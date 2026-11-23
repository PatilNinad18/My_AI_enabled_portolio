"""Approved evidence and local hybrid retrieval."""

import json
import logging
import os
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from langchain_core.documents import Document
from langchain_core.runnables import RunnableLambda
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

logger = logging.getLogger("uvicorn.error")

ROOT = Path(__file__).resolve().parents[1]
CONCEPTS = {
    "frontend": ("front end", "frontend", "client side", "user interface", "user interfaces", "web interface", "ui", "responsive", "react", "typescript", "next js", "browser"),
    "backend": ("back end", "backend", "api", "apis", "fastapi", "server side", "node js", "validation", "authentication", "database", "data layer"),
    "ai": ("ai", "ml", "rag", "llm", "llms", "retrieval augmented generation", "machine learning", "computer vision", "embeddings", "qdrant"),
    "ownership": ("product ownership", "own a project", "own a product", "independent", "end to end", "idea through implementation"),
    "leadership": ("leadership", "lead a team", "lead a software team", "manage developers", "mentoring", "workshops", "co organizing", "coordination"),
    "experience": ("intern", "interned", "internship", "internships", "professional experience", "work experience", "employment history", "worked at", "worked for", "worked before", "work previously", "previous roles", "prior roles", "past roles"),
    "growth": ("weakness", "weaknesses", "improve", "growth", "shortcomings", "still learning", "development priorities"),
    "delivery": ("production ready", "production readiness", "shipped", "deployed", "public demo", "production scale", "production experience"),
    "coding": ("good at coding", "coding", "programming", "dsa", "leetcode", "algorithms", "problem solving", "data structures"),
    "architecture": ("architecture", "debugging", "technical challenges", "design decisions", "implementation"),
    "education": ("studying", "university", "viit", "degree", "education", "graduation", "cgpa", "gpa"),
    "bio": ("who is", "background", "biography", "introduce", "career interests"),
    "contact": ("contact", "linkedin", "github profile", "phone number", "email"),
    "availability": ("join", "joining", "available", "availability", "notice period", "start date", "how soon", "start next", "start on", "start immediately"),
    "projects": ("projects", "portfolio", "built", "build", "project work"),
    "tools": ("skills", "tools", "technologies", "tech stack", "frameworks", "technical abilities", "programming languages"),
}

# Raw knowledge-base files (lower trust than the reviewed claims).
RAW_LABELS = {
    "personal-profile.md": "Personal Knowledge Profile",
    "engineering-perspective.md": "Engineering & Product-Building Perspective",
    "Ninad_Patil_Resume.pdf": "Full-Stack Resume",
    "Ninad_Patil_SDE.pdf": "SDE Resume",
    "Ninad_SDE_AI.pdf": "AI/ML Resume",
}
# Chunks that carry private contact data or content the reviewed graph marks as conflicting are never indexed.
SKIP_RAW = re.compile(
    r"[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s-]{8,}\d|\bhome address\b|\baddress\b|\bAgriTrackr\b|\bMQTT\b", re.I,
)


