'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Plus, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface NavLinkProps {
  href: string
  children: React.ReactNode
}

const NavLink = ({ href, children }: NavLinkProps) => {
  const pathname = usePathname()
  const isActive = pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={cn(
        'relative px-3 py-1.5 text-sm font-medium transition-colors duration-150',
        isActive
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground/80'
      )}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-3 right-3 h-px bg-foreground/60 rounded-full" />
      )}
    </Link>
  )
}

export const Navbar = () => {
  const [activeAgents, setActiveAgents] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const fetchAgentCount = async () => {
      const { count } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'running')
      setActiveAgents(count ?? 0)
    }

    fetchAgentCount()

    const channel = supabase
      .channel('navbar-agents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, fetchAgentCount)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <header className="sticky top-0 z-50 h-[52px] flex items-center px-6 border-b border-border bg-background/95 backdrop-blur-sm">
      {/* Logo */}
      <Link
        href="/projects"
        className="flex items-center gap-2.5 mr-8 group"
        aria-label="Pantheon home"
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center bg-primary transition-shadow duration-200 group-hover:shadow-[0_0_12px_hsl(73_92%_56%/0.5)]"
          aria-hidden
        >
          <Zap size={13} className="text-primary-foreground" strokeWidth={2.5} />
        </div>
        <span className="text-[13px] font-bold tracking-[0.12em] uppercase text-foreground">
          Pantheon
        </span>
      </Link>

      {/* Primary nav */}
      <nav className="flex items-center gap-1" aria-label="Main navigation">
        <NavLink href="/projects">Projects</NavLink>
        <NavLink href="/agents">Agents</NavLink>
        <NavLink href="/settings">Settings</NavLink>
        <NavLink href="/help">Help</NavLink>
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        {/* Active agents indicator */}
        {activeAgents > 0 && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-[#1e2d1e] bg-[#0d1a0d]">
            <span className="live-dot relative flex h-1.5 w-1.5">
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
            </span>
            <span className="text-2xs font-semibold text-[#4ade80] tracking-wide">
              {activeAgents} running
            </span>
          </div>
        )}

        {/* New project */}
        <Link
          href="/projects/new"
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 transition-all duration-150',
            'hover:shadow-[0_0_16px_hsl(73_92%_56%/0.3)]',
            'active:scale-[0.97]'
          )}
          aria-label="Create new project"
        >
          <Plus size={13} strokeWidth={2.5} />
          New
        </Link>
      </div>
    </header>
  )
}
