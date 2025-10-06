// ReportModal.js
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { supabase } from '../../supbaseClient';

const ReportModal = ({ 
  visible, 
  onClose, 
  senderId, 
  targetUserId, 
  rentalId,
  title = "Report",
  description = "Please provide details about your report."
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Define the complaint reasons based on your complaint_reason_enum
  const complaintReasons = [
    'harassment',
    'fraud',
    'inappropriate_content',
    'fake_listing',
    'safety_concern',
    'other'
  ];

  const reasonLabels = {
    harassment: 'Harassment',
    fraud: 'Fraud or Scam',
    inappropriate_content: 'Inappropriate Content',
    fake_listing: 'Fake Listing',
    safety_concern: 'Safety Concern',
    other: 'Other'
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for your report.');
      return;
    }

    if (!content.trim()) {
      Alert.alert('Error', 'Please provide details about your report.');
      return;
    }

    if (!senderId) {
      Alert.alert('Error', 'You must be logged in to submit a report.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('user_complaints')
        .insert([
          {
            sender_id: senderId,
            target_user_id: targetUserId,
            rental_id: rentalId,
            reason: selectedReason,
            content: content.trim(),
          }
        ]);

      if (error) {
        console.error('Error submitting report:', error);
        Alert.alert('Error', 'Failed to submit report. Please try again.');
        return;
      }

      Alert.alert(
        'Report Submitted',
        'Thank you for your report. We will review it and take appropriate action.',
        [{ text: 'OK', onPress: onClose }]
      );

      setSelectedReason('');
      setContent('');
      
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason('');
    setContent('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.description}>{description}</Text>

            <Text style={styles.sectionTitle}>Reason for Report *</Text>
            <View style={styles.reasonsContainer}>
              {complaintReasons.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reasonButton,
                    selectedReason === reason && styles.reasonButtonSelected
                  ]}
                  onPress={() => setSelectedReason(reason)}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      selectedReason === reason && styles.reasonTextSelected
                    ]}
                  >
                    {reasonLabels[reason]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Details *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Please provide specific details about your report..."
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <Text style={styles.note}>
              * Required fields. Your report will be reviewed by our team.
            </Text>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedReason || !content.trim() || isSubmitting) && styles.submitButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || !content.trim() || isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'DM-Bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 10,
    marginTop: 10,
  },
  reasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  reasonButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  reasonButtonSelected: {
    backgroundColor: '#FFAB00',
    borderColor: '#FFAB00',
  },
  reasonText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'DM-Medium',
  },
  reasonTextSelected: {
    color: '#FFF',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 20
  },
  note: {
    fontSize: 12,
    color: '#999',
    marginTop: 10,
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'DM-Medium',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FFAB00',
    marginLeft: 10,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontFamily: 'DM-Bold',
  },
});

export default ReportModal;