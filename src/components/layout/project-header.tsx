'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ChevronLeft, Play, Pause, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types'

type Project = Database['public']['Tables']['projects']['Row']

interface ProjectHeaderProps {
  project: Project
}

const TAB_ITEMS = [
  { label: 'Overview',   href: '' },
  { label: 'Live Feed',  href: '/chat' },
  { label: 'Team',       href: '/team' },
  { label: 'Files',      href: '/files' },
  { label: 'Budget',     href: '/budget' },
  { label: 'Report',     href: '/report' },
  { label: 'Settings',   href: '/settings' },
]

const STATUS_LABELS: Record<string, string> = {
  scoping:   'Scoping',
  active:    'Running',
  running:   'Running',
  paused:    'Paused',
  reviewing: 'Reviewing',
  completed: 'Complete',
  complete:  'Complete',
  failed:    'Failed',
}

export const ProjectHeader = ({ project: initial }: ProjectHeaderProps) => {
  const [project, setProject] = useState(initial)
  const [toggling, setToggling] = useState(false)
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  // Keep budget bar + status live as agents run
  useEffect(() => {
    const channel = supabase
      .channel(`header-project-${initial.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${initial.id}` },
        payload => {
          setProject(p => ({ ...p, ...(payload.new as Partial<Project>) }))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [initial.id])

  const baseHref = `/projects/${project.id}`
  const activeTab = TAB_ITEMS.find(t => t.href && pathname.endsWith(t.href))
    ?? (pathname === baseHref ? TAB_ITEMS[0] : TAB_ITEMS[0])

  const isPaused  = project.status === 'paused'
  const isRunning = project.status === 'active' || project.status === 'running'
  const canToggle = isPaused || isRunning

  const handleToggle = async () => {
    if (!canToggle || toggling) return
    setToggling(true)
    const next = isPaused ? 'running' : 'paused'
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) {
        setProject(p => ({ ...p, status: next }))
        router.refresh()
      }
    } finally {
      setToggling(false)
    }
  }

  const statusClass = `status-${project.status}`
  const dotClass    = `dot-${project.status}`

  const budgetUsed  = project.cost_used ?? 0
  const budgetLimit = project.budget_dollars ?? 0
  const budgetPct   = budgetLimit > 0 ? Math.min((budgetUsed / budgetLimit) * 100, 100) : 0

  return (
    <div className="border-b border-border">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 pb-0">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          <ChevronLeft size={12} />
          Projects
        </Link>
      </div>

      {/* Project name + status + controls */}
      <div className="px-6 pt-3 pb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display truncate pr-4">
            {project.name}
          </h1>
        </div>

        {/* Pause / Resume */}
        {canToggle && (
          <button
            onClick={handleToggle}
            disabled={toggling}
            aria-label={isPaused ? 'Resume project' : 'Pause project'}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold',
              'border transition-all duration-150 flex-shrink-0',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isPaused
                ? 'border-[#1e2d1e] bg-[#0d1a0d] text-[#4ade80] hover:bg-[#0f220f] hover:border-[#2a3e2a]'
                : 'border-[#2a2a2a] bg-[#161616] text-[#a3a3a3] hover:text-foreground hover:border-[#3a3a3a]'
            )}
          >
            {toggling ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isPaused ? (
              <Play size={14} strokeWidth={2.5} />
            ) : (
              <Pause size={14} strokeWidth={2.5} />
            )}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        )}
      </div>

      {/* Tab navigation */}
      <nav className="flex items-center px-6 gap-0" aria-label="Project sections">
        {TAB_ITEMS.map(tab => {
          const href = `${baseHref}${tab.href}`
          const isCurrent = tab === activeTab ||
            (tab.href !== '' && pathname.startsWith(href))
          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150',
                isCurrent
                  ? 'text-foreground border-foreground'
                  : 'text-muted-foreground border-transparent hover:text-foreground/70 hover:border-foreground/20'
              )}
              aria-current={isCurrent ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
