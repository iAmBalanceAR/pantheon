'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { LLMProvider } from '@/types'

interface ControllerProfile {
  id: string
  name: string
  description: string
  provider: LLMProvider
  model: string
  system_prompt_override: string
  tier_lock: string   // '' = auto, or a fixed tier
  created_at: string
}

const PROVIDERS: LLMProvider[] = ['anthropic', 'fireworks', 'gemini']

const MODELS: Record<LLMProvider, string[]> = {
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-5'],
  fireworks: [
    'accounts/fireworks/models/llama-v3p1-70b-instruct',
    'accounts/fireworks/models/llama-v3p1-8b-instruct',
  ],
  gemini: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
}

const TIER_OPTIONS = ['', 'micro', 'small', 'medium', 'large', 'enterprise']

const BLANK: Omit<ControllerProfile, 'id' | 'created_at'> = {
  name:                   '',
  description:            '',
  provider:               'gemini',
  model:                  'gemini-2.5-flash',
  system_prompt_override: '',
  tier_lock:              '',
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<ControllerProfile[]>([])
  const [editing, setEditing]   = useState<ControllerProfile | null>(null)
  const [form, setForm]         = useState<Omit<ControllerProfile, 'id' | 'created_at'>>(BLANK)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/settings/profiles')
    if (res.ok) setProfiles(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  const handleNew = () => {
    setEditing(null)
    setForm(BLANK)
  }

  const handleEdit = (p: ControllerProfile) => {
    setEditing(p)
    setForm({
      name:                   p.name,
      description:            p.description,
      provider:               p.provider,
      model:                  p.model,
      system_prompt_override: p.system_prompt_override,
      tier_lock:              p.tier_lock,
    })
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError(null)
    const url    = editing ? `/api/settings/profiles/${editing.id}` : '/api/settings/profiles'
    const method = editing ? 'PATCH' : 'POST'
    const res    = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
    setEditing(null)
    setForm(BLANK)
    load()
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/settings/profiles/${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  const set = <K extends keyof typeof BLANK>(key: K, val: typeof BLANK[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Link href="/settings" className="hover:text-foreground">Settings</Link>
        <span>/</span>
        <span>Controller Profiles</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Controller Profiles</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Save reusable controller configurations. Apply a profile when creating a new project.
          </p>
        </div>
        <button
          onClick={handleNew}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Profile
        </button>
      </div>

      {/* Editor */}
      {(editing !== undefined) && form && (
        <div className="bg-card border border-primary/30 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">{editing ? `Edit — ${editing.name}` : 'New Profile'}</h2>
            <button onClick={() => { setEditing(null as unknown as ControllerProfile); setForm(BLANK) }} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
          <div className="p-5 space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-2">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Profile Name</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Fast & Cheap" className="input-field" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Description</label>
                <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description" className="input-field" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Provider</label>
                <select
                  value={form.provider}
                  onChange={e => {
                    const p = e.target.value as LLMProvider
                    set('provider', p)
                    set('model', MODELS[p][0])
                  }}
                  className="input-field"
                >
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Model</label>
                <select
                  value={form.model}
                  onChange={e => set('model', e.target.value)}
                  className="input-field"
                >
                  {MODELS[form.provider].map(m => (
                    <option key={m} value={m}>{m.split('/').at(-1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Tier Lock <span className="text-muted-foreground/50">(leave blank for auto)</span></label>
              <select value={form.tier_lock} onChange={e => set('tier_lock', e.target.value)} className="input-field w-40">
                <option value="">Auto (by spec score)</option>
                {TIER_OPTIONS.slice(1).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">System Prompt Override <span className="text-muted-foreground/50">(optional — replaces the default controller prompt)</span></label>
              <textarea
                value={form.system_prompt_override}
                onChange={e => set('system_prompt_override', e.target.value)}
                rows={6}
                placeholder="Leave blank to use Pantheon's default controller prompt…"
                className="input-field resize-y font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setEditing(null as unknown as ControllerProfile); setForm(BLANK) }}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Update Profile' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile list */}
      {profiles.length === 0 ? (
        <div className="border border-border rounded-xl p-12 text-center">
          <div className="text-3xl mb-3">🎛</div>
          <h2 className="text-base font-medium mb-1">No profiles yet</h2>
          <p className="text-muted-foreground text-sm mb-5 max-w-xs mx-auto">
            Create a profile to save a controller configuration you can reuse across projects.
          </p>
          <button onClick={handleNew} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
            Create first profile
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium">{p.name}</p>
                  {p.tier_lock && (
                    <span className={`text-xs px-2 py-0.5 rounded-full tier-${p.tier_lock}`}>{p.tier_lock}</span>
                  )}
                </div>
                {p.description && <p className="text-xs text-muted-foreground mb-2">{p.description}</p>}
                <div className="flex items-center gap-3">
                  <code className="text-xs bg-secondary/60 px-2 py-0.5 rounded">{p.provider}</code>
                  <code className="text-xs bg-secondary/60 px-2 py-0.5 rounded">{p.model.split('/').at(-1)}</code>
                  {p.system_prompt_override && (
                    <span className="text-xs text-muted-foreground">custom prompt</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleEdit(p)}
                  className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
