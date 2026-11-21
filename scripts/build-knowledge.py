"""Compile reviewed professional facts against locally supplied documents."""

import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "knowledge"
PRIVATE = ROOT / "private"


def normalized(text):
    return " ".join(text.casefold().split())


def extract(path, cached):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if cached and cached["sha256"] == digest:
        return cached
    if path.suffix.lower() == ".pdf":
        from pypdf import PdfReader

        parts = [(f"p. {i}", page.extract_text()) for i, page in enumerate(PdfReader(path).pages, 1)]
    elif path.suffix.lower() in {".txt", ".md", ".markdown"}:
        parts = [("lines 1–" + str(len(text.splitlines())), text)] if (text := path.read_text(encoding="utf-8-sig")) else []
        if path.suffix.lower() != ".txt":
            parts = []
            heading = "Introduction"
            for line in text.splitlines():
                if re.match(r"^#{1,6}\s", line):
                    heading = line.lstrip("# ").strip()
                    parts.append((heading, line))
                elif parts:
                    title, passage = parts[-1]
                    parts[-1] = (title, passage + "\n" + line)
                else:
                    parts.append((heading, line))
    else:
        raise ValueError(f"Unsupported document format: {path.name}")
    return {"sha256": digest, "parts": parts}


def build():
    review = json.loads((ROOT / "reviewed.json").read_text(encoding="utf-8-sig"))
    cache_path = PRIVATE / ".index-cache.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    extracted = {}
    for source, info in review["sources"].items():
        path = PRIVATE / info["file"]
        if not path.is_file():
            print(f"Missing: {info['file']}")
            continue
        extracted[source] = extract(path, cache.get(source))
        if not any(passage.strip() for _, passage in extracted[source]["parts"]):
            raise ValueError(f"No extractable text in {path.name}")
    if not extracted:
        raise ValueError("No source files are available; the last graph was preserved.")

    nodes = {}
    edges = []
    ids = set()
    statements = set()
    skipped = 0

    def entity(kind, name):
        node_id = kind.lower() + "/" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        nodes[node_id] = {"id": node_id, "kind": kind, "name": name}
        return node_id

    for claim in review["claims"]:
        claim_id, text = claim["id"], claim["text"]
        if claim_id in ids or normalized(text) in statements:
            raise ValueError(f"Duplicate reviewed claim: {claim_id}")
        ids.add(claim_id)
        statements.add(normalized(text))
        evidence = []
        for source, anchor in claim["refs"]:
            if source not in extracted:
                continue
            passages = extracted[source]["parts"]
            match = next((location for location, passage in passages if normalized(anchor) in normalized(passage)), None)
            if not match:
                raise ValueError(f"Missing reviewed passage for {claim_id} in {source}")
            evidence.append({"source": source, "location": match})
        if not evidence:
            skipped += 1
            continue
        lookup = claim.get("lookup")
        summary = claim.get("summary")
        public_text = " ".join(part for part in (text, summary, lookup["summary"] if lookup else None) if part)
        if re.search(r"https?://|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+\d[\d -]{8,}|api.key|password", public_text, re.I):
            raise ValueError(f"Private or unreviewed link content in {claim_id}")

        subject, obj = entity(*claim["from"]), entity(*claim["to"])
        for item in evidence:
            node_id = "source/" + item["source"]
            nodes[node_id] = {"id": node_id, "kind": "EvidenceSource", "name": review["sources"][item["source"]]["title"]}
            edges.append({"from": obj, "to": node_id, "relationship": "SUPPORTED_BY", "claim": claim_id, "evidence": [item]})
        provenance = {"claim": claim_id, "evidence": evidence, "status": "self-reported", "date": claim.get("date")}
        edges.append({
            "from": subject, "to": obj, "relationship": claim["relation"],
            "topics": claim["topics"], "aliases": claim.get("aliases", []), "text": text, **provenance,
            **({"lookup": lookup} if lookup else {}),
            **({"summary": summary} if summary else {}),
        })
        for start, relation, end in claim.get("links", []):
            edges.append({"from": entity(*start), "to": entity(*end), "relationship": relation, **provenance})

    conflicts = []
    for item in review["conflicts"]:
        available = {source: value for source, value in item["values"].items() if source in extracted or source == "portfolio"}
        if len(set(available.values())) > 1:
            conflicts.append({**item, "values": available})
    graph = {"sources": {key: review["sources"][key]["title"] for key in extracted}, "nodes": list(nodes.values()),
             "edges": edges, "conflicts": conflicts}
    cache_path.write_text(json.dumps(extracted, ensure_ascii=False), encoding="utf-8")
    return json.dumps(graph, ensure_ascii=False, indent=2) + "\n", len(extracted), len(ids) - skipped, len(conflicts)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="check that the committed graph matches the reviewed sources")
    args = parser.parse_args()
    output, sources, claims, conflicts = build()
    target = ROOT / "graph.json"
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != output:
            raise SystemExit("Graph is stale. Rebuild it after reviewing the source changes.")
    else:
        target.write_text(output, encoding="utf-8")
    print(f"{sources} source files, {claims} reviewed claims, {conflicts} recorded discrepancies.")
