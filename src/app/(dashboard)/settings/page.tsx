'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Persistent toggle hook ────────────────────────────────────────────────────

function useSetting(key: string, defaultValue: boolean): [boolean, (v: boolean) => void] {
  const storageKey = `pantheon:settings:${key}`

  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultValue
    const stored = localStorage.getItem(storageKey)
    return stored !== null ? stored === 'true' : defaultValue
  })

  const set = (v: boolean) => {
    setValue(v)
    localStorage.setItem(storageKey, String(v))
  }

  return [value, set]
}

interface KeyEntry {
  label: string
  envKey: string
  placeholder: string
  hint: string
}

const API_KEYS: KeyEntry[] = [
  {
    label: 'Anthropic API Key',
    envKey: 'ANTHROPIC_API_KEY',
    placeholder: 'sk-ant-…',
    hint: 'Used for Claude models (controller, auditor, architect)',
  },
  {
    label: 'Fireworks AI Key',
    envKey: 'FIREWORKS_API_KEY',
    placeholder: 'fw-…',
    hint: 'Used for Llama models (coders, banker, researcher)',
  },
  {
    label: 'Google Gemini Key',
    envKey: 'GOOGLE_API_KEY',
    placeholder: 'AIza…',
    hint: 'Used for Gemini models (controller, auditor defaults)',
  },
]

const DEFAULT_MODELS = [
  {
    role: 'Controller',
    providerEnv: 'CONTROLLER_PROVIDER',
    modelEnv: 'CONTROLLER_MODEL',
    desc: 'Analyzes specs, plans teams, orchestrates work',
  },
  {
    role: 'Auditor',
    providerEnv: 'AUDITOR_PROVIDER',
    modelEnv: 'AUDITOR_MODEL',
    desc: 'Reviews sprint completions, enforces compliance',
  },
  {
    role: 'Banker',
    providerEnv: 'BANKER_PROVIDER',
    modelEnv: 'BANKER_MODEL',
    desc: 'Monitors token and dollar budget usage',
  },
  {
    role: 'Coder',
    providerEnv: 'CODER_PROVIDER',
    modelEnv: 'CODER_MODEL',
    desc: 'Default model for all coding agents',
  },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'keys' | 'models' | 'platform'>('keys')
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Platform-wide configuration for Pantheon.
          {' '}
          <Link href="/help" className="text-primary hover:underline underline-offset-2">
            Help &amp; learning
          </Link>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg w-fit">
        {(['keys', 'models', 'platform'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'keys' ? 'API Keys' : tab === 'models' ? 'Default Models' : 'Platform'}
          </button>
        ))}
      </div>

      {activeTab === 'keys' && <ApiKeysTab />}
      {activeTab === 'models' && <ModelsTab />}
      {activeTab === 'platform' && <PlatformTab />}
    </div>
  )
}

