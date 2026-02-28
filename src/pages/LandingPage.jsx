import { Link, Navigate } from 'react-router-dom'
import {
  Menu,
  X,
  ArrowRight,
  Star,
  LayoutGrid,
  ListTodo,
  Brain,
  ShieldCheck,
  BarChart2,
  CheckCircle2,
} from 'lucide-react'
import EnergyCubeIcon from '../components/ui/EnergyCubeIcon'
import { useState } from 'react'
import useStore from '../store/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import TaskMasterLogo from '@/components/ui/TaskMasterLogo'
import laptopImg from '../assets/laptop.png'
import tabletImg from '../assets/tablet.png'
import service1Img from '../assets/Service-1.png'
import service2Img from '../assets/Service-2.png'
import service3Img from '../assets/Service-3.png'

/* ── Layout primitives ───────────────────────────────── */

function Container({ className, ...props }) {
  return (
    <div
      className={cn('mx-auto w-full max-w-[1200px] px-6 md:px-10', className)}
      {...props}
    />
  )
}

/* ── Nav ─────────────────────────────────────────────── */

function Nav({ mobileOpen, setMobileOpen }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-[#E5E7EB] h-16">
      <Container className="h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <TaskMasterLogo size={28} showWordmark />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-[13px] font-medium text-[#555555] hover:text-[#111111] transition-colors"
          >
            Features
          </a>
          <a
            href="#ai"
            className="text-[13px] font-medium text-[#555555] hover:text-[#111111] transition-colors"
          >
            AI
          </a>

          <Link
            to="/login"
            className="text-[13px] font-medium text-[#555555] hover:text-[#111111] transition-colors"
          >
            Login
          </Link>
          <Link to="/signup">
            <button className="h-9 px-5 rounded-lg bg-[#111111] text-white text-[13px] font-semibold hover:bg-[#2563EB] transition-colors">
              Sign Up
            </button>
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-[#111111]"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </Container>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden absolute top-16 inset-x-0 bg-white border-b border-[#E5E7EB] p-6 space-y-4 shadow-lg">
          <a
            href="#features"
            className="block text-sm font-medium text-[#555555]"
            onClick={() => setMobileOpen(false)}
          >
            Features
          </a>
          <a
            href="#ai"
            className="block text-sm font-medium text-[#555555]"
            onClick={() => setMobileOpen(false)}
          >
            AI
          </a>
          <Link
            to="/login"
            className="block text-sm font-medium text-[#555555]"
            onClick={() => setMobileOpen(false)}
          >
            Login
          </Link>
          <Link to="/signup" onClick={() => setMobileOpen(false)}>
            <button className="w-full h-10 rounded-lg bg-[#111111] text-white text-sm font-semibold">
              Sign Up
            </button>
          </Link>
        </div>
      )}
    </header>
  )
}

/* ── Hero ────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="pt-32 pb-[120px] bg-[#F7F8FA]">
      <Container>
        <div className="grid lg:grid-cols-[1fr_1fr] gap-16 items-center">
          {/* Left: Copy */}
          <div className="space-y-8">

            <h1 className="hero-headline text-[56px] md:text-[64px] font-bold leading-[1.08] text-[#111111] tracking-tight">
              Your tasks.{' '}
              <span className="text-[#2563EB]">Planned intelligently.</span>
            </h1>

            <p className="body-text text-[18px] leading-[1.6] text-[#555555] max-w-lg">
              Plan, organize, and execute work with real-time sync and
              AI-powered task planning. Built for teams that need to ship
              consistently.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Link to="/signup">
                <button className="ui-label inline-flex items-center gap-2 h-12 px-6 rounded-[10px] bg-[#111111] text-white text-[14px] font-semibold hover:bg-[#2563EB] transition-colors shadow-sm">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-[10px] border border-[#E5E7EB] bg-white text-[#111111] text-[14px] font-medium hover:border-[#111111] transition-colors"
              >
                See how it works
              </a>
            </div>

            <div className="flex flex-col gap-2">
              {/* Stars */}
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 text-[#F59E0B] fill-[#F59E0B]"
                  />
                ))}
                <span className="ml-2 text-[13px] text-[#555555] font-medium">
                  4.9 / 5 from 200+ teams
                </span>
              </div>
              <p className="text-[12px] text-[#888888]">
                Free forever. No credit card required.
              </p>
            </div>
          </div>

          {/* Right: Product screenshot */}
          <div className="relative">
            <div className="absolute -inset-4 bg-[#EFF6FF] rounded-3xl -z-10" />
            <div className="rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.10)] bg-white">
              <div className="h-8 bg-[#F7F8FA] border-b border-[#E5E7EB] flex items-center px-4 gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB]" />
              </div>
              <img
                src={laptopImg}
                alt="TaskMaster dashboard"
                className="w-full object-cover aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}


