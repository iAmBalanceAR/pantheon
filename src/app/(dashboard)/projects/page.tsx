'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Play, Pause, Loader2, MoreHorizontal,
  ChevronRight, ArrowRight, CheckCheck, XCircle,
  Clock, Zap, Eye, Copy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogAction, AlertDialogCancel, AlertDialogClose,
} from '@/components/ui/alert-dialog'
import type { Database } from '@/types'

type Project = Database['public']['Tables']['projects']['Row']

const STATUS_LABEL: Record<string, string> = {
  scoping:   'Queued',
  active:    'Running',
  running:   'Running',
  paused:    'Paused',
  reviewing: 'Reviewing',
  completed: 'Complete',
  complete:  'Complete',
  failed:    'Failed',
}

// Three-bucket grouping
const PROJECT_GROUPS = [
  {
    key:      'future',
    label:    'Future Projects',
    sub:      'Ready to launch',
    icon:     '◎',
    statuses: ['scoping'],
  },
  {
    key:      'active',
    label:    'In Process',
    sub:      'Currently underway',
    icon:     '◉',
    statuses: ['active', 'running', 'reviewing', 'paused'],
  },
  {
    key:      'complete',
    label:    'Complete',
    sub:      'Finished projects',
    icon:     '✓',
    statuses: ['completed', 'complete', 'failed'],
  },
] as const

interface ProjectRowProps {
  project: Project
  onAction: (action: string, project: Project) => void
}

// Status icon — each state gets its own character
function StatusIcon({ status }: { status: string }) {
  const isRunning  = status === 'active' || status === 'running'
  const isComplete = status === 'completed' || status === 'complete'
  const isFailed   = status === 'failed'
  const isPaused   = status === 'paused'
  const isReview   = status === 'reviewing'

  if (isComplete) return (
    <CheckCheck size={13} className="text-[#4ade80]" strokeWidth={2} />
  )
  if (isFailed) return (
    <XCircle size={13} className="text-red-400/70" strokeWidth={2} />
  )
  if (isPaused) return (
    <Pause size={11} className="text-[#525252]" strokeWidth={2} />
  )
  if (isReview) return (
    <Eye size={12} className="text-[#60a5fa]" strokeWidth={2} />
  )
  if (isRunning) return (
    <div className="relative w-3 h-3 flex items-center justify-center">
      <span className="absolute inset-0 rounded-full bg-[#4ade80]/30 animate-ping" />
      <Zap size={10} className="text-[#4ade80] relative z-10" strokeWidth={2.5} />
    </div>
  )
  // scoping / future
  return <Clock size={12} className="text-[#facc15]/70" strokeWidth={2} />
}

