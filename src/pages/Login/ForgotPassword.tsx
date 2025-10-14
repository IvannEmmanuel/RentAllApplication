import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useState } from "react";
import { supabase } from "../../../supbaseClient";
import { useNavigation } from "@react-navigation/native";

const ForgotPassword = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email)

      if (error) throw error;

      Alert.alert(
        "Success",
        `A password reset link has been sent to ${email}. Please check your inbox.`
      );
      navigation.goBack();
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>
          Enter your email below and we’ll send you a link to reset your
          password.
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="juan@gmail.com"
          placeholderTextColor="#bebebeff"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ForgotPassword;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
  },
  content: {
    backgroundColor: "#FAF5EF",
    margin: 20,
    borderRadius: 30,
    padding: 25,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontFamily: "DM-Bold",
    color: "#1E1E1E",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "DM-Regular",
    color: "#444",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 22,
  },
  label: {
    fontFamily: "DM-Bold",
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 12,
    borderColor: "gray",
    borderWidth: 1,
    paddingHorizontal: 20,
    color: "black",
    backgroundColor: "rgba(255,255,255,0.9)",
    marginBottom: 20,
  },
  button: {
    height: 50,
    borderRadius: 20,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 15,
    fontFamily: "DM-Bold",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  backButton: {
    marginTop: 20,
    alignSelf: "center",
  },
  backText: {
    fontSize: 15,
    fontFamily: "DM-Medium",
    color: "#FFAB00",
    textDecorationLine: "underline",
  },
});
