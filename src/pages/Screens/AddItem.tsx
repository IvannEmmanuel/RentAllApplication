import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native'
import React, { useEffect, useState } from 'react'
import { supabase } from '../../../supbaseClient'
import * as ImagePicker from 'expo-image-picker'

const AddItem = ({ navigation }) => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [form, setForm] = useState({
    title: '',
    category_id: '',
    description: '',
    price_per_day: '',
    deposit_fee: '',
    location: '',
    available: true,
    quantity: '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [categoryModalVisible, setCategoryModalVisible] = useState(false)
  const [isImagePickerModalVisible, setImagePickerModalVisible] = useState(false)

  const takePhoto = async () => {
    setImagePickerModalVisible(false)

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos!')
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        console.log('Photo taken:', asset.uri)
        setImageFile({
          uri: asset.uri,
          name: `image-${Date.now()}.jpg`,
          type: 'image/jpeg',
        })
      }
    } catch (error) {
      console.error('Camera error:', error)
      Alert.alert('Error', 'Failed to take photo')
    }
  }

  const chooseFromGallery = async () => {
    setImagePickerModalVisible(false)

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Gallery permission is required!')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        console.log('Image selected:', asset.uri)
        setImageFile({
          uri: asset.uri,
          name: `image-${Date.now()}.jpg`,
          type: 'image/jpeg',
        })
      }
    } catch (error) {
      console.error('Image picker error:', error)
      Alert.alert('Error', 'Failed to pick image')
    }
  }

  const pickImage = async () => {
    setImagePickerModalVisible(true)
  }

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error) {
          console.error('Auth error:', error.message)
          return
        }
        console.log('Current user loaded:', user?.id)
        setCurrentUser(user)
      } catch (error) {
        console.error('Error getting user:', error)
      }
    }
    getCurrentUser()
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('category_id,name')
        .order('name')
      if (error) {
        console.error('Categories fetch error:', error.message)
        return
      }
      console.log('Categories loaded:', data?.length)
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const updateForm = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  // Replace your handleSubmit function with this updated version:

  const handleSubmit = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to add an item.')
      return
    }

    // Check all required fields
    if (!form.title || !form.title.trim()) {
      Alert.alert('Error', 'Title is required.')
      return
    }

    if (!form.category_id) {
      Alert.alert('Error', 'Please select a category.')
      return
    }

    if (!form.description || !form.description.trim()) {
      Alert.alert('Error', 'Description is required.')
      return
    }

    if (!form.price_per_day || !form.price_per_day.trim()) {
      Alert.alert('Error', 'Price per day is required.')
      return
    }

    if (!form.deposit_fee || !form.deposit_fee.trim()) {
      Alert.alert('Error', 'Deposit fee is required.')
      return
    }

    if (!form.quantity || !form.quantity.trim()) {
      Alert.alert('Error', 'Quantity is required.')
      return
    }

    if (!form.location || !form.location.trim()) {
      Alert.alert('Error', 'Location is required.')
      return
    }

    if (!imageFile) {
      Alert.alert('Error', 'Image is required.')
      return
    }

    // Validate numbers
    const price = parseFloat(form.price_per_day)
    const deposit = parseFloat(form.deposit_fee)
    const quantity = parseInt(form.quantity, 10)

    if (isNaN(price) || price <= 0) {
      Alert.alert('Error', 'Please enter a valid price per day.')
      return
    }

    if (isNaN(deposit) || deposit < 0) {
      Alert.alert('Error', 'Please enter a valid deposit fee.')
      return
    }

    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity.')
      return
    }

    // Check if price per day is higher than deposit fee
    if (deposit > 0 && deposit >= price) {
      Alert.alert(
        'Invalid Price',
        `Deposit fee (₱${deposit.toFixed(2)}) cannot be equal to or higher than price per day (₱${price.toFixed(2)}).\n\nPrice per day must be higher than deposit fee.`
      )
      return
    }

    try {
      setLoading(true)

      // Step 1: Insert item
      const basePayload = {
        user_id: currentUser.id,
        title: form.title.trim(),
        description: form.description.trim(),
        price_per_day: price,
        deposit_fee: deposit,
        location: form.location.trim(),
        available: !!form.available,
        category_id: form.category_id ? Number(form.category_id) : null,
        main_image_url: null,
        quantity: quantity
      }

      console.log('Inserting item:', basePayload)

      const { data: inserted, error: insertErr } = await supabase
        .from('items')
        .insert([basePayload])
        .select('item_id')
        .single()

      if (insertErr) {
        console.error('Insert error:', insertErr)
        throw new Error(insertErr.message)
      }

      console.log('Item inserted successfully:', inserted)
      const itemId = inserted?.item_id

      if (!itemId) {
        throw new Error('No item ID returned')
      }

      let publicUrl = null

      // Step 2: Upload image
      if (imageFile && itemId) {
        console.log('=== STARTING IMAGE UPLOAD ===')
        console.log('Image details:', imageFile)

        try {
          const fileName = `${Date.now()}-${imageFile.name}`
          const path = `${currentUser.id}/${itemId}/${fileName}`

          console.log('Upload path:', path)

          const formData = new FormData()
          formData.append('file', {
            uri: imageFile.uri,
            type: imageFile.type || 'image/jpeg',
            name: fileName,
          } as any)

          console.log('Uploading to Supabase storage with FormData...')
          const { data: uploadData, error: upErr } = await supabase.storage
            .from('Items-photos')
            .upload(path, formData as any, {
              upsert: true,
              cacheControl: '3600',
            })

          if (upErr) {
            console.error('Upload error details:', upErr)
            throw new Error(`Upload failed: ${upErr.message}`)
          }

          console.log('Upload successful:', uploadData)

          const { data: pub } = supabase.storage
            .from('Items-photos')
            .getPublicUrl(path)

          publicUrl = pub?.publicUrl || null
          console.log('Public URL generated:', publicUrl)

          if (publicUrl) {
            console.log('Updating item with image URL...')
            const { error: updateErr } = await supabase
              .from('items')
              .update({ main_image_url: publicUrl })
              .eq('item_id', itemId)

            if (updateErr) {
              console.error('Update error:', updateErr)
              throw new Error(`Failed to update item: ${updateErr.message}`)
            } else {
              console.log('Item updated successfully with image URL')
            }
          } else {
            throw new Error('Failed to generate public URL')
          }

        } catch (imageError) {
          console.error('Image upload failed:', imageError)
          Alert.alert('Error', `Failed to upload image: ${imageError.message}`)
          return
        }
      }

      Alert.alert(
        'Success',
        `Your item was created successfully! It will be reviewed by an administrator and made visible to renters once approved.`,
        [{
          text: 'OK',
          onPress: () => {
            // Reset form
            setForm({
              title: '',
              category_id: '',
              description: '',
              price_per_day: '',
              deposit_fee: '',
              location: '',
              available: true,
              quantity: '',
            })
            setImageFile(null)
            // Navigate to Home tab
            navigation.navigate('Home')
          }
        }]
      )

    } catch (e) {
      console.error('Create item error:', e)
      Alert.alert('Error', `Failed to create item: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const CategorySelector = () => (
    <Modal
      visible={categoryModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setCategoryModalVisible(false)}
    >

      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setCategoryModalVisible(false)}
      >

        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.categoryModal}
        >
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>Select Category</Text>
            <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.categoryList}>
            <TouchableOpacity
              style={styles.categoryOption}
              onPress={() => {
                updateForm('category_id', '')
                setCategoryModalVisible(false)
              }}
            >
              <Text style={[styles.categoryOptionText, !form.category_id && styles.selectedCategory]}>
                No Category
              </Text>
            </TouchableOpacity>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.category_id}
                style={styles.categoryOption}
                onPress={() => {
                  updateForm('category_id', category.category_id.toString())
                  setCategoryModalVisible(false)
                }}
              >
                <Text style={[
                  styles.categoryOptionText,
                  form.category_id === category.category_id.toString() && styles.selectedCategory
                ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )

  const selectedCategoryName = categories.find(c => c.category_id.toString() === form.category_id)?.name || 'Select a category'

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Post an Item</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.label}>
          Title<Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(value) => updateForm('title', value)}
          placeholder="e.g., Cordless Drill"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>
          Category<Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={styles.categoryButton}
          onPress={() => setCategoryModalVisible(true)}
        >
          <Text style={[styles.categoryButtonText, !form.category_id && styles.placeholderText]}>
            {selectedCategoryName}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        <Text style={styles.label}>
          Description<Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.description}
          onChangeText={(value) => updateForm('description', value)}
          placeholder="Condition, accessories, etc."
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>
              Price per day (₱)<Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={form.price_per_day}
              onChangeText={(value) => updateForm('price_per_day', value)}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>
              Deposit fee (₱)<Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={form.deposit_fee}
              onChangeText={(value) => updateForm('deposit_fee', value)}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <Text style={styles.label}>
          Quantity<Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={form.quantity}
          onChangeText={(value) => updateForm('quantity', value)}
          placeholder="Enter quantity"
          placeholderTextColor="#999"
          keyboardType="numeric"
        />

        <Text style={styles.label}>
          Location<Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={form.location}
          onChangeText={(value) => updateForm('location', value)}
          placeholder="City / Barangay"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>
          Image<Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          style={styles.imageButton}
          onPress={pickImage}
        >
          <Image
            source={require("../../../assets/camera.png")}
            style={styles.imageButtonIcon}
          />
          <Text style={styles.imageButtonText}>
            {imageFile ? 'Change Image' : 'Select Image'}
          </Text>
        </TouchableOpacity>

        {imageFile && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: imageFile.uri }} style={styles.previewImage} />
            <Text style={styles.imageFileName}>✓ {imageFile.name}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Product</Text>
          )}
        </TouchableOpacity>


        <View style={{ height: 50 }} />
      </ScrollView>

      <CategorySelector />

      // Replace your Modal section with this updated version:

      <Modal
        visible={isImagePickerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setImagePickerModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setImagePickerModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.imagePickerModal}
          >
            <TouchableOpacity onPress={() => setImagePickerModalVisible(false)}>
              <View style={styles.handleBar} />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Select Photo</Text>
            <Text style={styles.modalSubtitle}>Choose how you want to add your item photo</Text>

            <TouchableOpacity
              onPress={takePhoto}
              style={styles.imageOptionButton}
            >
              <Image
                source={require("../../../assets/camera.png")}
                style={styles.imageOptionIcon}
              />
              <View style={styles.imageOptionContent}>
                <Text style={styles.imageOptionTitle}>Take a Photo</Text>
                <Text style={styles.imageOptionSubtitle}>Use your camera</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={chooseFromGallery}
              style={[styles.imageOptionButton, styles.imageOptionSecondary]}
            >
              <Image
                source={require("../../../assets/gallery.png")}
                style={styles.imageOptionIcon}
              />
              <View style={styles.imageOptionContent}>
                <Text style={styles.imageOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.imageOptionSubtitle}>Select existing photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setImagePickerModalVisible(false)}
              style={styles.imageOptionCancel}
            >
              <Text style={styles.imageOptionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

export default AddItem

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5EF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FAF5EF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'DM-Bold',
    color: '#333',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'DM-Medium',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  required: {
    color: '#FF6B6B',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
    fontFamily: 'DM-Regular',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  categoryButtonText: {
    fontSize: 16,
    fontFamily: 'DM-Regular',
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  halfWidth: {
    width: '48%',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#DDD',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  checkboxChecked: {
    backgroundColor: '#FFAB00',
    borderColor: '#FFAB00',
  },
  checkmark: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    fontFamily: 'DM-Regular',
    color: '#333',
  },
  imageButton: {
    borderWidth: 1,
    borderColor: '#FFAB00',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    marginTop: 4,
  },
  imageButtonText: {
    color: '#FFAB00',
    fontSize: 16,
    fontFamily: 'DM-Medium',
  },
  imagePreview: {
    marginTop: 16,
    alignItems: 'center',
  },
  previewImage: {
    width: 150,
    height: 112,
    borderRadius: 8,
    marginBottom: 8,
  },
  imageFileName: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#FFAB00',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: 'DM-Bold',
  },
  // Category Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  categoryModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingHorizontal: 0,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  categoryTitle: {
    fontSize: 18,
    fontFamily: 'DM-Bold',
    color: '#333',
  },
  closeText: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
  },
  categoryList: {
    maxHeight: 400,
  },
  categoryOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  categoryOptionText: {
    fontSize: 16,
    fontFamily: 'DM-Regular',
    color: '#333',
  },
  selectedCategory: {
    color: '#FFAB00',
    fontFamily: 'DM-Bold',
  },
  imageButtonIcon: {
    width: 24,
    height: 24,
    tintColor: '#FFAB00',
  },
  imagePickerModal: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },
  handleBar: {
    width: 50,
    height: 5,
    backgroundColor: '#CCCCCC',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'DM-Regular',
    marginBottom: 24,
  },
  imageOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFAB00',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  imageOptionSecondary: {
    backgroundColor: '#F5F5F5',
  },
  imageOptionIcon: {
    width: 28,
    height: 28,
    marginRight: 16,
    tintColor: '#333',
  },
  imageOptionContent: {
    flex: 1,
  },
  imageOptionTitle: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 2,
  },
  imageOptionSubtitle: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'DM-Regular',
  },
  imageOptionCancel: {
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  imageOptionCancelText: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#333',
  }
})