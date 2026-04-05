'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard error]', error)
  }, [error])

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-24">
      <div className="max-w-sm w-full animate-fade-up">
        <div className="w-5 h-5 rounded bg-destructive/20 border border-destructive/30 mb-6" aria-hidden />
        <h2 className="text-title mb-1">Something went wrong</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {error.message || 'An unexpected error occurred loading this page.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/projects"
            className="h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center"
          >
            Back to projects
          </Link>
        </div>
      </div>
    </div>
  )
}
