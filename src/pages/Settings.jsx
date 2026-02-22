import { useState, useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { User, Save, Loader2, X, UploadCloud, Image as ImageIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/store'
import { useShallow } from 'zustand/react/shallow'
import { updateProfile, uploadAvatar } from '../lib/database'
import { toast } from 'sonner'
import { Avatar, Button, IconButton, Input, Surface } from '../components/ui/Primitives'

export default function Settings() {
  const { user, profile, setProfile } = useStore(useShallow((s) => ({
    user: s.user,
    profile: s.profile,
    setProfile: s.setProfile,
  })))
  const [isSaving, setIsSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarError, setAvatarError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm()

  useEffect(() => {
    if (profile) {
      setValue('full_name', profile.full_name)
    }
  }, [profile, setValue])

  useEffect(() => {
    if (!avatarFile) return
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  const displayName = useMemo(() => profile?.full_name ?? user?.email ?? 'Account', [profile?.full_name, user?.email])

  const validateAvatar = (file) => {
    if (!file) return { ok: false, message: 'No file selected' }
    if (!file.type?.startsWith('image/')) return { ok: false, message: 'Please upload an image file.' }
    const maxBytes = 5 * 1024 * 1024
    if (file.size > maxBytes) return { ok: false, message: 'Image must be 5MB or smaller.' }
    return { ok: true, message: '' }
  }

  const acceptAvatarFile = (file) => {
    const v = validateAvatar(file)
    if (!v.ok) {
      setAvatarError(v.message)
      setAvatarFile(null)
      setAvatarPreview(null)
      return
    }
    setAvatarError('')
    setAvatarFile(file)
  }

  const onSubmit = async (data) => {
    if (!user) return
    setIsSaving(true)

    try {
      let avatar_url = profile?.avatar_url ?? null
      if (avatarFile) {
        const { data: uploaded, error: uploadError } = await uploadAvatar(user.id, avatarFile)
        if (uploadError) {
          toast.error(uploadError.message ?? 'Failed to upload avatar')
          setIsSaving(false)
          return
        }
        if (!uploaded?.publicUrl) {
          toast.error('Avatar uploaded, but no public URL was returned.')
          setIsSaving(false)
          return
        }
        avatar_url = uploaded.publicUrl
      }

      const { data: updatedProfile, error } = await updateProfile(user.id, {
        full_name: data.full_name,
        avatar_url,
      })

      if (error) {
        toast.error('Failed to update profile')
      } else {
        setProfile(updatedProfile)
        setAvatarFile(null)
        setAvatarPreview(null)
        toast.success('Profile updated successfully')
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Surface className="relative p-8">
          <div className="absolute right-4 top-4">
            <IconButton label="Close settings" onClick={() => navigate('/dashboard')}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>

          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-200">
              <User className="h-6 w-6" />
            </div>
            <div className="pt-0.5">
              <h1 className="text-2xl font-bold text-white">Settings</h1>
              <p className="mt-1 text-sm text-slate-400">Profile, avatar, and workspace identity.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
            <div>
              <div className="text-sm font-semibold text-slate-200">Avatar</div>
              <div className="mt-3 grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
                <div className="flex items-center gap-4">
                  <Avatar name={displayName} src={avatarPreview ?? profile?.avatar_url} className="h-16 w-16 rounded-2xl text-xl" />
                  <div>
                    <div className="text-sm font-medium text-white">{displayName}</div>
                    <div className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP up to 5MB.</div>
                  </div>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => acceptAvatarFile(e.target.files?.[0] ?? null)}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={() => setDragging(true)}
                    onDragLeave={() => setDragging(false)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragging(true)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragging(false)
                      acceptAvatarFile(e.dataTransfer.files?.[0] ?? null)
                    }}
                    className={`w-full rounded-2xl border px-5 py-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                      dragging
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'border-white/10 bg-black/30 hover:bg-white/5'
                    }`}
                    aria-describedby="avatar-help"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200">
                        {avatarFile ? <ImageIcon className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white">
                          {avatarFile ? 'Avatar selected' : 'Upload a new avatar'}
                        </div>
                        <div id="avatar-help" className="mt-1 text-xs text-slate-400">
                          Drag and drop an image here, or click to browse.
                        </div>
                        {avatarFile ? (
                          <div className="mt-2 text-xs text-slate-300">{avatarFile.name}</div>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  {avatarError ? <p className="mt-2 text-xs text-red-300">{avatarError}</p> : null}
                </div>
              </div>
            </div>

            <Input
              label="Full name"
              type="text"
              error={errors.full_name?.message}
              {...register('full_name', { required: 'Full name is required' })}
            />

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1.5">Email</label>
              <input
                type="email"
                value={user?.email ?? ''}
                disabled
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-400 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-slate-500">Email cannot be changed directly.</p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/dashboard')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || (!isDirty && !avatarFile)}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </div>
          </form>
        </Surface>
      </div>
    </div>
  )
}
