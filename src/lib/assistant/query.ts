import { mentionedProjects, mentionedTechnologies, projectDirectory, type Topic } from './knowledge';
import { contextLimit, type ConversationTurn } from './protocol';

export const injection = /\b(?:ignore|disregard|forget|override|bypass)\b.{0,65}\b(?:rules?|instructions?|guardrails?|prompt|policy|previous|above)\b|\b(?:system prompt|developer message|hidden instructions|jailbreak|prompt injection|act as|pretend to be|roleplay|base64)\b|\[\/?INST\]|<\|/i;
const privateRequest = /\b(?:passwords?|credentials?|api keys?|home (?:address|phone|number)|private (?:email|phone|number|information)|personal (?:email|address)|salary|medical records?|family members?)\b/i;
const unrelatedTask = /^(?:(?:please|can you|could you|would you)\s+)*(?:write|solve|implement|generate|create|debug)\b|\b(?:write|solve|code)\b.{0,50}\bfor me\b/i;
const subject = /\b(?:ninad|patil|he|his|him)\b/i;
const example = /^which\s+(?:of his\s+)?project|\b(?:give|show) me an example|\bproject (?:shows?|demonstrates?|proves?) that\b/i;
const followUp = /\b(?:that (?:project|app|one)|this (?:project|app)|the project|he use|does it (?:work|use|do|handle)|did he build it|it (?:win|place))\b/i;
const detailRequest = /\b(?:in depth|in detail|details|architecture|trade[- ]?offs?|compare|comparison|different|step by step)\b/i;
const assessment = /\b(?:can|capable|good at|discipline|suitable|qualified|ready for|trust|strengths?|ability|demonstrates?|hire|fit|experience)\b/i;
const limitations = /\b(?:limitations?|weakness\w*|shortcomings?|improv\w*|ready for production|production[- ]ready|deployment|deployed|shipped)\b/i;

const signals: { topic: Topic; pattern: RegExp }[] = [
  { topic: 'frontend', pattern: /\b(?:front[- ]?end|web interfaces?|user interfaces?|ui|react(?:\.js)?|next\.?js|responsive|css)\b/i },
  { topic: 'backend', pattern: /\b(?:back[- ]?end|server[- ]side|fast\s?api|node\.?js|express|rest\s+apis?|database\w*|postgres\w*|authentication)\b/i },
  { topic: 'ai', pattern: /\b(?:ai|machine learning|ml|rag|llms?|computer vision|embeddings|vector (?:search|retrieval)|language models?)\b/i },
  { topic: 'coding', pattern: /\b(?:coding|programming|coder|software engineer\w*|problem[- ]solving|dsa|data structures|algorithms?|leetcode|debugg\w*)\b/i },
];

export type Facet = {
  query: string; topic: Topic; projects: string[]; goal: 'fact' | 'assessment' | 'example' | 'limitations'; focus?: string;
};
export type Plan = { facets: Facet[]; detail: boolean; omitted: boolean; contextual: boolean };
const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

