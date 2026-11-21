import 'server-only';
import { expertise, technologyRows } from '@/content/home';
import { experience, profile } from '@/content/profile';
import { categories, projects } from '@/content/projects';
import type { Citation } from './protocol';
import graph from '../../../data/knowledge/graph.json';

export const topics = ['bio', 'education', 'experience', 'frontend', 'backend', 'ai', 'tools', 'projects', 'delivery', 'contact', 'coding', 'architecture'] as const;
export type Topic = (typeof topics)[number];
export type Document = {
  id: string; title: string; aliases: readonly string[]; topics: readonly Topic[]; facts: string; sources: Citation[];
  entities?: string[]; verification?: string;
  lookup?: { attribute: string; summary: string };
  summary?: string;
};

const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
const graphSources: Record<string, string> = graph.sources;
const claimEntities = new Map<string, Set<string>>();
for (const edge of graph.edges) {
  if (edge.relationship === 'SUPPORTED_BY') continue;
  const entities = claimEntities.get(edge.claim) ?? new Set<string>();
  entities.add(edge.from).add(edge.to);
  claimEntities.set(edge.claim, entities);
}
const reviewed: Document[] = graph.edges.flatMap((edge) => {
  if (!edge.text) return [];
  const subject = nodes.get(edge.from);
  const object = nodes.get(edge.to);
  return [{
    id: `reviewed-${edge.claim}`, title: object?.name ?? edge.claim,
    aliases: [...(edge.aliases ?? []), ...(subject?.kind === 'Person' ? [] : [subject?.name ?? '']), object?.name ?? ''].filter(Boolean),
    topics: edge.topics as Topic[],
    facts: edge.text, verification: edge.status, lookup: edge.lookup, summary: edge.summary,
    entities: [...(claimEntities.get(edge.claim) ?? [])],
    sources: edge.evidence.map(({ source, location }) => ({
      title: `${graphSources[source]} · ${location}`,
    })),
  }];
});
export const factDirectory = reviewed.flatMap(({ id, lookup }) => lookup ? [{ id, attribute: lookup.attribute }] : []);
export function getReviewedFact(id: string) {
  return reviewed.find((doc) => doc.id === id && doc.lookup);
}

const catalog = categories.flatMap((category) => projects[category]);
const projectNotes: Record<string, { aliases: string[]; topics: Topic[]; readme?: string }> = {
  TimeBoard: { aliases: ['time board', 'windows productivity tracker'], topics: ['frontend', 'delivery'], readme: 'The README describes Electron and React, active-window tracking, idle detection, local activity history, and CSV exports.' },
  KrishiTrackr: { aliases: ['krishi trackr', 'agrotech', 'agritrackr'], topics: ['frontend', 'backend', 'delivery'], readme: 'The AgroTech README identifies separate React frontend and Node.js/Express/MongoDB backend packages, with dashboard, table, and farm performance report views.' },
  SentinelX: { aliases: ['sentinel x', 'disaster insight dashboard'], topics: ['frontend', 'delivery'], readme: 'The public frontend repository documents its React, TypeScript, and Vite setup.' },
  'FinCognito.AI': { aliases: ['fincognito', 'fin cognito'], topics: ['frontend', 'backend', 'delivery'], readme: 'The repository describes an explainable financial intelligence platform.' },
  AgriRAG: { aliases: ['agri rag', 'agricultural rag assistant'], topics: ['ai', 'backend'], readme: 'Its README documents page-level document provenance, Qdrant vector retrieval, a Sentence Transformers embedder, and a Streamlit UI.' },
  'Telegram Grievance Bot': { aliases: ['telebot', 'telegram bot', 'grievance bot'], topics: ['ai', 'backend'] },
  'Focus Detection System': { aliases: ['focus detection', 'focusdetection'], topics: ['ai', 'frontend', 'backend'], readme: 'Its README describes webcam-based detection of attention and distractions alongside timed focus sessions.' },
};

export const publicPhone = '+91 8605221851';

