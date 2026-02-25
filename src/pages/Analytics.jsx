import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'

const COLORS = ['#94a3b8', '#3b82f6', '#10b981', '#ef4444']

export default function Analytics() {
  const { tasks, activeProjectId } = useStore(useShallow((s) => ({
    tasks: s.tasks,
    activeProjectId: s.activeProjectId,
  })))

  const projectTasks = useMemo(() => {
    return tasks[activeProjectId] ?? []
  }, [tasks, activeProjectId])

  const statusData = useMemo(() => {
    const counts = { todo: 0, in_progress: 0, done: 0 }
    projectTasks.forEach((t) => {
      if (counts[t.status] !== undefined) counts[t.status]++
    })
    return [
      { name: 'To Do', value: counts.todo, color: '#94a3b8' },
      { name: 'In Progress', value: counts.in_progress, color: '#3b82f6' },
      { name: 'Done', value: counts.done, color: '#10b981' },
    ].filter((d) => d.value > 0)
  }, [projectTasks])

  const priorityData = useMemo(() => {
    const counts = { none: 0, low: 0, medium: 0, high: 0, urgent: 0 }
    projectTasks.forEach((t) => {
      if (counts[t.priority] !== undefined) counts[t.priority]++
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
  }, [projectTasks])

  const totalTasks = projectTasks.length
  const completedTasks = projectTasks.filter((t) => t.status === 'done').length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const overdueCount = projectTasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
  ).length

  if (!activeProjectId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Please select a project to view analytics.
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8 overflow-y-auto h-full text-foreground">
      <h1 className="text-2xl font-bold text-foreground mb-6">Analytics Overview</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card/70 dark:bg-linear-to-b dark:from-white/5 dark:to-transparent p-6 rounded-2xl border border-border backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted/40 rounded-xl border border-border">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <p className="text-2xl font-bold text-foreground">{completionRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-card/70 dark:bg-linear-to-b dark:from-white/5 dark:to-transparent p-6 rounded-2xl border border-border backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted/40 rounded-xl border border-border">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Tasks</p>
              <p className="text-2xl font-bold text-foreground">{totalTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-card/70 dark:bg-linear-to-b dark:from-white/5 dark:to-transparent p-6 rounded-2xl border border-border backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted/40 rounded-xl border border-border">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <p className="text-2xl font-bold text-foreground">{overdueCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Distribution */}
        <div className="bg-card/70 dark:bg-linear-to-b dark:from-white/5 dark:to-transparent p-6 rounded-2xl border border-border h-[400px] backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-foreground mb-6">Task Status</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Distribution */}
        <div className="bg-card/70 dark:bg-linear-to-b dark:from-white/5 dark:to-transparent p-6 rounded-2xl border border-border h-[400px] backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-foreground mb-6">Tasks by Priority</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priorityData}>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  borderColor: 'hsl(var(--border))',
                  color: 'hsl(var(--popover-foreground))',
                }}
              />
              <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
