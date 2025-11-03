import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/auth'
import type { Vacancy } from '../lib/database.types'
import Button from './Button'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface ApplyToVacancyModalProps {
  isOpen: boolean
  onClose: () => void
  vacancy: Vacancy
  onSuccess: () => void
}

export default function ApplyToVacancyModal({
  isOpen,
  onClose,
  vacancy,
  onSuccess,
}: ApplyToVacancyModalProps) {
  const { user } = useAuthStore()
  const [coverLetter, setCoverLetter] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  const handleClose = useCallback(() => {
    if (isSubmitting) {
      return
    }
    onClose()
    setCoverLetter('')
    setError(null)
  }, [isSubmitting, onClose])

  useFocusTrap({ containerRef: dialogRef, isActive: isOpen, initialFocusRef: textareaRef })

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      setError('You must be signed in to apply.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    // Optimistically call onSuccess immediately for instant UI feedback
    onSuccess() // Update UI immediately
    onClose() // Close modal immediately

    try {
      const { error: insertError } = await supabase
        .from('vacancy_applications')
        .insert({
          vacancy_id: vacancy.id,
          player_id: user.id,
          cover_letter: coverLetter.trim() || null,
          status: 'pending',
        } as never)

      if (insertError) {
        // Check for duplicate application error
        if (insertError.code === '23505') {
          // Already applied - show message but don't revert UI
          alert('You have already applied to this vacancy.')
        } else {
          // Real error - we should ideally revert the optimistic update
          throw insertError
        }
        return
      }

      // Success! Clear cover letter for next time
      setCoverLetter('')
    } catch (err) {
      console.error('Error applying to vacancy:', err)
      // In a real app, you'd want to revert the optimistic update here
      alert('Failed to submit application. Please try refreshing the page.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="presentation">
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 id={titleId} className="text-2xl font-bold text-gray-900">Apply to Position</h2>
            <p id={descriptionId} className="text-sm text-gray-600 mt-1">{vacancy.title}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Vacancy Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Position:</span>
              <span className="text-sm text-gray-900">{vacancy.position}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Location:</span>
              <span className="text-sm text-gray-900">
                {vacancy.location_city}, {vacancy.location_country}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Type:</span>
              <span className="text-sm text-gray-900 capitalize">{vacancy.opportunity_type}</span>
            </div>
          </div>

          {/* Cover Letter */}
          <div>
            <label htmlFor="coverLetter" className="block text-sm font-medium text-gray-700 mb-2">
              Cover Letter <span className="text-gray-400">(Optional)</span>
            </label>
            <textarea
              ref={textareaRef}
              id="coverLetter"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              placeholder="Tell the club why you're interested in this position and what you can bring to the team..."
              rows={8}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              disabled={isSubmitting}
            />
            <p className="mt-2 text-xs text-gray-500">
              {coverLetter.length} characters
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>What happens next?</strong> Your application will be sent to the club. 
              They'll review your profile and may contact you if you're a good fit.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <Button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
