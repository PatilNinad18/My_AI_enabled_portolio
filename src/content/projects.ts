export const categories = ['Full-Stack', 'AI/ML'] as const;
export type Category = (typeof categories)[number];

export type Project = {
  name: string;
  screenshot: string;
  description: string;
  stack: readonly string[];
  highlights: readonly string[];
  repository?: string;
  demo?: string;
  demoAccess?: { email: string; password: string };
  status?: string;
};

export const projects: Record<Category, readonly Project[]> = {
  'Full-Stack': [
    {
      name: 'TimeBoard',
      screenshot: '/assets/projects/fullstack/fullstack1.png',
      repository: 'https://github.com/PatilNinad18/TimeBoard',
      demo: 'https://gettimeboard.netlify.app/',
      description: 'A privacy-first Windows desktop productivity tracker that monitors application usage, calculates personalized focus scores, and visualizes work patterns through analytics dashboards, activity timelines, and downloadable reports.',
      stack: ['Electron', 'React', 'SQLite', 'Zustand', 'Recharts', 'Tailwind CSS'],
      highlights: ['One-second application tracking', 'Idle detection', 'Rule-based productivity insights', 'Focus scoring', 'Local SQLite persistence', 'CSV reporting'],
    },
    {
      name: 'KrishiTrackr',
      screenshot: '/assets/projects/fullstack/fullstack3.png',
      repository: 'https://github.com/PatilNinad18/AgroTech',
      demo: 'https://krishitrackr.netlify.app/',
      demoAccess: { email: 'patil1804@gmail.com', password: 'Pass@123' },
      description: 'A full-stack agricultural monitoring platform for visualizing soil and operational metrics, exploring nutrient data, and generating farm-performance reports.',
      stack: ['React', 'Node.js', 'Express', 'MongoDB', 'JWT'],
      highlights: ['Authentication and backend APIs', 'Soil-data ingestion and retrieval', 'Agricultural dashboards', 'Date-range filtering', 'Farm-performance reports', 'Operational endpoints'],
    },
    {
      name: 'SentinelX',
      screenshot: '/assets/projects/fullstack/fullstack2.png',
      repository: 'https://github.com/PatilNinad18/disaster-insight-dashboard',
      description: 'An interactive disaster-intelligence dashboard for exploring flood and earthquake scenarios, visualizing geographic risk zones, and comparing human decisions against automated recommendations.',
      stack: ['React', 'TypeScript', 'Leaflet', 'Recharts', 'Tailwind CSS', 'FastAPI integration'],
      highlights: ['Disaster simulations', 'District-level zone visualization', 'Decision comparison', 'Alert management', 'Data-driven dashboards'],
      status: 'Some services use mock implementations. The FastAPI backend is maintained separately.',
    },
    {
      name: 'FinCognito.AI',
      screenshot: '/assets/projects/fullstack/fullstack4.png',
      repository: 'https://github.com/PatilNinad18/FinCognito.AI',
      description: 'A privacy-focused financial intelligence application featuring transaction imports, explainable financial analytics, scenario simulations, and isolated fictional demo and personal workspaces.',
      stack: ['React', 'TypeScript', 'FastAPI', 'SQLite', 'Tesseract OCR', 'Recharts'],
      highlights: ['PDF, CSV, and SMS imports', 'OCR document processing', 'Review before confirmation', 'Digital Twin analysis', 'Scenario simulation', 'Explainable rule-based intelligence'],
      status: 'Locally tested demonstration. Public deployment and licensing remain unresolved.',
    },
  ],
  'AI/ML': [
    {
      name: 'AgriRAG',
      screenshot: '/assets/projects/aiml/aiml1.png',
      repository: 'https://github.com/PatilNinad18/AgriRAG',
      description: 'A domain-specific agricultural RAG assistant that retrieves relevant farming information from documents and generates source-grounded answers, with a domain-adapted LLM fallback when supporting material is unavailable.',
      stack: ['Python', 'FastAPI', 'Qdrant', 'Sentence Transformers', 'AgriParam', 'Streamlit'],
      highlights: ['Document ingestion and chunking', 'Semantic embeddings', 'Vector similarity retrieval', 'Page-level citations', 'Domain-specific LLM', 'Dual-mode responses'],
    },
    {
      name: 'Telegram Grievance Bot',
      screenshot: '/assets/projects/aiml/aiml2.png',
      repository: 'https://github.com/PatilNinad18/TeleBot',
      description: 'An AI-assisted citizen grievance management system that accepts complaints through Telegram, automatically classifies and routes grievances, assigns urgency levels, and provides a real-time administrative dashboard.',
      stack: ['Python', 'aiogram', 'FastAPI', 'MongoDB', 'Hugging Face', 'Chart.js', 'SSE'],
      highlights: ['Telegram commands', 'Weighted keyword classification', 'Zero-shot NLP fallback', 'Department routing', 'Priority detection', 'Real-time dashboard updates'],
    },
    {
      name: 'Focus Detection System',
      screenshot: '/assets/projects/aiml/aiml3.png',
      repository: 'https://github.com/PatilNinad18/FocusDetection',
      description: 'A computer-vision-powered focus monitoring system that analyzes webcam input to estimate attention, detect distractions, and provide real-time productivity feedback.',
      stack: ['Python', 'YOLOv8', 'OpenCV', 'FastAPI', 'React', 'Tailwind CSS'],
      highlights: ['Face and eye tracking', 'Phone and writing-activity detection', 'Fatigue indicators', 'Focus score estimation', 'Real-time video processing', 'Customizable focus sessions'],
    },
  ],
};
