import { documents, publicPhone, retrieve, type Document } from './knowledge';
import type { Citation } from './protocol';
import type { Facet } from './query';

export type Reply = { text: string; sources: Citation[] };
const byId = new Map(documents.map((doc) => [doc.id, doc]));
const find = (id: string) => byId.get(id)!;
const from = (doc: Document, text = doc.facts): Reply => ({ text, sources: doc.sources });
const combine = (...replies: Reply[]): Reply => ({
  text: replies.map(({ text }) => text).join(' '),
  sources: replies.flatMap(({ sources }) => sources),
});

function projectReply(doc: Document, facet: Facet, detail: boolean): Reply {
  if (!doc.project) return from(doc);
  const { description, highlights, stack } = doc.project;
  const overview = `${doc.title} is ${description[0].toLowerCase()}${description.slice(1)}`;
  const technologies = `${doc.title} uses ${stack.join(', ')}.`;
  if (facet.goal === 'limitations') return from(doc, `${overview} ${doc.limitations ?? 'The portfolio describes its features, but it doesn’t establish production scale.'}`);
  if (facet.focus === 'stack') return from(doc, technologies);
  if (detail || facet.focus === 'architecture') {
    return from(doc, `${overview} It uses ${stack.join(', ')}. Its technical highlights include ${highlights.slice(0, 4).join(', ')}.`);
  }
  return from(doc, overview);
}

const project = (title: string) => documents.find((doc) => doc.title === title)!;
const fieldora = find('fieldora');
const timeboard = project('TimeBoard');
const krishi = project('KrishiTrackr');
const agri = project('AgriRAG');
const frontend = find('reviewed-frontend');
const block = find('reviewed-block');
const smart = find('internship-0');
const fastApi = find('reviewed-smart-role');
const development = find('reviewed-smart-work');
const focus = project('Focus Detection System');

const reactExperience = combine(
  from(frontend, 'Ninad lists React, Next.js, TypeScript, and responsive web design among his frontend skills.'),
  from(block, 'At BlockSeBlock, he built interactive 3D web experiences with React Three Fiber.'),
);
const fastApiExperience = {
  ...from(fastApi, 'Ninad used Python and FastAPI for request validation, schemas, and error handling during his SmartLeaven internship.'),
  sources: [...fastApi.sources, ...smart.sources],
};
const ragExperience = combine(
  from(agri, 'AgriRAG uses Qdrant and semantic embeddings to retrieve agricultural information and cite supporting pages.'),
  from(development, 'At SmartLeaven, Ninad worked on an LLM-powered agent for structuring job descriptions.'),
  from(focus, 'He also used YOLOv8 and OpenCV for computer-vision focus detection.'),
);

