import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../supbaseClient';

export default function EditProfileModal({ visible, onClose, currentUser, setCurrentUser }) {
  const [firstName, setFirstName] = useState(currentUser.first_name);
  const [lastName, setLastName] = useState(currentUser.last_name);
  const [image, setImage] = useState(currentUser.face_image_url);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow photo access to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    try {
      setUploading(true);
      let uploadedImageUrl = image;

      // If user selected a new image (not the same as current URL)
      if (image && image !== currentUser.face_image_url && !image.startsWith('https')) {
        const fileExt = image.split('.').pop();
        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
        const filePath = `user-profile-pic/${fileName}`;

        const response = await fetch(image);
        const arrayBuffer = await response.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from('user-profile-pic')
          .upload(filePath, new Uint8Array(arrayBuffer), {
            contentType: `image/${fileExt}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('user-profile-pic').getPublicUrl(filePath);
        uploadedImageUrl = data.publicUrl;
      }


      // Update user info
      const { error } = await supabase
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          face_image_url: uploadedImageUrl,
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      setCurrentUser({
        ...currentUser,
        first_name: firstName,
        last_name: lastName,
        face_image_url: uploadedImageUrl,
      });

      Alert.alert('Success', 'Profile updated successfully.');
      onClose();
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Edit Profile</Text>

          {/* Profile Picture */}
          <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
            <Image
              source={
                image
                  ? { uri: image }
                  : require('../../assets/splash-icon.png')
              }
              style={styles.profileImage}
            />
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>

          {/* First Name */}
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            style={styles.input}
            placeholder="First Name"
          />

          {/* Last Name */}
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            style={styles.input}
            placeholder="Last Name"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#007bff' }]}
              onPress={handleSave}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#aaa' }]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    width: '85%',
    borderRadius: 15,
    padding: 20,
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  imageContainer: { alignItems: 'center', marginBottom: 15 },
  profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 5 },
  changePhotoText: { color: '#007bff', fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
  },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  button: { flex: 1, marginHorizontal: 5, padding: 12, borderRadius: 10 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: '600' },
});
