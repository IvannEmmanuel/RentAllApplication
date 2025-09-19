// import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native"
// import { useState, useRef } from "react"
// import { CameraView, type CameraType, useCameraPermissions } from "expo-camera"

// const Face = () => {
//   const [facing, setFacing] = useState<CameraType>("front")
//   const [permission, requestPermission] = useCameraPermissions()
//   const [isCameraOpen, setIsCameraOpen] = useState(false)
//   const cameraRef = useRef<CameraView>(null)

//   const openCamera = async () => {
//     if (!permission) {
//       // Camera permissions are still loading
//       return
//     }

//     if (!permission.granted) {
//       // Camera permissions are not granted yet
//       const result = await requestPermission()
//       if (!result.granted) {
//         Alert.alert("Permission denied", "Camera permission is required to use this feature")
//         return
//       }
//     }

//     setIsCameraOpen(true)
//   }

//   const takePicture = async () => {
//     if (cameraRef.current) {
//       try {
//         const photo = await cameraRef.current.takePictureAsync()
//         console.log("Photo taken:", photo?.uri)
//         Alert.alert("Success", "Photo captured successfully!")
//         setIsCameraOpen(false)
//       } catch (error) {
//         console.error("Error taking picture:", error)
//         Alert.alert("Error", "Failed to take picture")
//       }
//     }
//   }

//   return (
//     <ImageBackground source={require("../../../assets/registerBackground.png")} style={styles.container}>
//       <View style={styles.cameraContainer}>
//         {isCameraOpen ? (
//           <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
//         ) : (
//           <View style={styles.cameraPlaceholder}>
//             <Text style={styles.placeholderText}>Camera Preview</Text>
//           </View>
//         )}
//       </View>

//       <View style={styles.buttonContainer}>
//         {!isCameraOpen ? (
//           <TouchableOpacity style={styles.openCameraContainer} onPress={openCamera}>
//             <Text style={styles.cameraText}>Open Camera</Text>
//           </TouchableOpacity>
//         ) : (
//           <View style={styles.cameraControls}>
//             <TouchableOpacity style={styles.controlButton} onPress={takePicture}>
//               <Text style={styles.cameraText}>Take Photo</Text>
//             </TouchableOpacity>
//             <TouchableOpacity style={styles.controlButton} onPress={() => setIsCameraOpen(false)}>
//               <Text style={styles.cameraText}>Close</Text>
//             </TouchableOpacity>
//           </View>
//         )}
//       </View>

//       <TouchableOpacity style={styles.submitButton}>
//         <Text style={styles.submitButtonText}>Submit</Text>
//       </TouchableOpacity>
//     </ImageBackground>
//   )
// }

// export default Face

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     alignItems: "center",
//   },
//   cameraContainer: {
//     width: 300,
//     height: 200,
//     borderRadius: 50,
//     backgroundColor: "#524F4F",
//     marginTop: 130,
//     overflow: "hidden", // Added overflow hidden for rounded corners
//   },
//   camera: {
//     flex: 1,
//   },
//   cameraPlaceholder: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   placeholderText: {
//     color: "white",
//     fontSize: 16,
//   },
//   buttonContainer: {
//     marginTop: 10,
//   },
//   openCameraContainer: {
//     width: 150,
//     height: 30,
//     backgroundColor: "#524F4F",
//     borderRadius: 5,
//     justifyContent: "center", // Added center alignment
//   },
//   cameraControls: {
//     flexDirection: "row",
//     gap: 10,
//   },
//   controlButton: {
//     width: 100,
//     height: 30,
//     backgroundColor: "#524F4F",
//     borderRadius: 5,
//     justifyContent: "center",
//   },
//   cameraText: {
//     textAlign: "center",
//     color: "white",
//   },
//   submitButton: {
//     position: "absolute",
//     bottom: 50,
//     left: 20,
//     right: 20,
//     backgroundColor: "#333",
//     paddingVertical: 15,
//     borderRadius: 25,
//     alignItems: "center",
//   },
//   submitButtonText: {
//     color: "white",
//     fontSize: 16,
//     fontWeight: "bold",
//   },
// })

import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native"
import { useState, useRef } from "react"
import { CameraView, type CameraType, useCameraPermissions } from "expo-camera"
import { useNavigation } from "@react-navigation/native"
import { supabase } from "../../../supbaseClient"
import { useRegistration } from "../../hooks/RegistrationContext"

