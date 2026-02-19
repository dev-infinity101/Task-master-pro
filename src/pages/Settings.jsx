import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { User, Save, Loader2, Camera } from 'lucide-react'
import useStore from '../store/store'
import { updateProfile } from '../lib/database'
import { toast } from 'sonner'

export default function Settings() {
  const { user, profile, setProfile } = useStore()
  const [isSaving, setIsSaving] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm()

  useEffect(() => {
    if (profile) {
      setValue('full_name', profile.full_name)
      setValue('avatar_url', profile.avatar_url)
    }
  }, [profile, setValue])

  const onSubmit = async (data) => {
    if (!user) return
    setIsSaving(true)

    const { data: updatedProfile, error } = await updateProfile(user.id, {
      full_name: data.full_name,
      avatar_url: data.avatar_url,
    })

    setIsSaving(false)

    if (error) {
      toast.error('Failed to update profile')
    } else {
      setProfile(updatedProfile)
      toast.success('Profile updated successfully')
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-indigo-500/10 rounded-xl">
            <User className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Profile Settings</h2>
            <p className="text-sm text-slate-400">Manage your account information</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Avatar URL (Simple text input for now, could be file upload later) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Avatar URL
            </label>
            <div className="flex gap-4 items-center">
              <div className="w-16 h-16 rounded-full bg-slate-700 overflow-hidden shrink-0 border-2 border-slate-600">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-xl font-bold">
                    {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                )}
              </div>
              <input
                {...register('avatar_url')}
                type="url"
                placeholder="https://example.com/avatar.jpg"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Full Name
            </label>
            <input
              {...register('full_name', { required: 'Full name is required' })}
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            {errors.full_name && (
              <p className="text-red-400 text-xs mt-1">{errors.full_name.message}</p>
            )}
          </div>

          {/* Email (Read only) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-400 cursor-not-allowed"
            />
            <p className="text-slate-500 text-xs mt-1">
              Email cannot be changed directly.
            </p>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
