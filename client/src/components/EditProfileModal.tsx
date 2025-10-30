import { useState, useRef } from 'react'
import { X, Upload, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/auth'
import { Button, Input } from '@/components'

interface EditProfileModalProps {
  isOpen: boolean
  onClose: () => void
  role: 'player' | 'coach' | 'club'
}

export default function EditProfileModal({ isOpen, onClose, role }: EditProfileModalProps) {
  const { profile, fetchProfile } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    base_location: profile?.base_location || '',
    nationality: profile?.nationality || '',
    date_of_birth: profile?.date_of_birth || '',
    position: profile?.position || '',
    gender: profile?.gender || '',
    passport_1: profile?.passport_1 || '',
    passport_2: profile?.passport_2 || '',
    current_club: profile?.current_club || '',
    year_founded: profile?.year_founded?.toString() || '',
    league_division: profile?.league_division || '',
    website: profile?.website || '',
    contact_email: profile?.contact_email || '',
    club_bio: profile?.club_bio || '',
    club_history: profile?.club_history || '',
    bio: profile?.bio || '',
    avatar_url: profile?.avatar_url || '',
  })

  if (!isOpen || !profile) return null

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData({ ...formData, avatar_url: publicUrl });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setError('Failed to upload avatar');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Build update object based on role
      const updateData: Record<string, unknown> = {
        full_name: formData.full_name,
        base_location: formData.base_location,
        avatar_url: formData.avatar_url || null,
      }

      if (role === 'player') {
        updateData.nationality = formData.nationality
        updateData.position = formData.position
        updateData.gender = formData.gender
        updateData.date_of_birth = formData.date_of_birth || null
        updateData.passport_1 = formData.passport_1 || null
        updateData.passport_2 = formData.passport_2 || null
        updateData.current_club = formData.current_club || null
      } else if (role === 'coach') {
        updateData.nationality = formData.nationality
        updateData.gender = formData.gender || null
        updateData.date_of_birth = formData.date_of_birth || null
        updateData.passport_1 = formData.passport_1 || null
        updateData.passport_2 = formData.passport_2 || null
        updateData.bio = formData.bio || null
        updateData.contact_email = formData.contact_email || null
      } else if (role === 'club') {
        updateData.nationality = formData.nationality
        updateData.year_founded = formData.year_founded ? parseInt(formData.year_founded) : null
        updateData.league_division = formData.league_division || null
        updateData.website = formData.website || null
        updateData.contact_email = formData.contact_email || null
        updateData.club_bio = formData.club_bio || null
        updateData.club_history = formData.club_history || null
      }

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)

      if (updateError) throw updateError

      // Refresh profile in auth store
      await fetchProfile(profile.id)

      // Close modal
      onClose()
    } catch (err) {
      console.error('Profile update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Edit {role === 'club' ? 'Club' : role === 'coach' ? 'Coach' : 'Player'} Profile
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Avatar Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {role === 'club' ? 'Club Logo' : 'Profile Picture'}
              </label>
              <div className="flex items-center gap-4">
                <div 
                  onClick={handleImageClick}
                  className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors overflow-hidden"
                >
                  {formData.avatar_url ? (
                    <img src={formData.avatar_url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleImageClick}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    {formData.avatar_url ? 'Change Image' : 'Upload Image'}
                  </button>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                aria-label="Profile picture upload"
              />
            </div>

            {/* Common Fields */}
            <Input
              label={role === 'club' ? 'Club Name' : 'Full Name'}
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />

            <Input
              label="Base Location (City)"
              placeholder="Where are you currently based?"
              value={formData.base_location}
              onChange={(e) => setFormData({ ...formData, base_location: e.target.value })}
              required
            />

            <Input
              label="Country"
              value={formData.nationality}
              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              required
            />

            {/* Player-specific fields */}
            {role === 'player' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="player-position">
                    Position
                  </label>
                  <select
                    id="player-position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6366f1] focus:border-transparent"
                    required
                    aria-label="Select position"
                  >
                    <option value="">Select position</option>
                    <option value="Goalkeeper">Goalkeeper</option>
                    <option value="Defender">Defender</option>
                    <option value="Midfielder">Midfielder</option>
                    <option value="Forward">Forward</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="player-gender">
                    Gender
                  </label>
                  <select
                    id="player-gender"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6366f1] focus:border-transparent"
                    required
                    aria-label="Select gender"
                  >
                    <option value="">Select gender</option>
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                  </select>
                </div>

                <Input
                  label="Date of Birth (Optional)"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />

                <Input
                  label="Passport 1 (Required)"
                  type="text"
                  value={formData.passport_1}
                  onChange={(e) => setFormData({ ...formData, passport_1: e.target.value })}
                  placeholder="e.g., New Zealand Passport"
                  required
                />

                <Input
                  label="Passport 2 (Optional)"
                  type="text"
                  value={formData.passport_2}
                  onChange={(e) => setFormData({ ...formData, passport_2: e.target.value })}
                  placeholder="e.g., Australian Passport"
                />

                <Input
                  label="Current Club (Optional)"
                  type="text"
                  value={formData.current_club}
                  onChange={(e) => setFormData({ ...formData, current_club: e.target.value })}
                  placeholder="e.g., Holcombe Hockey Club"
                />
              </>
            )}

            {/* Coach-specific fields */}
            {role === 'coach' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="coach-gender-edit">
                    Gender
                  </label>
                  <select
                    id="coach-gender-edit"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6366f1] focus:border-transparent"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <Input
                  label="Date of Birth (Optional)"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />

                <Input
                  label="Passport 1 (Optional)"
                  placeholder="Primary passport/nationality"
                  value={formData.passport_1}
                  onChange={(e) => setFormData({ ...formData, passport_1: e.target.value })}
                />

                <Input
                  label="Passport 2 (Optional)"
                  placeholder="Secondary passport/nationality"
                  value={formData.passport_2}
                  onChange={(e) => setFormData({ ...formData, passport_2: e.target.value })}
                />

                <Input
                  label="Contact Email (Optional)"
                  type="email"
                  placeholder="contact@example.com"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio (Optional)
                  </label>
                  <textarea
                    value={formData.bio || ''}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#6366f1] focus:border-transparent resize-none"
                    placeholder="Tell us about your coaching experience..."
                  />
                </div>
              </>
            )}

            {/* Club-specific fields */}
            {role === 'club' && (
              <>
                <Input
                  label="Year Founded (Optional)"
                  type="number"
                  value={formData.year_founded}
                  onChange={(e) => setFormData({ ...formData, year_founded: e.target.value })}
                />

                <Input
                  label="League/Division (Optional)"
                  value={formData.league_division}
                  onChange={(e) => setFormData({ ...formData, league_division: e.target.value })}
                />

                <Input
                  label="Website (Optional)"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />

                <Input
                  label="Contact Email (Optional)"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                />

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="club-bio">
                  Bio
                </label>
                <textarea
                  id="club-bio"
                  value={formData.club_bio || ''}
                  onChange={(e) => setFormData({ ...formData, club_bio: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-yellow-400 focus:outline-none resize-none"
                  placeholder="Tell us about your club..."
                  aria-label="Club bio"
                />
              </div>                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="club-history">
                    Club History (Optional)
                  </label>
                  <textarea
                    id="club-history"
                    value={formData.club_history}
                    onChange={(e) => setFormData({ ...formData, club_history: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#8b5cf6] focus:border-transparent"
                    rows={3}
                    placeholder="Tell us about your club's history..."
                    aria-label="Club history"
                  />
                </div>
              </>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
