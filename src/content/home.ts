export type FeatureIcon = 'layers' | 'server' | 'sparkles' | 'vision' | 'database' | 'terminal';

export type Feature = {
  title: string;
  description: string;
  icon: FeatureIcon;
};

export const expertise: readonly Feature[] = [
  {
    title: 'Full-Stack Development',
    description: 'Building complete web applications using React, Next.js, Node.js, Express, and modern frontend/backend architectures.',
    icon: 'layers',
  },
  {
    title: 'Backend Engineering',
    description: 'Designing REST APIs, implementing authentication, integrating databases, and building reliable application workflows with Node.js and Python.',
    icon: 'server',
  },
  {
    title: 'AI & LLM Applications',
    description: 'Developing AI-enabled applications using LLM integrations, retrieval-augmented generation, embeddings, and vector search.',
    icon: 'sparkles',
  },
  {
    title: 'Machine Learning & Computer Vision',
    description: 'Working with Python, PyTorch, scikit-learn, YOLOv8, and OpenCV to build practical detection and analytical systems.',
    icon: 'vision',
  },
  {
    title: 'Databases & Real-Time Systems',
    description: 'Using MongoDB, SQLite, Qdrant, and event-driven or real-time integrations to manage and process application data.',
    icon: 'database',
  },
  {
    title: 'Development Tools & Deployment',
    description: 'Working with Git, GitHub, Docker fundamentals, testing tools, and application deployment workflows.',
    icon: 'terminal',
  },
];

export const technologyRows = [
  {
    label: 'Web and backend technologies',
    direction: 'right',
    tools: [
      ['React', 'react'], ['Next.js', 'nextdotjs'], ['TypeScript', 'typescript'], ['JavaScript', 'javascript'],
      ['Node.js', 'nodedotjs'], ['Express', 'express'], ['FastAPI', 'fastapi'], ['Python', 'python'],
      ['MongoDB', 'mongodb'], ['SQLite', 'sqlite'],
    ],
  },
  {
    label: 'AI and development technologies',
    direction: 'left',
    tools: [
      ['PyTorch', 'pytorch'], ['scikit-learn', 'scikitlearn'], ['YOLOv8', 'yolo'], ['OpenCV', 'opencv'],
      ['Qdrant', 'qdrant'], ['RAG', 'sparkles'], ['Docker', 'docker'], ['Git', 'git'], ['GitHub', 'github'],
      ['Electron', 'electron'], ['Tailwind CSS', 'tailwindcss'],
    ],
  },
] as const;
