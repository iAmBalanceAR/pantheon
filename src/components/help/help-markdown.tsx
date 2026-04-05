'use client'

import Link from 'next/link'
import Markdown from 'react-markdown'

interface HelpMarkdownProps {
  content: string
}

export function HelpMarkdown({ content }: HelpMarkdownProps) {
  return (
    <div className="help-md space-y-4 text-body text-foreground/90">
    <Markdown
      components={{
        h1: ({ children }) => (
          <h1 className="text-display font-bold tracking-tight text-foreground mt-10 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-title text-foreground mt-8 first:mt-0 pb-2 border-b border-border">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold tracking-wide text-foreground mt-6 first:mt-0">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        a: ({ href, children }) => {
          if (href?.startsWith('/')) {
            return (
              <Link href={href} className="text-primary hover:underline underline-offset-2">
                {children}
              </Link>
            )
          }
          return (
            <a
              href={href}
              className="text-primary hover:underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          )
        },
        code: ({ className, children, ...props }) => {
          const isBlock = Boolean(className)
          if (!isBlock) {
            return (
              <code className="px-1.5 py-0.5 rounded bg-secondary/80 text-small font-mono text-foreground/90">
                {children}
              </code>
            )
          }
          return (
            <code className={`${className ?? ''} text-xs font-mono`} {...props}>
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="p-4 rounded-xl border border-border bg-[#0f0f0f] text-small font-mono text-muted-foreground overflow-x-auto">
            {children}
          </pre>
        ),
        hr: () => <div className="sep my-8" aria-hidden />,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/50 pl-4 my-4 text-sm text-muted-foreground italic">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </Markdown>
    </div>
  )
}
