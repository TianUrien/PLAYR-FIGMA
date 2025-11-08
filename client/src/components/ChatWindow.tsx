import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { ChatWindowSkeleton } from './Skeleton'
import { monitor } from '@/lib/monitor'
import { logger } from '@/lib/logger'
import { withRetry } from '@/lib/retry'
import { requestCache, generateCacheKey } from '@/lib/requestCache'

type NullableDate = string | null

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  sent_at: string
  read_at: NullableDate
}

interface ConversationParticipant {
  id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  role: 'player' | 'coach' | 'club'
}

interface Conversation {
  id: string
  participant_one_id: string
  participant_two_id: string
  created_at: string
  updated_at: string
  last_message_at: NullableDate
  otherParticipant?: ConversationParticipant
  isPending?: boolean
}

interface ChatWindowProps {
  conversation: Conversation
  currentUserId: string
  onBack: () => void
  onMessageSent: () => void
  onConversationCreated: (conversation: Conversation) => void
  onConversationRead?: (conversationId: string) => void
}

export default function ChatWindow({ conversation, currentUserId, onBack, onMessageSent, onConversationCreated, onConversationRead }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<Message[]>([])

  const syncMessagesState = useCallback(
    (next: Message[] | ((prev: Message[]) => Message[])) => {
      if (typeof next === 'function') {
        setMessages(prev => {
          const resolved = next(prev)
          messagesRef.current = resolved
          return resolved
        })
      } else {
        messagesRef.current = next
        setMessages(next)
      }
    },
    []
  )

  const fetchMessages = useCallback(async () => {
    if (!conversation.id || conversation.isPending) {
      syncMessagesState([])
      setLoading(false)
      return [] as Message[]
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('sent_at', { ascending: true })

      if (error) throw error

      const fetched = data ?? []
      logger.debug('Fetched messages:', fetched)
      syncMessagesState(fetched)
      return fetched
    } catch (error) {
      logger.error('Error fetching messages:', error)
      syncMessagesState([])
      return [] as Message[]
    } finally {
      setLoading(false)
    }
  }, [conversation.id, conversation.isPending, syncMessagesState])

  const markMessagesAsRead = useCallback(
    async (messagesOverride?: Message[]): Promise<number> => {
      if (!conversation.id || conversation.isPending) {
        return 0
      }

      const snapshot = messagesOverride ?? messagesRef.current
      if (!snapshot.length) {
        logger.debug('No messages loaded yet, skipping mark-as-read')
        return 0
      }

      const unreadMessages = snapshot.filter(
        msg => msg.sender_id !== currentUserId && !msg.read_at
      )
      const unreadCount = unreadMessages.length

      if (unreadCount === 0) {
        logger.debug('No unread messages to mark, skipping')
        return 0
      }

      logger.debug(`Found ${unreadCount} unread messages to mark as read`)

      if (typeof window !== 'undefined' && window.__updateUnreadBadge) {
        window.__updateUnreadBadge(-unreadCount)
        logger.debug(`Optimistically decremented badge by ${unreadCount}`)
      }

      const now = new Date().toISOString()
      const applyReadState = (source: Message[]) =>
        source.map(msg =>
          msg.sender_id !== currentUserId && !msg.read_at
            ? { ...msg, read_at: now }
            : msg
        )

      if (messagesOverride) {
        syncMessagesState(applyReadState(snapshot))
      } else {
        syncMessagesState(prev => applyReadState(prev))
      }

      const cacheKey = generateCacheKey('unread_count', { userId: currentUserId })
      requestCache.invalidate(cacheKey)
      onMessageSent()

      try {
        const { error } = await supabase
          .from('messages')
          .update({ read_at: now })
          .eq('conversation_id', conversation.id)
          .neq('sender_id', currentUserId)
          .is('read_at', null)

        if (error) throw error

        logger.debug('Database confirmed messages as read', {
          conversationId: conversation.id,
          unreadCount
        })

        if (onConversationRead) {
          onConversationRead(conversation.id)
        }

        requestCache.invalidate(cacheKey)
        if (typeof window !== 'undefined' && window.__refreshUnreadBadge) {
          window.__refreshUnreadBadge()
        }
        return unreadCount
      } catch (error) {
        logger.error('Error marking messages as read in database:', error)

        if (typeof window !== 'undefined' && window.__updateUnreadBadge) {
          window.__updateUnreadBadge(unreadCount)
        }

        syncMessagesState(snapshot)
        return -unreadCount
      }
    },
    [conversation.id, conversation.isPending, currentUserId, onConversationRead, onMessageSent, syncMessagesState]
  )

  useEffect(() => {
    if (!conversation.id || conversation.isPending) {
      setLoading(false)
      syncMessagesState([])
      return
    }

    let cancelled = false

    const loadConversation = async () => {
      const fetched = await fetchMessages()
      if (cancelled) return

      const marked = await markMessagesAsRead(fetched)
      if (cancelled) return

      if (marked <= 0) {
        const cacheKey = generateCacheKey('unread_count', { userId: currentUserId })
        requestCache.invalidate(cacheKey)
        if (typeof window !== 'undefined' && window.__refreshUnreadBadge) {
          window.__refreshUnreadBadge()
        }
      }
    }

    loadConversation()

    return () => {
      cancelled = true
    }
  }, [conversation.id, conversation.isPending, currentUserId, fetchMessages, markMessagesAsRead, syncMessagesState])

  useEffect(() => {
    if (!conversation.id || conversation.isPending) return

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
        payload => {
          const newMessage = payload.new as Message
          syncMessagesState(prev => {
            if (prev.some(msg => msg.id === newMessage.id)) {
              return prev
            }
            return [...prev, newMessage]
          })

          if (newMessage.sender_id !== currentUserId) {
            markMessagesAsRead()
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
        payload => {
          const updated = payload.new as Message
          syncMessagesState(prev =>
            prev.map(msg => (msg.id === updated.id ? updated : msg))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation.id, conversation.isPending, currentUserId, markMessagesAsRead, syncMessagesState])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    const messageContent = newMessage.trim()
    if (messageContent.length > 1000) {
      alert('Message is too long. Maximum 1000 characters.')
      return
    }

    setSending(true)
    const otherParticipantId =
      conversation.participant_one_id === currentUserId
        ? conversation.participant_two_id
        : conversation.participant_one_id

    if (!otherParticipantId) {
      logger.error('Cannot determine recipient for conversation', { conversation })
      setSending(false)
      return
    }

    let activeConversationId: string | null = conversation.isPending ? null : conversation.id
    let newlyCreatedConversation: Conversation | null = null
    let optimisticId: string | null = null
    let conversationCreatedForSend = false

    try {
      if (!activeConversationId) {
        try {
          const result = await withRetry(async () => {
            const response = await supabase
              .from('conversations')
              .insert({
                participant_one_id: currentUserId,
                participant_two_id: otherParticipantId
              })
              .select()

            if (response.error) throw response.error
            return response
          })

          const createdConversation = result.data?.[0]
          if (!createdConversation) {
            throw new Error('Failed to create conversation')
          }

          activeConversationId = createdConversation.id
          newlyCreatedConversation = {
            ...createdConversation,
            otherParticipant: conversation.otherParticipant,
            isPending: false
          }
          conversationCreatedForSend = true
        } catch (creationError: unknown) {
          const parsedError = creationError as { code?: string; message?: string; details?: string }
          const isUniqueViolation =
            parsedError?.code === '23505' ||
            parsedError?.message?.includes('duplicate key value') ||
            parsedError?.details?.includes('already exists')

          if (!isUniqueViolation) {
            throw creationError
          }

          const { data: existingConversation, error: existingConversationError } = await supabase
            .from('conversations')
            .select('*')
            .or(
              `and(participant_one_id.eq.${currentUserId},participant_two_id.eq.${otherParticipantId}),and(participant_one_id.eq.${otherParticipantId},participant_two_id.eq.${currentUserId})`
            )
            .maybeSingle()

          if (existingConversationError) {
            throw existingConversationError
          }

          if (!existingConversation) {
            throw creationError
          }

          activeConversationId = existingConversation.id
          newlyCreatedConversation = {
            ...existingConversation,
            otherParticipant: conversation.otherParticipant,
            isPending: false
          }
        }
      }

      const idempotencyKey = `${currentUserId}-${Date.now()}-${Math.random()}`
      optimisticId = `optimistic-${idempotencyKey}`

      const optimisticMessage: Message = {
        id: optimisticId,
        conversation_id: activeConversationId,
        sender_id: currentUserId,
        content: messageContent,
        sent_at: new Date().toISOString(),
        read_at: null
      }

      syncMessagesState(prev => [...prev, optimisticMessage])
      setNewMessage('')
      inputRef.current?.focus()

      const conversationIdForMetrics = activeConversationId

      await monitor.measure(
        'send_message',
        async () => {
          const result = await withRetry(async () => {
            const res = await supabase
              .from('messages')
              .insert({
                conversation_id: conversationIdForMetrics,
                sender_id: currentUserId,
                content: messageContent,
                idempotency_key: idempotencyKey
              })
              .select()

            if (res.error) throw res.error
            return res
          })

          const { data, error } = result
          if (error) throw error

          if (data && data[0]) {
            logger.debug('Message sent successfully, replacing optimistic message')
            const persisted = data[0] as Message
            syncMessagesState(prev => prev.map(msg => (msg.id === optimisticId ? persisted : msg)))
          }
        },
        { conversationId: conversationIdForMetrics }
      )

      onMessageSent()

      if (newlyCreatedConversation) {
        onConversationCreated(newlyCreatedConversation)
      }
    } catch (error) {
      logger.error('Error sending message:', error)
      if (optimisticId) {
        const finalOptimisticId = optimisticId
        syncMessagesState(prev => prev.filter(msg => msg.id !== finalOptimisticId))
      }
      setNewMessage(messageContent)

      if (conversationCreatedForSend && newlyCreatedConversation) {
        try {
          await supabase
            .from('conversations')
            .delete()
            .eq('id', newlyCreatedConversation.id)
        } catch (cleanupError) {
          logger.error('Failed to rollback empty conversation after send failure', cleanupError)
        }
      }

      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
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
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-white">
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="flex-1">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        <ChatWindowSkeleton />
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="h-12 bg-gray-100 rounded-xl animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="sticky top-[var(--app-header-offset,0px)] z-30 flex flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-4 shadow-sm md:px-6">
        <button
          onClick={onBack}
          className="md:hidden rounded-lg p-2 transition-colors hover:bg-gray-100"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={conversation.otherParticipant?.full_name}
            className="h-12 w-12 rounded-full object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-lg font-semibold text-white shadow-sm">
            {conversation.otherParticipant?.full_name?.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-gray-900 md:text-xl">
            {conversation.otherParticipant?.full_name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium md:text-sm ${
                conversation.otherParticipant?.role === 'club'
                  ? 'bg-orange-50 text-orange-700'
                  : conversation.otherParticipant?.role === 'coach'
                  ? 'bg-purple-50 text-purple-700'
                  : 'bg-blue-50 text-blue-700'
              }`}
            >
              {conversation.otherParticipant?.role === 'club'
                ? 'Club'
                : conversation.otherParticipant?.role === 'coach'
                ? 'Coach'
                : 'Player'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-6 scroll-smooth md:px-6 md:pb-20">
        {messages.length === 0 ? (
          <div className="flex min-h-[240px] items-center justify-center text-center text-gray-500">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message, index) => {
              const isMyMessage = message.sender_id === currentUserId
              const isPending = message.id.startsWith('optimistic-')
              const showTimestamp =
                index === 0 ||
                new Date(message.sent_at).getTime() - new Date(messages[index - 1].sent_at).getTime() > 300000

              return (
                <div key={message.id}>
                  {showTimestamp && (
                    <div className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-gray-400">
                      {format(new Date(message.sent_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  )}
                  <div className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm md:max-w-[70%] ${
                        isMyMessage
                          ? isPending
                            ? 'bg-gradient-to-br from-[#6366f1]/70 to-[#8b5cf6]/70 text-white'
                            : 'bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white'
                          : 'bg-white text-gray-900'
                      } ${!isMyMessage ? 'border border-gray-200' : ''}`}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <p className={isMyMessage ? 'text-purple-100' : 'text-gray-500'}>
                          {format(new Date(message.sent_at), 'h:mm a')}
                        </p>
                        {isPending && (
                          <span className="flex items-center gap-1 text-purple-100">
                            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
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
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="flex-shrink-0 border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex items-end gap-3 md:gap-4">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full resize-none rounded-xl border border-transparent bg-gray-100 px-4 py-3 text-sm shadow-inner focus:border-purple-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-100 md:rounded-2xl md:px-5 md:py-3"
            />
            <div className="pointer-events-none absolute bottom-2 right-3 text-xs font-medium text-gray-400 md:bottom-2.5 md:right-3">
              {newMessage.length}/1000
            </div>
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white shadow-lg transition-all duration-200 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Send message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
