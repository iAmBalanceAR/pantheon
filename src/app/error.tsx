'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Pantheon error]', error)
  }, [error])

  return (
    <html lang="en" className="dark">
      <body className="bg-[#0d0d0d] text-[#f5f5f5] min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="max-w-sm w-full">
          <div className="w-6 h-6 rounded-md bg-[#CBF43A] mb-8" aria-hidden />
          <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-[#707070] mb-6">
            {error.message || 'An unexpected error occurred.'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="h-9 px-4 rounded-lg bg-[#CBF43A] text-[#0d0d0d] text-sm font-semibold hover:bg-[#b8df34] transition-colors"
            >
              Try again
            </button>
            <a
              href="/projects"
              className="h-9 px-4 rounded-lg border border-[#212121] text-sm text-[#707070] hover:text-[#f5f5f5] transition-colors flex items-center"
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
