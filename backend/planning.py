"""Locally resolve the subject and independently answerable parts."""

import re
from dataclasses import dataclass, replace

from .corpus import Corpus, concepts, contains, phrase

INJECTION = re.compile(r"\b(?:ignore|disregard|override|bypass|forget)\b.{0,60}\b(?:instructions?|rules?|guardrails?|prompt|above|previous)\b|\b(?:system prompt|developer message|hidden instructions|jailbreak|roleplay|base64)\b|\[/?INST\]|<\|", re.I)
PRIVATE = re.compile(r"\b(?:passwords?|api keys?|credentials?|home address|private (?:phone|email|information)|personal (?:email|address)|salary|family members?|medical records?)\b", re.I)
UNRELATED = re.compile(r"^(?:(?:please|can you|could you|would you)\s+)*(?:write|solve|implement|generate|debug|draft)\b|\b(?:for me|from scratch)\b|\b(?:capital of|weather in|history of|general knowledge)\b", re.I)
PERSON = re.compile(r"\b(?:ninad|patil|he|his|him)\b", re.I)
PROJECT_REFERENCE = re.compile(r"\b(?:that project|the project|its (?:stack|architecture|data|storage|features|design)|(?:does|did|can|how does) it (?:work|use|do|handle|win|track|detect|store|save|record|support|collect|run|export|report)|he (?:build it|use)|(?:stack|technologies)\s+(?:did|does))\b", re.I)
ORDINALS = ("first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth")
ORDINAL = re.compile(r"\b(" + "|".join(ORDINALS) + r")\s+(?:one|project)\b", re.I)
CONTINUATION = re.compile(r"^(?:and\b|(?:what|how) about\b)|\b(?:it|that (?:project|framework|stack|one)|which project|what technologies)\b", re.I)
SPLIT = re.compile(r"\?+\s*|;\s*|,?\s+(?:and|also|but)\s+(?=(?:why|what|who|where|when|how|can|could|would|did|does|is|tell|solve|write|explain|private|personal|home address|salary)\b)", re.I)
FAMILIES = {
    "frontend": ("AngularJS", "Angular", "Vue.js", "Vue", "SvelteKit", "Svelte", "Nuxt", "SolidJS", "React", "Next.js", "TypeScript", "Vite", "Redux", "GSAP", "Three.js"),
    "mobile": ("React Native", "Flutter", "Expo", "Kotlin", "SwiftUI", "Ionic"),
    "backend": ("FastAPI", "Django", "Flask", "Spring Boot", "ASP.NET Core", "Rails", "Laravel", "NestJS", "Express", "Node.js", "Golang", "Python", "Rust", "Java", "PHP", "Ruby", "GraphQL", "Kafka", "gRPC"),
    "infrastructure": ("Kubernetes", "Terraform", "AWS", "Azure", "Docker", "Google Cloud", "Helm", "Linux", "Nginx", "GitHub Actions"),
    "ai": ("PyTorch", "TensorFlow", "Keras", "JAX", "OpenCV", "Qdrant", "LangChain", "Hugging Face", "Ollama", "LlamaIndex"),
}
TECH_INTENT = re.compile(r"\b(?:handle|experience (?:with|in)|worked with|work with|using|used?|learn|pick up|ramp up on|maintain|requires?|knows?|familiar with|stack|proficien\w*|skilled|good at|comfortable|qualified)\b", re.I)
TECH_TARGET = re.compile(r"\b(?:handle|experience (?:with|in)|worked with|work with|using|used?|learn|pick up|ramp up on|maintain|requires?|knows?|familiar with)\s+(.+?)(?=\s+(?:for|as|before|with|that|in|who|and (?:lead|manage|mentor|own|start))\b|$)", re.I)
NOT_TECH = {
    "frontend", "backend", "another", "unfamiliar", "framework", "tool", "coding", "team", "project", "role", "product",
    "production", "software", "forms", "portfolio", "applications", "there", "here", "them", "him", "her", "his", "that",
    "those", "this", "these", "which", "what", "how", "why", "ninad", "patil", "startup", "company", "everything",
    "anything", "something", "experience", "internship", "internships", "skills", "work", "technologies", "technology",
}
LEADERSHIP = re.compile(r"\b(?:leadership|team lead|people management|(?:lead(?:ing)?|led)\s+(?:(?:a|an|our|the|small|software|engineering)\s+){0,4}(?:teams?|engineers|developers)|(?:manag(?:e|ed|es|ing)|mentor(?:ed|ing)?|coach(?:ed|ing)?|supervis(?:e|ed|ing))\s+(?:developers|engineers|people|a team))\b", re.I)
OWNERSHIP = re.compile(r"\b(?:(?:product|project|delivery) ownership|own(?:ed|ing)?\s+(?:(?:a|the|our)\s+)?(?:project|product|delivery))\b", re.I)
ASSESS = re.compile(r"\b(?:hire|hired|hiring|fit|suitable|senior|staff engineer|day[- ]one|qualifi\w*|strengths|would you trust|our (?:startup|team|company)|work for us|join (?:us|our))\b", re.I)
EMPLOYMENT_REFERENCE = re.compile(r"\b(?:there|that (?:role|company|internship|experience|work|job)|those (?:roles|internships))\b", re.I)
ROLE_DUTIES = re.compile(r"\b(?:what (?:kind of )?work|work(?:ed)? on|responsibilit\w*|technolog\w*|tools?|stack|frameworks?|languages?|(?:he|ninad) (?:do|did|build|built|learn|contribut\w*)|use[ds]?)\b", re.I)


