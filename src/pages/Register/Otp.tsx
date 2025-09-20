// import { ImageBackground, StyleSheet, Text, View, Image, TextInput, TouchableOpacity, Alert } from "react-native"
// import { useState, useRef } from "react"
// import { useNavigation } from "@react-navigation/native"

// const Otp = () => {
//   const [otp, setOtp] = useState(["", "", "", ""])
//   const inputRefs = useRef<(TextInput | null)[]>([])
//   const navigation = useNavigation();

//   const handleOtpChange = (value: string, index: number) => {
//     const newOtp = [...otp]
//     newOtp[index] = value
//     setOtp(newOtp)

//     // Auto-focus next input
//     if (value && index < 3) {
//       inputRefs.current[index + 1]?.focus()
//     }
//   }

//   const handleKeyPress = (key: string, index: number) => {
//     // Handle backspace to move to previous input
//     if (key === "Backspace" && !otp[index] && index > 0) {
//       inputRefs.current[index - 1]?.focus()
//     }
//   }

//   const handleSubmit = () => {
//     // const otpCode = otp.join("")
//     // if (otpCode.length === 4) {
//     //   Alert.alert("OTP Submitted", `Your OTP: ${otpCode}`)
//     //   // Add your OTP verification logic here
//     // } else {
//     //   Alert.alert("Error", "Please enter complete OTP")
//     // }
//     navigation.navigate('Face')
//   }

//   const handleResend = () => {
//     Alert.alert("OTP Resent", "A new OTP has been sent to your phone")
//     setOtp(["", "", "", ""])
//     inputRefs.current[0]?.focus()
//   }

//   return (
//     <ImageBackground source={require("../../../assets/registerBackground.png")} style={styles.container}>
//       <Image source={require("../../../assets/inbox.png")} style={styles.inbox} />
//       <View style={styles.textContainer}>
//         <Text style={styles.text}>
//           We've sent a one-time password (OTP) to the phone number you provided. Please check your messages and enter
//           the code to continue.
//         </Text>

//         <View style={styles.otpContainer}>
//           {otp.map((digit, index) => (
//             <TextInput
//               key={index}
//               ref={(ref) => (inputRefs.current[index] = ref)}
//               style={styles.otpInput}
//               value={digit}
//               onChangeText={(value) => handleOtpChange(value, index)}
//               onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
//               keyboardType="numeric"
//               maxLength={1}
//               textAlign="center"
//               autoFocus={index === 0}
//             />
//           ))}
//         </View>

//         <View style={styles.resendContainer}>
//           <Text style={styles.resendText}>OTP not received? </Text>
//           <TouchableOpacity onPress={handleResend}>
//             <Text style={styles.resendLink}>RESEND</Text>
//           </TouchableOpacity>
//         </View>

//         <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
//           <Text style={styles.submitButtonText}>Next</Text>
//         </TouchableOpacity>
//       </View>
//     </ImageBackground>
//   )
// }

// export default Otp

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: "center",
//   },
//   inbox: {
//     width: 150,
//     height: 150,
//     alignSelf: "center",
//   },
//   textContainer: {
//     paddingHorizontal: 35,
//   },
//   text: {
//     textAlign: "center",
//     padding: 35,
//     fontSize: 16,
//     color: "#333",
//     lineHeight: 24,
//   },
//   otpContainer: {
//     flexDirection: "row",
//     alignSelf: 'center',
//   },
//   otpInput: {
//     width: 60,
//     height: 60,
//     borderWidth: 2,
//     borderColor: "#ddd",
//     borderRadius: 8,
//     fontSize: 24,
//     margin: 10,
//     fontWeight: "bold",
//     backgroundColor: "white",
//     color: "#333",
//   },
//   resendContainer: {
//     flexDirection: "row",
//     justifyContent: "center",
//     alignItems: "center",
//     marginVertical: 20,
//   },
//   resendText: {
//     fontSize: 14,
//     color: "#666",
//   },
//   resendLink: {
//     fontSize: 14,
//     color: "#FFAB00",
//     fontWeight: "bold",
//   },
//   submitButton: {
//     backgroundColor: "#333",
//     paddingVertical: 15,
//     marginHorizontal: 20,
//     marginTop: 30,
//     borderRadius: 25,
//     alignItems: "center",
//   },
//   submitButtonText: {
//     color: "white",
//     fontSize: 16,
//     fontWeight: "bold",
//   },
// })

import { ImageBackground, StyleSheet, Text, View, Image, TextInput, TouchableOpacity, Alert } from "react-native"
import { useState, useRef } from "react"
import { useNavigation, useRoute } from "@react-navigation/native"
import { supabase } from "../../../supbaseClient"
import { useRegistration } from "../../hooks/RegistrationContext"