const Face = () => {
  const [facing, setFacing] = useState<CameraType>("front")
  const [permission, requestPermission] = useCameraPermissions()
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const cameraRef = useRef<CameraView>(null)

  const navigation = useNavigation()

  // Move the hook call to the top level of the component
  const { registrationData } = useRegistration()

  const openCamera = async () => {
    if (!permission) {
      // Camera permissions are still loading
      return
    }

    if (!permission.granted) {
      // Camera permissions are not granted yet
      const result = await requestPermission()
      if (!result.granted) {
        Alert.alert("Permission denied", "Camera permission is required to use this feature")
        return
      }
    }

    setIsCameraOpen(true)
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1,
          base64: false,
        })

        if (photo?.uri) {
          setCapturedImage(photo.uri)
          Alert.alert("Success", "Photo captured successfully!")
          setIsCameraOpen(false)

          // Automatically compare faces after capture
          await compareFaces(photo.uri)
        }
      } catch (error) {
        console.error("Error taking picture:", error)
        Alert.alert("Error", "Failed to take picture")
      }
    }
  }

  const compareFaces = async (selfieUri: string) => {
    if (!registrationData.idImage || !selfieUri) {
      Alert.alert("Error", "ID image or selfie is missing")
      return false
    }

    try {
      setLoading(true)
      setResult("🔄 Comparing faces...")

      // Method 1: Try base64 approach (more reliable for React Native)
      console.log('Converting images to base64...')

      const [idResponse, selfieResponse] = await Promise.all([
        fetch(registrationData.idImage.uri),
        fetch(selfieUri)
      ])

      if (!idResponse.ok || !selfieResponse.ok) {
        throw new Error('Cannot access image files')
      }

      const [idBlob, selfieBlob] = await Promise.all([
        idResponse.blob(),
        selfieResponse.blob()
      ])

      console.log('Image sizes - ID:', idBlob.size, 'bytes, Selfie:', selfieBlob.size, 'bytes')

      // Check file sizes (Face++ limit is usually 2MB)
      if (idBlob.size > 2000000 || selfieBlob.size > 2000000) {
        throw new Error('Image file too large (max 2MB)')
      }

      const idBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(idBlob)
      })

      const selfieBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(selfieBlob)
      })

      console.log('Base64 conversion complete, sending to Face++ API...')

      // Send using URL-encoded form data (more reliable than multipart)
      const formBody = new URLSearchParams()
      formBody.append('api_key', 'W9-sl3ggHVQ2DsAuGh8abK4GJe-6LWY7')
      formBody.append('api_secret', 'IKs0rowIo3yVqLB8FS3kpOkpFhJ3qTt3')
      formBody.append('image_base64_1', idBase64)
      formBody.append('image_base64_2', selfieBase64)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const response = await fetch('https://api-us.faceplusplus.com/facepp/v3/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody.toString(),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('HTTP Error:', response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log("Face++ result:", data)

      if (data.error_message) {
        throw new Error(data.error_message)
      }

      const confidence = data.confidence || 0
      const matched = confidence > 80

      if (matched) {
        setResult(`✅ Face matched! Confidence: ${confidence.toFixed(1)}%`)
      } else {
        setResult(`❌ Face does not match. Confidence: ${confidence.toFixed(1)}%`)
      }

      return matched

    } catch (error: any) {
      console.error("Face++ API error:", error)
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      })

      if (error.name === 'AbortError') {
        setResult("⚠️ Request timeout - please try again")
        Alert.alert("Timeout", "Request timed out. Please try again.")
      } else if (error.message.includes('Network request failed')) {
        setResult("⚠️ Network error")
        Alert.alert(
          "Network Error",
          "Could not connect to Face++ API. Please check:\n\n" +
          "• Internet connection\n" +
          "• VPN settings\n" +
          "• Firewall/proxy settings\n\n" +
          "Try again in a moment."
        )
      } else if (error.message.includes('Image file too large')) {
        setResult("⚠️ Image too large")
        Alert.alert("Error", "Image files are too large. Please try with smaller images.")
      } else if (error.message.includes('Cannot access image files')) {
        setResult("⚠️ Cannot access images")
        Alert.alert("Error", "Cannot access image files. Please try capturing them again.")
      } else {
        setResult("⚠️ API error")
        Alert.alert("API Error", `Face comparison failed: ${error.message}`)
      }

      return false
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!capturedImage) {
      Alert.alert("Error", "Please capture your selfie first.")
      return
    }

    if (!result?.includes("✅")) {
      Alert.alert("Error", "Face verification failed! Please try again.")
      return
    }

    try {
      setLoading(true)

      // Update user password - use registrationData instead of formData
      const { error: updatePasswordError } = await supabase.auth.updateUser({
        password: registrationData.password,
      })
      if (updatePasswordError) throw updatePasswordError

      // Get current user
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userData?.user) {
        throw new Error(userErr?.message || "No user in session")
      }
      const userId = userData.user.id

      // Upload ID image to Supabase Storage
      let idImageUrl = null
      if (registrationData.idImage) {
        const fileExtension = registrationData.idImage.name.split('.').pop() || 'jpg'
        const idPath = `${userId}/id_${Date.now()}.${fileExtension}`

        // Convert image URI to blob for upload
        const formData = new FormData();
        formData.append("file", {
          uri: registrationData.idImage.uri,
          type: "image/jpeg", // adjust if not jpeg
          name: `id_${Date.now()}.jpg`,
        } as any);

        const { error: idErr } = await supabase.storage
          .from("user-ids")
          .upload(idPath, formData as any);
        if (idErr) throw idErr

        const { data: idPub } = supabase.storage
          .from("user-ids")
          .getPublicUrl(idPath)
        idImageUrl = idPub?.publicUrl || null
      }

      // Upload selfie image to Supabase Storage
      let faceImageUrl = null
      if (capturedImage) {
        const facePath = `${userId}/faces/selfie_${Date.now()}.jpg`

        // Convert image URI to blob for upload
        const formData = new FormData();
        formData.append("file", {
          uri: capturedImage,
          type: "image/jpeg",
          name: `selfie_${Date.now()}.jpg`,
        } as any);

        const { error: faceErr } = await supabase.storage
          .from("user-faces")
          .upload(facePath, formData as any);
        if (faceErr) throw faceErr

        const { data: facePub } = supabase.storage
          .from("user-faces")
          .getPublicUrl(facePath)
        faceImageUrl = facePub?.publicUrl || null
      }

      // Convert dob back to Date object if it's a string from context
      const dobDate = registrationData.dob ? new Date(registrationData.dob) : null

      // Insert user data into users table - use registrationData
      const { error: insertError } = await supabase
        .from("users")
        .insert([
          {
            id: userId,
            first_name: registrationData.firstName,
            last_name: registrationData.lastName,
            phone: registrationData.phone,
            dob: dobDate ? dobDate.toISOString().split("T")[0] : null,
            location_lat: registrationData.location?.lat ? String(registrationData.location.lat) : null,
            location_lng: registrationData.location?.lng ? String(registrationData.location.lng) : null,
            id_image_url: idImageUrl,
            face_image_url: faceImageUrl,
            face_verified: true, // Set to true since Face++ verified
            role: "unverified", // Still needs admin verification
          },
        ])
      if (insertError) throw insertError

      // Log the registration activity
      await supabase.from("activity_log").insert([
        {
          user_id: userId,
          action_type: "registration",
          description: "User completed registration + automated face match; pending manual admin verification",
          target_table: "users",
          target_id: userId,
        },
      ])

      Alert.alert(
        "Success",
        "Registration completed successfully! Your account is pending admin verification.",
        [
          {
            text: "OK",
            onPress: () => navigation.navigate('Login' as never)
          }
        ]
      )

    } catch (error: any) {
      console.error("Error during registration:", error)
      Alert.alert("Error", `Failed to register: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ImageBackground source={require("../../../assets/registerBackground.png")} style={styles.container}>
      <View style={styles.cameraContainer}>
        {isCameraOpen ? (
          <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
        ) : (
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.placeholderText}>
              {capturedImage ? "✅ Selfie Captured" : "Camera Preview"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        {!isCameraOpen ? (
          <TouchableOpacity
            style={[styles.openCameraContainer, loading && { opacity: 0.6 }]}
            onPress={openCamera}
            disabled={loading}
          >
            <Text style={styles.cameraText}>Open Camera</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={[styles.controlButton, loading && { opacity: 0.6 }]}
              onPress={takePicture}
              disabled={loading}
            >
              <Text style={styles.cameraText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setIsCameraOpen(false)}
            >
              <Text style={styles.cameraText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Face comparison result */}
      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitButton, loading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? "Submitting..." : "Submit"}
        </Text>
      </TouchableOpacity>
    </ImageBackground>
  )
}

export default Face

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  cameraContainer: {
    width: 300,
    height: 200,
    borderRadius: 50,
    backgroundColor: "#524F4F",
    marginTop: 130,
    overflow: "hidden",
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
  },
  buttonContainer: {
    marginTop: 10,
  },
  openCameraContainer: {
    width: 150,
    height: 30,
    backgroundColor: "#524F4F",
    borderRadius: 5,
    justifyContent: "center",
  },
  cameraControls: {
    flexDirection: "row",
    gap: 10,
  },
  controlButton: {
    width: 100,
    height: 30,
    backgroundColor: "#524F4F",
    borderRadius: 5,
    justifyContent: "center",
  },
  cameraText: {
    textAlign: "center",
    color: "white",
  },
  resultContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  resultText: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 10,
    borderRadius: 10,
  },
  submitButton: {
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: "#333",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
})