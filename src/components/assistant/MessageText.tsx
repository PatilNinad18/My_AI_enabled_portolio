import styles from '@/styles/assistant.module.scss';

function emphasis(value: string) {
  return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') || part.startsWith('__') && part.endsWith('__')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// Model output is rendered as React text. Only the supported Markdown constructs become elements.
export default function MessageText({ text }: { text: string }) {
  return (
    <div className={styles.messageText}>
      {text.split(/\n\n+/).map((block, index) => {
        const lines = block.split('\n');
        const bullets = /^[-*]\s+/;
        const ordinal = /^\d+\.\s+/;
        if (lines.every((line) => bullets.test(line))) return <ul key={index}>{lines.map((line, item) => <li key={item}>{emphasis(line.replace(bullets, ''))}</li>)}</ul>;
        if (lines.every((line) => ordinal.test(line))) return <ol key={index}>{lines.map((line, item) => <li key={item}>{emphasis(line.replace(ordinal, ''))}</li>)}</ol>;
        return <p key={index}>{emphasis(block.replace(/^#{1,6}\s+/, ''))}</p>;
      })}
    </div>
  );
}
