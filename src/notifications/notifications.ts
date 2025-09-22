// import { useEffect } from 'react';
// import * as Notifications from 'expo-notifications';
// import { Platform, PermissionsAndroid } from 'react-native';
// import messaging from '@react-native-firebase/messaging';

// // Expo notification handler (needed for foreground)
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: true,
//   }),
// });

// export async function requestUserPermission() {
//   if (Platform.OS === 'android') {
//     const granted = await PermissionsAndroid.request(
//       PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
//     );
//     if (granted === PermissionsAndroid.RESULTS.GRANTED) {
//       console.log('Notification permission granted');
//     } else {
//       console.log('Notification permission denied');
//     }
//   } else {
//     const { status } = await Notifications.requestPermissionsAsync();
//     if (status === 'granted') {
//       console.log('iOS notification permission granted');
//     } else {
//       console.log('iOS notification permission denied');
//     }
//   }
// }

// export async function getFcmToken() {
//   try {
//     const token = await messaging().getToken();
//     console.log('FCM Token:', token);
//     return token;
//   } catch (error) {
//     console.error('Error getting FCM token:', error);
//   }
// }

// async function registerNotificationChannel() {
//   if (Platform.OS === 'android') {
//     await Notifications.setNotificationChannelAsync('urgent-channel-v2', {
//       name: 'Urgent Channel V2',
//       importance: Notifications.AndroidImportance.HIGH, // heads-up
//       vibrationPattern: [0, 250, 250, 250],
//       sound: 'default',
//       lightColor: '#FF231F7C',
//       lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
//     });
//     console.log('High-priority channel registered: urgent-channel-v2');
//   }
// }

// export const useNotification = () => {
//   useEffect(() => {
//     requestUserPermission();
//     getFcmToken();
//     registerNotificationChannel();

//     // Foreground FCM listener → trigger local heads-up
//     const unsubscribe = messaging().onMessage(async remoteMessage => {
//       console.log('Foreground FCM:', remoteMessage);

//       await Notifications.scheduleNotificationAsync({
//         content: {
//           title: remoteMessage.notification?.title || 'New message',
//           body: remoteMessage.notification?.body || 'You got something!',
//           sound: 'default',
//           android: {
//             channelId: 'urgent-channel-v2',
//             priority: Notifications.AndroidNotificationPriority.HIGH,
//           },
//         },
//         trigger: null, // show immediately
//       });
//     });

//     return () => {
//       unsubscribe();
//     };
//   }, []);
// };


import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { supabase } from '../../supbaseClient';
import { baseURL } from '../api/api';

// Expo notification handler (needed for foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestUserPermission() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('Notification permission granted');
    } else {
      console.log('Notification permission denied');
    }
  } else {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      console.log('iOS notification permission granted');
    } else {
      console.log('iOS notification permission denied');
    }
  }
}