/* ── Features grid ───────────────────────────────────── */

const FEATURES = [
  {
    icon: LayoutGrid,
    title: 'Kanban & List views',
    desc: 'Visualize your work the way your team thinks. Switch between board and list in one click.',
  },
  {
    icon: Brain,
    title: 'AI task planning',
    desc: 'Describe a goal and let the AI break it into prioritized, actionable tasks automatically.',
  },
  {
    icon: EnergyCubeIcon,
    title: 'Real-time sync',
    desc: 'Every update appears instantly across your team — no refreshing, no conflict, no delay.',
  },
  {
    icon: ListTodo,
    title: 'Subtask hierarchy',
    desc: 'Break complex work into nested tasks. Collapse what you don\'t need. Focus on what matters.',
  },
  {
    icon: BarChart2,
    title: 'Built-in analytics',
    desc: 'Track velocity, completion rate, and overdue tasks across all your projects.',
  },
  {
    icon: ShieldCheck,
    title: 'Security-first',
    desc: 'End-to-end encryption, SSO support, and role-based permissions out of the box.',
  },
]

function FeaturesSection() {
  return (
    <section id="features" className="py-[120px] bg-[#F7F8FA]">
      <Container>
        <div className="text-center mb-16">
          <h2
            className="text-[40px] font-bold text-[#111111] leading-tight"

          >
            Everything you need to execute faster.
          </h2>
          <p className="mt-4 text-[18px] text-[#555555] leading-relaxed max-w-xl mx-auto">
            One workspace, all the tools. No tab-switching, no data silos.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="p-8 bg-white border border-[#E5E7EB] rounded-xl hover:border-[#2563EB]/30 hover:shadow-sm transition-all group"
            >
              {Icon === EnergyCubeIcon ? (
                <div className="flex items-center justify-center mb-5 shrink-0 overflow-hidden w-10 h-10">
                  <Icon size={32} className="text-primary" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center mb-5">
                  <Icon className="h-5 w-5 text-[#2563EB]" />
                </div>
              )}
              <h3 className="section-heading text-[16px] font-semibold text-[#111111] mb-2">
                {title}
              </h3>
              <p className="text-[14px] text-[#555555] leading-[1.6]">{desc}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* ── Screenshot sections (alternating) ──────────────── */

function ScreenshotA() {
  return (
    <section className="py-[120px] bg-white">
      <Container>
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Image left */}
          <div className="rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
            <img
              src={service1Img}
              alt="Kanban workflow"
              className="w-full object-cover aspect-[4/3]"
            />
          </div>

          {/* Text right */}
          <div className="space-y-6">
            <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#2563EB]">
              Project Management
            </p>
            <h2
              className="text-[32px] font-semibold text-[#111111] leading-tight"

            >
              Drag. Drop. Done. Your board, your rules.
            </h2>
            <p className="text-[16px] text-[#555555] leading-[1.6]">
              Move tasks across customizable columns with smooth drag-and-drop.
              Assign priorities, set due dates, and track progress without
              leaving the board.
            </p>
            <ul className="space-y-3">
              {[
                'Custom columns & workflows',
                'Priority levels & due dates',
                'One-click subtask creation',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-[14px] text-[#555555]">
                  <CheckCircle2 className="h-4 w-4 text-[#2563EB] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="#features"
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#2563EB] hover:gap-2.5 transition-all"
            >
              Learn more <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}

function ScreenshotB() {
  return (
    <section id="ai" className="py-[120px] bg-[#F7F8FA]">
      <Container>
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text left */}
          <div className="space-y-6">
            <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#2563EB]">
              AI-Powered
            </p>
            <h2
              className="text-[32px] font-semibold text-[#111111] leading-tight"

            >
              Describe a goal. Get a full task plan instantly.
            </h2>
            <p className="text-[16px] text-[#555555] leading-[1.6]">
              Our AI assistant reads your project context, understands your
              workload, and generates a prioritized breakdown. Review,
              edit, and confirm — it ships in seconds.
            </p>
            <ul className="space-y-3">
              {[
                'Natural language task creation',
                'Auto-priority based on deadlines',
                'Conversation memory across sessions',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-[14px] text-[#555555]">
                  <CheckCircle2 className="h-4 w-4 text-[#2563EB] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="#features"
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#2563EB] hover:gap-2.5 transition-all"
            >
              Learn more <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          {/* Image right */}
          <div className="rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
            <img
              src={service2Img}
              alt="AI task planning"
              className="w-full object-cover aspect-[4/3]"
            />
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ── Deadlines section ───────────────────────────────── */

function DeadlinesSection() {
  return (
    <section className="py-[120px] bg-white">
      <Container>
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Image left */}
          <div className="rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
            <img
              src={service3Img}
              alt="Deadline tracking"
              className="w-full object-cover aspect-[4/3]"
            />
          </div>

          {/* Text right */}
          <div className="space-y-8">
            <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#2563EB]">
              Deadline Tracking
            </p>
            <h2 className="section-heading text-[40px] md:text-[48px] font-bold text-[#111111] leading-[1.1]">
              Meet deadlines.
              <br />
              Stay consistent.
            </h2>
            <p className="text-[18px] text-[#555555] leading-[1.6]">
              A structured system that keeps priorities clear and momentum
              constant. Never miss a deadline because work fell off the radar.
            </p>
            <Link to="/signup">
              <button className="inline-flex items-center gap-2 h-12 px-6 rounded-[10px] bg-[#111111] text-white text-[14px] font-semibold hover:bg-[#2563EB] transition-colors">
                Start for free <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ── Testimonials ────────────────────────────────────── */

const TESTIMONIALS = [
  {
    quote:
      'TaskMaster brought our scattered roadmap into a single, clear view. Shipping velocity improved in the first two weeks.',
    name: 'Leslie Boatwright',
    role: 'CEO, Hillstreet Industries',
    initials: 'LB',
  },
  {
    quote:
      'The AI assistant alone is worth it. I describe a feature and it hands me a full sub-task breakdown. Game-changer.',
    name: 'Carly Ferris',
    role: 'Founder, Vivarily',
    initials: 'CF',
  },
  {
    quote:
      'We tried Jira, Asana, Notion. TaskMaster is the first tool that didn\'t require a 2-hour onboarding session.',
    name: 'Gabriel Shelby',
    role: 'Owner, Stipple Unlimited',
    initials: 'GS',
  },
]

function TestimonialsSection() {
  return (
    <section className="py-[120px] bg-[#F7F8FA]">
      <Container>
        <div className="text-center mb-16">
          <h2
            className="text-[40px] font-bold text-[#111111] leading-tight"

          >
            Trusted by teams that ship.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {TESTIMONIALS.map(({ quote, name, role, initials }) => (
            <div
              key={name}
              className="p-8 bg-white border border-[#E5E7EB] rounded-xl"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 text-[#F59E0B] fill-[#F59E0B]" />
                ))}
              </div>
              <p className="text-[15px] text-[#333333] leading-[1.65] mb-8">
                "{quote}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#111111] flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-white">{initials}</span>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#111111]">{name}</p>
                  <p className="text-[12px] text-[#888888]">{role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

/* ── Final CTA ───────────────────────────────────────── */

function CTASection() {
  return (
    <section className="py-[120px] bg-[#F7F8FA] border-t border-[#E5E7EB]">
      <Container>
        <div className="text-center max-w-2xl mx-auto space-y-8">
          <h2 className="hero-headline text-[48px] md:text-[56px] font-bold text-[#111111] leading-[1.1]">
            Stop managing tasks.
            <br />
            Start shipping work.
          </h2>
          <p className="text-[18px] text-[#555555] leading-relaxed">
            Join thousands of teams who replaced chaos with clarity.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link to="/signup">
              <button className="inline-flex items-center gap-2 h-13 px-8 py-3.5 rounded-[10px] bg-[#111111] text-white text-[15px] font-semibold hover:bg-[#2563EB] transition-colors shadow-sm">
                Create your free workspace
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <p className="text-[13px] text-[#888888]">
              Takes less than 30 seconds to start.
            </p>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ── Footer ──────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="py-12 bg-white border-t border-[#E5E7EB]">
      <Container>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <TaskMasterLogo size={24} showWordmark />
          </div>

          <div className="flex items-center gap-8 text-[13px] text-[#888888]">
            <a href="#features" className="hover:text-[#111111] transition-colors">Features</a>
            <a href="#ai" className="hover:text-[#111111] transition-colors">AI</a>

            <span>help@taskmaster.com</span>
          </div>

          <p className="text-[12px] text-[#888888]">
            © 2026 TaskMaster. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  )
}

/* ── Page ────────────────────────────────────────────── */

export default function LandingPage() {
  const session = useStore((s) => s.session)
  const [mobileOpen, setMobileOpen] = useState(false)

  if (session) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen text-[#111111] selection:bg-[#BFDBFE]">
      <Nav mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main className="pt-16">
        <HeroSection />

        <FeaturesSection />
        <ScreenshotA />
        <ScreenshotB />
        <DeadlinesSection />
        <TestimonialsSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  )
}
