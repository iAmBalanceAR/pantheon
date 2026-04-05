import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getHelpArticle, getAllHelpSlugs } from '@/lib/help/load-help'
import { HelpMarkdown } from '@/components/help/help-markdown'

interface PageProps {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getAllHelpSlugs().map(slug => ({ slug }))
}

export default async function HelpArticlePage({ params }: PageProps) {
  const { slug } = await params
  const article = getHelpArticle(slug)

  if (!article) notFound()

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 animate-fade-up">
      <nav aria-label="Breadcrumb">
        <Link
          href="/help"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} strokeWidth={2.5} aria-hidden />
          All guides
        </Link>
      </nav>

      <header className="space-y-2 pb-2 border-b border-border">
        <h1 className="text-display font-bold tracking-tight text-foreground">
          {article.title}
        </h1>
        {article.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{article.description}</p>
        )}
      </header>

      <article className="pb-12">
        <HelpMarkdown content={article.body} />
      </article>
    </div>
  )
}
