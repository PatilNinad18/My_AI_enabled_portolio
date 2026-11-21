export type FeatureIcon = 'layers' | 'server' | 'sparkles' | 'vision' | 'database' | 'terminal';

export type Feature = {
  title: string;
  description: string;
  icon: FeatureIcon;
};

export const expertise: readonly Feature[] = [
  {
    title: 'Full-Stack Development',
    description: 'Building end-to-end applications with React, Next.js, Node.js, and modern frontend and backend technologies.',
    icon: 'layers',
  },
  {
    title: 'Backend Engineering',
    description: 'Developing REST APIs, application logic, database integrations, and backend services using Python, FastAPI, and Node.js.',
    icon: 'server',
  },
  {
    title: 'AI & LLM Applications',
    description: 'Building LLM-powered applications using RAG, vector search, embeddings, prompt engineering, and AI agent workflows.',
    icon: 'sparkles',
  },
  {
    title: 'Machine Learning & Computer Vision',
    description: 'Exploring machine learning and computer vision through Python, PyTorch, TensorFlow, OpenCV, and YOLOv8.',
    icon: 'vision',
  },
  {
    title: 'Databases & Real-Time Systems',
    description: 'Working with PostgreSQL, MongoDB, SQLite, and Qdrant to design data storage, retrieval, and application workflows.',
    icon: 'database',
  },
  {
    title: 'Development Tools & Deployment',
    description: 'Using Git, GitHub, Docker, testing tools, and deployment platforms to develop and maintain software applications.',
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
