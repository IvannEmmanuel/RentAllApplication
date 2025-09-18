import { StyleSheet, Text, View, SafeAreaView, ImageBackground, Image, TextInput, TouchableOpacity } from 'react-native'
import React from 'react'
import { useNavigation } from '@react-navigation/native'

const Login = () => {
  const navigation = useNavigation();

  const handleRegister = () => {
    navigation.navigate('Register')
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ImageBackground
        source={require('../../../assets/loginBackground.png')}
        style={styles.loginBackground}
        resizeMode='cover'>
        <View>
          <Text style={styles.loginText}>Login</Text>
          <View style={{ alignSelf: 'center', top: 40 }}>
            <Image source={require('../././../../assets/logo.png')} style={styles.logo} />
            <Text style={styles.rentAllText}>RentAll</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 20, top: 150 }}>
          <Text style={styles.text}>Email</Text>
          <TextInput
            placeholder="juan@gmail.com"
            placeholderTextColor='#bebebeff'
            style={styles.textInput}
          />
          <Text style={styles.text}>Password</Text>
          <TextInput
            placeholder="Password"
            placeholderTextColor='#bebebeff'
            style={styles.textInput}
            secureTextEntry
          />
          <TouchableOpacity style={styles.loginButton}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
          <View style={{ top: 40 }}>
            <View style={styles.bottomContainer}>
              <TouchableOpacity>
                <Text style={styles.forgotPasswordText}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.accountContainer}>
              <Text style={styles.accountText}>Don't have an account?</Text>
              <TouchableOpacity onPress={handleRegister}>
                <Text style={styles.signUpText}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  )
}

export default Login

const styles = StyleSheet.create({
  loginBackground: {
    flex: 1,
    top: 30
  },
  loginText: {
    color: 'white',
    fontSize: 32,
    paddingLeft: 30,
    fontFamily: 'DM-Bold'
  },
  logo: {
    width: 120,
    height: 100,
    alignSelf: 'center'
  },
  rentAllText: {
    fontFamily: 'FugazOne-Regular',
    fontSize: 40,
    color: 'white',
  },
  text: {
    paddingLeft: 10,
    marginBottom: 3,
    fontFamily: 'DM-Bold'
  },
  textInput: {
    height: 50,
    borderRadius: 12,
    borderColor: 'gray',
    borderWidth: 1,
    paddingHorizontal: 10,
    color: 'black',
    paddingLeft: 20,
    marginBottom: 20,
  },
  loginButton: {
    width: '100%',
    height: 50,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    top: 20,
  },
  loginButtonText: {
    color: 'white',
    alignSelf: 'center',
    fontSize: 15,
    fontFamily: 'DM-Bold'
  },
  bottomContainer: {
    flexDirection: 'row'
  },
  forgotPasswordText: {
    fontSize: 12,
    marginBottom: 10
  },
  accountContainer: {
    flexDirection: 'row'
  },
  accountText: {
    fontSize: 12,
  },
  signUpText: {
    paddingLeft: 5,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFAB00'
  }
})