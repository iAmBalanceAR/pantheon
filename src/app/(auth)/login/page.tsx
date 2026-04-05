'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Zap, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/projects')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-up">

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-12">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-primary">
            <Zap size={14} className="text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold tracking-[0.12em] uppercase">Pantheon</span>
        </div>

        {/* Heading */}
        <h1 className="text-display mb-1">
          {isSignUp ? 'Create account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {isSignUp
            ? 'Start orchestrating AI development teams.'
            : 'Sign in to your workspace.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="Email"
            autoComplete="email"
            className="input"
            aria-label="Email address"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading}
            placeholder="Password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            className="input"
            aria-label="Password"
          />

          {error && (
            <div className="text-xs text-red-400 px-1">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className={cn(
              'w-full h-10 rounded-xl text-sm font-semibold',
              'bg-primary text-primary-foreground',
              'hover:bg-primary/90 hover:shadow-[0_0_20px_hsl(73_92%_56%/0.3)]',
              'transition-all duration-150 active:scale-[0.98]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'flex items-center justify-center gap-2'
            )}
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          {' '}
          <button
            onClick={() => { setIsSignUp(s => !s); setError('') }}
            className="text-primary hover:underline"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}
