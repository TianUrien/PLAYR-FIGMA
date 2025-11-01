import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ChatWindowSkeleton } from './Skeleton'
import { monitor } from '@/lib/monitor'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/retry'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  sent_at: string
  read_at: string | null
}

interface Conversation {
  id: string
  participant_one_id: string
  participant_two_id: string
  otherParticipant?: {
    id: string
    full_name: string
    username: string | null
    avatar_url: string | null
    role: 'player' | 'coach' | 'club'
  }
}

interface ChatWindowProps {
  conversation: Conversation
  currentUserId: string
  onBack: () => void
  onMessageSent: () => void
}

export default function ChatWindow({ conversation, currentUserId, onBack, onMessageSent }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('sent_at', { ascending: true })

      if (error) throw error
      logger.debug('Fetched messages:', data)
      setMessages(data || [])
    } catch (error) {
      logger.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }, [conversation.id])

  const markMessagesAsRead = useCallback(async () => {
    // Optimistically mark messages as read in UI immediately
    const now = new Date().toISOString()
    setMessages(prev => 
      prev.map(msg => 
        msg.sender_id !== currentUserId && !msg.read_at
          ? { ...msg, read_at: now }
          : msg
      )
    )
    
    // Update badge count immediately
    onMessageSent()
    
    // Then update in database
    try {
      await supabase
        .from('messages')
        .update({ read_at: now })
        .eq('conversation_id', conversation.id)
        .neq('sender_id', currentUserId)
        .is('read_at', null)
    } catch (error) {
      logger.error('Error marking messages as read:', error)
      // Silently fail - user already sees them as read
    }
  }, [conversation.id, currentUserId, onMessageSent])

  useEffect(() => {
    if (conversation.id) {
      fetchMessages()
      markMessagesAsRead()
    }
  }, [conversation.id, fetchMessages, markMessagesAsRead])

  // Set up real-time subscription for new messages in this conversation
  useEffect(() => {
    if (!conversation.id) return

    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          const newMessage = payload.new as Message
          setMessages((prev) => {
            // Check if message already exists (avoid duplicates from optimistic updates)
            if (prev.some(msg => msg.id === newMessage.id)) {
              return prev
            }
            return [...prev, newMessage]
          })
          if (newMessage.sender_id !== currentUserId) {
            markMessagesAsRead()
            onMessageSent()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) => (msg.id === payload.new.id ? (payload.new as Message) : msg))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation.id, currentUserId, onMessageSent, markMessagesAsRead]) // Fixed: Proper dependencies

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    const messageContent = newMessage.trim()
    if (messageContent.length > 1000) {
      alert('Message is too long. Maximum 1000 characters.')
      return
    }

    setSending(true)
    
    // Generate idempotency key and optimistic message ID
    const idempotencyKey = `${currentUserId}-${Date.now()}-${Math.random()}`
    const optimisticId = `optimistic-${idempotencyKey}`
    
    // Create optimistic message for immediate UI feedback
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: conversation.id,
      sender_id: currentUserId,
      content: messageContent,
      sent_at: new Date().toISOString(),
      read_at: null
    }
    
    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMessage])
    setNewMessage('')
    inputRef.current?.focus()
    
    await monitor.measure('send_message', async () => {
      try {
        // Send message with retry logic
        const result = await withRetry(async () => {
          const res = await supabase.from('messages').insert({
            conversation_id: conversation.id,
            sender_id: currentUserId,
            content: messageContent,
            idempotency_key: idempotencyKey
          }).select()
          if (res.error) throw res.error
          return res
        })

        const { data, error } = result
        if (error) throw error

        // Replace optimistic message with real message from server
        if (data && data[0]) {
          logger.debug('Message sent successfully, replacing optimistic message')
          setMessages(prev => prev.map(msg => 
            msg.id === optimisticId ? data[0] : msg
          ))
        }

        onMessageSent()
      } catch (error) {
        logger.error('Error sending message:', error)
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(msg => msg.id !== optimisticId))
        // Restore the message content so user can retry
        setNewMessage(messageContent)
        alert('Failed to send message. Please try again.')
        throw error
      }
    }, {
      conversationId: conversation.id
    }).finally(() => {
      setSending(false)
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const syntheticEvent = e as unknown as React.FormEvent
      handleSendMessage(syntheticEvent)
    }
  }

  const getAvatarUrl = (avatarUrl: string | null) => {
    if (!avatarUrl) return null
    if (avatarUrl.startsWith('http')) return avatarUrl
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarUrl}`
  }

  const avatarUrl = getAvatarUrl(conversation.otherParticipant?.avatar_url || null)

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        {/* Header Skeleton */}
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-white">
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="flex-1">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        {/* Messages Skeleton */}
        <ChatWindowSkeleton />
        {/* Input Skeleton */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-white">
        <button
          onClick={onBack}
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={conversation.otherParticipant?.full_name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold">
            {conversation.otherParticipant?.full_name?.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">
            {conversation.otherParticipant?.full_name}
          </h2>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              conversation.otherParticipant?.role === 'club'
                ? 'bg-orange-50 text-orange-700'
                : conversation.otherParticipant?.role === 'coach'
                ? 'bg-purple-50 text-purple-700'
                : 'bg-blue-50 text-blue-700'
            }`}>
              {conversation.otherParticipant?.role === 'club' 
                ? 'Club' 
                : conversation.otherParticipant?.role === 'coach'
                ? 'Coach'
                : 'Player'}
            </span>
            {/* Active status - placeholder for future feature */}
            {/* <span className="flex items-center gap-1 text-xs text-gray-500">
              <Circle className="w-2 h-2 fill-green-500 text-green-500" />
              Active now
            </span> */}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-center">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isMyMessage = message.sender_id === currentUserId
              const isPending = message.id.startsWith('optimistic-')
              const showTimestamp = 
                index === 0 || 
                new Date(message.sent_at).getTime() - new Date(messages[index - 1].sent_at).getTime() > 300000 // 5 minutes

              return (
                <div key={message.id}>
                  {showTimestamp && (
                    <div className="text-center text-xs text-gray-500 mb-2">
                      {format(new Date(message.sent_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  )}
                  <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        isMyMessage
                          ? isPending
                            ? 'bg-gradient-to-br from-[#6366f1]/70 to-[#8b5cf6]/70 text-white'
                            : 'bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className={`text-xs ${isMyMessage ? 'text-purple-100' : 'text-gray-500'}`}>
                          {format(new Date(message.sent_at), 'h:mm a')}
                        </p>
                        {isPending && (
                          <span className="text-xs text-purple-200 flex items-center gap-1">
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Sending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {newMessage.length}/1000
            </div>
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
