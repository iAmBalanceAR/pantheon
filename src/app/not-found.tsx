import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#f5f5f5] flex items-center justify-center p-6 font-sans">
      <div className="max-w-sm w-full">
        <div className="text-[#CBF43A] text-6xl font-black tracking-tight mb-4 leading-none">404</div>
        <h1 className="text-lg font-semibold mb-2">Page not found</h1>
        <p className="text-sm text-[#707070] mb-6">
          This page doesn't exist or you don't have access to it.
        </p>
        <Link
          href="/projects"
          className="inline-flex h-9 px-4 items-center rounded-lg bg-[#CBF43A] text-[#0d0d0d] text-sm font-semibold hover:bg-[#b8df34] transition-colors"
        >
          Back to projects
        </Link>
      </div>
    </div>
  )
}
