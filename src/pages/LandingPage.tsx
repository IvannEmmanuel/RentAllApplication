import React from 'react';
import { View, Image, Text, ImageBackground, TouchableOpacity, SafeAreaView } from 'react-native';
import LandingStyles from '../styles/LandingStyles';
import { useNavigation } from '@react-navigation/native';

const LandingPage = () => {

  const navigation = useNavigation();

  const handleLogin = () => {
    navigation.navigate('Login')
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ImageBackground
        source={require('../../assets/loginBackground.png')}
        style={LandingStyles.background}
        resizeMode="cover"
      >
        <View style={LandingStyles.innerContainer}>
          {/* Logo in final position */}
          <View style={LandingStyles.logoContainer}>
            <Image
              source={require('../../assets/logo.png')}
              style={LandingStyles.logo}
              resizeMode="contain"
            />
            <Text style={LandingStyles.title}>RentAll</Text>
          </View>

          {/* Final content */}
          <View style={LandingStyles.finalContent}>
            <Text style={LandingStyles.welcome}>
              Welcome to RentAll!
            </Text>
            <Text style={LandingStyles.description}>
              Your all-in-one rental hub in Cagayan de Oro City.
              From clothes and tools to electronics, furniture, and temporary stays—RentAll connects you with trusted providers for
              anything you need. Enjoy smart recommendations, secure transactions, and easy communication—all in one seamless,
              mobile-friendly app.
            </Text>
          </View>

          {/* Continue Button */}
          <TouchableOpacity style={LandingStyles.continueButton} onPress={handleLogin}>
            <Text style={LandingStyles.continueText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
};

export default LandingPage;