const ProjectRow = ({ project, onAction }: ProjectRowProps) => {
  const router = useRouter()
  const isRunning  = project.status === 'active' || project.status === 'running'
  const isPaused   = project.status === 'paused'
  const isComplete = project.status === 'completed' || project.status === 'complete'
  const isFailed   = project.status === 'failed'
  const isActive   = ['active', 'running', 'reviewing'].includes(project.status)
  const isDim      = isComplete || isFailed

  const tier = project.resource_tier
  const tierColors: Record<string, string> = {
    micro:      'text-[#444] bg-[#1a1a1a]',
    small:      'text-teal-500/70 bg-teal-950/40',
    medium:     'text-blue-400/70 bg-blue-950/40',
    large:      'text-violet-400/70 bg-violet-950/40',
    enterprise: 'text-primary/70 bg-primary/5',
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 px-6 py-2.5 transition-colors duration-150 cursor-pointer',
        'hover:bg-[#0d0d0d]',
        isRunning  && 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[#4ade80]',
        isPaused   && 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[#525252]',
        project.status === 'reviewing' && 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[#60a5fa]',
        project.status === 'scoping'   && 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[#facc15]/50',
      )}
      onClick={() => router.push(`/projects/${project.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && router.push(`/projects/${project.id}`)}
      aria-label={`Open project ${project.name}`}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 w-4 flex items-center justify-center">
        <StatusIcon status={project.status} />
      </div>

      {/* Name */}
      <span className={cn(
        'flex-1 min-w-0 text-sm font-medium truncate transition-colors duration-150',
        isDim ? 'text-foreground/40' : isActive ? 'text-foreground' : 'text-foreground/70',
        'group-hover:text-foreground'
      )}>
        {project.name}
      </span>

      {/* Tier badge — only when not complete/failed */}
      {tier && !isDim && (
        <span className={cn(
          'hidden sm:inline-flex text-2xs font-mono px-1.5 py-0.5 rounded capitalize flex-shrink-0',
          tierColors[tier] ?? 'text-[#444] bg-[#1a1a1a]'
        )}>
          {tier}
        </span>
      )}

      {/* Date — always shown, quieter when done */}
      <span className={cn(
        'text-2xs font-mono flex-shrink-0 w-20 text-right',
        isDim ? 'text-muted-foreground/25' : 'text-muted-foreground/40'
      )}>
        {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>

      {/* Actions — appear on hover */}
      <div
        className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1"
        onClick={e => e.stopPropagation()}
      >
        {(isRunning || isPaused) && (
          <button
            onClick={() => onAction(isPaused ? 'resume' : 'pause', project)}
            aria-label={isPaused ? 'Resume' : 'Pause'}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors"
          >
            {isPaused ? <Play size={10} strokeWidth={2.5} /> : <Pause size={10} strokeWidth={2.5} />}
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Project options"
              className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors"
            >
              <MoreHorizontal size={13} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAction('open', project)}>
              <Eye size={12} /> Open project
            </DropdownMenuItem>
            {isRunning && (
              <DropdownMenuItem onClick={() => onAction('pause', project)}>
                <Pause size={12} /> Pause
              </DropdownMenuItem>
            )}
            {isPaused && (
              <DropdownMenuItem onClick={() => onAction('resume', project)}>
                <Play size={12} /> Resume
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
              onClick={() => onAction('delete', project)}
            >
              Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

const GroupSection = ({
  groupKey, label, projects, onAction,
}: {
  groupKey: string
  label: string
  projects: Project[]
  onAction: (action: string, project: Project) => void
}) => {
  if (projects.length === 0) return null

  const dotColor =
    groupKey === 'active'  ? 'bg-[#4ade80]' :
    groupKey === 'future'  ? 'bg-[#facc15]' :
    'bg-red-500'

  return (
    <section className="animate-fade-up">
      <div className="px-6 pt-7 pb-2 flex items-center gap-3">
        <span className={cn(
          'w-2 h-2 rounded-full flex-shrink-0',
          dotColor,
          groupKey === 'active' && 'animate-live-pulse'
        )} />
        <span className="text-sm font-semibold tracking-widest uppercase text-foreground">
          {label}
        </span>
        <span className="text-2xs text-muted-foreground/30 font-mono tabular-nums">{projects.length}</span>
      </div>
      <div className="sep mx-6 mb-0.5" />
      {projects.map(p => (
        <ProjectRow key={p.id} project={p} onAction={onAction} />
      ))}
    </section>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    setProjects(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchProjects()
    const channel = supabase
      .channel('projects-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchProjects)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleAction = async (action: string, project: Project) => {
    if (action === 'open') {
      router.push(`/projects/${project.id}`)
      return
    }
    if (action === 'delete') {
      setDeleteTarget(project)
      return
    }
    if (action === 'pause' || action === 'resume') {
      const status = action === 'pause' ? 'paused' : 'running'
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      fetchProjects()
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/projects/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    setDeleting(false)
    fetchProjects()
  }

  const grouped = PROJECT_GROUPS.map(g => ({
    ...g,
    projects: projects.filter(p => (g.statuses as readonly string[]).includes(p.status)),
  }))

  const activeCount    = grouped.find(g => g.key === 'active')?.projects.length ?? 0
  const completeCount  = grouped.find(g => g.key === 'complete')?.projects.length ?? 0
  const hasProjects    = projects.length > 0

  return (
    <div className="max-w-4xl mx-auto w-full px-0 py-0">

      {/* Page header */}
      <div className="px-6 pt-10 pb-8 flex items-end justify-between">
        <div>
          <h1 className="text-hero">Projects</h1>
          {hasProjects && (
            <p className="mt-2 text-sm text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
              {activeCount > 0 && (
                <> · <span className="text-[#4ade80]">{activeCount} active</span></>
              )}
              {completeCount > 0 && (
                <> · <span className="text-muted-foreground/50">{completeCount} complete</span></>
              )}
            </p>
          )}
        </div>
        <Link
          href="/projects/new"
          className={cn(
            'inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 hover:shadow-[0_0_20px_hsl(73_92%_56%/0.3)]',
            'transition-all duration-150 active:scale-[0.97]'
          )}
        >
          New project
          <ArrowRight size={14} strokeWidth={2.5} />
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="px-6 py-16 text-center">
          <Loader2 size={16} className="mx-auto text-muted-foreground animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasProjects && (
        <div className="px-6 py-24 text-center animate-fade-up">
          <div className="w-12 h-12 mx-auto mb-6 rounded-2xl bg-[#141414] border border-border flex items-center justify-center">
            <div className="w-4 h-4 rounded-sm bg-primary opacity-60" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            The stage is set
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto">
            Describe what you want to build and a team of AI agents will figure out how.
          </p>
          <Link
            href="/projects/new"
            className={cn(
              'inline-flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-semibold',
              'bg-primary text-primary-foreground',
              'hover:bg-primary/90 hover:shadow-[0_0_20px_hsl(73_92%_56%/0.3)]',
              'transition-all duration-150'
            )}
          >
            Start your first project
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Project list — three sections */}
      {!loading && hasProjects && (
        <div className="space-y-1 pb-16">
          {grouped.map(g => (
            <GroupSection
              key={g.key}
              groupKey={g.key}
              label={g.label}
              projects={g.projects}
              onAction={handleAction}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogClose className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" />
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project, all agents, sprints, tasks, and chat history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 size={13} className="animate-spin" /> : null}
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
