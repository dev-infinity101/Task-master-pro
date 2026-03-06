import { Link, Navigate } from 'react-router-dom'
import {
  Menu,
  X,
  ArrowRight,
  Activity,
  Cpu,
  Globe2,
  Terminal,
  CheckCircle2
} from 'lucide-react'
import EnergyCubeIcon from '../components/ui/EnergyCubeIcon'
import { useState, useEffect } from 'react'
import useStore from '../store/store'
import { cn } from '@/lib/utils'
import TaskMasterLogo from '@/components/ui/TaskMasterLogo'

/* ── Custom Parallax / Inertia Hook ───────────────────── */
function useParallax(speed = 0.5) {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    let animationFrameId
    let lastScrollY = window.scrollY
    let currentOffset = 0

    const updateScroll = () => {
      lastScrollY = window.scrollY
    }

    const animate = () => {
      currentOffset += (lastScrollY - currentOffset) * 0.1
      setOffset(currentOffset * speed)
      animationFrameId = requestAnimationFrame(animate)
    }

    window.addEventListener('scroll', updateScroll, { passive: true })
    animate()

    return () => {
      window.removeEventListener('scroll', updateScroll)
      cancelAnimationFrame(animationFrameId)
    }
  }, [speed])

  return offset
}

/* ── Layout primitives ───────────────────────────────── */
function Container({ className, ...props }) {
  return (
    <div
      className={cn('mx-auto w-full max-w-[1400px] px-6 md:px-12', className)}
      {...props}
    />
  )
}

/* ── Nav (Light) ───────────────────────────────────────── */
function Nav({ mobileOpen, setMobileOpen }) {
  return (
    <header className="absolute top-0 inset-x-0 z-50 bg-transparent h-24 transition-all duration-300">
      <Container className="h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group relative">
          <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          <TaskMasterLogo size={32} />
          <span className="text-xl font-bold tracking-tight text-gray-900 font-mono hidden sm:block mt-1">
            TASKMASTER<span className="text-blue-600">_PRO</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-10">
          <a href="#architecture" className="text-[12px] uppercase tracking-[0.2em] font-medium text-gray-500 hover:text-gray-900 transition-colors">Architecture</a>
          <Link to="/login" className="text-[12px] uppercase tracking-[0.2em] font-medium text-gray-500 hover:text-gray-900 transition-colors">Access</Link>
          <Link to="/signup">
            <button className="relative group h-10 px-6 overflow-hidden rounded-none border border-gray-900/20 hover:border-blue-500/60 bg-white text-gray-900 text-[12px] uppercase tracking-[0.1em] font-semibold transition-all shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 ease-out" />
              <span className="relative z-10 font-mono">INITIALIZE</span>
            </button>
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 text-gray-600 hover:text-gray-900 z-50 relative" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </Container>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-white/95 backdrop-blur-2xl flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95">
          <a href="#architecture" onClick={() => setMobileOpen(false)} className="text-lg font-mono uppercase tracking-widest text-gray-500 hover:text-gray-900">Architecture</a>
          <Link to="/login" onClick={() => setMobileOpen(false)} className="text-lg font-mono uppercase tracking-widest text-gray-500 hover:text-gray-900">System Access</Link>
          <Link to="/signup" onClick={() => setMobileOpen(false)}>
            <button className="h-12 px-8 border border-blue-600 text-blue-600 font-mono tracking-widest uppercase hover:bg-blue-600 hover:text-white transition-colors">
              Create Your Workspace
            </button>
          </Link>
        </div>
      )}
    </header>
  )
}

