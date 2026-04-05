'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, FileCode, FolderArchive, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileRow {
  id: string
  path: string
  updated_at: string
  task_id: string | null
  agent_id: string | null
}

export default function ProjectFilesPage() {
  const { id } = useParams<{ id: string }>()
  const [files, setFiles] = useState<FileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zipLoading, setZipLoading] = useState(false)

  const load = async () => {
    setError(null)
    const res = await fetch(`/api/projects/${id}/files`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.detail ?? data.error ?? 'Failed to load files')
      setFiles([])
      setLoading(false)
      return
    }
    setFiles(data.files ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [id])

  const handleDownloadZip = async () => {
    setZipLoading(true)
    try {
      const res = await fetch(`/api/projects/${id}/files/zip`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.detail ?? data.error ?? 'Zip failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `deliverables-${String(id).slice(0, 8)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setZipLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <Loader2 size={22} className="text-primary animate-spin" strokeWidth={2} />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-display text-foreground">Deliverable files</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            When agents finish tasks using <code className="text-2xs font-mono text-primary/90">&lt;file path=&quot;…&quot;&gt;</code>{' '}
            blocks, Pantheon saves them here. Download everything as a zip to open in your editor or run locally.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadZip}
          disabled={zipLoading || files.length === 0}
          className={cn(
            'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold shrink-0',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          {zipLoading ? (
            <Loader2 size={16} className="animate-spin" strokeWidth={2} />
          ) : (
            <FolderArchive size={16} strokeWidth={2} />
          )}
          Download all (.zip)
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-100/90">
          {error}
        </div>
      )}

      {files.length === 0 && !error && (
        <div className="p-10 rounded-2xl border border-border bg-[#0f0f0f] text-center space-y-2">
          <FileCode size={28} className="mx-auto text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-foreground font-medium">No files extracted yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Run the project and let coding tasks complete. The Coder (and other roles that emit structured{' '}
            <code className="font-mono">&lt;file&gt;</code> blocks) will populate this tab automatically.
          </p>
        </div>
      )}

      {files.length > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden bg-[#0f0f0f]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-2xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Path</th>
                <th className="px-4 py-3 font-medium w-44 hidden sm:table-cell">Updated</th>
                <th className="px-4 py-3 font-medium w-28 text-right">Download</th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs text-foreground break-all">{f.path}</td>
                  <td className="px-4 py-3 text-2xs text-muted-foreground hidden sm:table-cell">
                    {new Date(f.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/projects/${id}/files/by-id/${f.id}`}
                      download
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Download size={12} strokeWidth={2.5} />
                      Get
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
