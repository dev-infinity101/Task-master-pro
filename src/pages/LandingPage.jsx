import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Zap } from 'lucide-react'
import useStore from '../store/store'
import { Button, Container, Surface } from '../components/ui/Primitives'

export default function LandingPage() {
  const session = useStore((s) => s.session)

  if (session) return <Navigate to="/dashboard" replace />

  return (
    <div className="min-h-screen text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#0F1E3A_0%,#0B1220_40%,#000000_100%)]" />
        <div className="absolute -top-24 -left-28 h-96 w-96 rounded-[32px] bg-linear-to-br from-cyan-300/20 to-blue-500/20 blur-2xl" />
        <div className="absolute top-20 -right-24 h-[26rem] w-[26rem] rounded-[32px] bg-linear-to-br from-blue-500/20 to-cyan-300/15 blur-2xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-[32px] bg-linear-to-br from-cyan-300/15 to-blue-500/10 blur-2xl" />

        <Container className="relative py-10">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 shadow-[0_10px_30px_rgba(37,99,235,0.25)]">
                <Zap className="h-5 w-5 text-white" fill="currentColor" />
              </div>
              <div className="leading-tight">
                <div className="text-xs font-semibold tracking-[0.28em] text-slate-200">
                  TASKMASTER PRO
                </div>
                <div className="text-xs tracking-[0.04em] text-slate-400">
                  Production-Grade Task System
                </div>
              </div>
            </div>

            <nav className="hidden sm:flex items-center gap-3">
              <Link to="/login" className="text-sm text-slate-200 hover:text-white transition-colors">
                Log in
              </Link>
              <Link to="/signup">
                <Button size="md" className="px-6">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </nav>
          </header>

          <section className="mt-16 grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.08]">
                Keep every project
                <br />
                Aligned from plan to delivery
              </h1>
              <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-xl">
                Infrastructure for people who ship. Clear priorities, realtime sync, and an AI that plans with you.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-6"
                >
                  LEARN MORE
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Link to="/signup">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto px-6">
                    CREATE YOUR WORKSPACE
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[32px] bg-linear-to-br from-blue-500/15 to-cyan-300/10 blur-2xl" />
              <Surface className="relative p-6">
                <div
                  className="relative rounded-2xl border border-white/10 bg-black/40 overflow-hidden"
                  style={{
                    transform: 'perspective(1100px) rotateY(-16deg) rotateX(8deg)',
                    transformOrigin: 'center',
                  }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_55%)]" />
                  <div className="relative p-5">
                    <div className="flex items-center justify-between">
                      <div className="h-2.5 w-24 rounded-full bg-white/10" />
                      <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                        <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                        <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3">
                      {[
                        { title: 'Today', subtitle: 'Quick-add per column' },
                        { title: 'Realtime', subtitle: 'Changes sync across tabs' },
                        { title: 'AI Planning', subtitle: 'Break goals into subtasks' },
                      ].map((row) => (
                        <div
                          key={row.title}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-transform hover:-translate-y-0.5"
                        >
                          <div className="text-sm font-semibold text-white">{row.title}</div>
                          <div className="mt-1 text-xs text-slate-400">{row.subtitle}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Surface>
            </div>
          </section>

          <section id="features" className="mt-24">
            <div className="text-center">
              <h2 className="text-4xl sm:text-5xl font-bold leading-tight">
                Focus with a workflow
                <br />
                Built for Clarity and Speed.
              </h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  title: 'ORGANIZE TASKS AND GET ANALYTICS',
                  description: ['Add any task in under 3 seconds.', 'Quick-add per column.', 'Natural language support.'],
                },
                {
                  title: 'STAY IN SYNC WITH REAL-TIME UPDATES',
                  description: ['Drag, drop, reorder.', 'Changes sync across tabs in <200ms.', 'Optimistic updates. No waiting.'],
                },
                {
                  title: 'AN AI THAT PLANS WITH YOU',
                  description: ['Break goals into subtasks automatically.', 'Plan your day in seconds.', 'Prioritize intelligently.'],
                },
              ].map((card) => (
                <Surface
                  key={card.title}
                  className="rounded-3xl bg-linear-to-br from-[#0B1220] to-[#111827] p-8 transition-transform hover:-translate-y-1"
                >
                  <div className="text-xs font-semibold tracking-[0.18em] text-slate-200">
                    {card.title}
                  </div>
                  <div className="mt-4 space-y-1.5 text-sm text-slate-300">
                    {card.description.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                </Surface>
              ))}
            </div>
          </section>

          <section className="mt-24">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-[#0B1220] to-black px-8 py-14">
              <div className="absolute -top-10 -left-10 h-56 w-56 rounded-[32px] bg-linear-to-br from-cyan-300/15 to-blue-500/15 blur-2xl" />
              <div className="absolute -bottom-12 right-8 h-64 w-64 rounded-[32px] bg-linear-to-br from-blue-500/15 to-cyan-300/10 blur-2xl" />
              <div className="relative text-center">
                <h2 className="text-5xl sm:text-6xl font-extrabold leading-[1.05]">
                  Meet deadlines
                  <br />
                  and
                  <br />
                  <span className="text-blue-400">Stay Consistent</span>
                </h2>
                <p className="mt-6 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
                  Built for people who ship. Clear priorities. Real-time sync. No task left behind.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-24">
            <div className="text-center">
              <h2 className="text-4xl sm:text-5xl font-bold">Early Users Are Shipping More</h2>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                { quote: '"It replaced 4 tools in my workflow."', author: '— Indie Developer' },
                { quote: '"The realtime sync feels native. Not like a web app."', author: '— Product Designer' },
                { quote: '"The AI planning actually understands context."', author: '— Startup Founder' },
              ].map((t) => (
                <Surface key={t.author} className="rounded-3xl bg-linear-to-br from-[#0B1220] to-[#111827] p-8">
                  <div className="text-lg font-semibold text-white">{t.quote}</div>
                  <div className="mt-4 text-sm text-slate-400">{t.author}</div>
                </Surface>
              ))}
            </div>
          </section>

          <section className="mt-24">
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-center rounded-3xl border border-white/10 bg-linear-to-br from-[#0B1220] to-black p-10">
              <div>
                <h2 className="text-5xl sm:text-6xl font-extrabold leading-[1.05]">
                  Stop managing tasks.
                  <br />
                  Start shipping work.
                </h2>
                <div className="mt-8">
                  <Link to="/signup">
                    <Button size="lg" className="px-7">
                      CREATE YOUR WORKSPACE
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              <Surface className="rounded-3xl p-6">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
                  <div className="text-sm font-semibold text-white">TaskMaster Dashboard</div>
                  <div className="mt-3 grid gap-3">
                    <div className="h-10 rounded-xl bg-white/5 border border-white/10" />
                    <div className="h-24 rounded-2xl bg-white/5 border border-white/10" />
                    <div className="h-24 rounded-2xl bg-white/5 border border-white/10" />
                  </div>
                </div>
              </Surface>
            </div>
          </section>

          <section className="mt-16 pb-16">
            <div className="rounded-3xl border border-blue-500/20 bg-linear-to-br from-blue-600/20 to-black p-10">
              <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] items-center">
                <div className="hidden lg:block">
                  <div className="h-48 w-full rounded-[32px] bg-linear-to-br from-cyan-300/20 to-blue-500/20 blur-0" />
                </div>
                <div>
                  <h3 className="text-4xl font-bold">Questions?</h3>
                  <p className="mt-3 text-slate-300">help@taskmaster.com</p>
                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <Link to="/login">
                      <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                        Log in
                      </Button>
                    </Link>
                    <Link to="/signup">
                      <Button size="lg" className="w-full sm:w-auto">
                        Get started
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Container>
      </div>
    </div>
  )
}
