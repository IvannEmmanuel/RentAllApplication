import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    Image
} from 'react-native'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../../supbaseClient'
import { useRoute, useNavigation } from '@react-navigation/native'

const Chat = () => {
    const route = useRoute()
    const navigation = useNavigation()
    const scrollViewRef = useRef(null)

    const { conversationId, otherUserId, otherUserName, itemTitle, itemId } = route.params

    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
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

    // Fetch messages
    const fetchMessages = useCallback(async () => {
        if (!conversationId) return

        try {
            console.log('Fetching messages for conversation:', conversationId)

            const { data, error } = await supabase
                .from('messages')
                .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at,
          read_at
        `)
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })

            if (error) {
                console.error('Error fetching messages:', error)
                return
            }

            console.log('Messages fetched:', data?.length || 0)
            setMessages(data || [])

            // Mark messages as read
            await markMessagesAsRead()

        } catch (error) {
            console.error('Error in fetchMessages:', error)
        } finally {
            setLoading(false)
        }
    }, [conversationId])

    // Mark messages as read
    const markMessagesAsRead = useCallback(async () => {
        if (!currentUser || !conversationId) return

        try {
            const { error } = await supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .eq('conversation_id', conversationId)
                .neq('sender_id', currentUser.id)
                .is('read_at', null)

            if (error) {
                console.warn('Error marking messages as read:', error)
            }
        } catch (error) {
            console.warn('Error in markMessagesAsRead:', error)
        }
    }, [currentUser, conversationId])

    // Send message
    const sendMessage = async () => {
        if (!newMessage.trim() || !currentUser || sending) return

        const messageContent = newMessage.trim()
        setNewMessage('')
        setSending(true)

        try {
            console.log('Sending message:', messageContent)

            // Insert new message
            const { data: messageData, error: messageError } = await supabase
                .from('messages')
                .insert([{
                    conversation_id: conversationId,
                    sender_id: currentUser.id,
                    content: messageContent
                }])
                .select()
                .single()

            if (messageError) throw messageError

            // Update conversation's last message
            const { error: convError } = await supabase
                .from('conversations')
                .update({
                    last_message: messageContent,
                    last_message_at: new Date().toISOString()
                })
                .eq('id', conversationId)

            if (convError) {
                console.warn('Error updating conversation:', convError)
            }

            console.log('Message sent successfully')

            // The real-time subscription will handle adding the message to the UI

        } catch (error) {
            console.error('Error sending message:', error)
            Alert.alert('Error', 'Failed to send message. Please try again.')

            // Restore message text on error
            setNewMessage(messageContent)
        } finally {
            setSending(false)
        }
    }

    // Format message time
    const formatMessageTime = (timestamp) => {
        const messageTime = new Date(timestamp)
        const now = new Date()

        if (messageTime.toDateString() === now.toDateString()) {
            // Same day - show time
            return messageTime.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            })
        } else {
            // Different day - show date and time
            return messageTime.toLocaleDateString() + ' ' +
                messageTime.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                })
        }
    }

    // Scroll to bottom when new messages arrive
    const scrollToBottom = () => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true })
        }, 100)
    }

    // Load messages when component mounts
    useEffect(() => {
        if (currentUser) {
            fetchMessages()
        }
    }, [currentUser, fetchMessages])

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Real-time message updates
    useEffect(() => {
        if (!conversationId) return

        console.log('Setting up real-time subscription for messages')

        const channel = supabase
            .channel(`chat_${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    console.log('New message received via real-time:', payload)
                    const newMessage = payload.new

                    setMessages(prevMessages => {
                        // Check if message already exists to avoid duplicates
                        if (prevMessages.some(msg => msg.id === newMessage.id)) {
                            return prevMessages
                        }
                        return [...prevMessages, newMessage]
                    })

                    // Mark as read if we're the recipient
                    if (newMessage.sender_id !== currentUser?.id) {
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
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    console.log('Message updated via real-time:', payload)
                    const updatedMessage = payload.new

                    setMessages(prevMessages =>
                        prevMessages.map(msg =>
                            msg.id === updatedMessage.id ? updatedMessage : msg
                        )
                    )
                }
            )
            .subscribe()

        return () => {
            console.log('Cleaning up real-time subscription')
            supabase.removeChannel(channel)
        }
    }, [conversationId, currentUser, markMessagesAsRead])

    if (!currentUser) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Image source={require('../../../assets/back.png')} style={styles.backImage} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Chat</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </View>
        )
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 100}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Image source={require('../../../assets/back.png')} style={styles.backImage} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {otherUserName}
                    </Text>
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                        {itemTitle}
                    </Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            {/* Messages */}
            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => scrollToBottom()}
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#FFAB00" />
                        <Text style={styles.loadingText}>Loading messages...</Text>
                    </View>
                ) : messages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No messages yet</Text>
                        <Text style={styles.emptySubtext}>Start the conversation!</Text>
                    </View>
                ) : (
                    messages.map((message, index) => {
                        const isMyMessage = message.sender_id === currentUser.id
                        const showTimestamp = index === 0 ||
                            (new Date(message.created_at) - new Date(messages[index - 1].created_at)) > 300000 // 5 minutes

                        return (
                            <View key={message.id}>
                                {showTimestamp && (
                                    <Text style={styles.timestamp}>
                                        {formatMessageTime(message.created_at)}
                                    </Text>
                                )}
                                <View style={[
                                    styles.messageContainer,
                                    isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
                                ]}>
                                    <View style={[
                                        styles.messageBubble,
                                        isMyMessage ? styles.myMessage : styles.otherMessage
                                    ]}>
                                        <Text style={[
                                            styles.messageText,
                                            isMyMessage ? styles.myMessageText : styles.otherMessageText
                                        ]}>
                                            {message.content}
                                        </Text>
                                    </View>
                                    {isMyMessage && (
                                        <Text style={styles.readStatus}>
                                            {message.read_at ? '✓✓' : '✓'}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )
                    })
                )}
            </ScrollView>

            {/* Message Input */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    value={newMessage}
                    onChangeText={setNewMessage}
                    placeholder="Type a message..."
                    placeholderTextColor="#999"
                    multiline
                    maxLength={1000}
                />
                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        (!newMessage.trim() || sending) && styles.sendButtonDisabled
                    ]}
                    onPress={sendMessage}
                    disabled={!newMessage.trim() || sending}
                >
                    {sending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <Text style={styles.sendButtonText}>Send</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    )
}

