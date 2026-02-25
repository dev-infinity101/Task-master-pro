import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Save, Loader2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'
import { updateProfile } from '../lib/database'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

function Surface({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card text-card-foreground shadow-sm',
        className
      )}
      {...props}
    />
  )
}

export default function Settings() {
  const { user, profile, setProfile, theme, setTheme } = useStore(useShallow((s) => ({
    user: s.user,
    profile: s.profile,
    setProfile: s.setProfile,
    theme: s.theme,
    setTheme: s.setTheme,
  })))
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm()

  useEffect(() => {
    const candidate =
      profile?.full_name ??
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      ''

    if (candidate) setValue('full_name', candidate)
  }, [profile?.full_name, user?.user_metadata?.full_name, user?.user_metadata?.name, setValue])

  const displayName = useMemo(
    () =>
      profile?.full_name ??
      user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      user?.email ??
      'Account',
    [profile?.full_name, user?.user_metadata?.full_name, user?.user_metadata?.name, user?.email]
  )

  const onSubmit = async (data) => {
    if (!user) return
    setIsSaving(true)

    try {
      const { data: updatedProfile, error } = await updateProfile(user.id, {
        full_name: data.full_name,
      })

      if (error) {
        toast.error('Failed to update profile')
      } else {
        setProfile(updatedProfile)
        toast.success('Profile updated successfully')
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <Surface className="relative overflow-hidden">
          <div className="grid lg:grid-cols-[260px_1fr]">
            <aside className="border-b lg:border-b-0 lg:border-r border-border bg-card/40">
              <div className="p-4 flex items-center justify-between lg:hidden">
                <div className="text-sm font-semibold">Settings</div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/dashboard')}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="px-4 pb-4 pt-2 lg:pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg border border-border bg-background/30 grid place-items-center text-sm font-semibold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{displayName}</div>
                    <div className="text-xs text-muted-foreground truncate">Account</div>
                  </div>
                </div>

                <div className="mt-6 space-y-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('general')}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                      activeTab === 'general'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                    )}
                  >
                    General
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preferences')}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                      activeTab === 'preferences'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                    )}
                  >
                    Preferences
                  </button>
                </div>
              </div>
            </aside>

            <main className="min-w-0">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <div className="text-sm text-muted-foreground">Workspace settings</div>
                  <div className="text-lg font-semibold tracking-tight">General</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/dashboard')}
                  className="hidden lg:inline-flex h-9 w-9 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input
                      id="full_name"
                      type="text"
                      className={errors.full_name ? "border-destructive focus-visible:ring-destructive" : ""}
                      {...register('full_name', { required: 'Full name is required' })}
                    />
                    {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={user?.email ?? ''}
                      disabled
                      className="bg-muted text-muted-foreground opacity-100"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-[180px_1fr] gap-6 items-start">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">Theme</div>
                    <div className="text-xs text-muted-foreground">Applies across the app.</div>
                  </div>
                  <div className="max-w-sm">
                    <Select value={theme} onValueChange={(v) => setTheme(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate('/dashboard')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving || !isDirty} variant="contrast" className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                </div>
              </form>
            </main>
          </div>
        </Surface>
      </div>
    </div>
  )
}
