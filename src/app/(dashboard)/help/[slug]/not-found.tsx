import Link from 'next/link'

export default function HelpArticleNotFound() {
  return (
    <div className="p-8 max-w-md mx-auto text-center space-y-4">
      <h1 className="text-title text-foreground">Guide not found</h1>
      <p className="text-sm text-muted-foreground">
        That help page does not exist or was moved.
      </p>
      <Link href="/help" className="text-sm text-primary hover:underline underline-offset-2">
        Back to Help &amp; learning
      </Link>
    </div>
  )
}