const entityId = (kind: string, name: string) => `${kind}/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
const skillNames: Partial<Record<Topic, string>> = { frontend: 'Frontend engineering', backend: 'Backend engineering', ai: 'AI engineering' };
// These edges inherit their provenance from the matching portfolio project document.
const catalogLinks = catalog.flatMap((project, index) => {
  const from = entityId('project', project.name);
  const claim = `project-${index}`;
  nodes.set(from, { id: from, kind: 'Project', name: project.name });
  const technologies = project.stack.map((technology) => {
    const to = entityId('technology', technology);
    nodes.set(to, { id: to, kind: 'Technology', name: technology });
    return { from, to, relationship: 'USES_TECHNOLOGY', claim };
  });
  const skills = (projectNotes[project.name]?.topics ?? []).flatMap((topic) => {
    const name = skillNames[topic];
    if (!name) return [];
    const to = entityId('skill', name);
    nodes.set(to, { id: to, kind: 'Skill', name });
    return [{ from, to, relationship: 'DEMONSTRATES_SKILL', claim }];
  });
  return [...technologies, ...skills];
});
const retrievalEdges = [...graph.edges, ...catalogLinks];
const semanticSeeds: Partial<Record<Topic, string[]>> = {
  coding: ['data structures and algorithms', 'application development'],
  backend: ['backend engineering'],
  frontend: ['frontend engineering'],
  architecture: ['engineering process'],
};

// Only these fields are indexed. The project catalog's demo credentials are deliberately excluded.
export const documents: readonly Document[] = [
  {
    id: 'bio', title: 'Ninad Patil — biography', aliases: ['who is ninad', 'biography', 'background', 'engineering journey', 'career interests', 'introduce ninad'],
    topics: ['bio'],
    facts: `${profile.bio} ${profile.work} He started exploring software during engineering and is interested in AI, machine learning, software engineering, product development, and developer tools.`,
    sources: [{ title: 'Ninad’s story', href: '/story#my-story' }],
  },
  {
    id: 'education', title: 'Education at VIIT Pune', aliases: ['education', 'viit', 'college', 'university', 'graduation', 'degree', 'gpa', 'cgpa', 'school'],
    topics: ['education'],
    facts: `Ninad studies B.Tech in ${profile.education.program} at Vishwakarma Institute of Information Technology (VIIT), Pune. The portfolio lists 2023–2027 with expected graduation in ${profile.education.expectedGraduation}.`,
    sources: [{ title: 'Education & beyond', href: '/story#education-beyond' }],
  },
  ...experience.map((entry, index): Document => ({
    id: `internship-${index}`, title: entry.organization, aliases: [entry.organization, 'internship experience', 'internships', 'worked at', 'professional experience', ...(index === 0 ? ['llm', 'llms', 'rag systems'] : [])],
    topics: index === 0 ? ['experience', 'backend', 'ai'] : ['experience', 'frontend', 'ai'],
    facts: `${entry.organization} — ${index === 0 ? 'Software Engineer internship, 2026' : 'internship, August to September 2025'}. ${entry.description} ${index === 0 ? 'The Story page lists Python, FastAPI, LangChain, Qdrant, local model deployment, structured outputs, and agent workflows among his experience.' : ''}`,
    sources: [{ title: 'Software Engineering & AI', href: '/story#software-engineering-ai' }],
  })),
  {
    id: 'projects', title: 'Project portfolio', aliases: ['what projects', 'projects built', 'portfolio projects', 'what has ninad built'],
    topics: ['projects'],
    facts: `The portfolio showcases ${catalog.map(({ name }) => name).join(', ')}. Ninad also documents Fieldora, an independent browser extension, in his Story.`,
    sources: [{ title: 'My Projects', href: '/#projects' }, { title: 'Independent products', href: '/story#independent-products' }],
  },
  ...catalog.map((project, index): Document => ({
    id: `project-${index}`, title: project.name, aliases: [project.name, ...(projectNotes[project.name]?.aliases ?? [])],
    entities: [entityId('project', project.name), ...project.stack.map((technology) => entityId('technology', technology))],
    summary: `${project.name} · ${project.description}`,
    topics: ['projects', 'coding', ...(projectNotes[project.name]?.topics ?? [])],
    facts: `${project.description} Stack: ${project.stack.join(', ')}. Highlights: ${project.highlights.join('; ')}. ${project.status ?? ''} ${projectNotes[project.name]?.readme ?? ''} ${project.demo ? `The portfolio links to a public ${project.name === 'TimeBoard' ? 'product website' : 'demo'}.` : ''}`,
    sources: [
      ...(project.repository ? [{ title: `${project.name} · GitHub`, href: project.repository }] : [{ title: 'My Projects', href: '/#projects' }]),
      ...(project.demo ? [{ title: `${project.name} · website`, href: project.demo }] : []),
    ],
  })),
  {
    id: 'fieldora', title: 'Fieldora', aliases: ['fieldora', 'form autofill', 'browser extension'],
    topics: ['frontend', 'projects'],
    facts: 'Fieldora is an independent browser extension for reducing repetitive form filling with local profile-based autofill. The Story page lists React, TypeScript, Vite, and Chrome Extension APIs, with dynamic form detection, intelligent field matching, React-controlled inputs, and custom dropdowns.',
    sources: [{ title: 'Fieldora · Independent products', href: '/story#independent-products' }],
  },
  {
    id: 'skills', title: 'Technical skills and tools', aliases: ['skills', 'technologies', 'tech stack', 'tools', 'what does ninad work with'],
    topics: ['frontend', 'backend', 'ai', 'tools'],
    facts: `${expertise.map(({ title, description }) => `${title}: ${description}`).join(' ')} Listed tools: ${technologyRows.flatMap(({ tools }) => tools.map(([name]) => name)).join(', ')}.`,
    sources: [{ title: 'Skills & Expertise', href: '/#home-expertise' }],
  },
  {
    id: 'delivery-evidence', title: 'Public releases and project limitations', aliases: ['production ready', 'production readiness', 'deployed', 'live demo', 'weaknesses', 'limitations', 'gaps'],
    topics: ['delivery'],
    facts: 'TimeBoard has a public product website and KrishiTrackr has a public demo. Some SentinelX services use mock implementations and its FastAPI backend is maintained separately. FinCognito.AI is documented as a locally tested demonstration with public deployment and licensing unresolved. These are project-level observations. The portfolio does not document independent certification of production readiness or measured production scale.',
    sources: [{ title: 'Project highlights and demos', href: '/#projects' }],
  },
  {
    id: 'contact', title: 'Public professional contact', aliases: ['contact', 'reach', 'linkedin', 'github profile', 'phone', 'email', 'connect'],
    topics: ['contact'],
    facts: `Ninad’s public portfolio lists LinkedIn, GitHub, and the professional contact phone ${publicPhone}. No contact email is listed in the portfolio’s contact section.`,
    sources: [
      { title: 'LinkedIn', href: 'https://www.linkedin.com/in/ninadpatil18/' },
      { title: 'GitHub', href: 'https://github.com/PatilNinad18' },
      { title: 'Let’s Connect', href: '/#contact' },
    ],
  },
  ...reviewed,
];

const common = new Set('a an and about are at be can could do does for good has have he his how i in is it me ninad of on patil the this to was were what when where which with would you your tell did development engineering'.split(' '));
const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
const phrase = (text: string) => ` ${words(text).join(' ')} `;
const tokens = (text: string) => new Set(words(text).filter((word) => word.length > 1 && !common.has(word)));
const index = documents.map((doc) => ({ doc, terms: tokens(`${doc.title} ${doc.aliases.join(' ')} ${doc.facts}`), aliases: doc.aliases.map(phrase) }));
const frequency = new Map<string, number>();
for (const { terms } of index) for (const term of terms) frequency.set(term, (frequency.get(term) ?? 0) + 1);

const projectIndex = index.filter(({ doc }) => doc.id.startsWith('project-') || doc.id === 'fieldora' || doc.id === 'reviewed-keyboard');
export const projectDirectory = projectIndex.map(({ doc }) => ({ id: doc.id, name: doc.title }));

export function mentionedProjects(text: string, includeAliases = false): string[] {
  const normalized = phrase(text);
  return projectIndex.flatMap(({ doc, aliases }) => {
    const matches = (includeAliases ? aliases : [phrase(doc.title)])
      .map((alias) => normalized.indexOf(alias)).filter((position) => position >= 0);
    return matches.length ? [{ id: doc.id, position: Math.min(...matches) }] : [];
  }).sort((a, b) => a.position - b.position).map(({ id }) => id);
}

export function retrieve(original: string, rewritten: string, subjectTopics: Topic[], projectIds: string[]): Document[] {
  const current = phrase(original);
  const rewrittenPhrase = phrase(rewritten);
  const query = tokens(`${original} ${rewritten}`);
  const projectNames = projectDirectory.filter(({ id }) => projectIds.includes(id)).map(({ name }) => phrase(name));
  const semanticEntities = subjectTopics.flatMap((topic) => semanticSeeds[topic] ?? []);
  const traversable = (id: string) => !id.startsWith('person/') && !id.startsWith('source/');
  const seeds = new Set([...nodes.values()].filter(({ id, name }) => traversable(id) && name.length >= 3
    && (current.includes(phrase(name)) || rewrittenPhrase.includes(phrase(name)) || projectNames.includes(phrase(name))
      || semanticEntities.includes(name.toLowerCase())))
    .map(({ id }) => id));
  const neighbors = new Set(seeds);
  for (const edge of retrievalEdges) {
    if (!traversable(edge.from) || !traversable(edge.to)) continue;
    if (seeds.has(edge.from)) neighbors.add(edge.to);
    if (seeds.has(edge.to)) neighbors.add(edge.from);
  }
  const ranked = index.map(({ doc, terms, aliases }) => {
    const matches = [...query].filter((term) => terms.has(term));
    const lexical = matches.reduce((sum, term) => sum + Math.log(1 + index.length / (frequency.get(term) ?? 1)), 0);
    const concepts = subjectTopics.filter((topic) => doc.topics.includes(topic)).length;
    return {
      doc,
      score: Math.min(9, lexical) + (concepts ? 4 + concepts : 0)
        + (aliases.some((alias) => current.includes(alias)) ? 7 : 0)
        + (projectIds.includes(doc.id) ? 30 : 0)
        + (doc.entities?.some((id) => seeds.has(id)) ? 7 : doc.entities?.some((id) => neighbors.has(id)) ? 3 : 0),
    };
  }).filter(({ score }) => score >= 2.7).sort((a, b) => b.score - a.score);

  // Reserve space for the strongest evidence for each part of a compound question.
  const selected = new Set<Document>(ranked.filter(({ doc }) => projectIds.includes(doc.id)).map(({ doc }) => doc));
  const linkedEvidence = ranked.find(({ doc }) => doc.id.startsWith('reviewed-') && doc.entities?.some((id) => seeds.has(id)));
  if (projectIds.length && linkedEvidence) selected.add(linkedEvidence.doc);
  if (!projectIds.length && subjectTopics.includes('coding')) {
    const practice = ranked.find(({ doc }) => doc.entities?.includes('skill/data-structures-and-algorithms'));
    if (practice) selected.add(practice.doc);
  }
  if (!projectIds.length && subjectTopics.some((topic) => ['coding', 'frontend', 'backend', 'ai'].includes(topic))) {
    const primaryTopics = subjectTopics.filter((topic) => !['coding', 'tools', 'experience'].includes(topic));
    const examples = ranked.filter(({ doc }) => doc.id.startsWith('project-')
      && (!primaryTopics.length || doc.topics.some((topic) => primaryTopics.includes(topic))));
    for (const { doc } of examples.slice(0, 2)) selected.add(doc);
  }
  for (const topic of subjectTopics) {
    const best = ranked.find(({ doc }) => doc.topics.includes(topic));
    if (best) selected.add(best.doc);
  }
  for (const { doc } of ranked) selected.add(doc);
  return [...selected].slice(0, 7);
}
