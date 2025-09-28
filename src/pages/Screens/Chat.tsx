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
    Image,
    Modal,
    Dimensions,
    Keyboard
} from 'react-native'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../../supbaseClient'
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFavorites } from '../../components/FavoritesContext'
import { useUnread } from '../../hooks/useUnreadMessages'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from "expo-file-system/legacy";

function base64ToUint8Array(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

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
    const [uploadingImage, setUploadingImage] = useState(false)
    const [selectedImage, setSelectedImage] = useState(null)
    const [showImageModal, setShowImageModal] = useState(false)

    const { refreshUnreadCount } = useUnread();

    console.log("Conversation ID:", conversationId)
    console.log("Current User ID:", currentUser?.id)

    useEffect(() => {
        const showSub = Keyboard.addListener("keyboardDidShow", () => {
            scrollToBottom();
        });
        const hideSub = Keyboard.addListener("keyboardDidHide", () => {
            scrollToBottom();
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // --- Mark messages as read ---
    const markMessagesAsRead = useCallback(async () => {
        if (!currentUser?.id || !conversationId) return;

        try {
            console.log('🔄 Attempting to mark messages as read...');

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

            if (!unreadMessages || unreadMessages.length === 0) {
                return;
            }

            const messageIds = unreadMessages.map(msg => msg.id);

            const { data, error } = await supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .in('id', messageIds)
                .select('id, read_at');

            if (error) {
                console.error('❌ Error marking messages as read:', error);
                return;
            }

            console.log(`✅ Successfully marked ${data?.length || 0} messages as read`);

            setTimeout(() => {
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
                setTimeout(() => {
                    markMessagesAsRead();
                }, 100);
            }
        }, [currentUser?.id, conversationId, markMessagesAsRead])
    );

    // --- Mark messages as read when messages are loaded ---
    const [hasMarkedOnLoad, setHasMarkedOnLoad] = useState(false);
    useEffect(() => {
        if (messages.length > 0 && currentUser?.id && conversationId && !hasMarkedOnLoad && !loading) {
            setHasMarkedOnLoad(true);
            markMessagesAsRead();
        }
    }, [messages.length, currentUser?.id, conversationId, hasMarkedOnLoad, loading, markMessagesAsRead]);

    // --- Request camera/gallery permissions ---
    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'We need camera roll permissions to send images.');
            }
        })();
    }, []);

    // --- Upload image to Supabase Storage ---
    // --- Upload image to Supabase Storage ---
    const uploadImage = async (uri: string, fileName: string) => {
        try {
            console.log("📤 Uploading image...");
            console.log("Bucket: chat-images");
            console.log("File name:", fileName);
            console.log("URI:", uri);

            // Debug: Check authentication
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            console.log("Current user:", user?.id);
            console.log("Auth error:", authError);

            if (!user) {
                console.error("No authenticated user found");
                return null;
            }

            // Read file as base64
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // Convert base64 to binary
            const fileBytes = base64ToUint8Array(base64);

            console.log("File size:", fileBytes.length, "bytes");

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from("chat-images")
                .upload(`public/${fileName}`, fileBytes, {
                    contentType: "image/jpeg",
                    upsert: true,
                });

            if (error) {
                console.error("❌ Detailed upload error:", JSON.stringify(error, null, 2));
                return null;
            }

            console.log("✅ Uploaded:", data);

            // Get public URL
            const { data: publicUrlData } = supabase.storage
                .from("chat-images")
                .getPublicUrl(`public/${fileName}`);

            return publicUrlData.publicUrl;
        } catch (err) {
            console.error("❌ Error uploading image:", err);
            return null;
        }
    };

    // --- Pick image from gallery ---
    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });

            if (!result.canceled) {
                const imageUri = result.assets[0].uri;
                // Generate filename with user ID and timestamp
                const fileName = `${currentUser.id}_${Date.now()}.jpg`;
                await sendImageMessage(imageUri, fileName); // Pass fileName
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    // --- Take photo with camera ---
    const takePhoto = async () => {
        try {
            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (!result.canceled) {
                const imageUri = result.assets[0].uri;
                // Generate filename with user ID and timestamp
                const fileName = `${currentUser.id}_${Date.now()}.jpg`;
                await sendImageMessage(imageUri, fileName); // Pass fileName
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to take photo');
        }
    };

    // --- Send image message ---
    const sendImageMessage = async (imageUri, fileName) => {
        if (!currentUser || uploadingImage) return;

        setUploadingImage(true);

        try {
            console.log('Uploading image...');
            const imageUrl = await uploadImage(imageUri, fileName); // Pass fileName

            if (!imageUrl) {
                throw new Error('Failed to upload image');
            }

            console.log('Sending image message...');
            const { error: messageError } = await supabase
                .from('messages')
                .insert([{
                    conversation_id: conversationId,
                    sender_id: currentUser.id,
                    content: '',
                    image_url: imageUrl,
                    message_type: 'image'
                }]);

            if (messageError) throw messageError;

            await supabase
                .from('conversations')
                .update({
                    last_message: '📷 Image',
                    last_message_at: new Date().toISOString()
                })
                .eq('id', conversationId);

            console.log('✅ Image message sent');
        } catch (error) {
            console.error('❌ Error sending image:', error);
            Alert.alert('Error', 'Failed to send image. Please try again.');
        } finally {
            setUploadingImage(false);
        }
    };

    // --- Fetch messages ---
    const fetchMessages = useCallback(async () => {
        if (!conversationId) return

        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    id,
                    conversation_id,
                    sender_id,
                    content,
                    image_url,
                    message_type,
                    created_at,
                    read_at
                `)
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })

            if (error) {
                console.error('Error fetching messages:', error)
                return
            }

            setMessages(data || [])
        } catch (error) {
            console.error('Error in fetchMessages:', error)
        } finally {
            setLoading(false)
        }
    }, [conversationId])

    // --- Send text message ---
    const sendMessage = async () => {
        if (!newMessage.trim() || !currentUser || sending) return

        const messageContent = newMessage.trim()
        setNewMessage('')
        setSending(true)

        try {
            const { data: messageData, error: messageError } = await supabase
                .from('messages')
                .insert([{
                    conversation_id: conversationId,
                    sender_id: currentUser.id,
                    content: messageContent,
                    message_type: 'text'
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

        const channel = supabase
            .channel(`chat_${conversationId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
                (payload) => {
                    const newMessage = payload.new
                    setMessages(prev => prev.some(m => m.id === newMessage.id) ? prev : [...prev, newMessage])

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
                    const updatedMessage = payload.new
                    setMessages(prev =>
                        prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
                    )
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [conversationId, currentUser?.id, markMessagesAsRead])

    // --- Render message ---
    const renderMessage = (message, index) => {
        const isMyMessage = message.sender_id === currentUser.id
        const showTimestamp = index === 0 ||
            (new Date(message.created_at) - new Date(messages[index - 1].created_at)) > 300000

        return (
            <View key={message.id}>
                {showTimestamp && <Text style={styles.timestamp}>{formatMessageTime(message.created_at)}</Text>}
                <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
                    <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
                        {message.message_type === 'image' && message.image_url ? (
                            <TouchableOpacity
                                onPress={() => {
                                    setSelectedImage(message.image_url);
                                    setShowImageModal(true);
                                }}
                            >
                                <Image
                                    source={{ uri: message.image_url }}
                                    style={styles.messageImage}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>
                        ) : (
                            <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
                                {message.content}
                            </Text>
                        )}
                    </View>
                    {isMyMessage && (
                        <Text style={styles.readStatus}>
                            {message.read_at ? '✓✓' : '✓'}
                        </Text>
                    )}
                </View>
            </View>
        )
    }

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
                        messages.map((message, index) => renderMessage(message, index))
                    )}
                </ScrollView>

                {/* Input */}
                <View style={styles.inputContainer}>
                    <TouchableOpacity
                        style={styles.attachButton}
                        onPress={() => {
                            Alert.alert(
                                "Add Image",
                                "Choose an option",
                                [
                                    { text: "Camera", onPress: takePhoto },
                                    { text: "Gallery", onPress: pickImage },
                                    { text: "Cancel", style: "cancel" }
                                ]
                            );
                        }}
                        disabled={uploadingImage}
                    >
                        {uploadingImage ? (
                            <ActivityIndicator size="small" color="#FFAB00" />
                        ) : (
                            <Text style={styles.attachButtonText}>📷</Text>
                        )}
                    </TouchableOpacity>

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

                {/* Image Modal */}
                <Modal
                    visible={showImageModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowImageModal(false)}
                >
                    <View style={styles.modalContainer}>
                        <TouchableOpacity
                            style={styles.modalOverlay}
                            onPress={() => setShowImageModal(false)}
                        />
                        <View style={styles.modalContent}>
                            <Image
                                source={{ uri: selectedImage }}
                                style={styles.fullImage}
                                resizeMode="contain"
                            />
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowImageModal(false)}
                            >
                                <Text style={styles.closeButtonText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
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
    messageImage: {
        width: 200,
        height: 150,
        borderRadius: 10,
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
    attachButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    attachButtonText: {
        fontSize: 20,
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
    // Modal styles
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContent: {
        width: '90%',
        height: '70%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImage: {
        width: '100%',
        height: '100%',
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 20,
        color: '#000',
        fontWeight: 'bold',
    },
});

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