// import React from 'react';
// import { View, Text, StyleSheet } from 'react-native';
// import { useNotification } from './src/notifications/notifications';
// import AppNavigator from './src/components/AppNavigator';

// export default function App() {
//   useNotification(); // Initializes notification setup (permissions, channel, listeners)

//   return (
//     <AppNavigator/>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   text: {
//     fontSize: 20,
//     fontWeight: 'bold',
//   },
// });

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useNotification } from './src/notifications/notifications';
import AppNavigator from './src/components/AppNavigator';
import { loadFonts } from './src/utils/fontLoader';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useNotification(); // ✅ Notification setup

  useEffect(() => {
    const prepare = async () => {
      await loadFonts(); // ✅ Load custom fonts
      setFontsLoaded(true);
      await SplashScreen.hideAsync();
    };
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container} onLayout={onLayoutRootView}>
      <AppNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
