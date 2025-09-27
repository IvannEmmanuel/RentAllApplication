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
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFavorites } from '../../components/FavoritesContext'
import { useUnreadMessages } from '../../hooks/useUnreadMessages'

const Chat = () => {
    const route = useRoute()
    const navigation = useNavigation()
    const scrollViewRef = useRef(null)

    const { conversationId, otherUserId, otherUserName, itemTitle, itemId } = route.params
    const { currentUser } = useFavorites()

    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)

    const { refreshUnreadCount } = useUnreadMessages(currentUser?.id);

    console.log("Conversation ID:", conversationId)
    console.log("Current User ID:", currentUser?.id)

    // --- Mark messages as read ---
    const markMessagesAsRead = useCallback(async () => {
        if (!currentUser?.id || !conversationId) return;

        try {
            console.log('🔄 Attempting to mark messages as read...');
            console.log('Current user ID:', currentUser.id);
            console.log('Conversation ID:', conversationId);
            
            // First, let's check what messages need to be marked as read
            const { data: unreadMessages, error: checkError } = await supabase
                .from('messages')
                .select('id, sender_id, content, read_at, conversation_id')
                .eq('conversation_id', conversationId)
                .neq('sender_id', currentUser.id)
                .is('read_at', null);

            if (checkError) {
                console.error('❌ Error checking unread messages:', checkError);
                return;
            }

            console.log(`📋 Found ${unreadMessages?.length || 0} unread messages to mark as read`);
            
            if (unreadMessages && unreadMessages.length > 0) {
                console.log('📋 Unread messages details:', unreadMessages.map(m => ({
                    id: m.id,
                    sender_id: m.sender_id,
                    conversation_id: m.conversation_id
                })));
            }

            if (!unreadMessages || unreadMessages.length === 0) {
                console.log('✅ No messages to mark as read');
                return;
            }

            // Get the IDs of messages to mark as read
            const messageIds = unreadMessages.map(msg => msg.id);
            console.log('📋 Message IDs to mark as read:', messageIds);

            // Mark them as read using the specific IDs
            const { data, error } = await supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .in('id', messageIds)
                .select('id, read_at');

            if (error) {
                console.error('❌ Error marking messages as read:', error);
                console.error('❌ Error details:', error.message);
                return;
            }

            console.log(`✅ Successfully marked ${data?.length || 0} messages as read`);
            if (data && data.length > 0) {
                console.log('✅ Marked messages:', data.map(m => ({ id: m.id, read_at: m.read_at })));
            }

            // Force refresh unread count after a small delay
            setTimeout(() => {
                console.log('🔄 Refreshing unread count...');
                refreshUnreadCount();
            }, 300);

        } catch (error) {
            console.error('❌ Error in markMessagesAsRead:', error);
        }
    }, [currentUser?.id, conversationId, refreshUnreadCount]);

    // --- Mark messages as read when screen focused ---
    useFocusEffect(
        useCallback(() => {
            if (currentUser?.id && conversationId) {
                console.log('👀 Screen focused - marking messages as read');
                // Add a small delay to ensure the screen is fully loaded
                setTimeout(() => {
                    markMessagesAsRead();
                }, 100);
            }
        }, [currentUser?.id, conversationId, markMessagesAsRead])
    );

    // --- Mark messages as read when messages are loaded (but only once) ---
    const [hasMarkedOnLoad, setHasMarkedOnLoad] = useState(false);
    useEffect(() => {
        if (messages.length > 0 && currentUser?.id && conversationId && !hasMarkedOnLoad && !loading) {
            console.log('📨 Messages loaded - marking as read');
            setHasMarkedOnLoad(true);
            markMessagesAsRead();
        }
    }, [messages.length, currentUser?.id, conversationId, hasMarkedOnLoad, loading, markMessagesAsRead]);

    // --- Fetch messages ---
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
        } catch (error) {
            console.error('Error in fetchMessages:', error)
        } finally {
            setLoading(false)
        }
    }, [conversationId])

    // --- Send message ---
    const sendMessage = async () => {
        if (!newMessage.trim() || !currentUser || sending) return

        const messageContent = newMessage.trim()
        setNewMessage('')
        setSending(true)

        try {
            console.log('Sending message:', messageContent)

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

            await supabase
                .from('conversations')
                .update({
                    last_message: messageContent,
                    last_message_at: new Date().toISOString()
                })
                .eq('id', conversationId)

            console.log('Message sent successfully')
        } catch (error) {
            console.error('Error sending message:', error)
            Alert.alert('Error', 'Failed to send message. Please try again.')
            setNewMessage(messageContent)
        } finally {
            setSending(false)
        }
    }

    // --- Helpers ---
    const formatMessageTime = (timestamp) => {
        const messageTime = new Date(timestamp)
        const now = new Date()

        if (messageTime.toDateString() === now.toDateString()) {
            return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } else {
            return messageTime.toLocaleDateString() + ' ' +
                messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    }

    const scrollToBottom = () => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true })
        }, 100)
    }

    // --- Effects ---
    useEffect(() => {
        if (currentUser && conversationId) {
            fetchMessages()
        }
    }, [currentUser, conversationId, fetchMessages])

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // --- Real-time subscription ---
    useEffect(() => {
        if (!conversationId || !currentUser?.id) return

        console.log('Setting up real-time subscription for messages')

        const channel = supabase
            .channel(`chat_${conversationId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
                (payload) => {
                    console.log('New message via real-time:', payload)
                    const newMessage = payload.new

                    setMessages(prev => prev.some(m => m.id === newMessage.id) ? prev : [...prev, newMessage])

                    // If it's not from current user, mark as read after a short delay
                    if (newMessage.sender_id !== currentUser.id) {
                        setTimeout(() => {
                            markMessagesAsRead();
                        }, 500);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
                (payload) => {
                    console.log('Message updated via real-time:', payload)
                    const updatedMessage = payload.new

                    setMessages(prev =>
                        prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
                    )
                }
            )
            .subscribe()

        return () => {
            console.log('Cleaning up real-time subscription')
            supabase.removeChannel(channel)
        }
    }, [conversationId, currentUser?.id, markMessagesAsRead])

    // --- UI ---
    if (!currentUser) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Image source={require("../../../assets/back.png")} style={styles.backImage} />
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{otherUserName}</Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>{itemTitle}</Text>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>
            </View>
        )
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Image source={require("../../../assets/back.png")} style={styles.backImage} />
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{otherUserName}</Text>
                        <Text style={styles.headerSubtitle} numberOfLines={1}>{itemTitle}</Text>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>

                {/* Messages */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={scrollToBottom}
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
                                (new Date(message.created_at) - new Date(messages[index - 1].created_at)) > 300000

                            return (
                                <View key={message.id}>
                                    {showTimestamp && <Text style={styles.timestamp}>{formatMessageTime(message.created_at)}</Text>}
                                    <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
                                        <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
                                            <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
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

                {/* Input */}
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
                        style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
                        onPress={sendMessage}
                        disabled={!newMessage.trim() || sending}
                    >
                        {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.sendButtonText}>Send</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
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
        paddingTop: 30,
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
        shadowRadius: 2,
    },
    backButton: {
        fontSize: 16,
        color: '#FFAB00',
        fontFamily: 'DM-Medium',
    },
    backImage: {
        width: 30,
        height: 30
    },
    headerInfo: {
        flex: 1,
        marginLeft: 15,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'DM-Bold',
        color: '#333',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#666',
        fontFamily: 'DM-Regular',
        marginTop: 2,
    },
    headerSpacer: {
        width: 50,
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

// import {
//     StyleSheet,
//     Text,
//     View,
//     ScrollView,
//     TextInput,
//     TouchableOpacity,
//     KeyboardAvoidingView,
//     Platform,
//     Alert,
//     ActivityIndicator,
//     Image
// } from "react-native"
// import React, { useEffect, useState, useCallback, useRef } from "react"
// import { supabase } from "../../../supbaseClient"
// import { useRoute, useNavigation } from "@react-navigation/native"
// import { SafeAreaView } from 'react-native-safe-area-context';

// const Chat = () => {
//     const route = useRoute()
//     const navigation = useNavigation()
//     const scrollViewRef = useRef(null)

//     const { conversationId, otherUserName, itemTitle } = route.params

//     const [messages, setMessages] = useState([])
//     const [newMessage, setNewMessage] = useState("")
//     const [loading, setLoading] = useState(true)
//     const [sending, setSending] = useState(false)
//     const [currentUser, setCurrentUser] = useState(null)

//     // Get current user
//     useEffect(() => {
//         const getCurrentUser = async () => {
//             try {
//                 const {
//                     data: { user },
//                     error,
//                 } = await supabase.auth.getUser()
//                 if (!error) setCurrentUser(user)
//             } catch (error) {
//                 console.error("Error in getCurrentUser:", error)
//             }
//         }
//         getCurrentUser()
//     }, [])

//     // Fetch messages
//     const fetchMessages = useCallback(async () => {
//         if (!conversationId) return
//         try {
//             const { data, error } = await supabase
//                 .from("messages")
//                 .select("id, conversation_id, sender_id, content, created_at, read_at")
//                 .eq("conversation_id", conversationId)
//                 .order("created_at", { ascending: true })

//             if (!error) setMessages(data || [])
//         } catch (error) {
//             console.error("Error in fetchMessages:", error)
//         } finally {
//             setLoading(false)
//         }
//     }, [conversationId])

//     useEffect(() => {
//         if (currentUser) fetchMessages()
//     }, [currentUser, fetchMessages])

//     useEffect(() => {
//         setTimeout(() => {
//             scrollViewRef.current?.scrollToEnd({ animated: true })
//         }, 100)
//     }, [messages])

//     // Send message
//     const sendMessage = async () => {
//         if (!newMessage.trim() || !currentUser || sending) return
//         const messageContent = newMessage.trim()
//         setNewMessage("")
//         setSending(true)

//         try {
//             await supabase
//                 .from("messages")
//                 .insert([
//                     {
//                         conversation_id: conversationId,
//                         sender_id: currentUser.id,
//                         content: messageContent,
//                     },
//                 ])
//             await supabase
//                 .from("conversations")
//                 .update({
//                     last_message: messageContent,
//                     last_message_at: new Date().toISOString(),
//                 })
//                 .eq("id", conversationId)
//         } catch (error) {
//             console.error("Error sending message:", error)
//             Alert.alert("Error", "Failed to send message.")
//             setNewMessage(messageContent)
//         } finally {
//             setSending(false)
//         }
//     }

//     // Format message time
//     const formatMessageTime = (timestamp) => {
//         const messageTime = new Date(timestamp)
//         const now = new Date()

//         if (messageTime.toDateString() === now.toDateString()) {
//             // Same day - show time
//             return messageTime.toLocaleTimeString([], {
//                 hour: '2-digit',
//                 minute: '2-digit'
//             })
//         } else {
//             // Different day - show date and time
//             return messageTime.toLocaleDateString() + ' ' +
//                 messageTime.toLocaleTimeString([], {
//                     hour: '2-digit',
//                     minute: '2-digit'
//                 })
//         }
//     }

//     const scrollToBottom = () => {
//         setTimeout(() => {
//             scrollViewRef.current?.scrollToEnd({ animated: true })
//         }, 100)
//     }

//     return (
//         <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
//             <KeyboardAvoidingView
//                 style={{ flex: 1 }}
//                 behavior="height"   // or "padding" for smoother animation
//                 keyboardVerticalOffset={0} // tweak this if header overlaps
//             >
//                 <View style={styles.container}>
//                     {/* Header */}
//                     <View style={styles.header}>
//                         <TouchableOpacity onPress={() => navigation.goBack()}>
//                             <Image source={require("../../../assets/back.png")} style={styles.backImage} />
//                         </TouchableOpacity>
//                         <View style={styles.headerInfo}>
//                             <Text style={styles.headerTitle} numberOfLines={1}>
//                                 {otherUserName}
//                             </Text>
//                             <Text style={styles.headerSubtitle} numberOfLines={1}>
//                                 {itemTitle}
//                             </Text>
//                         </View>
//                         <View style={styles.headerSpacer} />
//                     </View>

//                     {/* Messages */}
//                     {/* Messages */}
//                     <ScrollView
//                         ref={scrollViewRef}
//                         style={styles.messagesContainer}
//                         contentContainerStyle={styles.messagesContent}
//                         showsVerticalScrollIndicator={false}
//                         onContentSizeChange={() => scrollToBottom()}
//                     >
//                         {loading ? (
//                             <View style={styles.loadingContainer}>
//                                 <ActivityIndicator size="small" color="#FFAB00" />
//                                 <Text style={styles.loadingText}>Loading messages...</Text>
//                             </View>
//                         ) : messages.length === 0 ? (
//                             <View style={styles.emptyContainer}>
//                                 <Text style={styles.emptyText}>No messages yet</Text>
//                                 <Text style={styles.emptySubtext}>Start the conversation!</Text>
//                             </View>
//                         ) : (
//                             messages.map((message, index) => {
//                                 const isMyMessage = message.sender_id === currentUser.id
//                                 const showTimestamp = index === 0 ||
//                                     (new Date(message.created_at) - new Date(messages[index - 1].created_at)) > 300000 // 5 minutes

//                                 return (
//                                     <View key={message.id}>
//                                         {showTimestamp && (
//                                             <Text style={styles.timestamp}>
//                                                 {formatMessageTime(message.created_at)}
//                                             </Text>
//                                         )}
//                                         <View style={[
//                                             styles.messageContainer,
//                                             isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
//                                         ]}>
//                                             <View style={[
//                                                 styles.messageBubble,
//                                                 isMyMessage ? styles.myMessage : styles.otherMessage
//                                             ]}>
//                                                 <Text style={[
//                                                     styles.messageText,
//                                                     isMyMessage ? styles.myMessageText : styles.otherMessageText
//                                                 ]}>
//                                                     {message.content}
//                                                 </Text>
//                                             </View>
//                                             {isMyMessage && (
//                                                 <Text style={styles.readStatus}>
//                                                     {message.read_at ? '✓✓' : '✓'}
//                                                 </Text>
//                                             )}
//                                         </View>
//                                     </View>
//                                 )
//                             })
//                         )}
//                     </ScrollView>

//                     {/* Input fixed at bottom & moves with keyboard */}
//                     <View style={styles.inputContainer}>
//                         <TextInput
//                             style={styles.textInput}
//                             value={newMessage}
//                             onChangeText={setNewMessage}
//                             placeholder="Type a message..."
//                             placeholderTextColor="#999"
//                             multiline
//                             maxLength={1000}
//                         />
//                         <TouchableOpacity
//                             style={[
//                                 styles.sendButton,
//                                 (!newMessage.trim() || sending) && styles.sendButtonDisabled
//                             ]}
//                             onPress={sendMessage}
//                             disabled={!newMessage.trim() || sending}
//                         >
//                             {sending ? (
//                                 <ActivityIndicator size="small" color="#FFF" />
//                             ) : (
//                                 <Text style={styles.sendButtonText}>Send</Text>
//                             )}
//                         </TouchableOpacity>
//                     </View>
//                 </View >
//             </KeyboardAvoidingView>
//         </SafeAreaView >
//     )
// }

// export default Chat

// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         backgroundColor: '#FAF5EF',
//     },
//     header: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         paddingHorizontal: 20,
//         paddingTop: 60,
//         paddingBottom: 15,
//         backgroundColor: '#FFF',
//         borderBottomWidth: 1,
//         borderBottomColor: '#E5E5E5',
//         elevation: 2,
//         shadowColor: '#000',
//         shadowOffset: {
//             width: 0,
//             height: 1,
//         },
//         shadowOpacity: 0.1,
//         shadowRadius: 2
//     },
//     backButton: {
//         fontSize: 16,
//         color: '#181818ff',
//         fontFamily: 'DM-Medium',
//     },
//     headerInfo: {
//         flex: 1,
//         marginLeft: 15,
//     },
//     headerTitle: {
//         fontSize: 18,
//         fontFamily: 'DM-Bold',
//         color: '#333'
//     },
//     headerSubtitle: {
//         fontSize: 14,
//         color: '#666',
//         fontFamily: 'DM-Regular',
//     },
//     headerSpacer: {
//         width: 50,
//     },
//     backImage: {
//         width: 30,
//         height: 30
//     },
//     messagesContainer: {
//         flex: 1,
//         paddingHorizontal: 15,
//     },
//     messagesContent: {
//         paddingVertical: 10,
//     },
//     loadingContainer: {
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//         paddingVertical: 50,
//     },
//     loadingText: {
//         marginTop: 10,
//         color: '#666',
//         fontSize: 14,
//     },
//     emptyContainer: {
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//         paddingVertical: 50,
//     },
//     emptyText: {
//         fontSize: 16,
//         color: '#333',
//         fontFamily: 'DM-Medium',
//         marginBottom: 5,
//     },
//     emptySubtext: {
//         fontSize: 14,
//         color: '#666',
//         fontFamily: 'DM-Regular',
//     },
//     timestamp: {
//         textAlign: 'center',
//         fontSize: 12,
//         color: '#999',
//         marginVertical: 15,
//         fontFamily: 'DM-Regular',
//     },
//     messageContainer: {
//         marginVertical: 2,
//     },
//     myMessageContainer: {
//         alignItems: 'flex-end',
//     },
//     otherMessageContainer: {
//         alignItems: 'flex-start',
//     },
//     messageBubble: {
//         maxWidth: '80%',
//         paddingHorizontal: 15,
//         paddingVertical: 10,
//         borderRadius: 18,
//     },
//     myMessage: {
//         backgroundColor: '#FFAB00',
//         borderBottomRightRadius: 5,
//     },
//     otherMessage: {
//         backgroundColor: '#FFF',
//         borderBottomLeftRadius: 5,
//         elevation: 1,
//         shadowColor: '#000',
//         shadowOffset: {
//             width: 0,
//             height: 1,
//         },
//         shadowOpacity: 0.1,
//         shadowRadius: 1,
//     },
//     messageText: {
//         fontSize: 16,
//         fontFamily: 'DM-Regular',
//         lineHeight: 20,
//     },
//     myMessageText: {
//         color: '#FFF',
//     },
//     otherMessageText: {
//         color: '#333',
//     },
//     readStatus: {
//         fontSize: 12,
//         color: '#666',
//         marginTop: 2,
//         marginRight: 5,
//         textAlign: 'right',
//     },
//     inputContainer: {
//         flexDirection: 'row',
//         alignItems: 'flex-end',
//         paddingHorizontal: 15,
//         paddingVertical: 20,
//         backgroundColor: '#FFF',
//         borderTopWidth: 1,
//         borderTopColor: '#E5E5E5',
//     },
//     textInput: {
//         flex: 1,
//         borderWidth: 1,
//         borderColor: '#DDD',
//         borderRadius: 20,
//         paddingHorizontal: 15,
//         paddingVertical: 10,
//         fontSize: 16,
//         fontFamily: 'DM-Regular',
//         maxHeight: 100,
//         marginRight: 10,
//     },
//     sendButton: {
//         backgroundColor: '#FFAB00',
//         borderRadius: 20,
//         paddingHorizontal: 20,
//         paddingVertical: 10,
//         justifyContent: 'center',
//         alignItems: 'center',
//     },
//     sendButtonDisabled: {
//         backgroundColor: '#DDD',
//     },
//     sendButtonText: {
//         color: '#FFF',
//         fontSize: 16,
//         fontFamily: 'DM-Bold',
//     },
// })