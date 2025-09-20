import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import { useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { supabase } from "../../../supbaseClient"

const Login = () => {
  const navigation = useNavigation()

  // State management
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loginMethod, setLoginMethod] = useState("password") // 'password' | 'email_otp' | 'sms_otp'
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [emailOtpCode, setEmailOtpCode] = useState("")
  const [smsPhone, setSmsPhone] = useState("")
  const [loading, setLoading] = useState(false)

  const handleRegister = () => {
    navigation.navigate("Register")
  }

  const showToast = (message, type = "error") => {
    Alert.alert(type === "error" ? "Error" : "Success", message)
  }

  const handlePasswordLogin = async () => {
    if (!email || !password) {
      showToast("Please enter both email and password")
      return
    }

    try {
      setLoading(true)

      // Authenticate against Supabase Auth
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      const authUser = signInData.user
      if (!authUser) {
        throw new Error("No authenticated user returned")
      }

      // Fetch profile from public.users using auth user id (FK)
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle()

      if (profileError) throw profileError

      // Check role before proceeding
      if (!profile?.role) {
        throw new Error("No role assigned to this account")
      }

      if (profile.role === "unverified") {
        showToast("Your account is pending admin verification.", "info")
        return
      }

      // Store combined auth + profile
      const session = signInData.session
      const userInfo = {
        id: authUser.id,
        email: authUser.email,
        ...profile,
        session,
      }
      console.log(userInfo)

      const greetingName = profile?.first_name || authUser.email || "there"
      showToast(`Welcome back, ${greetingName}!`, "success")

      // Navigate based on role
      if (profile.role === "user") {
        navigation.navigate("Home")
      } else {
        showToast("Unknown role — cannot log in.")
      }
    } catch (err) {
      console.error("Login error:", err.message)
      showToast("Login failed: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const sendEmailOtp = async () => {
    if (!email) {
      showToast("Please enter your email")
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })

      if (error) throw error

      setEmailOtpSent(true)
      showToast(`OTP sent to ${email}`, "success")
    } catch (err) {
      console.error("OTP send error:", err.message)
      showToast("Failed to send OTP: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const verifyEmailOtp = async () => {
    if (!email || !emailOtpCode) {
      showToast("Enter your email and OTP code")
      return
    }

    try {
      setLoading(true)

      // If OTP hasn't been sent yet, send it first
      if (!emailOtpSent) {
        const { error: sendError } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        })

        if (sendError) throw sendError
        setEmailOtpSent(true)
        showToast(`OTP sent to ${email}`, "success")
        return
      }

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: emailOtpCode,
        type: "email",
      })

      if (error) throw error

      const authUser = data?.user
      let userId
      let userEmail

      if (authUser) {
        userId = authUser.id
        userEmail = authUser.email
      } else {
        const { data: userData, error: userErr } = await supabase.auth.getUser()
        if (userErr || !userData?.user) {
          throw new Error(userErr?.message || "No user in session")
        }
        userId = userData.user.id
        userEmail = userData.user.email
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle()

      if (profileError) throw profileError

      if (!profile?.role) {
        throw new Error("No role assigned to this account")
      }

      if (profile.role === "unverified") {
        showToast("Your account is pending admin verification.", "info")
        return
      }

      const userInfo = {
        id: userId,
        email: userEmail,
        ...profile,
      }
      console.log(userInfo)

      showToast("Signed in successfully with email OTP", "success")

      if (profile.role === "user") {
        navigation.navigate("Home")
      } else {
        showToast("Unknown role — cannot log in.")
      }
    } catch (err) {
      console.error("OTP verify error:", err.message)
      showToast("Failed to verify OTP: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const resetEmailOtp = () => {
    setEmail("")
    setEmailOtpCode("")
    setEmailOtpSent(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : -100}
    >
      {/* Top Section */}
      <View style={styles.topSection}>
        <Text style={styles.loginText}>Login</Text>
        <View style={{ alignItems: "center" }}>
          <Image source={require("../../../assets/logo.png")} style={styles.logo} />
          <Text style={styles.rentAllText}>RentAll</Text>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          {/* Login Method Selector */}
          <View style={styles.methodSelector}>
            <TouchableOpacity
              style={[styles.methodButton, loginMethod === "password" && styles.methodButtonActive]}
              onPress={() => setLoginMethod("password")}
            >
              <Text style={[styles.methodButtonText, loginMethod === "password" && styles.methodButtonTextActive]}>
                Password
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodButton, loginMethod === "email_otp" && styles.methodButtonActive]}
              onPress={() => setLoginMethod("email_otp")}
            >
              <Text style={[styles.methodButtonText, loginMethod === "email_otp" && styles.methodButtonTextActive]}>
                Email OTP
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email Input (for password and email OTP) */}
          {(loginMethod === "password" || loginMethod === "email_otp") && (
            <View>
              <Text style={styles.text}>Email</Text>
              <TextInput
                placeholder="juan@gmail.com"
                placeholderTextColor="#bebebeff"
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Password Login */}
          {loginMethod === "password" && (
            <View>
              <Text style={styles.text}>Password</Text>
              <TextInput
                placeholder="Password"
                placeholderTextColor="#bebebeff"
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.buttonDisabled]}
                onPress={handlePasswordLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.loginButtonText}>Sign In</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Email OTP Login */}
          {loginMethod === "email_otp" && (
            <View>
              {!emailOtpSent ? (
                // Send OTP Step
                <TouchableOpacity
                  style={[styles.loginButton, loading && styles.buttonDisabled]}
                  onPress={sendEmailOtp}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="white" /> : <Text style={styles.loginButtonText}>Send OTP</Text>}
                </TouchableOpacity>
              ) : (
                // Verify OTP Step
                <View>
                  <Text style={styles.text}>Enter OTP Code</Text>
                  <TextInput
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor="#bebebeff"
                    style={[styles.textInput, styles.otpInput]}
                    value={emailOtpCode}
                    onChangeText={setEmailOtpCode}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.loginButton, loading && styles.buttonDisabled]}
                    onPress={verifyEmailOtp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.loginButtonText}>Verify OTP</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.changeEmailButton} onPress={resetEmailOtp}>
                    <Text style={styles.changeEmailText}>Change Email</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <View style={styles.bottomActionsContainer}>
            <View style={styles.bottomContainer}>
              <TouchableOpacity>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.accountContainer}>
              <Text style={styles.accountText}>Don't have an account?</Text>
              <TouchableOpacity onPress={handleRegister}>
                <Text style={styles.signUpText}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

