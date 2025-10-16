import { useState, useEffect } from 'react'
import { X, Link as LinkIcon, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/auth'
import Button from './Button'
import Input from './Input'

interface AddVideoLinkModalProps {
  isOpen: boolean
  onClose: () => void
  currentVideoUrl: string
}

export default function AddVideoLinkModal({ isOpen, onClose, currentVideoUrl }: AddVideoLinkModalProps) {
  const { user, fetchProfile } = useAuthStore()
  const [videoUrl, setVideoUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setVideoUrl(currentVideoUrl)
      setError('')
    }
  }, [isOpen, currentVideoUrl])

  const validateAndNormalizeUrl = (url: string): string | null => {
    try {
      // YouTube patterns
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = ''
        if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1]?.split('?')[0] || ''
        } else if (url.includes('youtube.com')) {
          const urlParams = new URLSearchParams(url.split('?')[1] || '')
          videoId = urlParams.get('v') || ''
        }
        if (!videoId) return null
        return `https://www.youtube.com/watch?v=${videoId}`
      }

      // Vimeo patterns
      if (url.includes('vimeo.com')) {
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0]
        if (!videoId) return null
        return `https://vimeo.com/${videoId}`
      }

      // Google Drive patterns
      if (url.includes('drive.google.com')) {
        let fileId = ''
        if (url.includes('/file/d/')) {
          fileId = url.split('/file/d/')[1]?.split('/')[0] || ''
        } else {
          const urlParams = new URLSearchParams(url.split('?')[1] || '')
          fileId = urlParams.get('id') || ''
        }
        if (!fileId) return null
        return `https://drive.google.com/file/d/${fileId}/view`
      }

      return null
    } catch {
      return null
    }
  }

  const handleSave = async () => {
    if (!videoUrl.trim()) {
      setError('Please enter a video URL')
      return
    }

    const normalizedUrl = validateAndNormalizeUrl(videoUrl)
    if (!normalizedUrl) {
      setError('Invalid video URL. Please use YouTube, Vimeo, or Google Drive links.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ highlight_video_url: normalizedUrl } as any)
        .eq('id', user?.id || '')

      if (updateError) throw updateError

      await fetchProfile(user?.id || '')
      onClose()
    } catch (err) {
      console.error('Error saving video:', err)
      setError('Failed to save video. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {currentVideoUrl ? 'Manage Highlight Video' : 'Add Video Link'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video URL
            </label>
            <Input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              icon={<LinkIcon className="w-5 h-5" />}
              disabled={isLoading}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          {videoUrl && validateAndNormalizeUrl(videoUrl) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview:
              </label>
              <VideoPreview url={validateAndNormalizeUrl(videoUrl)!} />
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-2">Supported platforms:</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• YouTube (youtube.com, youtu.be)</li>
              <li>• Vimeo (vimeo.com)</li>
              <li>• Google Drive (drive.google.com)</li>
            </ul>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Video'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Video Preview Component
function VideoPreview({ url }: { url: string }) {
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com')) {
      const videoId = new URLSearchParams(url.split('?')[1]).get('v')
      return `https://www.youtube.com/embed/${videoId}`
    }

    if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1]
      return `https://player.vimeo.com/video/${videoId}`
    }

    if (url.includes('drive.google.com')) {
      const fileId = url.split('/file/d/')[1]?.split('/')[0]
      return `https://drive.google.com/file/d/${fileId}/preview`
    }

    return url
  }

  const embedUrl = getEmbedUrl(url)
  const platform = url.includes('youtube')
    ? 'YouTube'
    : url.includes('vimeo')
    ? 'Vimeo'
    : 'Google Drive'

  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-black aspect-video">
      <div className="absolute top-3 left-3 z-10">
        <span className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded">
          {platform}
        </span>
      </div>
      <iframe
        src={embedUrl}
        className="absolute top-0 left-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Video preview"
      />
    </div>
  )
}
