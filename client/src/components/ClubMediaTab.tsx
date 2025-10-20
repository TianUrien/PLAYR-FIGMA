import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, GripVertical, Edit2, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/auth'
import type { ClubMedia } from '../lib/database.types'

interface ClubMediaTabProps {
  clubId?: string
  readOnly?: boolean
}

interface UploadProgress {
  file: File
  progress: number
  status: 'uploading' | 'success' | 'error'
  error?: string
}

export default function ClubMediaTab({ clubId, readOnly = false }: ClubMediaTabProps) {
  const { user } = useAuthStore()
  const targetClubId = clubId || user?.id
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [media, setMedia] = useState<ClubMedia[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [draggedItem, setDraggedItem] = useState<ClubMedia | null>(null)
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [captionText, setCaptionText] = useState('')
  const [altText, setAltText] = useState('')

  // Fetch club media
  const fetchMedia = async () => {
    if (!targetClubId) return
    
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('club_media')
        .select('*')
        .eq('club_id', targetClubId)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      setMedia(data || [])
    } catch (error) {
      console.error('Error fetching club media:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (targetClubId) {
      fetchMedia()
    }
  }, [targetClubId])

  // Validate file
  const validateFile = (file: File): string | null => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return 'Only JPG, PNG, and WebP images are allowed'
    }
    
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return 'File size must be less than 10MB'
    }
    
    return null
  }

  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return

    const fileArray = Array.from(files).slice(0, 10) // Max 10 files
    const validFiles: File[] = []
    
    // Validate all files first
    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        alert(`${file.name}: ${error}`)
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) return

    // Initialize progress tracking
    const progressItems: UploadProgress[] = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading'
    }))
    setUploadProgress(progressItems)

    // Upload files
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      try {
        // Create unique filename
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('club-media')
          .upload(fileName, file)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('club-media')
          .getPublicUrl(fileName)

        // Get the highest order_index
        const maxOrder = media.length > 0 
          ? Math.max(...media.map(m => m.order_index))
          : -1

        // Save to database
        const { error: dbError } = await supabase
          .from('club_media')
          .insert({
            club_id: user.id,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_size: file.size,
            order_index: maxOrder + 1
          })

        if (dbError) throw dbError

        // Update progress
        setUploadProgress(prev => 
          prev.map((item, idx) => 
            idx === i ? { ...item, progress: 100, status: 'success' } : item
          )
        )
      } catch (error) {
        console.error('Error uploading file:', error)
        setUploadProgress(prev => 
          prev.map((item, idx) => 
            idx === i 
              ? { ...item, status: 'error', error: 'Upload failed' } 
              : item
          )
        )
      }
    }

    // Refresh media list after all uploads
    await fetchMedia()
    
    // Clear progress after 2 seconds
    setTimeout(() => {
      setUploadProgress([])
    }, 2000)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle delete
  const handleDelete = async (mediaItem: ClubMedia) => {
    if (!confirm('Are you sure you want to delete this photo?')) return

    try {
      // Extract file path from URL
      const urlParts = mediaItem.file_url.split('/club-media/')
      if (urlParts.length < 2) throw new Error('Invalid file URL')
      const filePath = urlParts[1]

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('club-media')
        .remove([filePath])

      if (storageError) throw storageError

      // Delete from database
      const { error: dbError } = await supabase
        .from('club_media')
        .delete()
        .eq('id', mediaItem.id)

      if (dbError) throw dbError

      // Refresh media list
      await fetchMedia()
    } catch (error) {
      console.error('Error deleting media:', error)
      alert('Failed to delete photo. Please try again.')
    }
  }

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, item: ClubMedia) => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  // Handle drop
  const handleDrop = async (e: React.DragEvent, targetItem: ClubMedia) => {
    e.preventDefault()
    
    if (!draggedItem || draggedItem.id === targetItem.id) {
      setDraggedItem(null)
      return
    }

    const reorderedMedia = [...media]
    const draggedIndex = reorderedMedia.findIndex(m => m.id === draggedItem.id)
    const targetIndex = reorderedMedia.findIndex(m => m.id === targetItem.id)

    // Remove dragged item and insert at target position
    const [removed] = reorderedMedia.splice(draggedIndex, 1)
    reorderedMedia.splice(targetIndex, 0, removed)

    // Update order_index for all items
    const updates = reorderedMedia.map((item, index) => ({
      id: item.id,
      order_index: index
    }))

    // Optimistically update UI
    setMedia(reorderedMedia.map((item, index) => ({
      ...item,
      order_index: index
    })))
    setDraggedItem(null)

    // Update database
    try {
      for (const update of updates) {
        await supabase
          .from('club_media')
          .update({ order_index: update.order_index })
          .eq('id', update.id)
      }
    } catch (error) {
      console.error('Error updating order:', error)
      // Revert on error
      await fetchMedia()
    }
  }

  // Handle caption edit
  const startEditingCaption = (item: ClubMedia) => {
    setEditingCaption(item.id)
    setCaptionText(item.caption || '')
    setAltText(item.alt_text || '')
  }

  const saveCaption = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('club_media')
        .update({ 
          caption: captionText.trim() || null,
          alt_text: altText.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId)

      if (error) throw error

      setEditingCaption(null)
      await fetchMedia()
    } catch (error) {
      console.error('Error updating caption:', error)
      alert('Failed to update caption')
    }
  }

  const cancelEdit = () => {
    setEditingCaption(null)
    setCaptionText('')
    setAltText('')
  }

  // Handle drag and drop zone
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDropZone = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const files = e.dataTransfer.files
    handleFileUpload(files)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {!readOnly && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Photo Gallery</h2>
            <p className="text-gray-600 mt-1">Upload and manage your club photos</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            <Upload className="w-5 h-5" />
            Add Photos
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          {uploadProgress.map((item, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 truncate flex-1">
                  {item.file.name}
                </span>
                <span className="text-sm text-gray-500 ml-2">
                  {item.status === 'success' ? '✓' : item.status === 'error' ? '✗' : `${item.progress}%`}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    item.status === 'success' ? 'bg-green-500' :
                    item.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              {item.error && (
                <p className="text-sm text-red-600 mt-1">{item.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      {!readOnly && media.length === 0 && !isLoading && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDropZone}
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-purple-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-1">
            Drag and drop photos here, or click to browse
          </p>
          <p className="text-sm text-gray-500">
            JPG, PNG, or WebP • Max 10MB per file • Up to 10 files at once
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Photo Grid */}
      {!isLoading && media.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {media.map((item) => (
            <div
              key={item.id}
              draggable={!readOnly}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, item)}
              className={`bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow ${
                !readOnly ? 'cursor-move' : ''
              }`}
            >
              {/* Image */}
              <div className="relative aspect-square bg-gray-100">
                <img
                  src={item.file_url}
                  alt={item.alt_text || item.file_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {!readOnly && (
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                      title="Delete photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {!readOnly && (
                  <div className="absolute top-2 left-2 p-2 bg-white/80 backdrop-blur rounded-lg shadow-lg">
                    <GripVertical className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-4 space-y-2">
                {editingCaption === item.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={captionText}
                      onChange={(e) => setCaptionText(e.target.value.slice(0, 200))}
                      placeholder="Caption (optional, max 200 chars)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                    <input
                      type="text"
                      value={altText}
                      onChange={(e) => setAltText(e.target.value)}
                      placeholder="Alt text for accessibility (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveCaption(item.id)}
                        className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium flex items-center justify-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {!readOnly && (
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => startEditingCaption(item)}
                          className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                          title="Edit caption"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {item.caption && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {item.caption}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      Uploaded {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State (when not loading and has media) */}
      {!isLoading && media.length === 0 && readOnly && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600">No photos yet</p>
        </div>
      )}
    </div>
  )
}