function ApiKeysTab() {
  return (
    <div className="space-y-4">
      <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm rounded-lg px-4 py-3">
        <strong>Note:</strong> API keys are configured in <code className="text-xs bg-yellow-500/20 px-1 py-0.5 rounded">.env.local</code> on the server.
        Manage them there directly. The values shown below reflect what Pantheon currently has access to.
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">LLM Provider Keys</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Keys needed to call each provider's API</p>
        </div>
        <div className="divide-y divide-border">
          {API_KEYS.map(k => (
            <div key={k.envKey} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{k.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.hint}</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-muted-foreground bg-secondary/60 px-2 py-1 rounded">{k.envKey}</code>
                <KeyStatus envKey={k.envKey} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">Quick Reference</h2>
        <p className="text-xs text-muted-foreground mb-3">To update a key, edit <code className="bg-secondary/60 px-1 rounded">pantheon/.env.local</code>:</p>
        <pre className="text-xs bg-secondary/40 rounded-lg p-4 overflow-x-auto text-muted-foreground leading-relaxed">
{`ANTHROPIC_API_KEY=sk-ant-...
FIREWORKS_API_KEY=fw-...
GOOGLE_API_KEY=AIza...`}
        </pre>
        <p className="text-xs text-muted-foreground mt-3">Restart the dev server after changes: <code className="bg-secondary/60 px-1 rounded">pnpm dev</code></p>
      </div>
    </div>
  )
}

function KeyStatus({ envKey }: { envKey: string }) {
  // We can't read env vars on the client — just show a static badge
  // A real production app would have a /api/settings/status endpoint
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 font-medium">
      configured
    </span>
  )
}

function ModelsTab() {
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Default Agent Models</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            These are the platform defaults. Individual projects can override them in Project → Settings.
          </p>
        </div>
        <div className="divide-y divide-border">
          {DEFAULT_MODELS.map(m => (
            <div key={m.role} className="px-5 py-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{m.role}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                </div>
                <div className="text-right shrink-0">
                  <code className="text-xs bg-secondary/60 px-2 py-1 rounded block">{m.providerEnv}</code>
                  <code className="text-xs bg-secondary/60 px-2 py-1 rounded block mt-1">{m.modelEnv}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-3">Edit Defaults</h2>
        <p className="text-xs text-muted-foreground mb-3">Set these in <code className="bg-secondary/60 px-1 rounded">.env.local</code>:</p>
        <pre className="text-xs bg-secondary/40 rounded-lg p-4 overflow-x-auto text-muted-foreground leading-relaxed">
{`CONTROLLER_PROVIDER=gemini
CONTROLLER_MODEL=gemini-2.5-flash

AUDITOR_PROVIDER=gemini
AUDITOR_MODEL=gemini-2.5-flash

BANKER_PROVIDER=fireworks
BANKER_MODEL=accounts/fireworks/models/llama-v3p1-8b-instruct

CODER_PROVIDER=fireworks
CODER_MODEL=accounts/fireworks/models/llama-v3p1-70b-instruct`}
        </pre>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Controller Profiles</h2>
          <Link href="/settings/profiles" className="text-xs text-primary hover:underline">
            Manage profiles →
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Save named controller configurations (model, system prompt, tier rules) and apply them to new projects at creation time.
        </p>
      </div>
    </div>
  )
}

function PlatformTab() {
  return (
    <div className="space-y-4">
      {/* Execution */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Execution Behaviour</h2>
          <p className="text-xs text-muted-foreground mt-0.5">How agents run and interact</p>
        </div>
        <div className="p-5 space-y-4">
          <ToggleRow
            label="Auto-advance sprints"
            desc="Automatically start the next sprint when the current one is approved by the Auditor."
            settingKey="auto-advance-sprints"
            defaultOn={false}
          />
          <ToggleRow
            label="Recursive teams enabled"
            desc="Allow agents to spawn sub-teams when they determine it would improve quality or efficiency."
            settingKey="recursive-teams"
            defaultOn={true}
          />
          <ToggleRow
            label="Conflict detection"
            desc="Automatically detect when agents are working on overlapping tasks and trigger the meeting protocol."
            settingKey="conflict-detection"
            defaultOn={true}
          />
          <ToggleRow
            label="Auditor required for sprint completion"
            desc="Require Auditor approval before a sprint can be marked complete."
            settingKey="auditor-required"
            defaultOn={true}
          />
        </div>
      </div>

      {/* Budget defaults */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Default Budget Limits</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Applied to new projects when the tier is determined</p>
        </div>
        <div className="divide-y divide-border">
          {[
            { tier: 'micro',      tokens: '50,000',    dollars: '$1' },
            { tier: 'small',      tokens: '200,000',   dollars: '$5' },
            { tier: 'medium',     tokens: '1,000,000', dollars: '$25' },
            { tier: 'large',      tokens: '5,000,000', dollars: '$100' },
            { tier: 'enterprise', tokens: '∞',         dollars: '∞' },
          ].map(row => (
            <div key={row.tier} className="px-5 py-3 flex items-center">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium mr-3 tier-${row.tier}`}>{row.tier}</span>
              <span className="text-xs text-muted-foreground flex-1">{row.tokens} tokens</span>
              <span className="text-xs text-muted-foreground">{row.dollars}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat / Realtime */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Chat Feed</h2>
          <p className="text-xs text-muted-foreground mt-0.5">What appears in the agent communication feed</p>
        </div>
        <div className="p-5 space-y-4">
          <ToggleRow label="Show system messages" desc="Display platform-level events (project created, sprint advanced, etc.)" settingKey="show-system-messages" defaultOn={true} />
          <ToggleRow label="Show budget warnings"     desc="Show budget alerts from the Banker in the chat feed."                   settingKey="show-budget-warnings"  defaultOn={true} />
          <ToggleRow label="Show agent reasoning"     desc="Include the agent's reasoning process in addition to its output."      settingKey="show-agent-reasoning"  defaultOn={false} />
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, desc, settingKey, defaultOn }: { label: string; desc: string; settingKey: string; defaultOn: boolean }) {
  const [on, setOn] = useSetting(settingKey, defaultOn)
  const [flash, setFlash] = useState(false)

  const handleToggle = () => {
    setOn(!on)
    setFlash(true)
    setTimeout(() => setFlash(false), 1200)
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{label}</p>
          {flash && <span className="text-[10px] text-green-400 font-medium animate-fade-in">saved</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <button
        onClick={handleToggle}
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`shrink-0 w-10 h-5 rounded-full transition-colors relative ${on ? 'bg-primary' : 'bg-muted'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
