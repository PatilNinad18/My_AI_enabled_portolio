import styles from '@/styles/assistant.module.scss';

function emphasis(value: string) {
  const nodes = [];
  let start = 0;
  for (const match of value.matchAll(/(\*\*|__)(\S(?:.*?\S)?)\1|(?<!\w)(\*|_)(\S(?:.*?\S)?)\3(?!\w)/g)) {
    nodes.push(value.slice(start, match.index));
    nodes.push(match[2] ? <strong key={match.index}>{match[2]}</strong> : <em key={match.index}>{match[4]}</em>);
    start = match.index + match[0].length;
  }
  nodes.push(value.slice(start));
  return nodes;
}

type Block = { kind: 'paragraph' | 'heading' | 'ul' | 'ol'; lines: string[] };

function blocksFrom(text: string) {
  const blocks: Block[] = [];
  let paragraphEnded = true;
  for (const entry of text.split(/\r?\n/)) {
    const line = entry.trim();
    if (!line) {
      paragraphEnded = true;
      continue;
    }
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    const bullet = /^[-+*]\s+(.+)$/.exec(line);
    const number = /^\d{1,2}[.)]\s+(.+)$/.exec(line);
    const kind = heading ? 'heading' : bullet ? 'ul' : number ? 'ol' : 'paragraph';
    const value = heading?.[1] ?? bullet?.[1] ?? number?.[1] ?? line;
    const previous = blocks.at(-1);
    if (previous?.kind === kind && (kind === 'ul' || kind === 'ol' || (kind === 'paragraph' && !paragraphEnded))) {
      previous.lines.push(value);
    } else {
      blocks.push({ kind, lines: [value] });
    }
    paragraphEnded = false;
  }
  return blocks;
}

// Model output is rendered as React text. Only the supported Markdown constructs become elements.
export default function MessageText({ text }: { text: string }) {
  return (
    <div className={styles.messageText}>
      {blocksFrom(text).map(({ kind, lines }, index) => {
        if (kind === 'ul' || kind === 'ol') {
          const List = kind;
          return <List key={index}>{lines.map((line, item) => <li key={item}>{emphasis(line)}</li>)}</List>;
        }
        if (kind === 'heading') return <h2 className={styles.messageHeading} key={index}>{emphasis(lines[0])}</h2>;
        return <p key={index}>{emphasis(lines.join(' '))}</p>;
      })}
    </div>
  );
}
