import { mentionedTechnologies, type Topic } from './knowledge';

type Area = 'frontend' | 'backend' | 'infrastructure' | 'ai';
export type TechnologyRequirement = { kind: 'technology'; name: string; documented?: true; area?: Area; unspecified?: true };
export type Requirement =
  | TechnologyRequirement
  | { kind: 'leadership'; softwareTeam: boolean }
  | { kind: 'ownership' }
  | { kind: 'role'; area?: Area; senior: boolean; immediate: boolean };

export const recruiterLanguage = /\b(?:hir(?:e[ds]?|ing)|recruit\w*|candidate|fit|suitable|qualified|qualification|role|position|job|requirements?|onboard\w*|ramp up|day[- ]one|learning curve|interview|take on)\b/i;
export const leadershipLanguage = /\b(?:leadership|(?:lead|leads|leading|manage|managing|coach|mentor|supervise)\s+(?:(?:an?|the|his|our|small|software|engineering|development)\s+){0,3}(?:teams?|engineers?|developers?|people)|team lead|people management|delegat\w*|direct reports)\b/i;
export const ownershipLanguage = /\b(?:product|project|delivery) ownership\b|\b(?:own|take ownership of|drive)\s+(?:(?:a|an|the|our|his|software)\s+){0,2}(?:products?|projects?|delivery)\b/i;
export const roleLanguage = /\b(?:roles?|positions?|jobs?|internship|developer|engineer|hire|hiring|candidate)\b/i;
export const technicalAssessment = /\b(?:can|could|would|does|did|has|have|fit|familiar|experience|expertise|proficien\w*|skill\w*|learn|use|work(?:ed)?\s+(?:with|in)|ramp up|know|handle|learn(?:ing)? curve|requirements?|requires?|using)\b/i;

// These labels describe technology families, independent of portfolio evidence.
const families: Record<Area, readonly string[]> = {
  frontend: ['AngularJS', 'Angular', 'Vue.js', 'Vue', 'SvelteKit', 'Svelte', 'SolidJS', 'Ember.js', 'Alpine.js', 'Lit', 'Nuxt', 'React', 'Next.js', 'TypeScript'],
  backend: ['Django', 'Flask', 'Spring Boot', 'ASP.NET Core', 'ASP.NET', 'Ruby on Rails', 'Rails', 'Laravel', 'NestJS', 'Koa', 'Golang', 'FastAPI', 'Express', 'Node.js'],
  infrastructure: ['Kubernetes', 'K8s', 'Terraform', 'AWS', 'Azure', 'Google Cloud', 'Docker', 'Helm', 'Ansible'],
  ai: ['TensorFlow', 'Keras', 'JAX', 'PyTorch', 'scikit-learn', 'OpenCV'],
};

function areaOf(text: string): Area | undefined {
  if (/\bfull[- ]stack\b/i.test(text)) return;
  if (/\b(?:front[- ]?end|web interfaces?|ui)\b/i.test(text)) return 'frontend';
  if (/\b(?:back[- ]?end|server[- ]side|api services?)\b/i.test(text)) return 'backend';
  if (/\b(?:infrastructure|devops|platform engineering|cloud)\b/i.test(text)) return 'infrastructure';
  if (/\b(?:ai|ml|machine learning|computer vision)\b/i.test(text)) return 'ai';
}

export function areaTopic(area?: Area): Topic {
  return area === 'infrastructure' ? 'tools' : area ?? 'experience';
}

