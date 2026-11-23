"""Gemini and durable, single-host request budgets."""

import json
import logging
import math
import os
import sqlite3
import time
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit

from langchain_openai import ChatOpenAI

from .corpus import ROOT

logger = logging.getLogger("uvicorn.error")


def positive_env(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value <= 0:
        raise ValueError(f"{name} must be positive")
    return value


class Store:
    # Model budgets are shared by ALL visitors: set them to your Gemini quota (see .env.example).
    def __init__(self, path: Path, visitor_limit=20, model_limits=((10, 60), (400, 86400))):
        self.path = path
        self.visitor_limit = visitor_limit
        self.model_limits = model_limits
        path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self.connect()) as db:
            db.executescript("""
                PRAGMA journal_mode = WAL;
                CREATE TABLE IF NOT EXISTS admission (bucket TEXT, timestamp REAL, expires REAL);
                CREATE INDEX IF NOT EXISTS admission_bucket ON admission(bucket, timestamp);
                CREATE INDEX IF NOT EXISTS admission_expiry ON admission(expires);
                CREATE TABLE IF NOT EXISTS cooldown (id INTEGER PRIMARY KEY, until REAL);
            """)

    @classmethod
    def from_env(cls):
        return cls(Path(os.getenv("NINAD_AI_PYTHON_SQLITE_PATH", str(ROOT / "data/runtime/assistant-python.sqlite"))),
                   visitor_limit=positive_env("NINAD_AI_VISITOR_LIMIT_PER_HOUR", 20),
                   model_limits=((positive_env("NINAD_AI_GEMINI_CALLS_PER_MINUTE", 10), 60),
                                 (positive_env("NINAD_AI_GEMINI_CALLS_PER_DAY", 400), 86400)))

    def connect(self):
        return sqlite3.connect(self.path, timeout=2)

    @contextmanager
    def transaction(self):
        db = sqlite3.connect(self.path, timeout=2, isolation_level=None)
        try:
            db.execute("BEGIN IMMEDIATE")
            yield db
            db.execute("COMMIT")
        except BaseException:
            try:
                db.execute("ROLLBACK")
            except sqlite3.Error:
                pass
            raise
        finally:
            db.close()

    def take(self, bucket, windows, now=None):
        now = time.time() if now is None else now
        with self.transaction() as db:
            db.execute("DELETE FROM admission WHERE expires <= ?", (now,))
            if bucket == "gemini":
                row = db.execute("SELECT until FROM cooldown WHERE id = 1").fetchone()
                if row and row[0] > now:
                    return math.ceil(row[0] - now)
            retry = 0
            for limit, window in windows:
                match = db.execute(
                    """SELECT timestamp FROM admission WHERE bucket = ? AND timestamp > ?
                       ORDER BY timestamp DESC LIMIT 1 OFFSET ?""",
                    (bucket, now - window, limit - 1),
                ).fetchone()
                if match:
                    retry = max(retry, math.ceil(match[0] + window - now))
            if retry:
                return retry
            db.execute("INSERT INTO admission VALUES (?, ?, ?)", (bucket, now, now + max(window for _, window in windows)))
            return 0

    def admit_visitor(self, visitor):
        return self.take("visitor:" + visitor, ((self.visitor_limit, 3600),))

    def admit_model(self):
        return self.take("gemini", self.model_limits)

    def defer_error(self, error):
        status = getattr(error, "status_code", None)
        retry = retry_delay(error)
        if not retry:
            retry = 60 if status == 429 else 10 if isinstance(error, TimeoutError) else 20
        with self.transaction() as db:
            db.execute("""INSERT INTO cooldown VALUES (1, ?)
                          ON CONFLICT(id) DO UPDATE SET until = MAX(cooldown.until, excluded.until)""", (time.time() + retry,))
        logger.warning("Gemini fallback status=%s error=%s retry_after=%s", status if isinstance(status, int) else "network-or-response",
                       type(error).__name__, retry)
        return retry


def retry_delay(error):
    response = getattr(error, "response", None)
    retry = 0
    if response is not None:
        value = response.headers.get("retry-after")
        if value:
            try:
                retry = int(value) if value.isdigit() else math.ceil((parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
            except (TypeError, ValueError, OverflowError):
                pass
    body = getattr(error, "body", None)
    for item in body if isinstance(body, list) else [body]:
        if not isinstance(item, dict):
            continue
        error_info = item.get("error", item)
        if not isinstance(error_info, dict):
            continue
        details = error_info.get("details")
        for detail in details if isinstance(details, list) else []:
            if isinstance(detail, dict) and str(detail.get("@type", "")).endswith("/google.rpc.RetryInfo"):
                delay = detail.get("retryDelay")
                if isinstance(delay, str) and delay.endswith("s"):
                    try:
                        retry = max(retry, math.ceil(float(delay[:-1])))
                    except (ValueError, OverflowError):
                        pass
    return max(0, min(86400, retry))


class Gemini:
    def __init__(self, key, model, url):
        endpoint = urlsplit(url)
        if not endpoint.hostname or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment or (
            endpoint.scheme != "https" and not (endpoint.scheme == "http" and endpoint.hostname in {"127.0.0.1", "localhost", "::1"})
        ):
            raise ValueError("Gemini endpoint must be HTTPS or loopback HTTP.")
        config = {"reasoning_effort": "minimal"} if model.startswith("gemini-3") else {}
        self.client = ChatOpenAI(api_key=key, model=model, base_url=url, max_retries=0,
                                 timeout=float(os.getenv("NINAD_AI_HTTP_TIMEOUT", "20")), max_tokens=1600, temperature=0.2,
                                 use_responses_api=False, stream_usage=True, **config)

    @classmethod
    def from_env(cls):
        key = os.getenv("NINAD_AI_API_KEY", "").strip()
        model = os.getenv("NINAD_AI_MODEL", "gemini-3.5-flash-lite")
        url = os.getenv("NINAD_AI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
        if not key:
            logger.warning("NINAD_AI_API_KEY is not set; every answer will use the deterministic fallback.")
            return None
        return cls(key, model, url)

    async def stream(self, system, groups):
        usage = None
        try:
            async for chunk in self.client.astream([("system", system), ("human", json.dumps(groups, ensure_ascii=False))]):
                if chunk.usage_metadata:
                    usage = chunk.usage_metadata
                content = chunk.content
                if isinstance(content, list):
                    content = "".join(item.get("text", "") if isinstance(item, dict) else str(item) for item in content)
                if isinstance(content, str) and content:
                    yield content
        finally:
            logger.info("Gemini generation calls=1 input_tokens=%s output_tokens=%s",
                        usage.get("input_tokens") if usage else None, usage.get("output_tokens") if usage else None)