export function replyChoices(facet: Facet, detail: boolean): Reply[] {
  if (facet.focus === 'unknown') return [];
  const { topic, query, goal } = facet;
  const evidence = retrieve(facet);
  if (facet.focus?.startsWith('technology:')) {
    const name = facet.focus.slice('technology:'.length);
    const uses = documents.filter((doc) => doc.project?.stack.includes(name)).slice(0, 3);
    if (uses.length) {
      const examples = goal === 'example' ? uses : uses.slice(0, 1);
      return [{ text: `${name} is in the documented stack for ${examples.map(({ title }) => title).join(', ')}.`,
        sources: examples.flatMap(({ sources }) => sources) }];
    }
    if (goal === 'example') return [];
    if (name === 'Docker') return [from(find('skills'), 'Ninad lists Docker fundamentals among his development tools.')];
    if (name === 'C++') return [from(find('reviewed-practice'))];
    if (name === 'PostgreSQL' || name === 'Redis') return [from(find('reviewed-databases'), `Ninad lists ${name} among the databases he’s familiar with.`)];
    if (name === 'LangChain') return [from(development, 'At SmartLeaven, Ninad used LangChain in an agricultural advisory RAG pipeline.')];
    if (name === 'Pydantic') return [fastApiExperience];
    return [from(find('skills'), `${name} is listed in Ninad’s portfolio technology stack.`)];
  }
  if (facet.projects.length) {
    const selected = facet.projects.flatMap((id) => byId.get(id) ?? []);
    if (selected.length > 1) return [combine(...selected.map((doc) => projectReply(doc, facet, false)))];
    const primary = selected[0];
    if (!primary) return [];
    if (facet.focus === 'architecture' && primary.id === 'fieldora') {
      return [combine(projectReply(primary, facet, true), from(find('reviewed-fieldora-challenge')))];
    }
    const extra = evidence.find((doc) => doc.id.startsWith('reviewed-') && doc.title.startsWith(primary.title));
    const overview = projectReply(primary, facet, detail);
    return detail && extra && goal !== 'limitations' && facet.focus !== 'stack' ? [overview, combine(overview, from(extra))] : [overview];
  }
  if (facet.focus && byId.has(`reviewed-${facet.focus}`)) {
    const related = find(`reviewed-${facet.focus}`);
    const publicDoc = topic === 'education' ? find('education')
      : facet.focus === 'block' ? find('internship-1') : facet.focus.startsWith('smart') ? smart : undefined;
    return [{ text: related.facts, sources: [...related.sources, ...(publicDoc?.sources ?? [])] }];
  }
  if (goal === 'example') {
    const examples = evidence.filter((doc) => doc.project || doc.id === 'fieldora');
    return examples.slice(0, 2).map((doc) => doc.project
      ? from(doc, `${doc.title} is one example. It uses ${doc.project.stack.slice(0, 4).join(', ')}.`)
      : from(doc));
  }

  switch (topic) {
    case 'availability': return [from(find('availability'))];
    case 'contact': {
      const contact = find('contact');
      if (/\bphone\b/i.test(query)) return [from(contact, `Ninad’s public contact number is ${publicPhone}.`)];
      if (/\bemail\b/i.test(query)) return [from(contact, 'His portfolio doesn’t list a contact email. You can reach him on LinkedIn.')];
      return [from(contact, 'You can reach Ninad on LinkedIn or visit the contact section for his public phone number.')];
    }
    case 'projects': return [from(find('projects'))];
    case 'bio': return [from(find('bio'), find('bio').facts.split(' He started exploring')[0])];
    case 'growth': return [from(find('reviewed-growth'))];
    case 'delivery': return [from(find('delivery-evidence'), 'TimeBoard has a public website and KrishiTrackr has a live demo. The portfolio does not establish how either performs at production scale.')];
    case 'tools': return [combine(
      from(frontend, 'Ninad lists React, Next.js, TypeScript, and Tailwind CSS for frontend work.'),
      from(find('skills'), 'His backend and AI work uses tools such as Node.js, FastAPI, MongoDB, SQLite, and Qdrant.'),
    )];
    case 'frontend': return [
      reactExperience,
      combine(from(frontend, 'Ninad lists React, Next.js, TypeScript, and responsive web design among his frontend skills.'),
        from(fieldora, 'He used React and TypeScript in Fieldora, which handles dynamically rendered forms and custom dropdowns.')),
    ];
    case 'backend': {
      const project = from(krishi, 'KrishiTrackr uses Node.js, Express, and MongoDB for authenticated APIs and farm data.');
      return /\bfast\s?api\b/i.test(query)
        ? [combine(fastApiExperience, from(agri, 'He also used FastAPI in AgriRAG alongside Qdrant vector retrieval.')), fastApiExperience]
        : [combine(fastApiExperience, project), combine(project, from(agri, 'AgriRAG is another example, with a Python and FastAPI backend.'))];
    }
    case 'ai': return [
      ragExperience,
      combine(from(agri, 'He built AgriRAG with semantic search and cited answers using Qdrant.'),
        from(development, 'At SmartLeaven, he worked on LLM-powered structured outputs.'), from(focus, 'His Focus Detection System uses computer vision to analyze webcam input.')),
    ];
    case 'coding': {
      const practice = from(find('reviewed-practice'));
      return [
        combine(practice, from(timeboard, 'He also implemented activity tracking, focus scoring, and local SQLite persistence in TimeBoard.')),
        combine(practice, from(find('reviewed-debug'), 'His engineering profile describes reproducing issues, isolating the failing component, and testing fixes.')),
      ];
    }
    case 'architecture': {
      const debugging = from(find('reviewed-debug'));
      return /\bchallenges?\b/i.test(query)
        ? [debugging, combine(debugging, from(find('reviewed-fieldora-challenge'), 'For Fieldora, he used MutationObserver to handle dynamically rendered forms.'))]
        : [from(find('reviewed-architecture')), debugging];
    }
    case 'experience': {
      const hiring = /\b(?:hire|suitable|qualifi\w*|role|strengths?|engineering abilities)\b/i.test(query);
      const ownership = /\b(?:independent|ownership)\b/i.test(query);
      if (ownership) return [combine(from(find('reviewed-timeboard-ownership'), 'Ninad took TimeBoard from an idea through implementation.'), from(fieldora, 'He also independently built the Fieldora browser extension.'))];
      const first = from(smart, 'At SmartLeaven Technologies, Ninad has worked on AI applications, RAG systems, and backend services with Python and FastAPI.');
      const second = from(block, 'At BlockSeBlock, he built interactive 3D interfaces using React Three Fiber.');
      if (!hiring) return [combine(first, second)];
      const fullStack = from(krishi, 'KrishiTrackr is another example of his full-stack work, using React, Node.js, and MongoDB.');
      return [combine(first, fullStack), combine(second, fullStack)];
    }
    default: return evidence.slice(0, 1).map((doc) => from(doc));
  }
}
