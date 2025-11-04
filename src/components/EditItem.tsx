import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../supbaseClient';

interface EditItemModalProps {
  visible: boolean;
  onClose: () => void;
  item: any; // The item to edit (from selectedItem)
  onSaved: () => void; // Callback to refresh after save
}

const EditItemModal: React.FC<EditItemModalProps> = ({ visible, onClose, item, onSaved }) => {
  const [title, setTitle] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [quantity, setQuantity] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setPricePerDay(item.price_per_day?.toString() || '');
      setQuantity(item.quantity?.toString() || '1');
      setLocation(item.location || '');
    }
  }, [item]);

  const handleSave = async () => {
    if (!title || !pricePerDay || !quantity || !location) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }

    const price = parseFloat(pricePerDay);
    const qty = parseInt(quantity, 10);

    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Price and quantity must be positive numbers.');
      return;
    }

    try {
      const { error } = await supabase
        .from('items')
        .update({
          title,
          price_per_day: price,
          quantity: qty,
          location,
        })
        .eq('item_id', item.item_id);

      if (error) throw error;

      Alert.alert('Success', 'Item updated successfully.');
      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Error updating item:', error);
      Alert.alert('Error', error.message || 'Failed to update item.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Item</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter item title"
          />

          <Text style={styles.label}>Price per Day</Text>
          <TextInput
            style={styles.input}
            value={pricePerDay}
            onChangeText={setPricePerDay}
            placeholder="Enter price per day"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Quantity</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Enter quantity"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Enter location"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontFamily: 'DM-Bold',
    fontSize: 20,
    marginBottom: 15,
    textAlign: 'center',
  },
  label: {
    fontFamily: 'DM-Medium',
    fontSize: 14,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontFamily: 'DM-Medium',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#FFAB00',
    borderRadius: 5,
    padding: 10,
    width: '48%',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#FFAB00',
    borderRadius: 5,
    padding: 10,
    width: '48%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'DM-Bold',
    fontSize: 16,
  },
});

export default EditItemModal;