function classify(query: string, projectIds: string[], priorTopic?: Topic): Facet[] {
  const build = (topic: Topic, goal: Facet['goal'] = 'fact', focus?: string): Facet =>
    ({ query, topic, projects: projectIds, goal, focus });
  const aboutPortfolio = subject.test(query) || /\b(?:portfolio|internships?|full[- ]stack|skills)\b/i.test(query);
  const wantsExample = example.test(query);
  if (wantsExample && priorTopic && !projectIds.length && /\b(?:that|shows?|proves?|demonstrates?)\b/i.test(query)) return [build(priorTopic, 'example')];
  const goal = limitations.test(query) ? 'limitations' : assessment.test(query) ? 'assessment' : 'fact';
  if (/\b(?:awards?|prizes?)\b/i.test(query) && (aboutPortfolio || projectIds.length)) return [build('experience', 'fact', 'unknown')];

  if (projectIds.length) {
    const focus = /\b(?:tech stack|technolog\w*|languages?|frameworks?|built with|what.*use)\b/i.test(query) ? 'stack'
      : /\b(?:architecture|how (?:does|did|is|was|he|it)|technical|implementation|dynamic forms)\b/i.test(query) ? 'architecture' : undefined;
    return [build(focus === 'architecture' ? 'architecture' : 'projects', goal === 'limitations' ? goal : 'fact', focus)];
  }

  const employer = [
    { position: query.search(/\bsmartleaven\b/i), key: /\b(?:start|join|when|date|month)\w*\b/i.test(query) ? 'smartleaven' : 'smart-work' },
    { position: query.search(/\bblockseblock\b/i), key: 'block' },
  ].filter(({ position }) => position >= 0).sort((a, b) => a.position - b.position);
  if (employer.length) return employer.map(({ key }) => build('experience', 'fact', key));
  if (/\b(?:join(?:ing)?|start date|notice period|availab\w*|start (?:next|on|in)|how soon (?:can|could))\b/i.test(query) && aboutPortfolio) {
    return [build('availability')];
  }
  if (/\b(?:weakness\w*|shortcomings?|areas? (?:of|for) (?:growth|improvement)|improv\w*|still learning)\b/i.test(query) && aboutPortfolio) {
    return [build('growth', 'limitations', 'growth')];
  }
  if (/\b(?:cgpa|gpa|grade point)\b/i.test(query)) return [build('education', 'fact', 'cgpa')];
  if (/\b(?:viit|studying|study|education|degree|graduat\w*|college|university|academic|publication|published|kelvin)\b/i.test(query)) {
    return [build('education', 'fact', /\b(?:publication|published|kelvin)\b/i.test(query) ? 'publication' : 'education')];
  }
  if (/\b(?:contact|linkedin|github profile|reach|phone|email)\b/i.test(query)
    && (aboutPortfolio || /^(?:contact|linkedin|github profile|email|phone(?: number)?)$/i.test(query))) {
    return [build('contact', 'fact', 'contact')];
  }
  if (/\b(?:awards?|prizes?|worked (?:at|for))\b/i.test(query) && aboutPortfolio) return [build('experience', 'fact', 'unknown')];
  if (/\b(?:production[- ]ready|production readiness|shipped|deployed|live demos?)\b/i.test(query) && aboutPortfolio) {
    return [build('delivery', 'limitations')];
  }
  const technologies = mentionedTechnologies(query);
  if (technologies.length && /\b(?:what|which)\b.*\bprojects?\b/i.test(query)) {
    return technologies.slice(0, 3).map((name) => build('tools', 'example', `technology:${name}`));
  }
  if (/\b(?:what (?:has|did) (?:he|ninad) build|what has (?:he|ninad) built|projects? (?:has|did) (?:he|ninad)|list (?:his|ninad.s) projects?|what projects?)\b/i.test(query)) {
    return [build('projects')];
  }
  if (/\b(?:hire|hiring|recruit\w*|suitable|internships?|strengths?|qualifi\w*|professional experience|professional suitab\w*|full[- ]stack|independent product ownership|engineering abilities)\b/i.test(query)) {
    return [build('experience', goal === 'fact' ? 'fact' : 'assessment')];
  }
  if (/\b(?:technical challenges?|design decisions?|engineering process|approach to architecture)\b/i.test(query)) return [build('architecture', 'fact')];
  if (/\b(?:which|what) databases?\b/i.test(query)) return [build('backend', 'fact', 'databases')];
  if (/\b(?:tech stack|tools|what (?:technical )?skills|what technologies)\b/i.test(query) && aboutPortfolio) return [build('tools')];
  if (/\b(?:who (?:is|s) (?:ninad|he)|story|biography|background|career interests|introduce ninad)\b/i.test(query) && aboutPortfolio) {
    return [build('bio', 'fact', /\b(?:interests|goals)\b/i.test(query) ? 'direction' : undefined)];
  }
  const matches = signals.filter(({ pattern }) => pattern.test(query))
    .sort((a, b) => query.search(a.pattern) - query.search(b.pattern));
  if (matches.length && (aboutPortfolio || /^(?:what about|how about)\b/i.test(query))) {
    return matches.slice(0, 3).map(({ topic }) => build(topic, wantsExample ? 'example' : goal,
      topic === 'coding' && /\b(?:dsa|data structures|leetcode|algorithms?)\b/i.test(query) ? 'practice' : undefined));
  }
  if (technologies.length && aboutPortfolio) return technologies.slice(0, 3).map((name) => build('tools', goal, `technology:${name}`));
  if (/\b(?:ninad|patil)\b/i.test(query)) return [build('bio', 'fact', 'unknown')];
  return [];
}

export function planQuery(question: string, history: ConversationTurn[]): Plan | null {
  if (injection.test(question)) return null;
  const recent = history.slice(-contextLimit).filter(({ question }) => !injection.test(question) && !privateRequest.test(question));
  const last = recent.at(-1);
  const lastProjects = mentionedProjects(last?.answer ?? last?.question ?? '');
  const priorTopic = recent.toReversed().flatMap(({ question }) => classify(question, [])
    .map(({ topic }) => topic)).find((topic) => ['frontend', 'backend', 'ai', 'coding', 'architecture'].includes(topic));

  const position = /\b(?:(?:the|his)\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth)\s+(?:project|one)\b/i.exec(question);
  const ordered = position && lastProjects[ordinals.indexOf(position[1].toLowerCase())];
  const target = ordered ? projectDirectory.find(({ id }) => id === ordered) : undefined;
  const resolved = position && target ? question.replace(position[0], target.name) : question;
  let contextual = Boolean(target);
  let omitted = false;
  const facets: Facet[] = [];
  for (const part of resolved.split(/\?+\s*|;\s*|\s+(?:and|also|but)\s+(?=(?:why|what|who|where|when|how|can|would|did|does|is|tell|solve|write|explain)\b)/i)) {
    const query = part.trim();
    if (!/[\p{L}\p{N}]/u.test(query)) continue;
    const skillList = /^(?:(?:can|could|does|did) (?:ninad(?: patil)?|he) (?:handle|use|work with|build with|know))\s+(.+)$/i.exec(query);
    if (skillList && /\band\b|,/i.test(skillList[1]) && !mentionedProjects(query, true).length) {
      for (const skill of skillList[1].split(/\s+and\s+|,\s*/i).map((value) => value.trim()).filter(Boolean)) {
        if (unrelatedTask.test(skill) || privateRequest.test(skill)) { omitted = true; continue; }
        facets.push(...classify(`Can Ninad work with ${skill}`, [], priorTopic));
      }
      continue;
    }
    if (privateRequest.test(query) || unrelatedTask.test(query)) { omitted = true; continue; }
    const explicit = mentionedProjects(query, true);
    const previousProjects = facets.at(-1)?.projects;
    const referent = previousProjects?.length === 1 ? previousProjects : lastProjects;
    const spec = !explicit.length && !example.test(query) && followUp.test(query) && referent.length === 1 ? referent : explicit;
    const planned = classify(query, spec, priorTopic);
    if ((spec !== explicit && spec === lastProjects) || (!explicit.length && example.test(query) && priorTopic)) contextual = true;
    if (planned.length) facets.push(...planned);
    else omitted = true;
  }
  return facets.length ? { facets: facets.slice(0, 4), detail: detailRequest.test(question), omitted, contextual } : null;
}
