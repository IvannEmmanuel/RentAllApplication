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

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to make this work!')
        return
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false, // Don't need base64
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

  const handleSubmit = async () => {
    console.log('=== SUBMIT STARTED ===')
    console.log('User ID:', currentUser?.id)
    console.log('Form:', form)
    console.log('Image file:', imageFile ? 'Selected' : 'None')

    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to add an item.')
      return
    }
    if (!form.title || !form.price_per_day) {
      Alert.alert('Error', 'Title and Price per day are required.')
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

    try {
      setLoading(true)

      // Step 1: Insert item
      const basePayload = {
        user_id: currentUser.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        price_per_day: price,
        deposit_fee: deposit,
        location: form.location.trim() || null,
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

      // Step 2: Upload image if provided
      if (imageFile && itemId) {
        console.log('=== STARTING IMAGE UPLOAD ===')
        console.log('Image details:', imageFile)

        try {
          // Create path for the image
          const fileName = `${Date.now()}-${imageFile.name}`
          const path = `${currentUser.id}/${itemId}/${fileName}`

          console.log('Upload path:', path)

          // Convert image to FormData (React Native compatible)
          console.log('Creating FormData for upload...')
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

          // Get public URL
          console.log('Getting public URL...')
          const { data: pub } = supabase.storage
            .from('Items-photos')
            .getPublicUrl(path)

          publicUrl = pub?.publicUrl || null
          console.log('Public URL generated:', publicUrl)

          if (publicUrl) {
            // Update item with image URL
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
          // Don't throw here - let the item be created without image
          Alert.alert('Warning', `Item created but image upload failed: ${imageError.message}`)
        }
      }

      console.log('=== ITEM CREATION COMPLETED ===')
      console.log('Final public URL:', publicUrl)

      Alert.alert(
        'Success',
        `Item created successfully${publicUrl ? ' with image!' : '!'}`,
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
      <View style={styles.modalOverlay}>
        <View style={styles.categoryModal}>
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
        </View>
      </View>
    </Modal>
  )

  const selectedCategoryName = categories.find(c => c.category_id.toString() === form.category_id)?.name || 'Select a category'

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Post an Item</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title */}
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

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <TouchableOpacity
          style={styles.categoryButton}
          onPress={() => setCategoryModalVisible(true)}
        >
          <Text style={[styles.categoryButtonText, !form.category_id && styles.placeholderText]}>
            {selectedCategoryName}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>

        {/* Description */}
        <Text style={styles.label}>Description</Text>
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

        {/* Price and Deposit */}
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
            <Text style={styles.label}>Deposit fee (₱)</Text>
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

        {/* Location */}
        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={form.location}
          onChangeText={(value) => updateForm('location', value)}
          placeholder="City / Barangay"
          placeholderTextColor="#999"
        />

        {/* Available Checkbox */}
        {/* <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => updateForm('available', !form.available)}
        >
          <View style={[styles.checkbox, form.available && styles.checkboxChecked]}>
            {form.available && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Available</Text>
        </TouchableOpacity> */}

        {/* Image Picker */}
        <Text style={styles.label}>Image (optional)</Text>
        <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
          <Text style={styles.imageButtonText}>
            {imageFile ? 'Change Image' : 'Select Image'}
          </Text>
        </TouchableOpacity>

        {imageFile && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: imageFile.uri }} style={styles.previewImage} />
            <Text style={styles.imageFileName}>Selected: {imageFile.name}</Text>
          </View>
        )}

        {/* Save Button */}
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

        {/* Add some bottom padding for better scrolling */}
        <View style={{ height: 50 }} />
      </ScrollView>

      <CategorySelector />
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryModal: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '80%',
    maxHeight: '60%',
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
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  categoryList: {
    maxHeight: 300,
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
})