import 'server-only';
import { expertise, technologyRows } from '@/content/home';
import { experience, profile } from '@/content/profile';
import { categories, projects } from '@/content/projects';
import type { Citation } from './protocol';
import type { Facet } from './query';
import graph from '../../../data/knowledge/graph.json';

export const topics = ['bio', 'education', 'experience', 'frontend', 'backend', 'ai', 'tools', 'projects', 'delivery', 'growth', 'contact', 'coding', 'architecture', 'availability'] as const;
export const availabilityNote = 'His start date and notice period aren’t confirmed in the portfolio, so you can ask him directly on LinkedIn.';
export type Topic = (typeof topics)[number];
export type Document = {
  id: string; title: string; aliases: readonly string[]; topics: readonly Topic[]; facts: string; sources: Citation[];
  entities?: string[]; verification?: string;
  limitations?: string;
  project?: { description: string; stack: readonly string[]; highlights: readonly string[] };
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
  const title = object?.name ?? edge.claim;
  return [{
    id: `reviewed-${edge.claim}`, title: subject && subject.kind !== 'Person' ? `${subject.name} — ${title}` : title,
    aliases: [...(edge.aliases ?? []), ...(subject?.kind === 'Person' ? [] : [subject?.name ?? '']), object?.name ?? ''].filter(Boolean),
    topics: edge.topics as Topic[],
    facts: edge.text, verification: edge.status,
    entities: [...(claimEntities.get(edge.claim) ?? [])],
    sources: edge.evidence.map(({ source, location }) => ({
      title: `${graphSources[source]} · ${location}`,
    })),
  }];
});
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
  coding: ['skill/data-structures-and-algorithms', 'skill/application-development', 'technicalchallenge/debugging-across-components'],
  frontend: ['skill/frontend-engineering'],
  backend: ['skill/backend-engineering', 'role/software-engineer-intern'],
  ai: ['skill/ai-engineering', 'technicalchallenge/document-and-model-workflows'],
  architecture: ['architecturedecision/engineering-process'],
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
    entities: [entityId('company', entry.organization)],
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
    topics: ['projects', 'coding', ...(projectNotes[project.name]?.topics ?? [])],
    facts: `${project.description} Stack: ${project.stack.join(', ')}. Highlights: ${project.highlights.join('; ')}. ${projectNotes[project.name]?.readme ?? ''} ${project.demo ? `The portfolio links to a public ${project.name === 'TimeBoard' ? 'product website' : 'demo'}.` : ''}`,
    project: { description: project.description, stack: project.stack, highlights: project.highlights },
    limitations: project.status,
    sources: [
      ...(project.repository ? [{ title: `${project.name} · GitHub`, href: project.repository }] : [{ title: 'My Projects', href: '/#projects' }]),
      ...(project.demo ? [{ title: `${project.name} · website`, href: project.demo }] : []),
    ],
  })),
  {
    id: 'fieldora', title: 'Fieldora', aliases: ['fieldora', 'form autofill', 'browser extension'],
    topics: ['frontend', 'projects', 'coding'],
    entities: ['product/fieldora', 'skill/frontend-engineering'],
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
    id: 'delivery-evidence', title: 'Public releases and project limitations', aliases: ['production ready', 'production readiness', 'deployed', 'live demo', 'production scale'],
    topics: ['delivery'],
    facts: 'TimeBoard has a public product website and KrishiTrackr has a public demo. Some SentinelX services use mock implementations and its FastAPI backend is maintained separately. FinCognito.AI is documented as a locally tested demonstration with public deployment and licensing unresolved. These are project-level observations. The portfolio does not document independent certification of production readiness or measured production scale.',
    sources: [{ title: 'Project highlights and demos', href: '/#projects' }],
  },
  {
    id: 'availability', title: 'Joining availability', aliases: ['joining date', 'notice period', 'availability'],
    topics: ['availability'], facts: availabilityNote,
    sources: [{ title: 'LinkedIn', href: 'https://www.linkedin.com/in/ninadpatil18/' }],
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

const common = new Set('a an and about are at be can could do does for from good has have he him his how i in is it me ninad of on or patil the this to was were what when where which with would you your tell did assess demonstrated based using experience development engineering'.split(' '));
const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
const phrase = (text: string) => ` ${words(text).join(' ')} `;
const tokens = (text: string) => new Set(words(text).filter((word) => word.length > 1 && !common.has(word)));
const technologies = [...new Set([
  ...technologyRows.flatMap(({ tools }) => tools.map(([name]) => name)),
  ...catalog.flatMap(({ stack }) => stack),
  'C++', 'Docker', 'PostgreSQL', 'Redis', 'Pydantic', 'LangChain',
])];

export function mentionedTechnologies(text: string) {
  const normalized = phrase(text);
  const matches = technologies.filter((name) => name === 'C++' ? /\bC\+\+(?!\w)/i.test(text) : normalized.includes(phrase(name)));
  return matches.filter((name) => !matches.some((other) => other.length > name.length && phrase(other).includes(phrase(name))));
}

const index = documents.map((doc) => ({
  doc,
  terms: tokens(doc.facts),
  headings: tokens(`${doc.title} ${doc.aliases.join(' ')}`),
  aliases: doc.aliases.map(phrase),
}));
const frequency = new Map<string, number>();
for (const { terms, headings } of index) {
  for (const term of new Set([...terms, ...headings])) frequency.set(term, (frequency.get(term) ?? 0) + 1);
}

const isProject = ({ id }: Document) => id.startsWith('project-') || id === 'fieldora' || id === 'reviewed-keyboard';
const projectIndex = index.filter(({ doc }) => isProject(doc));
export const projectDirectory = projectIndex.map(({ doc }) => ({ id: doc.id, name: doc.title }));

export function mentionedProjects(text: string, includeAliases = false): string[] {
  const normalized = phrase(text);
  return projectIndex.flatMap(({ doc, aliases }) => {
    const matches = (includeAliases && !doc.id.startsWith('reviewed-') ? aliases : [phrase(doc.title)])
      .map((alias) => normalized.indexOf(alias)).filter((position) => position >= 0);
    return matches.length ? [{ id: doc.id, position: Math.min(...matches) }] : [];
  }).sort((a, b) => a.position - b.position).map(({ id }) => id);
}

const subjectOf = (doc: Document) =>
  doc.entities?.find((id) => /^(?:project|product|company)\//.test(id))?.replace(/^(?:project|product)\//, 'product/') ?? doc.id;
const isWork = ({ topics: tags }: Document) => tags.includes('experience');

export function retrieve({ query, topic, projects: projectIds, goal }: Facet): Document[] {
  if (topic === 'availability') return documents.filter((doc) => doc.id === 'availability');
  const normalized = phrase(query);
  const queryTerms = [...tokens(query)].filter((term) => frequency.has(term));
  const namedSubjects = new Set(projectDirectory.filter(({ id }) => projectIds.includes(id)).map(({ name }) => phrase(name)));
  const explicitEntities = new Set([...nodes.values()].filter(({ id, name }) =>
    !/^(?:person|source)\//.test(id) && name.length >= 3 && (normalized.includes(phrase(name)) || namedSubjects.has(phrase(name)))
  ).map(({ id }) => id));
  const semantic = new Set(semanticSeeds[topic]);
  const seeds = new Set([...explicitEntities, ...semantic]);
  const neighbors = new Set(seeds);
  for (const edge of retrievalEdges) {
    if (/^(?:person|source)\//.test(edge.from) || /^(?:person|source)\//.test(edge.to)) continue;
    if (seeds.has(edge.from)) neighbors.add(edge.to);
    if (seeds.has(edge.to)) neighbors.add(edge.from);
  }
  const seekingLimits = goal === 'limitations' || topic === 'delivery';
  const ranked = index.flatMap(({ doc, terms, headings, aliases }) => {
    if (doc.id === 'availability' || (doc.id === 'delivery-evidence' && topic !== 'delivery')
      || (doc.id === 'reviewed-growth' && topic !== 'growth')) return [];
    if (goal === 'example' && !isProject(doc)) return [];
    const named = projectIds.includes(doc.id);
    const directEntity = doc.entities?.some((id) => explicitEntities.has(id));
    const matchesTopic = doc.topics.includes(topic);
    const strongAlias = aliases.some((alias) => normalized.includes(alias));
    if (!named && !directEntity && !matchesTopic && !strongAlias) return [];
    if (projectIds.length && !named && !doc.entities?.some((id) =>
      explicitEntities.has(id) && namedSubjects.has(phrase(nodes.get(id)?.name ?? ''))
    )) return [];

    const lexical = queryTerms.reduce((sum, term) => {
      const weight = Math.log(1 + index.length / frequency.get(term)!);
      return sum + (headings.has(term) ? 1.5 * weight : terms.has(term) ? 0.65 * weight : 0);
    }, 0);
    const score = (named ? 30 : 0) + (strongAlias ? 6 : 0) + (directEntity ? 6 : 0)
      + (matchesTopic ? 6 : 0) + (doc.entities?.some((id) => semantic.has(id)) ? 5 : 0)
      + (doc.entities?.some((id) => neighbors.has(id)) ? 1.5 : 0) + Math.min(12, lexical);
    return [{ doc, score }];
  }).sort((a, b) => b.score - a.score);

  const selected = new Map<string, Document>();
  const usedSubjects = new Set<string>();
  function select(candidates: typeof ranked, count: number, allowSameSubject = false) {
    for (const candidate of candidates) {
      if (!count || selected.size >= 7) break;
      const { doc } = candidate;
      const subject = subjectOf(doc);
      if (selected.has(doc.id) || (!allowSameSubject && usedSubjects.has(subject))) continue;
      usedSubjects.add(subject);
      selected.set(doc.id, seekingLimits && doc.limitations ? { ...doc, facts: `${doc.facts} ${doc.limitations}` } : doc);
      count--;
    }
  }

  if (projectIds.length) {
    select(ranked.filter(({ doc }) => projectIds.includes(doc.id)), projectIds.length);
    select(ranked, 7, true);
  } else if (goal === 'assessment') {
    const practical = ranked.filter(({ doc }) => isProject(doc) && doc.topics.includes(topic));
    const appliedWork = ranked.filter(({ doc }) => isWork(doc) && doc.topics.includes(topic));
    const directSkills = ranked.filter(({ doc }) => !isProject(doc) && doc.entities?.some((id) => semantic.has(id))
      && (topic !== 'coding' || !doc.entities?.some((id) => /^(?:project|product)\//.test(id))));
    select(directSkills, topic === 'coding' ? 3 : 2);
    select(appliedWork, 2);
    select(practical, 3);
    // Hiring and general coding need concrete evidence beyond the job titles or skills list.
    if (topic === 'experience') {
      const supportingProjects = index.filter(({ doc }) => isProject(doc) && doc.topics.includes('coding'));
      select(supportingProjects.map(({ doc }) => ({ doc, score: 0 })), 2);
    }
    select(ranked, 7);
  } else {
    select(ranked.filter(({ doc }) => doc.id.startsWith('reviewed-') && doc.entities?.some((id) =>
      explicitEntities.has(id) && id.startsWith('company/')
    )), 3, true);
    select(ranked, 7);
  }
  return [...selected.values()].filter((doc, index, all) => all.findIndex((item) => item.facts === doc.facts) === index);
}