export default Login

const styles = StyleSheet.create({
  container: {
    flex: 1, // make parent take full screen
    backgroundColor: "#1E1E1E",
  },
  topSection: {
    flex: 0.5,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
  },
  bottomSection: {
    flex: 1,
    backgroundColor: "#FAF5EF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  formContainer: {
    // Remove flex: 1 to prevent stretching
  },
  loginText: {
    color: "white",
    fontSize: 32,
    paddingLeft: 30,
    fontFamily: "DM-Bold",
  },
  logo: {
    width: 120,
    height: 100,
    alignSelf: "center",
  },
  rentAllText: {
    fontFamily: "FugazOne-Regular",
    fontSize: 40,
    color: "white",
  },
  methodText: {
    textAlign: "center",
    marginBottom: 10,
    fontSize: 14,
    color: "#666",
    fontFamily: "DM-Medium",
  },
  methodSelector: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 25,
    padding: 4,
    marginBottom: 30,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: "center",
  },
  methodButtonActive: {
    backgroundColor: "#1E1E1E",
  },
  methodButtonText: {
    fontSize: 14,
    fontFamily: "DM-Medium",
    color: "#666",
  },
  methodButtonTextActive: {
    color: "white",
    fontFamily: "DM-Bold",
  },
  text: {
    paddingLeft: 10,
    marginBottom: 8,
    fontFamily: "DM-Bold",
    fontSize: 16,
  },
  textInput: {
    height: 50,
    borderRadius: 12,
    borderColor: "gray",
    borderWidth: 1,
    paddingHorizontal: 20,
    color: "black",
    marginBottom: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  otpInput: {
    fontSize: 12,
    fontFamily: "DM-Medium",
    letterSpacing: 4,
  },
  loginButton: {
    width: "100%",
    height: 50,
    borderRadius: 20,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  loginButtonText: {
    color: "white",
    fontSize: 15,
    fontFamily: "DM-Bold",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  otpButtonContainer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  otpButton: {
    flex: 1,
    height: 50,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyButton: {
    backgroundColor: "#1E1E1E",
  },
  resendButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  resendButtonText: {
    color: "#1E1E1E",
    fontSize: 15,
    fontFamily: "DM-Bold",
  },
  changeEmailButton: {
    alignSelf: "center",
    marginTop: 30,
  },
  changeEmailText: {
    color: "#1E7FFF",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  disabledButton: {
    width: "100%",
    height: 50,
    borderRadius: 20,
    backgroundColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  disabledButtonText: {
    color: "#666",
    fontSize: 15,
    fontFamily: "DM-Medium",
  },
  bottomActionsContainer: {
    marginTop: 20,
  },
  bottomContainer: {
    flexDirection: "row",
  },
  forgotPasswordText: {
    fontSize: 15,
    marginBottom: 10,
  },
  accountContainer: {
    flexDirection: "row",
  },
  accountText: {
    fontSize: 15,
  },
  signUpText: {
    paddingLeft: 5,
    fontSize: 15,
    fontWeight: "700",
    color: "#FFAB00",
  },
})
