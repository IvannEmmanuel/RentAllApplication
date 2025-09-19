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

export const useNotification = () => {
  useEffect(() => {
    requestUserPermission();
    getFcmToken();
    registerNotificationChannel();

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
  }, []);
};
