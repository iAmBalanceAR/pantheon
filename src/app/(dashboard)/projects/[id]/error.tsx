'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Project error]', error)
  }, [error])

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 animate-fade-up">
      <div className="w-5 h-5 rounded bg-destructive/20 border border-destructive/30 mb-6" aria-hidden />
      <h2 className="text-title mb-1">Failed to load project</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {error.message || 'Something went wrong loading this project.'}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
        <Link
          href="/projects"
          className="h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center"
        >
          All projects
        </Link>
      </div>
    </div>
  )
}
