'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { LibrarySkillMeta, LibraryCategory } from '@/lib/agents/skills-library/_index'
import { LIBRARY_CATEGORIES } from '@/lib/agents/skills-library/_index'

// ── Accordion ─────────────────────────────────────────────────────────────────

function Accordion({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="space-y-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left group"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {title}
            </h2>
            <p
              className={cn(
                'text-xs text-muted-foreground/60 mt-0.5 truncate transition-all duration-200',
                open ? 'opacity-0 h-0 mt-0' : 'opacity-100'
              )}
            >
              {subtitle}
            </p>
          </div>
          <span className="shrink-0 w-5 h-5 rounded-full border border-border flex items-center justify-center text-muted-foreground transition-all group-hover:border-foreground/30 group-hover:text-foreground">
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={cn('transition-transform duration-300', open && 'rotate-180')}
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
        <div className="h-px bg-border mt-2" />
      </button>

      {/* Grid row trick: animates from 0fr → 1fr so height:auto works correctly */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </section>
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RoleDefinition {
  role: string
  display_name: string
  description: string
  icon: string
  base_prompt: string
}

interface AgentProfile {
  role: string
  custom_context: string
  updated_at?: string
}

interface InstalledSkill {
  id: string
  library_id: string
  display_name: string
  icon: string
  category: string
  description: string
  skill_content: string
  created_at: string
  updated_at: string
}

// ── Landing content ───────────────────────────────────────────────────────────

const PRINCIPLES = [
  {
    icon: '📋',
    title: 'Specs drive everything',
    body: 'The Controller scores your spec from 1–5. A score of 1 gets a single micro agent and one sprint. A score of 5 unlocks an enterprise team of 50+ agents across 20 sprints. Write with clarity: state your stack, your acceptance criteria, and your constraints. The more precise your spec, the more your agents can deliver.',
  },
  {
    icon: '🔗',
    title: 'Agents collaborate, not just execute',
    body: 'Each role in the team plays a distinct part of the delivery chain. The Architect designs before the Coder builds. The Reviewer inspects before the Auditor approves. The Banker watches every token. Agents can spawn sub-teams for complex tasks and escalate conflicts to the Mediator. Your project benefits from that coordination automatically.',
  },
  {
    icon: '🎛️',
    title: 'Customize without replacing',
    body: "Every agent has a core identity that cannot be changed — it is what makes each role reliable. What you can do is inject custom context: house style, preferred libraries, naming conventions, domain vocabulary. That context is appended to the agent's base prompt across all your projects, personalizing every agent without sacrificing the baseline guarantee.",
  },
  {
    icon: '⏱️',
    title: 'Sprint cadence is intentional',
    body: 'Sprints are not just organizational units — they are checkpoints. After each sprint the Auditor scores the output against your spec. If tasks failed, the sprint enters review. Multi-sprint projects build cumulatively: later agents have context from earlier work. Keep sprint goals focused and narrow for best results.',
  },
  {
    icon: '💰',
    title: 'Budget is a guardrail, not a ceiling',
    body: 'The Banker monitors every token and dollar in real time. Crossing the warning threshold suspends non-essential spawning. Crossing the hard limit stops execution entirely. Set your budget deliberately: micro projects need very little; enterprise projects can run into the tens of dollars. You can always adjust budget in project settings.',
  },
  {
    icon: '📦',
    title: 'Files are your deliverable',
    body: 'Agents emit deliverables inside <file path="..."> tags in their task output. Pantheon extracts these automatically into the Files tab where you can browse and download a zip. For static web projects, agents use hotlinked stock imagery and output every CSS and JS file as a separate block — no binary assets are required.',
  },
]

const TIPS = [
  'Name your stack explicitly: "Next.js 14, Supabase, Tailwind CSS" beats "a web app".',
  'Include acceptance criteria: "Clicking Submit posts to /api/contact and shows a success toast."',
  'Mention non-functional requirements: "Must work without JavaScript", "mobile-first layout".',
  'Flag what NOT to build if scope creep is a risk: "Do not add authentication."',
  'Use the Custom Context field below to inject house style once — it applies to every future project.',
  "Pause a running project at any time; the Banker's checkpoint prevents runaway spend.",
]

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  // Core roster state
  const [definitions, setDefinitions] = useState<RoleDefinition[]>([])
  const [profiles, setProfiles]       = useState<Record<string, string>>({})
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [editing, setEditing]         = useState<string | null>(null)
  const [drafts, setDrafts]           = useState<Record<string, string>>({})
  const [saving, setSaving]           = useState<string | null>(null)
  const [saved, setSaved]             = useState<string | null>(null)
  const [rosterLoading, setRosterLoading] = useState(true)

  // Skills library state
  const [librarySkills, setLibrarySkills]     = useState<LibrarySkillMeta[]>([])
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([])
  const [libraryTab, setLibraryTab]           = useState<'browse' | 'installed'>('browse')
  const [activeCategory, setActiveCategory]   = useState<LibraryCategory | 'all'>('all')
  const [libraryLoading, setLibraryLoading]   = useState(true)
  const [installLoading, setInstallLoading]   = useState<Record<string, boolean>>({})
  const [previewSkill, setPreviewSkill]       = useState<string | null>(null)
  const [previewBody, setPreviewBody]         = useState<string>('')
  const [previewLoading, setPreviewLoading]   = useState(false)
  const [editingInstalled, setEditingInstalled] = useState<string | null>(null)
  const [installedDrafts, setInstalledDrafts]   = useState<Record<string, string>>({})
  const [installedSaving, setInstalledSaving]   = useState<string | null>(null)
  const [installedSaved, setInstalledSaved]     = useState<string | null>(null)

  const load = useCallback(async () => {
    const [rolesRes, profilesRes] = await Promise.all([
      fetch('/api/settings/roles'),
      fetch('/api/settings/agents'),
    ])
    if (rolesRes.ok) setDefinitions(await rolesRes.json())
    if (profilesRes.ok) {
      const data: AgentProfile[] = await profilesRes.json()
      const map: Record<string, string> = {}
      data.forEach(p => { map[p.role] = p.custom_context })
      setProfiles(map)
    }
    setRosterLoading(false)
  }, [])

  const loadLibrary = useCallback(async () => {
    const [libRes, installedRes] = await Promise.all([
      fetch('/api/agents/library'),
      fetch('/api/agents/skills'),
    ])
    if (libRes.ok) setLibrarySkills(await libRes.json())
    if (installedRes.ok) setInstalledSkills(await installedRes.json())
    setLibraryLoading(false)
  }, [])

  useEffect(() => {
    void load()
    void loadLibrary()
  }, [load, loadLibrary])

  // ── Roster handlers ────────────────────────────────────────────────────────

  const handleEdit = (role: string) => {
    setEditing(role)
    setDrafts(d => ({ ...d, [role]: profiles[role] ?? '' }))
  }

  const handleCancel = (role: string) => {
    setEditing(null)
    setDrafts(d => ({ ...d, [role]: profiles[role] ?? '' }))
  }

  const handleSave = async (role: string) => {
    setSaving(role)
    const res = await fetch('/api/settings/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, custom_context: drafts[role] ?? '' }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProfiles(p => ({ ...p, [role]: updated.custom_context }))
      setSaved(role)
      setEditing(null)
      setTimeout(() => setSaved(null), 2500)
    }
    setSaving(null)
  }

  const handleClear = async (role: string) => {
    setSaving(role)
    const res = await fetch('/api/settings/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, custom_context: '' }),
    })
    if (res.ok) {
      setProfiles(p => ({ ...p, [role]: '' }))
      setDrafts(d => ({ ...d, [role]: '' }))
      setEditing(null)
    }
    setSaving(null)
  }

  // ── Library handlers ───────────────────────────────────────────────────────

  const installedIds = new Set(installedSkills.map(s => s.library_id))

  const handlePreview = async (id: string) => {
    if (previewSkill === id) { setPreviewSkill(null); return }
    setPreviewSkill(id)
    setPreviewBody('')
    setPreviewLoading(true)
    const res = await fetch(`/api/agents/library/${id}`)
    if (res.ok) {
      const data = await res.json()
      setPreviewBody(data.body ?? '')
    }
    setPreviewLoading(false)
  }

  const handleInstall = async (skill: LibrarySkillMeta) => {
    setInstallLoading(l => ({ ...l, [skill.id]: true }))
    const bodyRes = await fetch(`/api/agents/library/${skill.id}`)
    if (!bodyRes.ok) { setInstallLoading(l => ({ ...l, [skill.id]: false })); return }
    const { body } = await bodyRes.json()

    const res = await fetch('/api/agents/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        library_id:    skill.id,
        display_name:  skill.display_name,
        icon:          skill.icon,
        category:      skill.category,
        description:   skill.description,
        skill_content: body,
      }),
    })
    if (res.ok) {
      const installed: InstalledSkill = await res.json()
      setInstalledSkills(s => [...s.filter(x => x.library_id !== skill.id), installed])
    }
    setInstallLoading(l => ({ ...l, [skill.id]: false }))
  }

  const handleUninstall = async (libraryId: string) => {
    setInstallLoading(l => ({ ...l, [libraryId]: true }))
    const res = await fetch('/api/agents/skills', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library_id: libraryId }),
    })
    if (res.ok) setInstalledSkills(s => s.filter(x => x.library_id !== libraryId))
    setInstallLoading(l => ({ ...l, [libraryId]: false }))
  }

  const handleEditInstalled = (libraryId: string, currentContent: string) => {
    setEditingInstalled(libraryId)
    setInstalledDrafts(d => ({ ...d, [libraryId]: currentContent }))
  }

  const handleSaveInstalled = async (libraryId: string) => {
    setInstalledSaving(libraryId)
    const res = await fetch('/api/agents/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library_id: libraryId, skill_content: installedDrafts[libraryId] }),
    })
    if (res.ok) {
      const updated: InstalledSkill = await res.json()
      setInstalledSkills(s => s.map(x => x.library_id === libraryId ? updated : x))
      setInstalledSaved(libraryId)
      setEditingInstalled(null)
      setTimeout(() => setInstalledSaved(null), 2500)
    }
    setInstalledSaving(null)
  }

  const filteredLibrary = activeCategory === 'all'
    ? librarySkills
    : librarySkills.filter(s => s.category === activeCategory)

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-16">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl select-none" aria-hidden>🤖</span>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
          Pantheon runs a coordinated team of specialist AI agents against your project spec. Each agent has a
          fixed role, a fixed identity, and a deterministic place in the delivery chain. Understanding how they
          work — and how to give them the best material to work with — is the difference between a great result
          and a mediocre one.
        </p>
      </section>

      {/* ── Principles ───────────────────────────────────────────── */}
      <Accordion title="How to get the best results" subtitle="Specs, collaboration, budgets, and deliverables">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PRINCIPLES.map(p => (
            <div
              key={p.title}
              className="rounded-xl border border-border bg-[#0f0f0f] p-5 space-y-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg select-none" aria-hidden>{p.icon}</span>
                <h3 className="text-sm font-semibold">{p.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </Accordion>

      {/* ── Tips ─────────────────────────────────────────────────── */}
      <Accordion title="Quick tips" subtitle="Writing better specs and working with agents">
        <ul className="space-y-2.5">
          {TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-3 text-xs text-muted-foreground">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {i + 1}
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </Accordion>

      {/* ── Skills Library ───────────────────────────────────────── */}
      <section className="space-y-5">
        <div>
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Skills library</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Install specialist agent skills built into Pantheon. Installed skills are available to the
                Controller as named agent types and can be edited to add your own context.
              </p>
            </div>
            {installedSkills.length > 0 && (
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-medium mt-0.5">
                {installedSkills.length} installed
              </span>
            )}
          </div>
          <div className="h-px bg-border mt-3" />
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-secondary/40 rounded-lg p-1 w-fit">
          {(['browse', 'installed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setLibraryTab(tab)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-md font-medium transition-all capitalize',
                libraryTab === tab
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'installed' ? `My skills ${installedSkills.length > 0 ? `(${installedSkills.length})` : ''}` : 'Browse'}
            </button>
          ))}
        </div>

        {/* ── Browse tab ── */}
        {libraryTab === 'browse' && (
          <div className="space-y-4">
            {/* Category filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategory('all')}
                className={cn(
                  'text-xs px-3 py-1 rounded-full border transition-all',
                  activeCategory === 'all'
                    ? 'bg-primary/15 text-primary border-primary/30 font-medium'
                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                )}
              >
                All ({librarySkills.length})
              </button>
              {LIBRARY_CATEGORIES.map(cat => {
                const count = librarySkills.filter(s => s.category === cat.id).length
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      'text-xs px-3 py-1 rounded-full border transition-all',
                      activeCategory === cat.id
                        ? 'bg-primary/15 text-primary border-primary/30 font-medium'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                    )}
                  >
                    {cat.icon} {cat.label} ({count})
                  </button>
                )
              })}
            </div>

            {/* Skill grid */}
            {libraryLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-xl border border-border bg-card animate-shimmer" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredLibrary.map(skill => {
                  const isInstalled = installedIds.has(skill.id)
                  const isLoading   = installLoading[skill.id]
                  const isPreviewed = previewSkill === skill.id

                  return (
                    <div
                      key={skill.id}
                      className={cn(
                        'rounded-xl border bg-card overflow-hidden transition-all',
                        isInstalled ? 'border-primary/40' : 'border-border'
                      )}
                    >
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span className="text-xl mt-0.5 select-none">{skill.icon}</span>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-sm font-semibold leading-tight">{skill.display_name}</h3>
                                {isInstalled && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-medium">
                                    installed
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                                {skill.description}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handlePreview(skill.id)}
                            className="text-[11px] text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors"
                          >
                            {isPreviewed ? '▲ Hide' : '▼ Preview'}
                          </button>
                          {isInstalled ? (
                            <button
                              onClick={() => handleUninstall(skill.id)}
                              disabled={isLoading}
                              className="text-[11px] text-red-400/80 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 rounded px-2 py-1 transition-colors disabled:opacity-50"
                            >
                              {isLoading ? 'Removing…' : 'Uninstall'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleInstall(skill)}
                              disabled={isLoading}
                              className="text-[11px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded px-2 py-1 font-medium transition-colors disabled:opacity-50"
                            >
                              {isLoading ? 'Installing…' : '+ Install'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline preview */}
                      {isPreviewed && (
                        <div className="border-t border-border px-4 py-3">
                          {previewLoading ? (
                            <div className="h-24 rounded bg-secondary/30 animate-shimmer" />
                          ) : (
                            <pre className="text-[10px] font-mono bg-secondary/30 rounded-lg p-3 whitespace-pre-wrap text-muted-foreground leading-relaxed overflow-x-auto max-h-64">
                              {previewBody}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── My Skills tab ── */}
        {libraryTab === 'installed' && (
          <div className="space-y-3">
            {libraryLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl border border-border bg-card animate-shimmer" />
                ))}
              </div>
            ) : installedSkills.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No skills installed yet</p>
                <p className="text-xs text-muted-foreground/60">
                  Browse the library and install specialist skills to extend your agent team.
                </p>
                <button
                  onClick={() => setLibraryTab('browse')}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Browse the library →
                </button>
              </div>
            ) : (
              installedSkills.map(skill => {
                const isEditing = editingInstalled === skill.library_id
                const isSaving  = installedSaving === skill.library_id
                const justSaved = installedSaved === skill.library_id

                return (
                  <InstalledSkillCard
                    key={skill.library_id}
                    skill={skill}
                    draft={installedDrafts[skill.library_id] ?? skill.skill_content}
                    isEditing={isEditing}
                    isSaving={isSaving}
                    justSaved={justSaved}
                    onEdit={() => handleEditInstalled(skill.library_id, skill.skill_content)}
                    onCancel={() => setEditingInstalled(null)}
                    onSave={() => handleSaveInstalled(skill.library_id)}
                    onUninstall={() => handleUninstall(skill.library_id)}
                    onDraftChange={val => setInstalledDrafts(d => ({ ...d, [skill.library_id]: val }))}
                  />
                )
              })
            )}
          </div>
        )}
      </section>

      {/* ── Agent Roster ─────────────────────────────────────────── */}
      <section className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Core agent roster</h2>
          <p className="text-xs text-muted-foreground mb-3">
            View each built-in agent's identity and inject your own custom context — appended to the base prompt across all projects.
          </p>
          <div className="h-px bg-border mb-1" />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs text-muted-foreground bg-secondary/30 border border-border rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
            <span>Base prompt — immutable, always applied</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>Your custom context — appended on top</span>
          </div>
        </div>

        {rosterLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl border border-border bg-card animate-shimmer" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {definitions.map(def => (
              <AgentCard
                key={def.role}
                def={def}
                customContext={profiles[def.role] ?? ''}
                draft={drafts[def.role] ?? profiles[def.role] ?? ''}
                isExpanded={expanded === def.role}
                isEditing={editing === def.role}
                isSaving={saving === def.role}
                justSaved={saved === def.role}
                onToggleExpand={() => setExpanded(e => e === def.role ? null : def.role)}
                onEdit={() => handleEdit(def.role)}
                onCancel={() => handleCancel(def.role)}
                onSave={() => handleSave(def.role)}
                onClear={() => handleClear(def.role)}
                onDraftChange={val => setDrafts(d => ({ ...d, [def.role]: val }))}
              />
            ))}
          </div>
        )}
      </section>

    </div>
  )
}

// ── InstalledSkillCard ────────────────────────────────────────────────────────

interface InstalledSkillCardProps {
  skill: InstalledSkill
  draft: string
  isEditing: boolean
  isSaving: boolean
  justSaved: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onUninstall: () => void
  onDraftChange: (val: string) => void
}

function InstalledSkillCard({
  skill, draft, isEditing, isSaving, justSaved,
  onEdit, onCancel, onSave, onUninstall, onDraftChange,
}: InstalledSkillCardProps) {
  return (
    <div className="bg-card border border-primary/30 rounded-xl overflow-hidden transition-all">

      {/* Header */}
      <div className="flex items-start gap-4 px-5 py-4">
        <span className="text-2xl mt-0.5 select-none">{skill.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">{skill.display_name}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-medium">
              installed
            </span>
            <span className="text-[10px] text-muted-foreground font-mono bg-secondary/60 px-1.5 py-0.5 rounded capitalize">
              {skill.category}
            </span>
            {justSaved && <span className="text-xs text-green-400 animate-fade-in">✓ Saved</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{skill.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing && (
            <button
              onClick={onEdit}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2.5 py-1 transition-colors"
            >
              Edit skill
            </button>
          )}
          <button
            onClick={onUninstall}
            className="text-xs text-red-400/70 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 rounded px-2.5 py-1 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Editor */}
      {isEditing && (
        <div className="border-t border-border px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            Skill content — the full system prompt used when this agent is invoked
            <span className="text-muted-foreground/60">— editable</span>
          </p>
          <textarea
            value={draft}
            onChange={e => onDraftChange(e.target.value)}
            rows={12}
            className="w-full input-field text-xs font-mono resize-y leading-relaxed"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-3 py-1.5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded px-3 py-1.5 font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

// ── AgentCard ─────────────────────────────────────────────────────────────────

interface AgentCardProps {
  def: RoleDefinition
  customContext: string
  draft: string
  isExpanded: boolean
  isEditing: boolean
  isSaving: boolean
  justSaved: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onClear: () => void
  onDraftChange: (val: string) => void
}

function AgentCard({
  def, customContext, draft,
  isExpanded, isEditing, isSaving, justSaved,
  onToggleExpand, onEdit, onCancel, onSave, onClear, onDraftChange,
}: AgentCardProps) {
  const hasCustom = customContext.trim().length > 0

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden transition-all">

      {/* Header */}
      <div className="flex items-start gap-4 px-5 py-4">
        <span className="text-2xl mt-0.5 select-none">{def.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">{def.display_name}</h3>
            <span className="text-xs text-muted-foreground font-mono bg-secondary/60 px-1.5 py-0.5 rounded">
              {def.role}
            </span>
            {hasCustom && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-medium">
                customized
              </span>
            )}
            {justSaved && (
              <span className="text-xs text-green-400 animate-fade-in">✓ Saved</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{def.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing && (
            <button
              onClick={onEdit}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2.5 py-1 transition-colors"
            >
              {hasCustom ? 'Edit' : '+ Add context'}
            </button>
          )}
          <button
            onClick={onToggleExpand}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2.5 py-1 transition-colors"
            aria-label={isExpanded ? 'Collapse base prompt' : 'View base prompt'}
          >
            {isExpanded ? '▲ Hide' : '▼ Base prompt'}
          </button>
        </div>
      </div>

      {/* Base prompt — read only */}
      {isExpanded && (
        <div className="border-t border-border mx-5 mb-4">
          <p className="text-xs text-muted-foreground mt-3 mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 inline-block" />
            Base prompt — read only
          </p>
          <pre className="text-xs font-mono bg-secondary/30 rounded-lg p-4 whitespace-pre-wrap text-muted-foreground leading-relaxed overflow-x-auto">
            {def.base_prompt}
          </pre>
        </div>
      )}

      {/* Custom context editor */}
      {isEditing && (
        <div className="border-t border-border px-5 py-4 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              Your custom context
              <span className="text-muted-foreground/60">— appended after the base prompt for all your projects</span>
            </p>
            <textarea
              value={draft}
              onChange={e => onDraftChange(e.target.value)}
              placeholder={`Add custom instructions for ${def.display_name} agents…\n\nExamples:\n- "Always output TypeScript, never JavaScript"\n- "Follow our internal naming convention: components use PascalCase, utilities use camelCase"\n- "When in doubt, ask the Controller before proceeding"`}
              rows={6}
              className="w-full input-field text-sm font-mono resize-y"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 justify-between">
            <button
              onClick={onClear}
              disabled={isSaving || !customContext}
              className="text-xs text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
            >
              Clear
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onCancel}
                className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={isSaving}
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground rounded px-3 py-1.5 font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom context preview */}
      {!isEditing && hasCustom && (
        <div className="border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            Your custom context
          </p>
          <p className="text-xs text-foreground/70 font-mono whitespace-pre-wrap line-clamp-3">
            {customContext}
          </p>
        </div>
      )}

    </div>
  )
}