export async function getFcmToken() {
  try {
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

async function registerNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('urgent-channel-v2', {
      name: 'Urgent Channel V2',
      importance: Notifications.AndroidImportance.HIGH, // heads-up
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lightColor: '#FF231F7C',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    console.log('High-priority channel registered: urgent-channel-v2');
  }
}

// ===== NEW NOTIFICATION SERVICE FUNCTIONS =====

// Store FCM token in Supabase
export async function storeFCMToken(userId: string, fcmToken: string) {
  try {
    const { error } = await supabase
      .from('user_fcm_tokens')
      .upsert({
        user_id: userId,
        fcm_token: fcmToken,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    console.log('FCM token stored successfully');
    return true;
  } catch (error) {
    console.error('Error storing FCM token:', error);
    return false;
  }
}

// Get user's FCM token from database
export async function getUserFCMToken(userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data?.fcm_token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

// Send notification via your backend
export async function sendNotificationToUser(
  toUserId: string,
  title: string,
  message: string,
  data: any = {}
) {
  try {
    // Get the user's FCM token
    const fcmToken = await getUserFCMToken(toUserId);
    if (!fcmToken) {
      console.log('No FCM token found for user:', toUserId);
      return false;
    }

    // Call your backend endpoint (replace with your actual URL)
    const response = await fetch(`${baseURL}/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: fcmToken,
        title: title,
        body: message,
        data: data
      })
    });

    const result = await response.json();

    // Store notification in database
    await storeNotification(toUserId, title, message, data);

    return result.success;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

// Store notification record in Supabase
export async function storeNotification(userId: string, title: string, message: string, data: any = {}) {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        title: title,
        message: message,
        type: data.type || 'general',
        rental_id: data.rental_id,
        item_id: data.item_id
      }]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error storing notification:', error);
    return false;
  }
}

// Handle booking status changes and send appropriate notifications
export async function handleBookingStatusChange(
  rental: any,
  oldStatus: string | null,
  newStatus: string
) {
  try {
    // Get item details
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('title, user_id')
      .eq('item_id', rental.item_id)
      .single();

    if (itemError) throw itemError;

    // Get user details
    const { data: renter, error: renterError } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', rental.renter_id)
      .single();

    const { data: lessor, error: lessorError } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', item.user_id)
      .single();

    if (renterError || lessorError) throw new Error('Error fetching user details');

    const renterName = `${renter.first_name} ${renter.last_name}`;
    const lessorName = `${lessor.first_name} ${lessor.last_name}`;

    // Send notifications based on status change
    switch (newStatus) {
      case 'pending':
        // Notify lessor about new booking request
        await sendNotificationToUser(
          item.user_id,
          'New Booking Request',
          `${renterName} wants to rent your "${item.title}"`,
          {
            type: 'booking_request',
            rental_id: rental.rental_id,
            item_id: rental.item_id
          }
        );
        break;

      case 'confirmed':
        // Notify renter that booking is confirmed
        await sendNotificationToUser(
          rental.renter_id,
          'Booking Confirmed!',
          `${lessorName} has confirmed your booking for "${item.title}"`,
          {
            type: 'booking_confirmed',
            rental_id: rental.rental_id,
            item_id: rental.item_id
          }
        );
        break;

      case 'ongoing':
        // Notify both parties
        await sendNotificationToUser(
          rental.renter_id,
          'Rental Started',
          `Your rental of "${item.title}" has started. Enjoy!`,
          {
            type: 'booking_started',
            rental_id: rental.rental_id,
            item_id: rental.item_id
          }
        );

        await sendNotificationToUser(
          item.user_id,
          'Rental Started',
          `${renterName}'s rental of your "${item.title}" has started`,
          {
            type: 'booking_started',
            rental_id: rental.rental_id,
            item_id: rental.item_id
          }
        );
        break;

      case 'completed':
        // Notify both parties
        await sendNotificationToUser(
          rental.renter_id,
          'Rental Completed',
          `Your rental of "${item.title}" is complete. Please rate your experience!`,
          {
            type: 'booking_completed',
            rental_id: rental.rental_id,
            item_id: rental.item_id
          }
        );

        await sendNotificationToUser(
          item.user_id,
          'Rental Completed',
          `${renterName}'s rental of your "${item.title}" is complete`,
          {
            type: 'booking_completed',
            rental_id: rental.rental_id,
            item_id: rental.item_id
          }
        );
        break;

      case 'cancelled':
        // Determine who to notify (the other party)
        const isLessorCancelling = oldStatus === 'pending';
        const notifyUserId = isLessorCancelling ? rental.renter_id : item.user_id;
        const cancellerName = isLessorCancelling ? lessorName : renterName;

        await sendNotificationToUser(
          notifyUserId,
          'Booking Cancelled',
          `${cancellerName} has cancelled the booking for "${item.title}"`,
          {
            type: 'booking_cancelled',
            rental_id: rental.rental_id,
            item_id: rental.item_id
          }
        );
        break;
    }

    return true;
  } catch (error) {
    console.error('Error handling booking status change:', error);
    return false;
  }
}

// Get user notifications
export async function getUserNotifications(userId: string, limit: number = 20) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
}

// Mark notification as read
export async function markNotificationAsRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('notification_id', notificationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

// Initialize notification service for a user (call this when user logs in)
export async function initializeNotificationService(userId: string) {
  try {
    // Get and store FCM token
    const token = await getFcmToken();
    if (token) {
      await storeFCMToken(userId, token);
      console.log('Notification service initialized for user:', userId);
    }
    return true;
  } catch (error) {
    console.error('Error initializing notification service:', error);
    return false;
  }
}

// ===== EXISTING HOOK (ENHANCED) =====

export const useNotification = (currentUser?: any) => {
  useEffect(() => {
    requestUserPermission();
    registerNotificationChannel();

    // Initialize notification service if user is logged in
    if (currentUser?.id) {
      initializeNotificationService(currentUser.id);
    } else {
      // Just get token for anonymous users
      getFcmToken();
    }

    // Foreground FCM listener → trigger local heads-up
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('Foreground FCM:', remoteMessage);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || 'New message',
          body: remoteMessage.notification?.body || 'You got something!',
          sound: 'default',
          android: {
            channelId: 'urgent-channel-v2',
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
        },
        trigger: null, // show immediately
      });
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);
};