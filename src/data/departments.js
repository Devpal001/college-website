import { Cpu, Zap, Radio, Cog, Laptop, Building2, FlaskConical, BrainCircuit } from 'lucide-react';

export const departments = [
  { 
    id: 'cse',
    name: 'Computer Science Engineering', 
    icon: Cpu, 
    blurb: 'Software development, AI/ML, and systems design.', 
    intake: 120, 
    duration: '4 Yrs.', 
    level: 'Degree',
    path: '/departments/cse'
  },
  { 
    id: 'ee',
    name: 'Electrical Engineering', 
    icon: Zap, 
    blurb: 'Power systems, control engineering, and electrical design.', 
    intake: 30, 
    duration: '4 Yrs.', 
    level: 'Degree',
    path: '/departments/ee'
  },
  { 
    id: 'ece',
    name: 'Electronics & Communication', 
    icon: Radio, 
    blurb: 'Circuit design, communication systems, and embedded tech.', 
    intake: 30, 
    duration: '4 Yrs.', 
    level: 'Degree',
    path: '/departments/ece'
  },
  { 
    id: 'mechanical',
    name: 'Mechanical Engineering', 
    icon: Cog, 
    blurb: 'Design, manufacturing, and thermal systems.', 
    intake: 30, 
    duration: '4 Yrs.', 
    level: 'Degree',
    path: '/departments/mechanical'
  },
  { 
    id: 'it',
    name: 'Information Technology', 
    icon: Laptop, 
    blurb: 'Networks, databases, and application development.', 
    intake: 60, 
    duration: '4 Yrs.', 
    level: 'Degree',
    path: '/departments/it'
  },
  { 
    id: 'civil',
    name: 'Civil Engineering', 
    icon: Building2, 
    blurb: 'Structural design, construction, and infrastructure.', 
    intake: 60, 
    duration: '4 Yrs.', 
    level: 'Degree',
    path: '/departments/civil'
  },
  { 
    id: 'cse-ai-ml',
    name: 'CSE (AI & ML)', 
    icon: BrainCircuit, 
    blurb: 'Artificial intelligence, machine learning, and data-driven systems.', 
    intake: 60, 
    duration: '4 Yrs.', 
    level: 'Degree', 
    note: 'Subject to Approval',
    path: '/departments/cse'
  },
  { 
    id: 'applied-science',
    name: 'Applied Science & Humanities', 
    icon: FlaskConical, 
    blurb: 'Foundational sciences and communication skills for all branches.',
    intake: 30,
    duration: '4 Yrs.',
    level: 'Degree',
    path: '/departments/common'
  },
];