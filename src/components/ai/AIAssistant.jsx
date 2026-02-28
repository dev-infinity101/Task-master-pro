/**
 * AIAssistant.jsx — AI Features side panel
 *
 * Automation-only: Daily Plan / Decompose / Weekly Review.
 * Chat mode has been removed — AI is limited to structured outputs only.
 * The panel is a global Sheet overlay rendered in App.jsx.
 */

import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import EnergyCubeIcon from '../ui/EnergyCubeIcon'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'

// Lazy-load the AI features panel for bundle efficiency
const AIFeaturesPanel = lazy(() => import('./AIFeaturesPanel'))

// ── Features Loader ───────────────────────────────────────────────────────────

function FeaturesLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 text-primary animate-spin" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AIAssistant() {
  const { aiPanelOpen, setAIPanelOpen } = useStore(useShallow(s => ({
    aiPanelOpen: s.aiPanelOpen,
    setAIPanelOpen: s.setAIPanelOpen,
  })))

  return (
    <Sheet open={aiPanelOpen} onOpenChange={setAIPanelOpen}>
      <SheetContent className="flex flex-col p-0 w-full sm:max-w-md border-l border-border bg-background">

        {/* ── Header ─────────────────────────────────────────────── */}
        <SheetHeader className="px-4 pt-4 pb-3 shrink-0 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center overflow-hidden">
              <EnergyCubeIcon size={28} className="text-primary" />
            </div>
            <div>
              <SheetTitle className="text-sm font-bold leading-none">AI Intelligence</SheetTitle>
              <SheetDescription className="text-[11px] mt-0.5">Automation powered by OpenRouter</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ── AI Features ─────────────────────────────────────────── */}
        <ScrollArea className="flex-1 px-4 pt-4 pb-4">
          <Suspense fallback={<FeaturesLoader />}>
            <AIFeaturesPanel />
          </Suspense>
        </ScrollArea>

      </SheetContent>
    </Sheet>
  )
}
