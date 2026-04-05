import Link from 'next/link'
import { BookOpen, ArrowRight } from 'lucide-react'
import { listHelpArticles } from '@/lib/help/load-help'

export default function HelpHomePage() {
  const articles = listHelpArticles()

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-10 animate-fade-up">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <BookOpen size={20} strokeWidth={2} aria-hidden />
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            Help &amp; learning
          </span>
        </div>
        <h1 className="text-display font-bold tracking-tight text-foreground">
          How Pantheon works
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
          Guides for using the platform: projects and agents, skills, budgets, and
          where to look when something goes wrong. Start with the overview, or jump
          to what you need.
        </p>
      </header>

      <ul className="space-y-2" aria-label="Help articles">
        {articles.map(a => (
          <li key={a.slug}>
            <Link
              href={`/help/${a.slug}`}
              className="group flex items-start gap-4 p-5 rounded-2xl border border-border bg-[#0f0f0f] hover:border-primary/25 transition-colors"
            >
              <span className="mt-0.5 text-primary opacity-80 group-hover:opacity-100" aria-hidden>
                <ArrowRight size={16} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-foreground group-hover:text-primary/95 transition-colors">
                  {a.title}
                </h2>
                {a.description && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {a.description}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground border-t border-border pt-6">
        Tip: Keep{' '}
        <Link href="/help/faq" className="text-primary hover:underline underline-offset-2">
          FAQ
        </Link>{' '}
        bookmarked for quick answers while you run your first projects.
      </p>
    </div>
  )
}