function labelPattern(name: string) {
  return new RegExp(`(?<![\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'i');
}

const catalog = Object.entries(families).flatMap(([area, names]) =>
  names.map((name) => ({ name, area: area as Area, pattern: labelPattern(name) })));
const genericLabel = /^(?:it|this|that|anything|everything|unfamiliar|new|different|another|role|job|framework|stack|technology|position|team|deadline|forms?|mentoring|management|ownership|responsibilities|feedback|[a-z]+ development)$/i;

function possibleLabel(value: string, allowBareWord = false) {
  const candidate = value.trim()
    .replace(/^(?:an?|the)\s+/i, '')
    .replace(/^(?:(?:an? )?unfamiliar (?:framework|tool)|(?:a )?(?:framework|tool))\s+(?:called|named)\s+/i, '')
    .replace(/\s+(?:framework|developer|engineer|role|position)$/i, '')
    .replace(/[.!?]+$/, '');
  return candidate.length <= 42 && /^[a-z][a-z\d.+#]*(?:[ -][a-z\d.+#]+){0,3}$/i.test(candidate)
    && !genericLabel.test(candidate) && !roleLanguage.test(candidate) && !leadershipLanguage.test(candidate)
    && !ownershipLanguage.test(candidate) && !/^(?:senior|junior|staff|principal|lead|technical|front[- ]?end|back[- ]?end|full[- ]stack|team|software|platform|infrastructure|full time|ai|ml|new responsibilities|gaps?|our|my|your|what|why|how)\b/i.test(candidate)
    && (/^(?:[A-Z][a-z\d]|[a-z]*[A-Z]|[a-z\d]+[.+#-])/u.test(candidate) || allowBareWord && /^[a-z][a-z\d]+$/i.test(candidate))
    ? candidate : undefined;
}

export function technologyRequirements(query: string): TechnologyRequirement[] {
  const known = mentionedTechnologies(query).map((name) => ({ name, position: query.search(labelPattern(name)), documented: true as const, area: catalog.find((item) => item.name === name)?.area }));
  const matches: { name: string; position: number; documented?: true; area?: Area }[] = [...known];
  for (const { name, area, pattern } of catalog) {
    const position = query.search(pattern);
    if (position < 0 || matches.some((match) => match.position === position && match.name.length >= name.length)) continue;
    matches.push({ name, position, area });
  }

  const target = /\b(?:experience (?:with|in|maintaining)|expertise in|familiar with|work(?:ed)? (?:with|in)|build with|pick up|ramp up (?:on|with)|handle|use[ds]?|using|learn|know|requires?)\s+(.+?)(?=\s+(?:for|as|before|within|without|that|who|would|could|and (?:lead|manage|mentor|own|start|ready|which))\b|[?!;]|$)/gi;
  const roleTarget = /\b([A-Z][A-Za-z\d.+#-]*(?: [A-Z][A-Za-z\d.+#-]*)?)\s+(?:(?:front[- ]?end|back[- ]?end)\s+)?(?:framework|developer|engineer|role)\b/g;
  const namesPerson = /\b(?:ninad|patil|he|his|him)\b/i.test(query);
  const candidates = [...query.matchAll(target)].flatMap((match) => {
    const labels = match[1].split(/\s+(?:and|or)\s+|,\s*/i);
    return labels.map((candidate) => ({
      candidate, allowBareWord: namesPerson || labels.length > 1 && matches.length > 0
        || /\b(?:framework|tool)\s+(?:called|named)\b/i.test(candidate),
    }));
  });
  candidates.push(...[...query.matchAll(roleTarget)].map((match) => ({ candidate: match[1], allowBareWord: false })));
  for (const { candidate, allowBareWord } of candidates) {
    const name = possibleLabel(candidate, allowBareWord);
    if (!name || known.length && mentionedTechnologies(name).length || catalog.some(({ pattern }) => pattern.test(name))) continue;
    matches.push({ name, position: query.indexOf(name), area: areaOf(query) });
  }
  return [...new Map(matches.sort((a, b) => a.position - b.position || b.name.length - a.name.length)
    .map(({ name, documented, area }) => [name.toLowerCase(), { kind: 'technology' as const, name, documented, area }])).values()]
    .filter((item, index, all) => !all.slice(0, index).some((prior) => prior.area === item.area
      && ['Vue.js/Vue', 'K8s/Kubernetes', 'Ruby on Rails/Rails'].some((pair) => pair.split('/').includes(prior.name) && pair.split('/').includes(item.name))));
}

export function professionalRequirements(query: string, previousTechnology?: TechnologyRequirement): Requirement[] {
  const technology = technologyRequirements(query);
  if (!technology.length && previousTechnology && /\b(?:learn|ramp up on|pick up|experience with|use|work with|ready for)\s+(?:it|that|this)\b/i.test(query)) {
    technology.push(previousTechnology);
  }
  if (!technology.length && /\b(?:new|unfamiliar|different|another)\s+(?:(?:front[- ]?end|back[- ]?end)\s+)?(?:framework|stack|technology)\b/i.test(query)) {
    technology.push({ kind: 'technology', name: 'framework', area: areaOf(query), unspecified: true });
  }
  const requirements: Requirement[] = [...technology];
  if (leadershipLanguage.test(query)) requirements.push({
    kind: 'leadership',
    softwareTeam: !/\b(?:workshops?|community|outreach)\b/i.test(query) || /\b(?:team|engineers?|developers?|people management)\b/i.test(query),
  });
  if (ownershipLanguage.test(query)) requirements.push({ kind: 'ownership' });
  const senior = /\b(?:senior|staff engineer|technical lead|lead engineer|principal|engineering manager)\b/i.test(query);
  const immediate = /\b(?:day[- ]one|immediately|hit the ground running|ready to (?:lead|own|ship)|without (?:any )?training)\b/i.test(query);
  if (roleLanguage.test(query) && (senior || immediate || !requirements.length)) {
    requirements.unshift({ kind: 'role', area: areaOf(query), senior, immediate });
  }
  return requirements;
}
