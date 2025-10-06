// ReportItemModal.tsx
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

interface ReportItemModalProps {
    visible: boolean;
    onClose: () => void;
    senderId: string;
    targetUserId: string;
    itemId: string;
    rentalId?: string | null;
    title?: string;
    description?: string;
}

const ReportItemModal: React.FC<ReportItemModalProps> = ({
    visible,
    onClose,
    senderId,
    targetUserId,
    itemId,
    rentalId = null,
    title = "Report Item",
    description = "Please provide details about your report."
}) => {
    const [selectedReason, setSelectedReason] = useState('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const complaintReasons = [
        'harassment',
        'fraud',
        'inappropriate',
        'fake_listing',
        'safety_concern',
        'other'
    ];

    const reasonLabels: Record<string, string> = {
        harassment: 'Harassment',
        fraud: 'Fraud or Scam',
        inappropriate: 'Inappropriate',
        fake_listing: 'Fake Listing',
        safety_concern: 'Safety Concern',
        other: 'Other'
    };

    const handleSubmit = async () => {
        if (!selectedReason) return Alert.alert('Error', 'Please select a reason.');
        if (!content.trim()) return Alert.alert('Error', 'Please provide details.');
        if (!senderId) return Alert.alert('Error', 'You must be logged in.');

        setIsSubmitting(true);

        try {
            const payload: any = {
                sender_id: senderId,
                target_user_id: targetUserId,
                reason: selectedReason,
                content: content.trim(),
            };

            if (rentalId) {
                payload.rental_id = rentalId;
            }

            if (itemId && !rentalId) {
                payload.target_item_id = itemId; // ✅ matches your complaints table
            }

            console.log('Attempting to insert payload:', payload);

            const { data, error } = await supabase
                .from('complaints') // ✅ correct table name
                .insert([payload])
                .select();

            if (error) {
                console.error('Insert error:', error);
                throw error;
            }

            console.log('Successfully inserted:', data);

            Alert.alert(
                'Report Submitted',
                'Thank you for your report. We will review it.',
                [{ text: 'OK', onPress: handleClose }]
            );

        } catch (error: any) {
            console.error('Error submitting report:', error);
            
            if (error.code === '23503') {
                Alert.alert(
                    'Error', 
                    'Unable to submit report. Please try again or contact support.'
                );
            } else {
                Alert.alert('Error', 'Failed to submit report.');
            }
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
            transparent
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
                    >
                        <Text style={styles.description}>{description}</Text>

                        <Text style={styles.sectionTitle}>Reason *</Text>
                        <View style={styles.reasonsContainer}>
                            {complaintReasons.map(reason => (
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
                            placeholder="Provide details..."
                            value={content}
                            onChangeText={setContent}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                            editable={!isSubmitting}
                        />
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
        backgroundColor: 'rgba(0,0,0,0.5)',
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
        fontWeight: 'bold',
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
        fontWeight: 'bold',
        color: '#333',
    },
    modalContent: {
        padding: 20,
    },
    description: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
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
        marginBottom: 20,
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
        fontWeight: 'bold',
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
        fontWeight: 'bold',
    },
});

export default ReportItemModal;
