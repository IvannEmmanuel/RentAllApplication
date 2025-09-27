import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../supbaseClient'
import { useFavorites } from '../components/FavoritesContext'

const UnreadMessagesContext = createContext({
  unreadCount: 0,
  refreshUnreadCount: async () => {}
})

export const UnreadMessagesProvider = ({ children }) => {
  const { currentUser } = useFavorites()
  const userId = currentUser?.id || null

  const [unreadCount, setUnreadCount] = useState(0)
  const convIdsRef = useRef([])
  const channelRef = useRef(null)

  const fetchConversationsIds = useCallback(async (uid) => {
    if (!uid) return []
    try {
      const { data: convData, error } = await supabase
        .from('conversations')
        .select('id')
        .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)

      if (error) {
        console.warn('Error fetching conversations for unread count:', error)
        return []
      }
      return convData ? convData.map(c => c.id) : []
    } catch (err) {
      console.error('Error in fetchConversationsIds:', err)
      return []
    }
  }, [])

  const fetchUnreadCount = useCallback(async (uid) => {
    if (!uid) {
      setUnreadCount(0)
      return 0
    }
    try {
      const convIds = await fetchConversationsIds(uid)
      convIdsRef.current = convIds

      if (!convIds || convIds.length === 0) {
        console.log(`📩 Fetching unread count for user: ${uid}`)
        console.log('✅ Unread count fetched: 0 (no conversations)')
        setUnreadCount(0)
        return 0
      }

      // Use head:true + count:'exact' to get an exact count without payload
      const resp = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .neq('sender_id', uid)
        .is('read_at', null)

      if (resp.error) {
        console.error('Error fetching unread count:', resp.error)
        return unreadCount
      }

      const count = resp.count || 0
      console.log(`📩 Fetching unread count for user: ${uid}`)
      console.log(`✅ Unread count fetched: ${count}`)
      setUnreadCount(count)
      return count
    } catch (err) {
      console.error('Error in fetchUnreadCount:', err)
      return unreadCount
    }
  }, [fetchConversationsIds, unreadCount])

  // Refresh function exposed to consumers
  const refreshUnreadCount = useCallback(async () => {
    if (!userId) return
    // manual refresh log
    console.log('🔄 Manual refresh triggered')
    await fetchUnreadCount(userId)
  }, [userId, fetchUnreadCount])

  useEffect(() => {
    let mounted = true

    // initialize on mount and whenever user changes
    ;(async () => {
      if (!userId) {
        if (mounted) setUnreadCount(0)
        return
      }

      await fetchUnreadCount(userId)

      // cleanup any previous channel
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current)
        } catch (e) {
          // ignore
        }
        channelRef.current = null
      }

      // Setup realtime subscription for messages INSERT/UPDATE
      const channel = supabase
        .channel(`unread_changes_${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            try {
              const newMsg = payload.new
              // message concerns the user's conversations?
              const convIds = convIdsRef.current
              if (!newMsg || !convIds || convIds.length === 0) return

              if (convIds.includes(newMsg.conversation_id)) {
                // only count messages not sent by the user and that are unread
                if (newMsg.sender_id !== userId && (newMsg.read_at === null || newMsg.read_at === undefined)) {
                  setUnreadCount(prev => {
                    const next = prev + 1
                    console.log(`LOG  🔄 Unread count changed: ${prev} → ${next}`)
                    return next
                  })
                }
              }
            } catch (err) {
              console.error('Error handling message INSERT realtime:', err)
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages' },
          (payload) => {
            try {
              const oldMsg = payload.old
              const newMsg = payload.new
              const convIds = convIdsRef.current
              if (!newMsg || !convIds || convIds.length === 0) return

              // If a message changed read_at from null -> timestamp and it's in user's conversations and was not sent by the user,
              // we should decrement unreadCount.
              const wasUnread = oldMsg && (oldMsg.read_at === null || oldMsg.read_at === undefined)
              const nowRead = newMsg && newMsg.read_at !== null && newMsg.read_at !== undefined

              if (convIds.includes(newMsg.conversation_id) && newMsg.sender_id !== userId && wasUnread && nowRead) {
                setUnreadCount(prev => {
                  const next = Math.max(0, prev - 1)
                  console.log(`LOG  🔄 Unread count changed: ${prev} → ${next}`)
                  return next
                })
              }
            } catch (err) {
              console.error('Error handling message UPDATE realtime:', err)
            }
          }
        )
        .subscribe((status) => {
          // optional: log subscription status
          // console.log('Unread channel status', status)
        })

      channelRef.current = channel

    })()

    return () => {
      mounted = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [userId, fetchUnreadCount])

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </UnreadMessagesContext.Provider>
  )
}

export const useUnread = () => {
  return useContext(UnreadMessagesContext)
}