@dataclass(frozen=True)
class Facet:
    topic: str
    question: str
    projects: tuple[str, ...] = ()
    target: str | None = None
    area: str | None = None
    detail: bool = False


@dataclass(frozen=True)
class Plan:
    facets: tuple[Facet, ...]
    outside: bool = False
    context: tuple[str, ...] = ()


def technologies(text: str, corpus: Corpus) -> list[tuple[str, str | None, bool]]:
    family = {name: area for area, names in FAMILIES.items() for name in names}
    names = sorted(set(family) | set(corpus.technologies), key=lambda name: (-len(name), name))
    hits = []
    for name in names:
        if name == "AI":
            continue
        if name == "C++":
            match = re.search(r"\bC\+\+", text, re.I)
        else:
            pattern = r"[ .-]+".join(re.escape(part) for part in name.replace(".", " ").split())
            match = re.search(rf"(?<!\w){pattern}(?!\w)", text, re.I)
        if match and not any(match.start() < end and start < match.end() for start, end, *_ in hits):
            known = name in corpus.technologies or corpus.mentioned(name)
            hits.append((match.start(), match.end(), name, family.get(name), known))
    suspect = TECH_TARGET.search(text)
    if suspect:
        for value in re.split(r"\s+and\s+|,\s*", suspect[1]):
            label = re.sub(r"^(?:a |an |the )?(?:(?:unfamiliar |new )?(?:framework|tool) (?:called|named) )?", "", value.strip(), flags=re.I)
            label = re.sub(r"\s+(?:framework|role|developer)$", "", label.strip(" .?"), flags=re.I)
            if not re.fullmatch(r"[A-Za-z][A-Za-z0-9.+#-]{2,29}", label):
                continue
            if label.casefold() in NOT_TECH:
                continue
            if any(contains(label, match[2]) for match in hits):
                continue
            area = next((item for item in ("frontend", "backend", "ai") if item in concepts(text)), None)
            hits.append((max(0, text.find(label)), max(0, text.find(label)) + len(label), label, area, corpus.mentioned(label)))
    return [(name, area, known) for _, _, name, area, known in sorted(hits)]


