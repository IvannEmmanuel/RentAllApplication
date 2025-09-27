import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supbaseClient';

export const useUnreadMessages = (userId) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchTimeoutRef = useRef(null);

  // Fetch unread count with improved error handling
  const fetchUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      console.log('📩 Fetching unread count for user:', userId);

      // Get all conversations for the user
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

      if (convError) throw convError;

      if (!conversations || conversations.length === 0) {
        console.log('✅ No conversations found - unread count: 0');
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      const conversationIds = conversations.map((conv) => conv.id);

      // Count unread messages in these conversations
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', userId)
        .is('read_at', null);

      if (error) throw error;

      const newCount = count || 0;
      console.log('✅ Unread count fetched:', newCount);
      
      // Only update if the count actually changed
      setUnreadCount(prevCount => {
        if (prevCount !== newCount) {
          console.log(`🔄 Unread count changed: ${prevCount} → ${newCount}`);
        }
        return newCount;
      });
      
    } catch (error) {
      console.error('❌ Error fetching unread count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Debounced refresh to prevent too many rapid calls
  const debouncedRefresh = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    fetchTimeoutRef.current = setTimeout(() => {
      fetchUnreadCount();
    }, 200);
  }, [fetchUnreadCount]);

  // Manual refresh function
  const refreshUnreadCount = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    // Clear any pending debounced calls
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    // Fetch immediately
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Fetch on mount and when userId changes
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Subscribe to relevant changes with improved filtering
  useEffect(() => {
    if (!userId) return;

    console.log(`📡 Setting up real-time subscription for user: ${userId}`);

    const channel = supabase
      .channel(`unread_messages_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT + UPDATE + DELETE
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('🔔 Dashboard: Message table changed:', payload.eventType, payload.new?.id || payload.old?.id);
          
          const message = payload.new || payload.old;
          if (message) {
            // Special handling for UPDATE events (like marking as read)
            if (payload.eventType === 'UPDATE') {
              const oldReadAt = payload.old?.read_at;
              const newReadAt = payload.new?.read_at;
              
              // If read_at changed from null to a timestamp, refresh immediately
              if (oldReadAt === null && newReadAt !== null) {
                console.log('🔔 Dashboard: Message marked as read, refreshing immediately');
                // Force immediate refresh for read status changes
                if (fetchTimeoutRef.current) {
                  clearTimeout(fetchTimeoutRef.current);
                }
                fetchUnreadCount();
                return;
              }
            }
            
            // For other changes, use debounced refresh
            debouncedRefresh();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          console.log('🔔 Dashboard: Conversation table changed:', payload.eventType);
          const conversation = payload.new || payload.old;
          
          // Only refresh if this conversation involves the current user
          if (conversation && (conversation.user1_id === userId || conversation.user2_id === userId)) {
            debouncedRefresh();
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Cleaning up real-time subscription for unread messages');
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [userId, debouncedRefresh, fetchUnreadCount]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  return {
    unreadCount,
    loading,
    refreshUnreadCount, // call this manually after marking read
    debouncedRefresh, // for internal use
  };
};