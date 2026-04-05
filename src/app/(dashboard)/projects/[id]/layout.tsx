import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectHeader } from '@/components/layout/project-header'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: { id: string }
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const supabase = await createClient()
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!project) notFound()

  return (
    <div className="flex flex-col min-h-[calc(100dvh-52px)]">
      <ProjectHeader project={project} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
