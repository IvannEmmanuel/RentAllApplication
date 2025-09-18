// import { AppRegistry } from 'react-native';
// import App from './App';
// import { name as appName } from './app.json';
// import messaging from '@react-native-firebase/messaging';

// // ✅ Must be outside of any component and at the top level
// messaging().setBackgroundMessageHandler(async remoteMessage => {
//   console.log('Background message:', JSON.stringify(remoteMessage, null, 2));
// });

// AppRegistry.registerComponent(appName, () => App);

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background message:', remoteMessage);

  await Notifications.presentNotificationAsync({
    title: remoteMessage.notification?.title || 'Notification',
    body: remoteMessage.notification?.body || 'You have a new message',
    sound: 'default',
    android: {
      channelId: 'default-channel-id', // Must match the registered channel
    },
  });
});

AppRegistry.registerComponent(appName, () => App);