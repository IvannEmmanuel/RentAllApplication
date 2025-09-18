import { StyleSheet, Dimensions, PixelRatio } from 'react-native';

const { width, height } = Dimensions.get('window');

// Responsive font scaling
const scaleFont = size => size * PixelRatio.getFontScale();

export default StyleSheet.create({
  background: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: width * 0.05, // 5% horizontal padding
  },
  logoContainer: {
    bottom: height * 0.1, // 3% vertical spacing
    alignItems: 'center',
  },
  logo: {
    width: width * 0.8, // 50% of screen width
    height: height * 0.13, // 10% of screen height
  },
  title: {
    color: 'white',
    fontSize: scaleFont(50), // responsive font
    fontFamily: 'FugazOne-Regular',
  },
  finalContent: {
    marginTop: height * 0.05,
  },
  welcome: {
    fontSize: scaleFont(35),
    fontWeight: 'bold',
    textAlign: 'center',
    bottom: height * 0.05
  },
  description: {
    fontSize: scaleFont(17),
    textAlign: 'center',
    bottom: height * 0.04
  },
  continueButton: {
    width: '100%',
    height: height * 0.07,
    borderRadius: 50,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    top: height * 0.05,
  },
  continueText: {
    alignSelf: 'center',
    color: 'white',
    fontSize: scaleFont(16),
  },
});
