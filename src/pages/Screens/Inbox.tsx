import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native'
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../supbaseClient'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import SkeletonLoadingInbox from '../../components/skeletonComponents/SkeletonLoadingInbox' // Adjust path as needed

const Inbox = () => {
  const navigation = useNavigation()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) {
          console.error('Error getting user:', error)
          return
        }
        setCurrentUser(user)
      } catch (error) {
        console.error('Error in getCurrentUser:', error)
      }
    }
    getCurrentUser()
  }, [])

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!currentUser) return

    try {
      console.log('Fetching conversations for user:', currentUser.id)

      // Get conversations where user is either user1 or user2
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          user1_id,
          user2_id,
          item_id,
          last_message,
          last_message_at,
          created_at
        `)
        .or(`user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id}`)
        .order('last_message_at', { ascending: false })

      if (convError) {
        console.error('Error fetching conversations:', convError)
        return
      }

      console.log('Conversations found:', convData?.length || 0)

      if (!convData || convData.length === 0) {
        setConversations([])
        setLoading(false)
        return
      }

      // Get user IDs to fetch user details
      const otherUserIds = convData.map(conv =>
        conv.user1_id === currentUser.id ? conv.user2_id : conv.user1_id
      )

      // Get item IDs to fetch item details
      const itemIds = convData.map(conv => conv.item_id).filter(Boolean)

      // Get conversation IDs to fetch last message details
      const conversationIds = convData.map(conv => conv.id)

      // Fetch user details
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, face_image_url')
        .in('id', otherUserIds)

      if (usersError) {
        console.warn('Error fetching users:', usersError)
      }

      // Fetch item details
      let itemsData = []
      if (itemIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from('items')
          .select('item_id, title, user_id')
          .in('item_id', itemIds)

        if (itemsError) {
          console.warn('Error fetching items:', itemsError)
        } else {
          itemsData = items || []
        }
      }

      // Fetch last message details to get message type
      const { data: lastMessagesData, error: lastMessagesError } = await supabase
        .from('messages')
        .select('conversation_id, message_type, content, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })

      if (lastMessagesError) {
        console.warn('Error fetching last messages:', lastMessagesError)
      }

      // Group messages by conversation and get the latest one for each
      const lastMessagesByConv = {}
      if (lastMessagesData) {
        lastMessagesData.forEach(msg => {
          if (!lastMessagesByConv[msg.conversation_id]) {
            lastMessagesByConv[msg.conversation_id] = msg
          }
        })
      }

      // Combine conversation data with user and item details
      const enrichedConversations = convData.map(conv => {
        const otherUserId = conv.user1_id === currentUser.id ? conv.user2_id : conv.user1_id
        const otherUser = usersData?.find(user => user.id === otherUserId)
        const item = itemsData.find(item => item.item_id === conv.item_id)
        const lastMessage = lastMessagesByConv[conv.id]

        // Determine preview text based on message type
        let preview = 'No messages yet'
        if (lastMessage) {
          if (lastMessage.message_type === 'image') {
            preview = 'Image'
          } else {
            preview = conv.last_message || lastMessage.content || 'No messages yet'
          }
        } else if (conv.last_message) {
          preview = conv.last_message
        }

        return {
          ...conv,
          otherUserId,
          otherUserName: otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'Unknown User',
          otherUserImage: otherUser?.face_image_url || null,
          itemTitle: item?.title || 'Item not found',
          formattedTime: formatMessageTime(conv.last_message_at),
          preview
        }
      })

      console.log('Enriched conversations:', enrichedConversations.length)
      setConversations(enrichedConversations)
      setLoading(false)

    } catch (error) {
      console.error('Error in fetchConversations:', error)
      setLoading(false)
    }
  }, [currentUser])

  // Format message time
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return ''

    const messageTime = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now - messageTime) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60))
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else if (diffInHours < 48) {
      return 'Yesterday'
    } else {
      return messageTime.toLocaleDateString()
    }
  }

  // Load conversations when user is available
  useFocusEffect(
    useCallback(() => {
      if (currentUser) {
        console.log("Inbox focused, fetching conversations...");
        fetchConversations();
      }
    }, [currentUser, fetchConversations]) // Pass fetchConversations here
  );

  // Real-time updates for conversations
  useEffect(() => {
    if (!currentUser) return

    console.log('Setting up real-time subscription for conversations')

    const channel = supabase
      .channel('inbox_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `or(user1_id.eq.${currentUser.id},user2_id.eq.${currentUser.id})`
        },
        (payload) => {
          console.log('Conversation change received:', payload)
          fetchConversations()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('New message received:', payload)
          // Refresh conversations to update last message
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up real-time subscription')
      supabase.removeChannel(channel)
    }
  }, [currentUser, fetchConversations])

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchConversations()
    setRefreshing(false)
  }, [fetchConversations])

  // Navigate to chat
  const openChat = (conversation) => {
    navigation.navigate('Chat', {
      conversationId: conversation.id,
      otherUserId: conversation.otherUserId,
      otherUserName: conversation.otherUserName,
      itemTitle: conversation.itemTitle,
      itemId: conversation.item_id
    })
  }

  // Show skeleton loading while loading
  if (loading) {
    return <SkeletonLoadingInbox />;
  }

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Please log in to view messages</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        style={styles.conversationsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FFAB00']}
            tintColor="#FFAB00"
          />
        }
      >
        {conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Image
              source={require('../../../assets/inboxM.png')}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Start messaging item owners from the Home screen
            </Text>
          </View>
        ) : (
          conversations.map((conversation) => (
            <TouchableOpacity
              key={conversation.id}
              style={styles.conversationItem}
              onPress={() => openChat(conversation)}
              activeOpacity={0.7}
            >
              <View style={styles.avatarContainer}>
                {conversation.otherUserImage ? (
                  <Image
                    source={{ uri: conversation.otherUserImage }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {conversation.otherUserName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {conversation.otherUserName}
                  </Text>
                  <Text style={styles.timestamp}>
                    {conversation.formattedTime}
                  </Text>
                </View>

                <Text style={styles.itemTitle} numberOfLines={1}>
                  📦 {conversation.itemTitle}
                </Text>

                <Text style={styles.lastMessage} numberOfLines={2}>
                  {conversation.preview}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Add some bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  )
}

export default Inbox

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5EF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
    backgroundColor: '#FAF5EF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'DM-Regular',
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFAB00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'DM-Bold',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#333',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'DM-Regular',
  },
  itemTitle: {
    fontSize: 13,
    color: '#FFAB00',
    fontFamily: 'DM-Medium',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'DM-Regular',
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 15,
    color: '#666',
    fontSize: 16,
    fontFamily: 'DM-Regular',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 100,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    opacity: 0.3,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'DM-Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    fontFamily: 'DM-Medium',
    textAlign: 'center'
  },
});