def project_reference(text, corpus, previous_projects):
    named = corpus.mentions(text)
    if named:
        return named
    ordinal = ORDINAL.search(text)
    if ordinal:
        index = ORDINALS.index(ordinal[1].lower())
        return previous_projects[index:index + 1]
    if len(previous_projects) == 1 and (PROJECT_REFERENCE.search(text) or re.fullmatch(
        r"(?:explain|describe|tell me (?:more )?about) (?:it|that|this)", text.strip(" .!?"), re.I
    )):
        return previous_projects
    return ()


def plan_question(question: str, history, corpus: Corpus) -> Plan:
    if INJECTION.search(question):
        return Plan((), True)
    # Treat previous answers solely as reference order, never as evidence.
    previous = None
    prior_projects = ()
    for turn in history[-4:]:
        if INJECTION.search(turn.question) or PRIVATE.search(turn.question) or UNRELATED.search(turn.question):
            continue
        resolved = project_reference(turn.question, corpus, prior_projects)
        topics = concepts(turn.question)
        if PERSON.search(turn.question) or resolved or previous and CONTINUATION.search(turn.question) and topics:
            previous = turn
            prior_projects = resolved
            if turn.answer:
                described = corpus.mentions(turn.answer)
                if len(resolved) > 1 and set(resolved).issubset(described):
                    prior_projects = tuple(id for id in described if id in resolved)
                elif not resolved and "projects" in topics:
                    prior_projects = described
    prior_tech = technologies(previous.question, corpus) if previous else []
    prior_topics = concepts(previous.question) if previous else set()
    prior_employers = tuple(doc.metadata["title"] for doc in corpus.employers_named(previous.question)) if previous else ()
    if prior_employers:
        prior_topics.add("experience")
    parts = []
    outside = False
    contextual = False
    for raw in SPLIT.split(question):
        part = raw.strip(" ,.!?\"'")
        if not phrase(part):
            continue
        if PRIVATE.search(part) or UNRELATED.search(part):
            outside = True
            continue
        refers_to_job = bool(EMPLOYMENT_REFERENCE.search(part))
        if refers_to_job and ROLE_DUTIES.search(part):
            experience = next((index for index in reversed(range(len(parts))) if parts[index].topic == "experience"), None)
            if experience is not None:
                earlier = parts[experience]
                parts[experience] = replace(earlier, question=f"{earlier.question}. {part}", detail=True)
                continue
            if previous and "experience" in prior_topics:
                resolved = f"{part} ({', '.join(prior_employers)})" if prior_employers else part
                parts.append(Facet("experience", resolved, detail=True))
                contextual = True
                continue
        # Pass a referenced employer ("that experience", "there") along to later facets.
        scoped = f"{part} ({', '.join(prior_employers)})" if refers_to_job and prior_employers else part
        projects_in_request = next((facet.projects for facet in reversed(parts) if facet.projects), prior_projects)
        targets = project_reference(part, corpus, projects_in_request)
        tags = concepts(part)
        person = bool(PERSON.search(part))
        continuation = bool((previous or parts) and (CONTINUATION.search(part) or ORDINAL.search(part)
                            or parts and re.match(r"(?:would|could|can|what|which|how|when|where|did|does|is)\b", part, re.I)))
        detailed = bool(re.search(r"\b(?:how|architecture|trade[- ]?offs?|compare|different|details|stack|technologies)\b", part, re.I))
        if re.search(r"\b(?:awards?|prizes?|citizenship|certification)\b", part, re.I) and (person or targets or parts):
            parts.append(Facet("unknown", part, target="that achievement or qualification"))
            continue
        if targets:
            parts.append(Facet("projects", part, targets, detail=detailed))
            contextual |= not bool(corpus.mentions(part))
            continue
        if not person and not continuation and not (
            re.fullmatch(r"(?:contact|skills|internships|projects|education|portfolio)", part, re.I)
        ):
            outside = True
            continue
        if contains(part, "SmartLeaven") and re.search(r"\b(?:when|start|joined|month|date)\b", part, re.I):
            parts.append(Facet("start-month", part))
            continue
        if re.search(r"\b(?:CGPA|GPA|grade point)\b", part, re.I):
            parts.append(Facet("grades", part))
            continue
        if re.search(r"\bworked (?:at|for)\b", part, re.I) and not any(contains(part, item) for item in ("SmartLeaven", "BlockSeBlock")):
            parts.append(Facet("unknown", part, target="that employment history"))
            continue
        if re.search(r"\bwhich project\b.*\b(?:that|proves|demonstrates|shows)\b", part, re.I) and previous:
            topic = next((item for item in ("backend", "frontend", "ai", "ownership") if item in prior_topics), "projects")
            parts.append(Facet("example", part, area=topic))
            contextual = True
            continue
        names = technologies(part, corpus) if TECH_INTENT.search(part) or ASSESS.search(part) or continuation else []
        if not names and continuation and len(prior_tech) == 1 and re.search(r"\b(?:learn|ramp up|pick up|work with|use|ready for)\b", part, re.I):
            names = prior_tech
        count = len(parts)
        if "experience" in tags and not names and not re.search(r"\b(?:for an?\b.*?internship|as an?\b.*?intern|an?\b.*?internship role)\b", part, re.I):
            parts.append(Facet("experience", part, detail=detailed))
            if "tools" in tags:
                parts.append(Facet("tools", part))
        if len(names) >= 2:
            # One combined answer with an overall verdict instead of separate paragraphs.
            parts.append(Facet("stackfit", scoped, target=", ".join(name for name, _, _ in names[:5])))
        else:
            for name, area, known in names:
                parts.append(Facet("technology" if known else "transfer", scoped, target=name, area=area))
        if not names and re.search(r"\b(?:another|different|new|unfamiliar)\s+(?:(?:front|back)[- ]?end\s+)?(?:framework|stack|technology)\b", part, re.I):
            area = next((item for item in ("frontend", "backend", "ai") if item in tags), None)
            parts.append(Facet("transfer", scoped, area=area))
        if LEADERSHIP.search(part):
            parts.append(Facet("leadership", part))
        if OWNERSHIP.search(part):
            parts.append(Facet("ownership", part))
        if "availability" in tags:
            parts.append(Facet("availability", part))
        if "growth" in tags:
            parts.append(Facet("growth", part))
        if re.search(r"\bstrengths?\b", part, re.I) or ASSESS.search(part) and (
            len(parts) == count or re.search(r"\b(?:senior|staff engineer|day[- ]one|immediately)\b", part, re.I)
        ):
            area = next((item for item in ("frontend", "backend", "ai") if item in tags), None)
            parts.append(Facet("fit", part, area=area))
        if len(parts) > count:
            contextual |= (continuation and previous is not None) or (refers_to_job and bool(prior_employers))
            continue
        for employer in ("SmartLeaven", "BlockSeBlock"):
            if contains(part, employer):
                parts.append(Facet("experience", part))
                break
        else:
            topic = next((item for item in ("delivery", "education", "contact", "bio", "coding", "architecture", "frontend", "backend", "ai", "experience", "tools", "projects") if item in tags), None)
            if topic:
                parts.append(Facet(topic, part, detail=detailed))
                contextual |= continuation and previous is not None
            elif person or ORDINAL.search(part):
                parts.append(Facet("unknown", part))
            else:
                outside = True
    unique = {}
    for part in parts:
        unique.setdefault((part.topic, part.projects, part.target, part.area), part)
    # Joining details should follow the evidence for role suitability.
    context = ()
    if contextual:
        context = tuple(corpus.by_id[id].metadata["title"] for id in prior_projects) + tuple(sorted(prior_topics))
    return Plan(tuple(sorted(unique.values(), key=lambda part: part.topic == "availability")), outside, context)
