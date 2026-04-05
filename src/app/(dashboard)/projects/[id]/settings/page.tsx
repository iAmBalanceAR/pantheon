'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Project, LLMProvider } from '@/types'

const PROVIDERS: LLMProvider[] = ['fireworks', 'gemini']

const MODELS: Record<LLMProvider, string[]> = {
  anthropic: [], // not in use
  fireworks: [
    'accounts/fireworks/models/llama-v3p3-70b-instruct',
    'accounts/fireworks/models/llama-v3p1-70b-instruct',
  ],
  gemini: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
}

interface ProjectSettings {
  name: string
  budget_tokens: number
  budget_dollars: number
  controller_provider: LLMProvider
  controller_model: string
  auditor_provider: LLMProvider
  auditor_model: string
  banker_provider: LLMProvider
  banker_model: string
  coder_provider: LLMProvider
  coder_model: string
}

const ROLE_LABELS = [
  { key: 'controller', label: 'Controller', desc: 'Orchestrates teams and plans' },
  { key: 'auditor',    label: 'Auditor',    desc: 'Reviews sprints and code quality' },
  { key: 'banker',     label: 'Banker',     desc: 'Monitors budget usage' },
  { key: 'coder',      label: 'Coder',      desc: 'Default model for coding agents' },
] as const

type RoleKey = typeof ROLE_LABELS[number]['key']

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [project, setProject]     = useState<Project | null>(null)
  const [form, setForm]           = useState<ProjectSettings | null>(null)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`)
    if (!res.ok) return
    const data: Project = await res.json()
    setProject(data)

    const meta = (data.metadata ?? {}) as Record<string, string>
    setForm({
      name:                data.name,
      budget_tokens:       data.budget_tokens,
      budget_dollars:      Number(data.budget_dollars),
      controller_provider: (meta.controller_provider as LLMProvider) ?? 'gemini',
      controller_model:    meta.controller_model ?? 'gemini-2.5-flash',
      auditor_provider:    (meta.auditor_provider as LLMProvider) ?? 'gemini',
      auditor_model:       meta.auditor_model ?? 'gemini-2.5-flash',
      banker_provider:     (meta.banker_provider as LLMProvider) ?? 'fireworks',
      banker_model:        meta.banker_model ?? 'accounts/fireworks/models/llama-v3p3-70b-instruct',
      coder_provider:      (meta.coder_provider as LLMProvider) ?? 'fireworks',
      coder_model:         meta.coder_model ?? 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    })
  }, [id])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:           form.name,
          budget_tokens:  form.budget_tokens,
          budget_dollars: form.budget_dollars,
          metadata: {
            ...((project?.metadata ?? {}) as object),
            controller_provider: form.controller_provider,
            controller_model:    form.controller_model,
            auditor_provider:    form.auditor_provider,
            auditor_model:       form.auditor_model,
            banker_provider:     form.banker_provider,
            banker_model:        form.banker_model,
            coder_provider:      form.coder_provider,
            coder_model:         form.coder_model,
          },
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Save failed')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      load()
    } finally {
      setSaving(false)
    }
  }

  const handlePauseToggle = async () => {
    if (!project) return
    const newStatus = project.status === 'paused' ? 'active' : 'paused'
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) load()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/projects')
    else setDeleting(false)
  }

  const set = <K extends keyof ProjectSettings>(key: K, val: ProjectSettings[K]) =>
    setForm(f => f ? { ...f, [key]: val } : f)

  if (!form || !project) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isPaused = project.status === 'paused'

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-foreground">{project.name}</Link>
        <span>/</span>
        <span>Settings</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Project Settings</h1>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-400 animate-fade-in">✓ Saved</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* General */}
      <SettingsSection title="General" desc="Basic project information">
        <Field label="Project Name">
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="input-field"
          />
        </Field>
      </SettingsSection>

      {/* Budget */}
      <SettingsSection title="Budget" desc="Control how much this project can spend">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Token Budget">
            <input
              type="number"
              value={form.budget_tokens}
              onChange={e => set('budget_tokens', parseInt(e.target.value) || 0)}
              step={10000}
              className="input-field"
            />
            <p className="text-xs text-muted-foreground mt-1">Current usage: {project.tokens_used.toLocaleString()} tokens</p>
          </Field>
          <Field label="Dollar Budget ($)">
            <input
              type="number"
              value={form.budget_dollars}
              onChange={e => set('budget_dollars', parseFloat(e.target.value) || 0)}
              step={0.5}
              className="input-field"
            />
            <p className="text-xs text-muted-foreground mt-1">Current usage: ${Number(project.cost_used).toFixed(4)}</p>
          </Field>
        </div>
      </SettingsSection>

      {/* Model Overrides */}
      <SettingsSection title="Model Overrides" desc="Override the default LLM for each agent role in this project">
        <div className="space-y-5">
          {ROLE_LABELS.map(({ key, label, desc }) => {
            const provKey = `${key}_provider` as keyof ProjectSettings
            const modKey  = `${key}_model`    as keyof ProjectSettings
            const prov    = form[provKey] as LLMProvider
            return (
              <div key={key} className="grid grid-cols-3 gap-3 items-start">
                <div className="pt-1">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Provider</label>
                  <select
                    value={prov}
                    onChange={e => {
                      const p = e.target.value as LLMProvider
                      set(provKey, p)
                      set(modKey, MODELS[p][0] as ProjectSettings[typeof modKey])
                    }}
                    className="input-field text-xs"
                  >
                    {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Model</label>
                  <select
                    value={form[modKey] as string}
                    onChange={e => set(modKey, e.target.value as ProjectSettings[typeof modKey])}
                    className="input-field text-xs"
                  >
                    {MODELS[prov].map(m => (
                      <option key={m} value={m}>{m.split('/').at(-1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      </SettingsSection>

      {/* Project Control */}
      <SettingsSection title="Project Control" desc="Pause, resume, or permanently remove this project">
        <div className="space-y-3">
          {/* Pause / Resume */}
          <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium">{isPaused ? 'Resume Project' : 'Pause Project'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isPaused
                  ? 'Allow agents to continue executing tasks.'
                  : 'Freeze all agent execution immediately. Agents mid-task will finish their current step.'}
              </p>
            </div>
            <button
              onClick={handlePauseToggle}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isPaused
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                  : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
              }`}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
          </div>

          {/* Delete */}
          <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-lg border border-red-500/20">
            <div>
              <p className="text-sm font-medium text-red-400">Delete Project</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently remove this project, all agents, sprints, tasks, and messages. This cannot be undone.
              </p>
            </div>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Are you sure?</span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Info */}
      <SettingsSection title="Info" desc="Read-only project metadata">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ['ID',         project.id],
            ['Status',     project.status],
            ['Tier',       project.resource_tier],
            ['Spec Score', project.spec_score ?? '—'],
            ['Created',    new Date(project.created_at).toLocaleString()],
            ['Updated',    new Date(project.updated_at).toLocaleString()],
          ].map(([k, v]) => (
            <div key={k as string}>
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="font-mono text-xs mt-0.5 truncate">{v}</p>
            </div>
          ))}
        </div>
        {project.spec && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-1">Spec</p>
            <p className="text-xs font-mono bg-secondary/40 rounded-lg p-3 whitespace-pre-wrap">{project.spec}</p>
          </div>
        )}
      </SettingsSection>
    </div>
  )
}

function SettingsSection({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block font-medium">{label}</label>
      {children}
    </div>
  )
}
