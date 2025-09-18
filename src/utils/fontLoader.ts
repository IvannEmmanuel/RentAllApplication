import * as Font from 'expo-font';

export const loadFonts = async () => {
  await Font.loadAsync({
    'FugazOne-Regular': require('../../assets/fonts/FugazOne-Regular.ttf'),
    'DM-Regular': require('../../assets/fonts/DM-Regular.ttf'),
    'DM-Bold': require('../../assets/fonts/DM-Bold.ttf'),
    'DM-Medium': require('../../assets/fonts/DM-Medium.ttf'),
    'DM-SemiBold': require('../../assets/fonts/DM-SemiBold.ttf'),
  });
};
