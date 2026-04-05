/**
 * Skills Library Index
 * All entries ship with Pantheon — no external registry, no runtime network calls.
 * Skills are read from the filesystem at request time via the API routes.
 */

export interface LibrarySkillMeta {
  id: string
  display_name: string
  description: string
  icon: string
  category: LibraryCategory
}

export type LibraryCategory = 'development' | 'creative' | 'analysis' | 'process'

export const LIBRARY_CATEGORIES: { id: LibraryCategory; label: string; icon: string }[] = [
  { id: 'development', label: 'Development',  icon: '💻' },
  { id: 'creative',    label: 'Creative',      icon: '✨' },
  { id: 'analysis',    label: 'Analysis',      icon: '📊' },
  { id: 'process',     label: 'Process',       icon: '🔄' },
]

export const SKILLS_LIBRARY: LibrarySkillMeta[] = [
  // ── Development ────────────────────────────────────────────────────────────
  {
    id: 'mobile-developer',
    display_name: 'Mobile Developer',
    description: 'Builds iOS and Android apps with React Native and Expo. Navigation, native APIs, and offline-first patterns.',
    icon: '📱',
    category: 'development',
  },
  {
    id: 'devops-engineer',
    display_name: 'DevOps Engineer',
    description: 'Designs CI/CD pipelines, Docker infrastructure, and deployment automation. Owns the path from code to production.',
    icon: '🚀',
    category: 'development',
  },
  {
    id: 'security-engineer',
    display_name: 'Security Engineer',
    description: 'Audits for OWASP vulnerabilities, designs secure-by-default patterns, and produces actionable remediation plans.',
    icon: '🔒',
    category: 'development',
  },
  {
    id: 'data-engineer',
    display_name: 'Data Engineer',
    description: 'Designs pipelines, ETL processes, and analytical data models. dbt, Airflow, and cloud data warehouses.',
    icon: '🔧',
    category: 'development',
  },
  {
    id: 'api-designer',
    display_name: 'API Designer',
    description: 'Contract-first REST and GraphQL API design. OpenAPI specs, versioning strategies, and developer-focused documentation.',
    icon: '🔌',
    category: 'development',
  },
  {
    id: 'python-developer',
    display_name: 'Python Developer',
    description: 'Idiomatic Python for web services, automation, and CLIs. FastAPI, Pydantic, async patterns, and pytest.',
    icon: '🐍',
    category: 'development',
  },
  {
    id: 'database-administrator',
    display_name: 'Database Administrator',
    description: 'Schema design, query optimization, migrations, and indexing strategies for PostgreSQL and relational databases.',
    icon: '🗄️',
    category: 'development',
  },

  // ── Creative ───────────────────────────────────────────────────────────────
  {
    id: 'copywriter',
    display_name: 'Copywriter',
    description: 'Landing pages, email sequences, ad copy, and brand messaging. Benefit-led, conversion-focused, voice-first.',
    icon: '✍️',
    category: 'creative',
  },
  {
    id: 'technical-writer',
    display_name: 'Technical Writer',
    description: 'READMEs, API references, runbooks, ADRs, and user guides. Writes for the reader who is stuck and needs the answer now.',
    icon: '📝',
    category: 'creative',
  },
  {
    id: 'ux-writer',
    display_name: 'UX Writer',
    description: 'Microcopy, onboarding flows, error messages, and in-app guidance. Makes software feel human without sacrificing clarity.',
    icon: '💬',
    category: 'creative',
  },

  // ── Analysis ───────────────────────────────────────────────────────────────
  {
    id: 'data-analyst',
    display_name: 'Data Analyst',
    description: 'SQL queries, cohort analyses, funnel breakdowns, and narrative reporting. Turns raw data into actionable decisions.',
    icon: '📊',
    category: 'analysis',
  },
  {
    id: 'business-analyst',
    display_name: 'Business Analyst',
    description: 'Requirements elicitation, BRDs, user stories, process mapping, and gap analysis. Translates needs into specs.',
    icon: '💼',
    category: 'analysis',
  },

  // ── Process ────────────────────────────────────────────────────────────────
  {
    id: 'qa-engineer',
    display_name: 'QA Engineer',
    description: 'Test plans, automation suites, and edge-case-first thinking. Catches what developers overlook before it ships.',
    icon: '🧪',
    category: 'process',
  },
  {
    id: 'product-manager',
    display_name: 'Product Manager',
    description: 'PRDs, user stories, prioritization frameworks, and launch plans. Owns the problem so engineering can own the solution.',
    icon: '🎯',
    category: 'process',
  },
]