const Otp = () => {
    const [otp, setOtp] = useState(["", "", "", "", "", ""])
    const [loading, setLoading] = useState(false)
    const inputRefs = useRef<(TextInput | null)[]>([])
    const navigation = useNavigation()
    const route = useRoute()
    const { registrationData } = useRegistration();

    // Get form data from navigation params
    const { formData } = route.params as { formData: any }

    const handleOtpChange = (value: string, index: number) => {
        const newOtp = [...otp]
        newOtp[index] = value
        setOtp(newOtp)

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleKeyPress = (key: string, index: number) => {
        // Handle backspace to move to previous input
        if (key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handleSubmit = async () => {
        const otpCode = otp.join("")
        if (otpCode.length !== 6) {
            Alert.alert("Error", "Please enter complete OTP")
            return
        }

        try {
            setLoading(true)

            // Verify OTP with Supabase
            const {
                data: { session },
                error,
            } = await supabase.auth.verifyOtp({
                email: registrationData.email,
                token: otpCode,
                type: "email",
            })

            if (error) throw error

            Alert.alert("Success", "OTP verified successfully!")

            // Navigate to Face verification screen
            navigation.navigate('Face' as never, {
                formData: {
                    email: formData.email
                }
            } as never)

        } catch (error: any) {
            Alert.alert("Error", `Invalid or expired OTP: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleResend = async () => {
        try {
            setLoading(true)

            // Resend OTP
            const { error } = await supabase.auth.signInWithOtp({
                email: formData.email,
                options: {
                    shouldCreateUser: true,
                },
            })

            if (error) throw error

            Alert.alert("Success", "A new OTP has been sent to your email")
            setOtp(["", "", "", "", "", ""])
            inputRefs.current[0]?.focus()

        } catch (error: any) {
            Alert.alert("Error", `Failed to resend OTP: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleChangeEmail = () => {
        // Go back to registration screen
        navigation.navigate('Register' as never)
    }

    return (
        <ImageBackground source={require("../../../assets/registerBackground.png")} style={styles.container}>
            <Image source={require("../../../assets/inbox.png")} style={styles.inbox} />
            <View style={styles.textContainer}>
                <Text style={styles.text}>
                    We've sent a one-time password (OTP) to {formData?.email || 'your email'}. Please check your messages and enter
                    the code to continue.
                </Text>

                <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => (inputRefs.current[index] = ref)}
                            style={styles.otpInput}
                            value={digit}
                            onChangeText={(value) => handleOtpChange(value, index)}
                            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                            keyboardType="numeric"
                            maxLength={1}
                            textAlign="center"
                            autoFocus={index === 0}
                        />
                    ))}
                </View>

                <View style={styles.resendContainer}>
                    <Text style={styles.resendText}>OTP not received? </Text>
                    <TouchableOpacity onPress={handleResend} disabled={loading}>
                        <Text style={[styles.resendLink, loading && { opacity: 0.6 }]}>RESEND</Text>
                    </TouchableOpacity>
                </View>

                {/* Change email option */}
                <View style={styles.resendContainer}>
                    <Text style={styles.resendText}>Wrong email? </Text>
                    <TouchableOpacity onPress={handleChangeEmail}>
                        <Text style={styles.resendLink}>CHANGE EMAIL</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, loading && { opacity: 0.6 }]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    <Text style={styles.submitButtonText}>
                        {loading ? "Verifying..." : "Next"}
                    </Text>
                </TouchableOpacity>
            </View>
        </ImageBackground>
    )
}

export default Otp

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
    },
    inbox: {
        width: 150,
        height: 150,
        alignSelf: "center",
    },
    textContainer: {
        paddingHorizontal: 35,
    },
    text: {
        textAlign: "center",
        padding: 35,
        fontSize: 16,
        color: "#333",
        lineHeight: 24,
    },
    otpContainer: {
        flexDirection: "row",
        justifyContent: 'center',
    },
    otpInput: {
        width: 50,
        height: 60,
        borderWidth: 2,
        borderColor: "#ddd",
        borderRadius: 8,
        fontSize: 24,
        margin: 5,
        fontWeight: "bold",
        backgroundColor: "white",
        color: "#333",
    },
    resendContainer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginVertical: 10,
    },
    resendText: {
        fontSize: 14,
        color: "#666",
    },
    resendLink: {
        fontSize: 14,
        color: "#FFAB00",
        fontWeight: "bold",
    },
    submitButton: {
        backgroundColor: "#333",
        paddingVertical: 15,
        marginHorizontal: 20,
        marginTop: 30,
        borderRadius: 25,
        alignItems: "center",
    },
    submitButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
    },
})