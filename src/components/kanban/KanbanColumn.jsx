import { useState, useRef } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Plus, MoreHorizontal } from 'lucide-react'
import useStore from '../../store/store'
import { useShallow } from 'zustand/react/shallow'
import { useTasks } from '../../hooks/useTasks'
import TaskCard from './TaskCard'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default function KanbanColumn({ column, tasks }) {
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const inputRef = useRef(null)
  const { activeProjectId } = useStore(useShallow((s) => ({
    activeProjectId: s.activeProjectId,
  })))
  const { addTask } = useTasks()

  // Make column itself droppable (for dropping into empty columns)
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  const taskIds = tasks.map((t) => t.id)

  const handleAddTask = async () => {
    const title = newTaskTitle.trim()
    if (!title || !activeProjectId) return

    setNewTaskTitle('')
    setIsAddingTask(false)

    await addTask(activeProjectId, column.id, { title })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddTask()
    if (e.key === 'Escape') {
      setIsAddingTask(false)
      setNewTaskTitle('')
    }
  }

  const handleStartAdding = () => {
    setIsAddingTask(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // Column accent color
  const accentColor = column.color ?? '#94a3b8'

  return (
    <div ref={setNodeRef} className="flex flex-col w-80 shrink-0 h-full">
      <Card className={cn(
        "flex flex-col h-full bg-white/80 dark:bg-white/5 border-none shadow-none rounded-2xl transition-colors",
        isOver && "bg-accent/10"
      )}>
        {/* Column Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-background"
              style={{ backgroundColor: accentColor }}
            />
            <h3 className="font-semibold text-sm tracking-tight">{column.name}</h3>
            <Badge variant="secondary" className="px-1.5 py-0 h-5 min-w-5 justify-center text-[10px] font-mono">
              {tasks.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={handleStartAdding}
              title="Add task"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tasks */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-2 min-h-[100px]">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </SortableContext>

          {isAddingTask ? (
            <div className="p-1 animate-in fade-in zoom-in-95 duration-200">
              <Input
                ref={inputRef}
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (!newTaskTitle) setIsAddingTask(false) }}
                placeholder="What needs to be done?"
                className="bg-card border-primary/50 ring-1 ring-primary/20 shadow-lg"
              />
              <div className="flex justify-end gap-2 mt-2">
                <Button size="sm" variant="ghost" onClick={() => setIsAddingTask(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAddTask}>Add</Button>
              </div>
            </div>
          ) : (
            tasks.length === 0 && (
              <div
                onClick={handleStartAdding}
                className="h-24 flex flex-col items-center justify-center border-2 border-dashed border-muted rounded-xl cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-all group"
              >
                <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary mb-1" />
                <span className="text-xs text-muted-foreground font-medium group-hover:text-primary">Add a task</span>
              </div>
            )
          )}
        </div>
      </Card>
    </div>
  )
}