def phrase(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", text.casefold()))


def contains(text: str, term: str) -> bool:
    return bool(term) and f" {phrase(term)} " in f" {phrase(text)} "


def concepts(text: str) -> set[str]:
    return {topic for topic, aliases in CONCEPTS.items() if any(contains(text, alias) for alias in aliases)}


def expanded(text: str, topics=()) -> str:
    markers = concepts(text) | set(topics)
    return " ".join([text, *(("concept_" + item + " ") * 3 for item in sorted(markers))])


def read_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        logger.warning("pypdf is not installed; skipping %s (pip install pypdf)", path.name)
        return ""
    try:
        return "\n\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)
    except Exception as error:  # a damaged PDF must not stop the service starting
        logger.warning("Could not read %s (%s)", path.name, type(error).__name__)
        return ""


def split_block(block: str, size: int):
    if len(block) <= size:
        yield block
        return
    current = ""
    for sentence in re.split(r"(?<=[.!?])\s+", block):
        if current and len(current) + len(sentence) + 1 > size:
            yield current
            current = ""
        current = f"{current} {sentence}".strip()
    if current:
        yield current


def chunk_text(text: str, size: int = 700) -> list[str]:
    blocks = [b.strip() for b in re.split(r"\n\s*\n|\n(?=#{1,6}\s)", text) if b.strip()]
    chunks, current = [], ""
    for block in blocks:
        for piece in split_block(block, size):
            if current and len(current) + len(piece) + 2 > size:
                chunks.append(current)
                current = ""
            current = f"{current}\n{piece}".strip()
    if current:
        chunks.append(current)
    return chunks


@dataclass(frozen=True)
class Search:
    query: str
    topic: str | None = None
    projects: tuple[str, ...] = ()
    exclude: tuple[str, ...] = ()
    limit: int = 5


class Corpus:
    def __init__(self, directory: Path = ROOT / "data" / "knowledge", raw_sources: bool | None = None):
        graph = json.loads((directory / "graph.json").read_text(encoding="utf-8-sig"))
        if set(graph["sources"]) != {"personal", "engineering", "fullstack", "ai", "sde"}:
            raise ValueError("The reviewed graph must contain all five approved sources.")
        portfolio = json.loads((directory / "portfolio.json").read_text(encoding="utf-8-sig"))
        self.nodes = {node["id"]: node["name"] for node in graph["nodes"]}
        self.adjacent = defaultdict(set)
        entities = defaultdict(set)
        for edge in graph["edges"]:
            a, b = edge["from"], edge["to"]
            if edge["relationship"] != "SUPPORTED_BY":
                entities[edge["claim"]].update((a, b))
                # A shared reference to Ninad must not make all facts neighbors.
                if not (a.startswith("person/") or b.startswith("person/")):
                    self.adjacent[a].add(b)
                    self.adjacent[b].add(a)
        for edge in graph["edges"]:
            if not edge.get("text"):
                continue
            a, b = edge["from"], edge["to"]
            portfolio.append({
                "id": "reviewed-" + edge["claim"], "title": self.nodes[b], "facts": edge["text"],
                "aliases": [*edge.get("aliases", []), self.nodes[b], *([] if a.startswith("person/") else [self.nodes[a]])],
                "topics": edge.get("topics", []), "entities": sorted(entities[edge["claim"]]),
                "sources": [{"title": graph["sources"][source["source"]], **source} for source in edge["evidence"]],
            })
        if raw_sources is None:
            raw_sources = os.getenv("NINAD_AI_INDEX_RAW_SOURCES", "1") != "0"
        if raw_sources:
            portfolio.extend(self.raw_documents(directory))

        self.documents = [Document(id=item["id"], page_content=item["facts"],
                                   metadata={key: value for key, value in item.items() if key not in {"id", "facts"}})
                          for item in portfolio]
        self.by_id = {doc.id: doc for doc in self.documents}
        self.projects = [doc for doc in self.documents if doc.metadata.get("project") or doc.id == "fieldora"]
        self.employers = tuple(doc for doc in self.documents if doc.id.startswith("internship-"))
        self.technologies = sorted({tech for doc in self.projects for tech in doc.metadata.get("project", {}).get("stack", [])}
                                   | {"JavaScript", "TypeScript", "Next.js", "Docker", "Redis", "PostgreSQL", "Pydantic", "LangChain", "C++", "Vite"})
        for doc in self.projects:
            for entity in doc.metadata.get("entities", []):
                self.nodes.setdefault(entity, entity.split("/", 1)[-1].replace("-", " "))
            linked = doc.metadata.get("entities", [])
            if linked:
                self.adjacent[linked[0]].update(linked[1:])
                for entity in linked[1:]:
                    self.adjacent[entity].add(linked[0])
        texts = [" ".join([doc.metadata["title"], *doc.metadata["aliases"], doc.page_content]) for doc in self.documents]
        self._phrases = [f" {phrase(text)} " for text in texts]
        self.lexical = TfidfVectorizer(ngram_range=(1, 2), stop_words="english").fit(texts)
        self.keywords = self.lexical.transform(texts)
        semantic_texts = [expanded(text, doc.metadata["topics"]) for text, doc in zip(texts, self.documents)]
        self.concept_index = TfidfVectorizer(stop_words="english").fit(semantic_texts)
        matrix = self.concept_index.transform(semantic_texts)
        self.latent = TruncatedSVD(n_components=min(24, len(texts) - 1), random_state=12).fit(matrix)
        self.vectors = normalize(self.latent.transform(matrix))
        self.retriever = RunnableLambda(self.search)

    # ---- raw knowledge-base files -------------------------------------------------
    def raw_documents(self, directory: Path) -> list[dict]:
        items, seen = [], set()
        for folder in (directory, directory.parent / "sources", directory / "sources"):
            if not folder.is_dir():
                continue
            for path in sorted(folder.iterdir()):
                suffix = path.suffix.lower()
                if suffix not in {".md", ".txt", ".pdf"} or path.name in seen:
                    continue
                seen.add(path.name)
                text = read_pdf(path) if suffix == ".pdf" else path.read_text(encoding="utf-8-sig", errors="ignore")
                label = RAW_LABELS.get(path.name, path.stem.replace("_", " ").replace("-", " "))
                slug = re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-")
                kept = 0
                for number, chunk in enumerate(chunk_text(text), 1):
                    if len(chunk) < 60 or SKIP_RAW.search(chunk):
                        continue
                    kept += 1
                    items.append({
                        "id": f"source-{slug}-{number}", "title": f"{label} (excerpt {number})", "facts": chunk,
                        "aliases": [], "topics": sorted(concepts(chunk)) or ["general"], "sources": [], "raw": True,
                    })
                logger.info("Indexed %s: %d excerpts", path.name, kept)
        return items

    # ---- lookups -------------------------------------------------------------------
    def mentioned(self, term: str) -> bool:
        """True when any approved document names the term (so it is not an unknown technology)."""
        needle = f" {phrase(term)} "
        return needle.strip() != "" and any(needle in text for text in self._phrases)

    def employers_named(self, text: str) -> tuple[Document, ...]:
        return tuple(doc for doc in self.employers if contains(text, doc.metadata["title"])
                     or contains(text, doc.metadata["title"].split()[0]))

    def mentions(self, text: str) -> tuple[str, ...]:
        text = f" {phrase(text)} "
        hits = []
        for doc in self.projects:
            available = [f" {phrase(alias)} " for alias in [doc.metadata["title"], *doc.metadata["aliases"]]]
            positions = [text.index(alias) for alias in available if alias in text]
            if positions:
                hits.append((min(positions), doc.id))
        return tuple(id for _, id in sorted(hits))

    def search(self, request: Search) -> list[Document]:
        query_vector = self.lexical.transform([request.query])
        word_scores = (self.keywords @ query_vector.T).toarray().ravel()
        topic = request.topic
        semantic_query = self.concept_index.transform([expanded(request.query, (topic,) if topic else ())])
        semantic_scores = self.vectors @ normalize(self.latent.transform(semantic_query))[0]
        seeds = {id for id, label in self.nodes.items()
                 if len(label) >= 3 and not id.startswith(("person/", "source/")) and contains(request.query, label)}
        nearby = set().union(*(self.adjacent[id] for id in seeds)) if seeds else set()
        output = []
        for idx, doc in enumerate(self.documents):
            meta = doc.metadata
            if doc.id in request.exclude or doc.id in {"availability", "contact"} and doc.id != topic:
                continue
            if topic == "experience" and topic not in meta["topics"]:
                continue
            if doc.id in {"delivery-evidence", "reviewed-growth"} and topic not in meta["topics"]:
                continue
            if request.projects and doc.id not in request.projects:
                if not doc.id.startswith("reviewed-") or not any(
                    contains(doc.page_content + " " + " ".join(meta["aliases"]), self.by_id[id].metadata["title"])
                    for id in request.projects
                ):
                    continue
            relevant_topic = topic in meta["topics"]
            exact = doc.id in request.projects
            related = set(meta.get("entities", []))
            if not exact and not relevant_topic and word_scores[idx] < .11 and not related.intersection(seeds):
                continue
            score = (3 * exact + .52 * relevant_topic + .57 * word_scores[idx] + .43 * max(0, semantic_scores[idx])
                     + .16 * bool(seeds & related) + .07 * bool(nearby & related))
            if meta.get("raw"):
                score *= .85  # reviewed claims outrank raw excerpts
            output.append((score, idx))
        output.sort(key=lambda item: (-item[0], item[1]))
        return [self.documents[idx] for _, idx in output[:request.limit]]

    def public_links(self, documents):
        seen = set()
        for doc in documents:
            for source in doc.metadata.get("sources", []):
                href = source.get("href")
                if href and href not in seen:
                    seen.add(href)
                    yield {"title": source["title"].replace(" · GitHub", " on GitHub").replace(" · website", " website"), "href": href}
