import { categories, type Category } from '@/content/projects';
import styles from '@/styles/projects.module.scss';

export default function ProjectFilters({ selected, onSelect, resultsId }: {
  selected: Category;
  onSelect: (category: Category) => void;
  resultsId: string;
}) {
  return (
    <div className={styles.filters} role="group" aria-label="Filter projects">
      {categories.map((category) => (
        <button key={category} type="button" aria-controls={resultsId}
          aria-pressed={selected === category} onClick={() => onSelect(category)}>
          {category}
        </button>
      ))}
    </div>
  );
}
