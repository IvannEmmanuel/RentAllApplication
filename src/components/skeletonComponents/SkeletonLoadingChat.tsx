import React from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SkeletonLoadingChat = () => {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {/* Header Skeleton */}
                <View style={styles.header}>
                    <View style={[styles.skeleton, styles.backSkeleton]} />
                    
                    {/* Profile Image Skeleton */}
                    <View style={[styles.skeleton, styles.headerProfileSkeleton]} />
                    
                    <View style={styles.headerInfo}>
                        <View style={[styles.skeleton, styles.headerTitleSkeleton]} />
                        <View style={[styles.skeleton, styles.headerSubtitleSkeleton]} />
                    </View>
                    <View style={styles.headerSpacer} />
                </View>

                {/* Messages Skeleton */}
                <ScrollView
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Timestamp Skeleton */}
                    <View style={styles.timestampSkeletonContainer}>
                        <View style={[styles.skeleton, styles.timestampSkeleton]} />
                    </View>

                    {/* Other User Messages Skeleton */}
                    <View style={[styles.messageContainer, styles.otherMessageContainer]}>
                        <View style={[styles.skeleton, styles.otherMessageBubble, styles.otherMessageSkeleton]} />
                    </View>

                    <View style={[styles.messageContainer, styles.otherMessageContainer]}>
                        <View style={[styles.skeleton, styles.otherMessageBubble, styles.otherMessageSkeletonShort]} />
                    </View>

                    {/* Timestamp Skeleton */}
                    <View style={styles.timestampSkeletonContainer}>
                        <View style={[styles.skeleton, styles.timestampSkeleton]} />
                    </View>

                    {/* My Messages Skeleton */}
                    <View style={[styles.messageContainer, styles.myMessageContainer]}>
                        <View style={[styles.skeleton, styles.myMessageBubble, styles.myMessageSkeleton]} />
                    </View>

                    <View style={[styles.messageContainer, styles.myMessageContainer]}>
                        <View style={[styles.skeleton, styles.myMessageBubble, styles.myMessageSkeletonShort]} />
                    </View>

                    <View style={[styles.messageContainer, styles.myMessageContainer]}>
                        <View style={[styles.skeleton, styles.myMessageBubble, styles.myMessageImageSkeleton]} />
                    </View>

                    {/* Other User Messages Skeleton */}
                    <View style={[styles.messageContainer, styles.otherMessageContainer]}>
                        <View style={[styles.skeleton, styles.otherMessageBubble, styles.otherMessageSkeleton]} />
                    </View>

                    {/* My Messages Skeleton */}
                    <View style={[styles.messageContainer, styles.myMessageContainer]}>
                        <View style={[styles.skeleton, styles.myMessageBubble, styles.myMessageSkeleton]} />
                    </View>
                </ScrollView>

                {/* Input Skeleton */}
                <View style={styles.inputContainer}>
                    <View style={[styles.skeleton, styles.attachButtonSkeleton]} />
                    <View style={[styles.skeleton, styles.textInputSkeleton]} />
                    <View style={[styles.skeleton, styles.sendButtonSkeleton]} />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

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
    skeleton: {
        backgroundColor: '#E5E5E5',
        borderRadius: 4,
    },
    backSkeleton: {
        width: 30,
        height: 30,
        borderRadius: 15,
    },
    headerProfileSkeleton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginLeft: 15,
        marginRight: 10,
    },
    headerInfo: {
        flex: 1,
        marginLeft: 10,
    },
    headerTitleSkeleton: {
        width: '60%',
        height: 20,
        marginBottom: 6,
    },
    headerSubtitleSkeleton: {
        width: '40%',
        height: 16,
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
    timestampSkeletonContainer: {
        alignItems: 'center',
        marginVertical: 15,
    },
    timestampSkeleton: {
        width: 80,
        height: 14,
    },
    messageContainer: {
        marginVertical: 4,
    },
    myMessageContainer: {
        alignItems: 'flex-end',
    },
    otherMessageContainer: {
        alignItems: 'flex-start',
    },
    myMessageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 18,
        borderBottomRightRadius: 5,
    },
    otherMessageBubble: {
        maxWidth: '80%',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 18,
        borderBottomLeftRadius: 5,
    },
    myMessageSkeleton: {
        width: 200,
        height: 40,
    },
    myMessageSkeletonShort: {
        width: 120,
        height: 40,
    },
    myMessageImageSkeleton: {
        width: 200,
        height: 150,
        borderRadius: 10,
    },
    otherMessageSkeleton: {
        width: 180,
        height: 40,
    },
    otherMessageSkeletonShort: {
        width: 150,
        height: 40,
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
    attachButtonSkeleton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
    },
    textInputSkeleton: {
        flex: 1,
        height: 45,
        borderRadius: 20,
        marginRight: 10,
    },
    sendButtonSkeleton: {
        width: 70,
        height: 40,
        borderRadius: 20,
    },
});

export default SkeletonLoadingChat;