export default Chat

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF5EF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 15,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2
    },
    backButton: {
        fontSize: 16,
        color: '#181818ff',
        fontFamily: 'DM-Medium',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 15,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'DM-Bold',
        color: '#333'
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666',
        fontFamily: 'DM-Regular',
    },
    headerSpacer: {
        width: 50,
    },
    backImage: {
        width: 30,
        height: 30
    },
    messagesContainer: {
        flex: 1,
        paddingHorizontal: 15,
    },
    messagesContent: {
        paddingVertical: 10,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 50,
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 50,
    },
    emptyText: {
        fontSize: 16,
        color: '#333',
        fontFamily: 'DM-Medium',
        marginBottom: 5,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#666',
        fontFamily: 'DM-Regular',
    },
    timestamp: {
        textAlign: 'center',
        fontSize: 12,
        color: '#999',
        marginVertical: 15,
        fontFamily: 'DM-Regular',
    },
    messageContainer: {
        marginVertical: 2,
    },
    myMessageContainer: {
        alignItems: 'flex-end',
    },
    otherMessageContainer: {
        alignItems: 'flex-start',
    },
    messageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 18,
    },
    myMessage: {
        backgroundColor: '#FFAB00',
        borderBottomRightRadius: 5,
    },
    otherMessage: {
        backgroundColor: '#FFF',
        borderBottomLeftRadius: 5,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    messageText: {
        fontSize: 16,
        fontFamily: 'DM-Regular',
        lineHeight: 20,
    },
    myMessageText: {
        color: '#FFF',
    },
    otherMessageText: {
        color: '#333',
    },
    readStatus: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
        marginRight: 5,
        textAlign: 'right',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E5E5',
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        fontSize: 16,
        fontFamily: 'DM-Regular',
        maxHeight: 100,
        marginRight: 10,
    },
    sendButton: {
        backgroundColor: '#FFAB00',
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#DDD',
    },
    sendButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'DM-Bold',
    },
})