import { useState, useEffect, useCallback } from 'react'
import { Video, Plus, Upload, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/auth'
import type { GalleryPhoto, Profile } from '../lib/database.types'
import Button from './Button'
import AddVideoLinkModal from './AddVideoLinkModal'
import { optimizeImage, validateImage } from '@/lib/imageOptimization'
import { logger } from '@/lib/logger'

interface MediaTabProps {
  profileId?: string
  readOnly?: boolean
}

export default function MediaTab({ profileId, readOnly = false }: MediaTabProps) {
  const { user, profile: authProfile, fetchProfile } = useAuthStore()
  const targetUserId = profileId || user?.id
  const [targetProfile, setTargetProfile] = useState<Profile | null>(null)
  const [showAddVideoModal, setShowAddVideoModal] = useState(false)
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([])
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)
  const [deletingVideo, setDeletingVideo] = useState(false)

  // Use the target profile if viewing someone else, otherwise use auth profile
  const displayProfile = targetProfile || authProfile

  // Fetch the profile data for the user being viewed
  useEffect(() => {
    const fetchTargetProfile = async () => {
      if (!targetUserId) return
      
      // If viewing our own profile, use auth profile
      if (targetUserId === user?.id) {
        setTargetProfile(authProfile)
        return
      }

      // Otherwise fetch the target user's profile
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetUserId)
          .single()

        if (error) throw error
        setTargetProfile(data)
      } catch (error) {
        console.error('Error fetching target profile:', error)
      }
    }

    fetchTargetProfile()
  }, [targetUserId, user?.id, authProfile])

  // Fetch gallery photos
  const fetchGalleryPhotos = useCallback(async () => {
    if (!targetUserId) return
    
    setIsLoadingPhotos(true)
    try {
      const { data, error } = await supabase
        .from('gallery_photos')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setGalleryPhotos(data || [])
    } catch (error) {
      console.error('Error fetching gallery photos:', error)
    } finally {
      setIsLoadingPhotos(false)
    }
  }, [targetUserId])

  useEffect(() => {
    fetchGalleryPhotos()
  }, [fetchGalleryPhotos])

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !user) return

    setIsUploading(true)

    try {
      // Upload all selected files
      for (const file of Array.from(files)) {
        // Validate file
        const validation = validateImage(file)
        if (!validation.valid) {
          alert(`${file.name}: ${validation.error}`)
          continue
        }

        // Optimize image before upload
        logger.debug(`Optimizing ${file.name}...`)
        const optimizedFile = await optimizeImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          maxSizeMB: 1, // 1MB max for gallery photos
          quality: 0.85
        })

        // Create unique filename
        const fileExt = optimizedFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('gallery')
          .upload(fileName, optimizedFile)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('gallery')
          .getPublicUrl(fileName)

        // Save to database
        const { error: dbError } = await supabase
          .from('gallery_photos')
          .insert({
            user_id: user.id,
            photo_url: urlData.publicUrl
          })

        if (dbError) throw dbError
      }

      // Refresh gallery
      await fetchGalleryPhotos()
      logger.info(`Successfully uploaded ${files.length} photo(s)`)
    } catch (error) {
      logger.error('Error uploading photos:', error)
      alert('Failed to upload photos. Please try again.')
    } finally {
      setIsUploading(false)
      // Reset input
      event.target.value = ''
    }
  }

  const handleDeletePhoto = async (photo: GalleryPhoto) => {
    if (!confirm('Are you sure you want to delete this photo?') || deletingPhotoId) return

    setDeletingPhotoId(photo.id)
    try {
      // Extract file path from URL
      const urlParts = photo.photo_url.split('/gallery/')
      if (urlParts.length < 2) throw new Error('Invalid photo URL')
      const filePath = urlParts[1]

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('gallery')
        .remove([filePath])

      if (storageError) throw storageError

      // Delete from database
      const { error: dbError } = await supabase
        .from('gallery_photos')
        .delete()
        .eq('id', photo.id)

      if (dbError) throw dbError

      // Update local state
      setGalleryPhotos(prev => prev.filter(p => p.id !== photo.id))
    } catch (error) {
      console.error('Error deleting photo:', error)
      alert('Failed to delete photo. Please try again.')
    } finally {
      setDeletingPhotoId(null)
    }
  }

  const handleDeleteVideo = async () => {
    if (!user || !confirm('Are you sure you want to remove your highlight video?') || deletingVideo) return

    setDeletingVideo(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ highlight_video_url: null })
        .eq('id', user.id)

      if (error) throw error

  await fetchProfile(user.id, { force: true })
    } catch (error) {
      console.error('Error deleting video:', error)
      alert('Failed to remove video. Please try again.')
    } finally {
      setDeletingVideo(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Highlight Video Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Highlight Video</h2>
            <p className="text-sm text-gray-600">Showcase your best moments and skills</p>
          </div>
          {!readOnly && displayProfile?.highlight_video_url && (
            <Button
              variant="outline"
              onClick={() => setShowAddVideoModal(true)}
            >
              Manage
            </Button>
          )}
        </div>

        {displayProfile?.highlight_video_url ? (
          <div className="relative">
            <VideoEmbed url={displayProfile.highlight_video_url} />
            {!readOnly && (
              <button
                onClick={handleDeleteVideo}
                disabled={deletingVideo}
                className="absolute top-4 right-4 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove video"
                aria-label="Remove video"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                <Video className="w-10 h-10 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Highlight Video Yet</h3>
            <p className="text-gray-600 mb-6">
              {readOnly 
                ? 'This player hasn\'t added a highlight video yet' 
                : 'Add a video link from YouTube, Vimeo, or Google Drive to showcase your skills'
              }
            </p>
            {!readOnly && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={() => setShowAddVideoModal(true)}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Add Video Link
                </Button>
                <Button
                  variant="outline"
                  disabled
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Video
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gallery Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Gallery</h2>
            <p className="text-sm text-gray-600">Share your best field hockey moments in Instagram-style</p>
          </div>
          {!readOnly && (
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={isUploading}
              />
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-playr-primary text-white rounded-lg hover:bg-playr-primary/90 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                <Plus className="w-4 h-4" />
                {isUploading ? 'Uploading...' : 'Add Photo'}
              </div>
            </label>
          )}
        </div>

        {isLoadingPhotos ? (
          <div className="text-center py-12 text-gray-500">Loading gallery...</div>
        ) : galleryPhotos.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
            <p className="text-gray-600 mb-4">
              {readOnly ? 'No photos in gallery yet' : 'No photos yet. Start building your gallery!'}
            </p>
            {!readOnly && (
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-playr-primary text-white rounded-lg hover:bg-playr-primary/90 transition-all font-semibold mx-auto">
                  <Plus className="w-4 h-4" />
                  Add Photo
                </div>
              </label>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {galleryPhotos.map((photo) => (
              <div key={photo.id} className="relative group aspect-square">
                <img
                  src={photo.photo_url}
                  alt="Gallery"
                  className="w-full h-full object-cover rounded-lg"
                />
                {!readOnly && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center">
                    <button
                      onClick={() => handleDeletePhoto(photo)}
                      disabled={deletingPhotoId === photo.id}
                      className="opacity-0 group-hover:opacity-100 p-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all transform scale-90 group-hover:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete photo"
                      aria-label="Delete photo"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Video Link Modal */}
      <AddVideoLinkModal
        isOpen={showAddVideoModal}
        onClose={() => setShowAddVideoModal(false)}
        currentVideoUrl={displayProfile?.highlight_video_url || ''}
      />
    </div>
  )
}

// Video Embed Component
function VideoEmbed({ url }: { url: string }) {
  const getEmbedUrl = (url: string) => {
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be')
        ? url.split('youtu.be/')[1]?.split('?')[0]
        : new URLSearchParams(url.split('?')[1]).get('v')
      return `https://www.youtube.com/embed/${videoId}`
    }

    // Vimeo
    if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0]
      return `https://player.vimeo.com/video/${videoId}`
    }

    // Google Drive
    if (url.includes('drive.google.com')) {
      const fileId = url.includes('/file/d/')
        ? url.split('/file/d/')[1]?.split('/')[0]
        : new URLSearchParams(url.split('?')[1]).get('id')
      return `https://drive.google.com/file/d/${fileId}/preview`
    }

    return url
  }

  const embedUrl = getEmbedUrl(url)
  const platform = url.includes('youtube') || url.includes('youtu.be')
    ? 'YouTube'
    : url.includes('vimeo')
    ? 'Vimeo'
    : url.includes('drive.google')
    ? 'Google Drive'
    : 'Video'

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-video">
      <div className="absolute top-4 left-4 z-10">
        <span className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded">
          {platform}
        </span>
      </div>
      <iframe
        src={embedUrl}
        className="absolute top-0 left-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Highlight video player"
      />
    </div>
  )
}
