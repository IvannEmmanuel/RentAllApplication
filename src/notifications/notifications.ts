// import messaging from '@react-native-firebase/messaging';
// import { Alert } from 'react-native';

// export async function requestUserPermission() {
//   const authStatus = await messaging().requestPermission();
//   const enabled =
//     authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
//     authStatus === messaging.AuthorizationStatus.PROVISIONAL;

//   if (enabled) {
//     console.log('Authorization status:', authStatus);
//     await getFcmToken();
//   } else {
//     Alert.alert('Push notifications permission not granted');
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

// export function listenForForegroundMessages() {
//   return messaging().onMessage(async remoteMessage => {
//     console.log('Foreground message:', remoteMessage);
//     Alert.alert('rawr');
//   });
// }


import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';

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
  }
}

async function registerNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default-channel-id', {
      name: 'Default Channel', // Name visible in Android settings
      importance: Notifications.AndroidImportance.HIGH, // Ensures a pop-up (heads-up) notification
      vibrationPattern: [0, 250, 250, 250], // Vibration pattern (optional)
      sound: 'default', // Default sound
      lightColor: '#FF231F7C', // Optional light color for LED
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, // Visible on lock screen
    });
    console.log('Notification channel registered');
  }
}

export const useNotification = () => {
  useEffect(() => {
    requestUserPermission();
    getFcmToken();
    registerNotificationChannel(); // Register the channel here

    // Handle foreground notifications
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Foreground notification:', notification);
      Notifications.presentNotificationAsync({
        title: notification.request.content.title || 'Notification',
        body: notification.request.content.body || 'You have a new message',
        sound: 'default',
        android: {
          channelId: 'default-channel-id', // Must match the registered channel
        },
      });
    });

    // Handle notification response
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);
};