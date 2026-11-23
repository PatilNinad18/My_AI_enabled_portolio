"""FastAPI endpoint behind the existing Next.js assistant route."""

import asyncio
import hmac
import json
import logging
import os
import re
import sqlite3
import unicodedata
from contextlib import asynccontextmanager
from dataclasses import dataclass
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

from .answer import Trace, events
from .corpus import Corpus
from .service import Gemini, Store

logger = logging.getLogger("uvicorn.error")
CONFIGURE = object()
HEADERS = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Ninad-Backend": "fastapi"}
MAX_HISTORY = 4
QUESTION_LIMIT = 600
ANSWER_LIMIT = 1500


@dataclass
class Turn:
    question: str
    answer: str = ""


def clean(text, limit=QUESTION_LIMIT, truncate=False):
    """Normalise user text. History answers are truncated; questions longer than the limit are rejected."""
    if not isinstance(text, str) or len(text) > limit * 4:
        raise ValueError(f"Text must contain 1–{limit} characters.")
    text = " ".join("".join(char for char in unicodedata.normalize("NFKC", text)
                            if unicodedata.category(char) != "Cf").split())
    if truncate:
        text = text[:limit]
    if not text or len(text) > limit or any(unicodedata.category(char) in {"Cc", "Cs"} for char in text):
        raise ValueError("Enter a valid question.")
    return text


def create_app(*, corpus=None, store=None, model=CONFIGURE, secret=None):
    @asynccontextmanager
    async def lifespan(app):
        token = secret or os.getenv("NINAD_AI_BACKEND_TOKEN", "")
        if not re.fullmatch(r"[!-~]{32,}", token):
            raise RuntimeError("Configure a server-only NINAD_AI_BACKEND_TOKEN of at least 32 printable ASCII characters without spaces.")
        app.state.token = ("Bearer " + token).encode("ascii")
        app.state.corpus = corpus or Corpus()
        app.state.store = store or Store.from_env()
        app.state.model = Gemini.from_env() if model is CONFIGURE else model
        logger.info("Ninad AI ready: %d documents, model=%s", len(app.state.corpus.documents), "on" if app.state.model else "off")
        yield

    app = FastAPI(title="Ninad AI", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.exception_handler(Exception)
    async def unhandled(request: Request, error: Exception):
        logger.error("Unhandled %s on %s", type(error).__name__, request.url.path)
        return JSONResponse({"message": "The assistant is temporarily unavailable. Please try again shortly."},
                            status_code=500, headers=HEADERS)

    @app.get("/healthz")
    async def health():
        return JSONResponse({"status": "ok"}, headers=HEADERS)

    @app.post("/chat")
    async def chat(request: Request):
        request_id = uuid4().hex
        headers = {**HEADERS, "X-Request-ID": request_id}

        def fail(message, status, retry=None):
            return JSONResponse({"message": message}, status_code=status,
                                headers={**headers, **({"Retry-After": str(retry)} if retry else {})})

        if not hmac.compare_digest(request.headers.get("authorization", "").encode("utf-8"), app.state.token):
            return fail("Assistant proxy authentication failed.", 401)
        visitor = request.headers.get("x-ninad-visitor", "")
        if not re.fullmatch(r"[a-f0-9]{64}", visitor):
            return fail("Missing trusted visitor identity.", 403)
        if request.headers.get("content-type", "").split(";")[0].lower() != "application/json":
            return fail("Expected JSON.", 415)
        raw = bytearray()
        try:
            async for part in request.stream():
                raw.extend(part)
                if len(raw) > 65536:
                    return fail("The request is too large.", 413)
            data = json.loads(raw)
            if not isinstance(data, dict):
                raise ValueError("Invalid conversation payload.")
            history_items = data.get("history") or []
            if not isinstance(history_items, list):
                raise ValueError("Invalid conversation payload.")
            question = clean(data.get("question"))
            history = []
            # Only the most recent turns matter for reference resolution; older ones are dropped, not rejected.
            for item in history_items[-MAX_HISTORY:]:
                if not isinstance(item, dict):
                    raise ValueError("Invalid conversation turn.")
                answer = item.get("answer")
                history.append(Turn(clean(item.get("question")),
                                    clean(answer, ANSWER_LIMIT, truncate=True) if isinstance(answer, str) and answer.strip() else ""))
        except (ValueError, UnicodeError):
            return fail("Enter a valid question and conversation history.", 400)
        try:
            retry = await asyncio.to_thread(app.state.store.admit_visitor, visitor)
        except sqlite3.Error:
            return fail("The assistant is temporarily unavailable. Please try again shortly.", 503, 30)
        if retry:
            logger.info("Assistant request=%s source=rate-limit gemini_calls=0 cache=disabled", request_id)
            return fail(f"You’ve reached the hourly question limit. Try again in about {(retry + 59) // 60} minutes.", 429, retry)

        async def stream():
            trace = Trace()

            def sse(event):
                return "data: " + json.dumps(event, ensure_ascii=False) + "\n\n"

            try:
                async for event in events(question, history, app.state.corpus, app.state.model, app.state.store, trace):
                    yield sse(event)
            except asyncio.CancelledError:
                trace.sources.add("cancelled")
                raise
            except Exception as error:
                trace.sources.add("error")
                logger.error("Assistant request %s failed (%s)", request_id, type(error).__name__)
                yield sse({"type": "error", "message": "The assistant couldn’t finish its response. Please try again."})
            finally:
                logger.info("Assistant request=%s source=%s gemini_calls=%d cache=disabled unverified_parts=%d",
                            request_id, "+".join(sorted(trace.sources)) or "none", trace.gemini_calls, trace.rejected_parts)
            yield sse({"type": "done"})

        return StreamingResponse(stream(), media_type="text/event-stream", headers={**headers, "X-Accel-Buffering": "no"})

    return app


app = create_app()
