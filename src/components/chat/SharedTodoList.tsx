'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Plus, Trash2, CheckCircle2, Circle, ClipboardList, X } from 'lucide-react'
import { toast } from 'sonner'

interface Todo {
  id: string
  conversation_id: string
  created_by: string
  title: string
  is_completed: boolean
  created_at: string
}

interface SharedTodoListProps {
  conversationId: string
  currentUserId: string
  isOpen: boolean
  onClose: () => void
}

export function SharedTodoList({ conversationId, currentUserId, isOpen, onClose }: SharedTodoListProps) {
  const supabase = createClient()
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetchTodos()

    // Real-time subscription
    const channel = supabase
      .channel(`todos:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTodos(prev => [...prev, payload.new as Todo])
        } else if (payload.eventType === 'UPDATE') {
          setTodos(prev => prev.map(t => t.id === payload.new.id ? payload.new as Todo : t))
        } else if (payload.eventType === 'DELETE') {
          setTodos(prev => prev.filter(t => t.id !== (payload.old as any).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isOpen, conversationId, supabase])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300)
  }, [isOpen])

  async function fetchTodos() {
    const { data } = await supabase
      .from('todos')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    setTodos((data as Todo[]) || [])
    setLoading(false)
  }

  async function addTodo() {
    const title = newTitle.trim()
    if (!title || adding) return
    setAdding(true)
    setNewTitle('')

    // Optimistic add
    const tempId = `temp-${Date.now()}`
    const tempTodo: Todo = {
      id: tempId,
      conversation_id: conversationId,
      created_by: currentUserId,
      title,
      is_completed: false,
      created_at: new Date().toISOString(),
    }
    setTodos(prev => [...prev, tempTodo])

    const { data, error } = await supabase
      .from('todos')
      .insert({ conversation_id: conversationId, created_by: currentUserId, title })
      .select()
      .single()

    if (error) {
      toast.error('Failed to add item')
      setTodos(prev => prev.filter(t => t.id !== tempId))
    } else if (data) {
      setTodos(prev => prev.map(t => t.id === tempId ? data as Todo : t))
    }
    setAdding(false)
    inputRef.current?.focus()
  }

  async function toggleTodo(todo: Todo) {
    // Optimistic update
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, is_completed: !t.is_completed } : t))
    await supabase.from('todos').update({ is_completed: !todo.is_completed }).eq('id', todo.id)
  }

  async function deleteTodo(id: string) {
    // Optimistic delete
    setTodos(prev => prev.filter(t => t.id !== id))
    await supabase.from('todos').delete().eq('id', id)
  }

  const pending = todos.filter(t => !t.is_completed)
  const completed = todos.filter(t => t.is_completed)

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn('fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300', isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-h-[75vh] flex flex-col',
          isOpen ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Our List</h2>
            {todos.length > 0 && (
              <span className="text-xs bg-primary/15 text-primary font-semibold px-2 py-0.5 rounded-full">
                {pending.length} left
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Add input */}
        <div className="px-5 py-3 border-b border-border/30">
          <div className="flex items-center gap-2 bg-secondary/60 rounded-2xl px-4 h-12">
            <input
              ref={inputRef}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTodo() }}
              placeholder="Add something to your list..."
              className="flex-1 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              onClick={addTodo}
              disabled={!newTitle.trim() || adding}
              className="h-7 w-7 flex items-center justify-center bg-primary text-primary-foreground rounded-full disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Todo list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5 pb-8">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">Loading...</div>
          ) : todos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-center">
              <p className="text-muted-foreground text-sm">Your list is empty.</p>
              <p className="text-muted-foreground text-xs">Add something to plan together! 💑</p>
            </div>
          ) : (
            <>
              {pending.map(todo => (
                <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
              ))}
              {completed.length > 0 && pending.length > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-border/40" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Done</span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
              )}
              {completed.map(todo => (
                <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function TodoItem({ todo, onToggle, onDelete }: { todo: Todo; onToggle: (t: Todo) => void; onDelete: (id: string) => void }) {
  return (
    <div className={cn(
      'group flex items-center gap-3 p-3 rounded-2xl transition-colors',
      todo.is_completed ? 'bg-secondary/30' : 'bg-secondary/60 hover:bg-secondary'
    )}>
      <button onClick={() => onToggle(todo)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
        {todo.is_completed
          ? <CheckCircle2 className="h-5 w-5 text-primary" />
          : <Circle className="h-5 w-5" />
        }
      </button>
      <span className={cn('flex-1 text-sm', todo.is_completed && 'line-through text-muted-foreground')}>
        {todo.title}
      </span>
      <button
        onClick={() => onDelete(todo.id)}
        className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
