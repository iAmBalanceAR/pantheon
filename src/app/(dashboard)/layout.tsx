import { Navbar } from '@/components/layout/navbar'
import { HelpAssistantBubble } from '@/components/help/help-assistant-bubble'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <HelpAssistantBubble />
    </div>
  )
}
