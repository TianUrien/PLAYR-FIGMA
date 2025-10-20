import { useState } from 'react'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/auth'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
  userEmail: string
}

export default function DeleteAccountModal({ isOpen, onClose, userEmail }: DeleteAccountModalProps) {
  const { signOut } = useAuthStore()
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const isConfirmed = confirmText.toUpperCase() === 'DELETE'

  const handleDelete = async () => {
    if (!isConfirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session. Please sign in again.')
      }

      // Call the delete-account edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete account')
      }

      // Success - sign out and redirect
      await signOut()
      
      // Show success message
      const successToast = document.createElement('div')
      successToast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50'
      successToast.textContent = 'Account deleted successfully'
      document.body.appendChild(successToast)
      
      setTimeout(() => {
        successToast.remove()
      }, 3000)

      // Redirect to home
      window.location.href = '/'
      
    } catch (err) {
      console.error('Error deleting account:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete account. Please try again.')
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('')
      setError(null)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
        {/* Close button */}
        {!isDeleting && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Icon */}
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Delete your account?
        </h2>

        {/* Description */}
        <p className="text-gray-600 text-center mb-6">
          This action is <strong>irreversible</strong>. All your profile data, messages, and uploaded media will be permanently deleted.
        </p>

        {/* Warning box */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800 font-medium mb-2">
            ⚠️ You will lose access to:
          </p>
          <ul className="text-sm text-red-700 space-y-1 ml-4">
            <li>• Your profile and all personal information</li>
            <li>• All messages and conversations</li>
            <li>• All uploaded photos and media</li>
            <li>• Applications and vacancies</li>
            <li>• Playing history and records</li>
          </ul>
        </div>

        {/* Confirmation input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type <span className="font-bold text-red-600">DELETE</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            disabled={isDeleting}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            autoComplete="off"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Permanently'
            )}
          </button>
        </div>

        {/* Additional info */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Signed in as: <span className="font-medium">{userEmail}</span>
        </p>
      </div>
    </div>
  )
}
