import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  RefreshControl
} from 'react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../supbaseClient';
import { useFavorites } from '../../components/FavoritesContext';
import { useNavigation } from '@react-navigation/native';
import { useNotificationModal } from '../../components/NotificationModalContext'; // Import the context
import AppModals from '../../components/AppModals'; // Import AppModals

const Notification = () => {
  const navigation = useNavigation();
  const { currentUser } = useFavorites();
  const { showModal } = useNotificationModal(); // Get the showModal function from context
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const LIMIT = 10
  const [page, setPage] = useState(0);

  // Format time ago function
  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString();
  };

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'booking_request':
      case 'booking_confirmed':
      case 'booking_cancelled':
      case 'booking_completed':
      case 'booking_started':
      case 'booking_return':
        return require("../../../assets/splash-icon.png");
      case 'message':
        return require("../../../assets/message.png");
      default:
        return require("../../../assets/splash-icon.png");
    }
  };

  // Get notification color based on type
  // Get notification color based on type
  const getNotificationColor = (type) => {
    switch (type) {
      case 'booking_confirmed':
      case 'booking_completed':
        return '#4CAF50'; // Green
      case 'booking_cancelled':
        return '#F44336'; // Red
      case 'booking_request':
      case 'booking_return':
        return '#FFAB00'; // Your theme color
      case 'booking_started':
      case 'booking_ongoing':
      case 'booking_delivered':
        return '#2196F3'; // Blue
      case 'message':
        return '#9C27B0'; // Purple
      default:
        return '#9C9894'; // Gray
    }
  };

  // Handle notification press
  // Handle notification press
  const handleNotificationPress = async (notification) => {
    // Mark as read first
    if (!notification.read_at) {
      await markAsRead(notification.notification_id);
    }

    // Handle different notification types with AppModal
    switch (notification.type) {
      case 'booking_request':
      case 'booking_confirmed':
      case 'booking_cancelled':
      case 'booking_completed':
      case 'booking_started':
      case 'booking_ongoing':
      case 'booking_return':
      case 'booking_delivered':
        // Use rental_id directly from notification object (not from metadata)
        const rentalId = notification.rental_id;

        if (rentalId) {
          console.log('📱 Opening modal for notification:', notification.type, 'rentalId:', rentalId);

          // FIX: Pass parameters correctly - check your useNotificationModal context
          // Try this format first:
          showModal(notification.type, rentalId);

          // If that doesn't work, try:
          // showModal({
          //   type: notification.type,
          //   rentalId: rentalId,
          //   visible: true
          // });
        } else {
          console.log('❌ No rental_id found for notification:', notification);
        }
        break;

      case 'message':
        // Navigate to chat if you have chat data
        if (notification.conversation_id) {
          navigation.navigate('Chat', {
            conversationId: notification.conversation_id,
            otherUserId: notification.other_user_id,
            otherUserName: notification.other_user_name,
            itemTitle: notification.item_title,
            itemId: notification.item_id
          });
        }
        break;

      default:
        console.log('Unknown notification type:', notification.type);
    }
  };

  // Helper function to extract rental ID from message (if not in metadata)
  const extractRentalIdFromMessage = (message) => {
    // Implement logic to extract rental ID from message if needed
    // This depends on how your notifications are structured
    return null;
  };

  // Fetch notifications from Supabase
  const fetchNotifications = useCallback(async (showLoading = true, page = 0) => {
    if (!currentUser?.id) return;

    if (showLoading) setLoading(true);
    try {
      const from = page * LIMIT;
      const to = from + LIMIT - 1;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (page === 0) {
        setNotifications(data || []);
      } else {
        setNotifications(prev => [...prev, ...(data || [])]);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [currentUser?.id]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(false);
    setRefreshing(false);
  }, [fetchNotifications]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('notification_id', notificationId);

      // Update local state
      setNotifications(prev =>
        prev.map(notification =>
          notification.notification_id === notificationId
            ? { ...notification, read_at: new Date().toISOString() }
            : notification
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Real-time listener
    if (!currentUser?.id) return;

    const channel = supabase
      .channel(`notifications_user_${currentUser?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser?.id}`
        },
        (payload) => {
          console.log('Notification change:', payload);
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev =>
              prev.map(item =>
                item.notification_id === payload.new.notification_id
                  ? payload.new
                  : item
              )
            );
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser?.id, fetchNotifications]);

  if (loading) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFAB00" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.read_at && styles.unreadNotificationItem
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationContent}>
        <View style={[
          styles.iconContainer,
          { backgroundColor: `${getNotificationColor(item.type)}20` }
        ]}>
          <View style={[
            styles.iconDot,
            { backgroundColor: getNotificationColor(item.type) }
          ]} />
        </View>

        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={[
              styles.notificationTitle,
              !item.read_at && styles.unreadTitle
            ]}>
              {item.title}
            </Text>
            <Text style={styles.timeText}>
              {formatTimeAgo(item.created_at)}
            </Text>
          </View>

          <Text style={styles.notificationMessage} numberOfLines={2}>
            {item.message}
          </Text>

          {!item.read_at && <View style={styles.unreadIndicator} />}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Image
            source={require("../../../assets/splash-icon.png")}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyMessage}>
            You'll receive notifications about your rentals and messages here
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.notification_id?.toString() || Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                setPage(0);
                await fetchNotifications(false, 0);
                setRefreshing(false);
              }}
              colors={['#FFAB00']}
              tintColor="#FFAB00"
            />
          }
          onEndReached={async () => {
            const nextPage = page + 1;
            setPage(nextPage);
            await fetchNotifications(false, nextPage);
          }}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
};

export default Notification;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF5EF",
    marginTop: 40,
  },
  headerContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#FAF5EF",
  },
  headerTitle: {
    flex: 1,
    fontSize: 32,
    fontFamily: "DM-Bold",
    color: "#000",
  },
  listContainer: {
    padding: 10,
    paddingBottom: 50,
  },
  notificationItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  unreadNotificationItem: {
    borderLeftWidth: 4,
    borderLeftColor: "#FFAB00",
  },
  notificationContent: {
    flexDirection: "row",
    padding: 15,
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  textContainer: {
    flex: 1,
    position: "relative",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontFamily: "DM-Medium",
    color: "#000",
    flex: 1,
    marginRight: 10,
  },
  unreadTitle: {
    fontFamily: "DM-Bold",
  },
  timeText: {
    fontSize: 12,
    color: "#9C9894",
    fontFamily: "DM-Regular",
  },
  notificationMessage: {
    fontSize: 13,
    color: "#9C9894",
    fontFamily: "DM-Regular",
    lineHeight: 18,
    marginTop: 2,
  },
  unreadIndicator: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFAB00",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#9C9894",
    fontSize: 16,
    fontFamily: "DM-Regular",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    marginBottom: 20,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "DM-Bold",
    color: "#000",
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: "#9C9894",
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "DM-Regular",
  },
});