/* ── Hero (Light, Asymmetrical Parallax) ─────────────── */
function HeroSection() {
  const parallax1 = useParallax(0.15)
  const parallax2 = useParallax(0.3)
  const parallax3 = useParallax(-0.1)

  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden bg-[#F8F9FB]">
      {/* Background accents */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 h-[70vh] bg-gradient-to-t from-blue-100/60 via-blue-50/30 to-transparent animate-horizon-breathe" />
        <div className="absolute top-1/4 left-[-10%] w-[120%] h-[1px] bg-gradient-to-r from-transparent via-blue-400/20 to-transparent -rotate-12 transform-gpu" />
        <div className="absolute bottom-1/3 right-[-10%] w-[120%] h-[1px] bg-gradient-to-l from-transparent via-orange-400/10 to-transparent rotate-6 transform-gpu" />

        {/* Subtle grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.025)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)]" />
      </div>

      <Container className="relative z-10 w-full mt-10 lg:mt-0">
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-20 items-center">

          {/* Left: Copy */}
          <div className="space-y-10 max-w-2xl" style={{ transform: `translateY(${parallax3}px)` }}>
            <h1 className="text-[52px] md:text-[72px] lg:text-[84px] font-black leading-[0.95] text-gray-900 tracking-tighter">
              TIME IS <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-emerald-500 drop-shadow-sm">FINITE.</span><br />
              EXECUTION IS EVERYTHING.
            </h1>

            <p className="text-[18px] md:text-[20px] leading-[1.6] text-gray-500 font-light tracking-wide max-w-md">
              The executive control system for your workflow. Deep work isolation meets autonomous AI planning.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-6 pt-4">
              <Link to="/signup">
                <button className="group relative flex items-center justify-center gap-3 h-14 px-8 rounded-none bg-gray-900 text-white text-[13px] uppercase tracking-[0.15em] font-bold hover:bg-blue-600 border border-gray-900 hover:border-blue-600 transition-all duration-300 overflow-hidden shadow-lg">
                  <span className="relative z-10 font-mono">Access Terminal</span>
                  <ArrowRight className="relative z-10 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </div>

            <div className="pt-12 flex items-center gap-8 border-t border-gray-900/[0.07]">
              <div>
                <div className="text-2xl font-mono text-gray-900 tracking-tighter">99.9%</div>
                <div className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">Uptime</div>
              </div>
              <div className="hidden sm:block">
                <div className="text-2xl font-mono text-gray-900 tracking-tighter">0ms</div>
                <div className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">Latency</div>
              </div>
              <div>
                <div className="text-2xl font-mono text-gray-900 tracking-tighter flex items-center gap-2">
                  <EnergyCubeIcon size={18} className="text-blue-500" />
                  TRINITY MODEL
                </div>
                <div className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">Processing</div>
              </div>
            </div>
          </div>

          {/* Right: UI Previews with Parallax Depth Layers */}
          <div className="relative h-[600px] w-full hidden lg:block" style={{ perspective: '1000px' }}>
            {/* Parallax Layer 1: Base Kanban Board */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-[700px] xl:w-[800px] rounded-xl border border-gray-200 bg-white/90 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-6"
              style={{ transform: `rotateY(-15deg) translateZ(-100px) translateY(${parallax1}px)`, transformOrigin: 'right center' }}
            >
              <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gray-200" />
                  <div className="w-3 h-3 rounded-full bg-gray-200" />
                  <div className="w-3 h-3 rounded-full bg-transparent border border-gray-300" />
                </div>
                <div className="mx-auto text-[10px] font-mono tracking-widest text-gray-400 uppercase">// WORKFLOW_MATRIX</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((col) => (
                  <div key={col} className="bg-gray-50 border border-gray-100 rounded-xl p-3 h-[400px]">
                    <div className="h-4 w-1/2 bg-gray-200 rounded mb-4" />
                    {[1, 2, (col === 1 ? 3 : null)].filter(Boolean).map((card) => (
                      <div key={card} className="h-20 bg-white rounded-lg border border-gray-100 mb-2 p-3 flex flex-col justify-between hover:border-gray-300 hover:shadow-sm transition-all">
                        <div className="h-2 w-3/4 bg-gray-200 rounded" />
                        <div className="flex justify-between items-center">
                          <div className="w-4 h-4 rounded-full bg-gray-100 border border-gray-200" />
                          {col === 2 && card === 1 ? (
                            <div className="w-12 h-1.5 bg-orange-400/50 rounded-full" />
                          ) : (
                            <div className="w-10 h-1.5 bg-blue-400/50 rounded-full" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Parallax Layer 2: Floating AI Panel */}
            <div
              className="absolute -left-12 top-1/4 w-[320px] rounded-xl border border-blue-200 bg-white/95 backdrop-blur-3xl shadow-[0_20px_60px_rgba(37,99,235,0.12)] p-5"
              style={{ transform: `translateZ(80px) translateY(${parallax2}px)` }}
            >
              <div className="flex items-center justify-between mb-5 border-b border-blue-100 pb-3">
                <div className="flex items-center gap-2">
                  <EnergyCubeIcon size={18} className="text-blue-500 animate-pulse" />
                  <span className="text-[11px] font-mono text-blue-600 tracking-widest uppercase">AI Planning</span>
                </div>
                <div className="text-[9px] text-emerald-600 font-mono border border-emerald-400/40 px-2 py-0.5 rounded-sm bg-emerald-50">SYNCED</div>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed font-mono mb-5 border-l-2 border-blue-400/50 pl-3">
                <span className="text-blue-500">{'>'}</span> Analyzing roadmap momentum...<br />
                <span className="text-blue-500">{'>'}</span> Decomposing Q3 deliverables...<br />
                <span className="text-gray-800 mt-2 block">Generated 14 optimal execution paths.</span>
              </p>

              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded bg-gray-50 border border-gray-100">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500/70" />
                    <div className="h-1 w-full bg-gray-200 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </Container>
    </section>
  )
}

/* ── Grid Section (Light) ────────────────────────────── */
function GridSection() {
  return (
    <section id="architecture" className="py-32 bg-white relative border-t border-gray-100">
      <Container>
        <div className="text-center mb-24 space-y-4">
          <h2 className="text-[12px] uppercase tracking-[0.3em] font-mono text-blue-600">Architecture</h2>
          <p className="text-[32px] md:text-[48px] font-black text-gray-900 tracking-tight leading-[1.1]">ENGINEERED FOR VELOCITY</p>
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-gray-100 p-px">
          <div className="bg-white p-10 lg:p-14 hover:bg-gray-50 transition-colors group">
            <Terminal className="w-8 h-8 text-gray-300 mb-10 group-hover:text-blue-500 transition-colors duration-500" />
            <h3 className="text-[15px] font-mono font-bold text-gray-900 mb-4 tracking-wider">ZERO_LATENCY_SYNC </h3>
            <p className="text-[14px] text-gray-400 leading-[1.7]">Optimized data structures and realtime websocket synchronization over global edge networks. No loading spinners. No waiting.</p>
          </div>
          <div className="bg-white p-10 lg:p-14 hover:bg-gray-50 transition-colors group">
            <Activity className="w-8 h-8 text-gray-300 mb-10 group-hover:text-emerald-500 transition-colors duration-500" />
            <h3 className="text-[15px] font-mono font-bold text-gray-900 mb-4 tracking-wider">FLUID_UI_DYNAMICS</h3>
            <p className="text-[14px] text-gray-400 leading-[1.7]">Predictive inertia scrolling, completely hidden scrollbars, and frictionless drag-and-drop kinetics for maximum tactical feel.</p>
          </div>
          <div className="bg-white p-10 lg:p-14 hover:bg-gray-50 transition-colors group">
            <Cpu className="w-8 h-8 text-gray-300 mb-10 group-hover:text-orange-500 transition-colors duration-500" />
            <h3 className="text-[15px] font-mono font-bold text-gray-900 mb-4 tracking-wider">POWERED_BY_TRINITY_MODEL</h3>
            <p className="text-[14px] text-gray-400 leading-[1.7]">Generative subtask hierarchy orchestrated by continuous-learning foundational AI models. Command your board with natural language.</p>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ── CTA Section (Light) ─────────────────────────────── */
function CTASection() {
  return (
    <section className="relative py-40 bg-[#F0F4FF] overflow-hidden flex items-center justify-center border-t border-blue-100">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.08)_0%,rgba(240,244,255,1)_70%)] pointer-events-none" />
      <div className="relative z-10 text-center space-y-12">
        <h2 className="text-[40px] md:text-[64px] font-black text-gray-900 tracking-tighter leading-tight uppercase">
          INITIATE SEQUENCE.
        </h2>
        <Link to="/signup">
          <button className="group relative flex items-center justify-center gap-4 h-16 px-12 mx-auto rounded-none border border-gray-900 bg-gray-900 text-white text-[13px] uppercase tracking-[0.2em] font-bold hover:bg-blue-600 hover:border-blue-600 transition-all duration-300 shadow-lg hover:shadow-[0_0_40px_rgba(37,99,235,0.25)]">
            <span>Create Your Workspace</span>
            <Globe2 className="w-5 h-5 group-hover:rotate-12 transition-transform opacity-70" />
          </button>
        </Link>
      </div>
    </section>
  )
}

/* ── Footer (Light) ──────────────────────────────────── */
function Footer() {
  return (
    <footer className="py-10 bg-white border-t border-gray-100">
      <Container>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 opacity-40 hover:opacity-100 transition-all duration-500">
            <TaskMasterLogo size={20} showWordmark />
          </div>
          <div className="flex items-center gap-8 text-[10px] font-mono uppercase tracking-widest text-gray-400">
            <span>© 2026 TASKMASTER_PRO</span>
            <span className="text-emerald-600 border border-emerald-400/40 px-2 py-0.5 rounded-sm bg-emerald-50">STATUS: NOMINAL</span>
          </div>
        </div>
      </Container>
    </footer>
  )
}

/* ── Page Root ───────────────────────────────────────── */
export default function LandingPage() {
  const session = useStore((s) => s.session)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Force light background globally to prevent color flashes on overscroll
  useEffect(() => {
    document.body.style.backgroundColor = '#F8F9FB'
    return () => { document.body.style.backgroundColor = '' }
  }, [])

  if (session) return <Navigate to="/dashboard" replace />

  return (
    <>
      <style>{`
        /* Custom Keyframes for Landing Page Animations */
        @keyframes horizon-breathe {
          0%, 100% { opacity: 0.4; transform: scaleY(1); }
          50% { opacity: 0.8; transform: scaleY(1.15); }
        }
        .animate-horizon-breathe {
          animation: horizon-breathe 10s ease-in-out infinite;
        }
      `}</style>

      <div className="min-h-screen text-gray-900 selection:bg-blue-500/20 font-sans overflow-x-hidden">
        <Nav mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        <main>
          <HeroSection />
          <GridSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </>
  )
}
