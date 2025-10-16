import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supbaseClient';
import { handleBookingStatusChange } from '../notifications/notifications';
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from "expo-file-system/legacy";

function base64ToUint8Array(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

const ItemTrackingScreen = ({ route, navigation }) => {
    const { rental } = route.params;
    const [currentRental, setCurrentRental] = useState(rental);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);

    console.log('Current rental:', currentRental);

    // Phase configurations for renter - UPDATED WITH DEPOSIT PHASE
    const phases = [
        { id: 1, title: 'Item Accepted', status: 'confirmed' },
        { id: 2, title: 'Upload Deposit', status: 'deposit_submitted' },
        { id: 3, title: 'On the Way', status: 'on_the_way' },
        { id: 4, title: 'Ongoing', status: 'ongoing' },
        { id: 5, title: 'Delivered', status: 'delivered' },
    ];

    // Check if end date has passed
    const isReturnEnabled = () => {
        if (!currentRental?.end_date) return false;
        const endDate = new Date(currentRental.end_date);
        const today = new Date();
        // Set both dates to start of day for accurate comparison
        endDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        return today >= endDate;
    };

    // Real-time subscription for status updates
    useEffect(() => {
        if (!currentRental?.rental_id) return;

        console.log('Setting up real-time subscription for rental:', currentRental.rental_id);

        const channel = supabase
            .channel(`rental_tracking_${currentRental.rental_id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rental_transactions',
                    filter: `rental_id=eq.${currentRental.rental_id}`,
                },
                async (payload) => {
                    console.log('Real-time rental status update received:', payload);

                    // Update the current rental with new status
                    setCurrentRental(prev => ({
                        ...prev,
                        ...payload.new
                    }));

                    // If the update doesn't include item details, fetch them
                    if (!payload.new.items) {
                        await fetchUpdatedRentalDetails();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'items',
                    filter: `item_id=eq.${currentRental.item_id}`,
                },
                (payload) => {
                    console.log('Real-time item update received:', payload);
                    // Update item details if they change
                    setCurrentRental(prev => ({
                        ...prev,
                        items: {
                            ...prev.items,
                            ...payload.new
                        }
                    }));
                }
            )
            .subscribe((status) => {
                console.log('Subscription status:', status);
                setIsSubscribed(status === 'SUBSCRIBED');
            });

        return () => {
            console.log('Cleaning up real-time subscription');
            supabase.removeChannel(channel);
            setIsSubscribed(false);
        };
    }, [currentRental?.rental_id, currentRental?.item_id]);

    // Fetch complete rental details including item information
    const fetchUpdatedRentalDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('rental_transactions')
                .select(`
                    rental_id,
                    item_id,
                    start_date,
                    end_date,
                    status,
                    quantity,
                    total_cost,
                    created_at,
                    proof_of_deposit_url,
                    items (
                        title,
                        price_per_day,
                        location,
                        main_image_url,
                        users:user_id (
                            first_name,
                            last_name,
                            face_image_url
                        )
                    )
                `)
                .eq('rental_id', currentRental.rental_id)
                .single();

            if (error) {
                console.error('Error fetching updated rental details:', error);
            } else {
                console.log('Fetched updated rental details:', data);
                setCurrentRental(data);
            }
        } catch (error) {
            console.error('Error in fetchUpdatedRentalDetails:', error);
        }
    };

    // NEW FUNCTION: Handle deposit image upload
    const handleUploadDeposit = async () => {
        try {
            // Request permissions first
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload deposit proof.');
                return;
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
            });

            if (result.canceled) {
                console.log('User cancelled image picker');
                return;
            }

            if (result.assets && result.assets.length > 0) {
                const imageUri = result.assets[0].uri;
                if (!imageUri) {
                    Alert.alert('Error', 'No image selected');
                    return;
                }

                setUploading(true);

                // Generate unique filename
                const fileName = `${currentRental.rental_id}/${Date.now()}.jpg`;

                // Convert image to base64 using expo-file-system (same approach as your Chat component)
                const base64 = await FileSystem.readAsStringAsync(imageUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                // Convert base64 to Uint8Array
                const fileBytes = base64ToUint8Array(base64);

                console.log("📤 Uploading deposit proof...");
                console.log("Bucket: deposit-proofs");
                console.log("File name:", fileName);

                // Upload to Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from("proof-of-deposit")
                    .upload(fileName, fileBytes, {
                        contentType: "image/jpeg",
                        upsert: false,
                    });

                if (uploadError) {
                    console.error("❌ Deposit upload error:", uploadError);
                    throw new Error(`Upload failed: ${uploadError.message}`);
                }

                console.log("✅ Deposit proof uploaded successfully");

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from("proof-of-deposit")
                    .getPublicUrl(fileName);

                const proofOfDepositUrl = urlData.publicUrl;

                // Store the old status before updating
                const oldStatus = currentRental.status;

                // Update rental transaction with deposit proof and status
                const { error: updateError } = await supabase
                    .from('rental_transactions')
                    .update({
                        proof_of_deposit_url: proofOfDepositUrl,
                        status: 'deposit_submitted'
                    })
                    .eq('rental_id', currentRental.rental_id);

                if (updateError) {
                    throw new Error(`Database update failed: ${updateError.message}`);
                }

                // Update local state
                setCurrentRental(prev => ({
                    ...prev,
                    proof_of_deposit_url: proofOfDepositUrl,
                    status: 'deposit_submitted'
                }));

                // Fetch the complete rental data including renter_id for notification
                const { data: fullRental, error: fetchError } = await supabase
                    .from('rental_transactions')
                    .select('*')
                    .eq('rental_id', currentRental.rental_id)
                    .single();

                if (!fetchError && fullRental) {
                    // Trigger notification to lessor
                    await handleBookingStatusChange(
                        fullRental,
                        oldStatus,
                        'deposit_submitted'
                    );
                }

                Alert.alert('Success', 'Deposit proof uploaded successfully!');

            }
        } catch (error) {
            console.error('Error uploading deposit:', error);
            Alert.alert('Error', 'Failed to upload deposit proof. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    // NEW FUNCTION: View uploaded deposit proof
    const handleViewDepositProof = () => {
        if (!currentRental.proof_of_deposit_url) {
            Alert.alert('No Proof', 'No deposit proof has been uploaded yet.');
            return;
        }

        // Navigate to image view screen or show in modal
        navigation.navigate('ImageViewScreen', {
            imageUrl: currentRental.proof_of_deposit_url,
            title: 'Deposit Proof'
        });
    };

    // NEW FUNCTION: Mark as Delivered (from on_the_way to ongoing)
    const handleMarkAsDelivered = async () => {
        setLoading(true);
        try {
            // Store the old status before updating
            const oldStatus = currentRental.status;

            const { data, error } = await supabase
                .from('rental_transactions')
                .update({ status: 'ongoing' })
                .eq('rental_id', currentRental.rental_id);

            if (error) {
                console.log('Error updating status:', error);
                alert('Failed to mark as delivered. Please try again.');
            } else {
                // Note: Real-time subscription will handle the state update automatically
                console.log('Marked as delivered successfully');

                // Fetch the complete rental data including renter_id
                const { data: fullRental, error: fetchError } = await supabase
                    .from('rental_transactions')
                    .select('*')
                    .eq('rental_id', currentRental.rental_id)
                    .single();

                if (!fetchError && fullRental) {
                    // Trigger notification to lessor
                    await handleBookingStatusChange(
                        fullRental,
                        oldStatus,
                        'ongoing'
                    );
                }

                Alert.alert('Success', 'Item marked as delivered!');
            }
        } catch (err) {
            console.log(err);
            alert('Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    const handleReturn = async () => {
        setLoading(true);
        try {
            // Store the old status before updating
            const oldStatus = currentRental.status;

            const { data, error } = await supabase
                .from('rental_transactions')
                .update({ status: 'awaiting_owner_confirmation' })
                .eq('rental_id', currentRental.rental_id);

            if (error) {
                console.log('Error updating status:', error);
                alert('Failed to return item. Please try again.');
            } else {
                // Note: Real-time subscription will handle the state update automatically
                console.log('Return request submitted successfully');

                // Fetch the complete rental data including renter_id
                const { data: fullRental, error: fetchError } = await supabase
                    .from('rental_transactions')
                    .select('*')
                    .eq('rental_id', currentRental.rental_id)
                    .single();

                if (!fetchError && fullRental) {
                    // Trigger notification to lessor
                    await handleBookingStatusChange(
                        fullRental,
                        oldStatus,
                        'awaiting_owner_confirmation'
                    );
                }

                Alert.alert('Success', 'Return request submitted! Waiting for owner confirmation.');
            }
        } catch (err) {
            console.log(err);
            alert('Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmReceived = async () => {
        setLoading(true);
        try {
            // Store the old status before updating
            const oldStatus = currentRental.status;

            const { data, error } = await supabase
                .from('rental_transactions')
                .update({ status: 'delivered' })
                .eq('rental_id', currentRental.rental_id);

            if (error) {
                console.log('Error updating status:', error);
                alert('Failed to confirm receipt. Please try again.');
            } else {
                // Note: Real-time subscription will handle the state update automatically
                console.log('Delivery confirmed successfully');

                // Fetch the complete rental data including renter_id
                const { data: fullRental, error: fetchError } = await supabase
                    .from('rental_transactions')
                    .select('*')
                    .eq('rental_id', currentRental.rental_id)
                    .single();

                if (!fetchError && fullRental) {
                    // Trigger notification to lessor
                    await handleBookingStatusChange(
                        fullRental,
                        oldStatus,
                        'delivered'
                    );
                }

                Alert.alert('Success', 'Item received confirmed!');
            }
        } catch (err) {
            console.log(err);
            alert('Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    // UPDATED: Get current phase based on rental status
    const getCurrentPhase = () => {
        switch (currentRental.status) {
            case 'confirmed':
                return 1;
            case 'deposit_submitted':
                return 2;
            case 'on_the_way':
                return 3;
            case 'ongoing':
                return 4;
            case 'delivered':
            case 'awaiting_owner_confirmation':
            case 'completed':
                return 5;
            default:
                return 1;
        }
    };

    const currentPhase = getCurrentPhase();

    const renderProgressBar = () => {
        return (
            <View style={styles.progressContainer}>
                {/* Progress Line
                <View style={styles.progressLine}>
                    <View
                        style={[
                            styles.progressFill,
                            { width: `${((currentPhase - 1) / (phases.length - 1)) * 100}%` }
                        ]}
                    />
                </View> */}

                {/* Phase Indicators */}
                <View style={styles.phaseIndicators}>
                    {phases.map((phase, index) => (
                        <View key={phase.id} style={styles.phaseItem}>
                            <View
                                style={[
                                    styles.phaseCircle,
                                    phase.id <= currentPhase ? styles.phaseCircleActive : styles.phaseCircleInactive
                                ]}
                            >
                                <View
                                    style={[
                                        styles.phaseCircleInner,
                                        phase.id <= currentPhase ? styles.phaseCircleInnerActive : styles.phaseCircleInnerInactive
                                    ]}
                                />
                            </View>
                            <Text
                                style={[
                                    styles.phaseLabel,
                                    phase.id <= currentPhase ? styles.phaseLabelActive : styles.phaseLabelInactive
                                ]}
                            >
                                {phase.title}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    // UPDATED: Status messages
    const getStatusMessage = () => {
        switch (currentRental.status) {
            case 'confirmed':
                return 'accepted - Please upload your deposit proof';
            case 'deposit_submitted':
                return 'deposit submitted - Waiting for owner confirmation';
            case 'on_the_way':
                return 'on the way - Item is being delivered';
            case 'ongoing':
                return 'ongoing - Item is with you';
            case 'delivered':
                return 'delivered';
            case 'awaiting_owner_confirmation':
                return 'awaiting owner confirmation';
            default:
                return 'being processed';
        }
    };

    const getStatusColor = () => {
        switch (currentRental.status) {
            case 'confirmed':
                return '#4CAF50';
            case 'deposit_submitted':
                return '#FF9800';
            case 'on_the_way':
                return '#2196F3';
            case 'ongoing':
                return '#4CAF50';
            case 'delivered':
                return '#2196F3';
            case 'awaiting_owner_confirmation':
                return '#FF7043';
            default:
                return '#757575';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Item Tracking</Text>
                <View style={styles.placeholder} />
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>✕</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Progress Section */}
                {renderProgressBar()}

                {/* Item Details */}
                <View style={styles.itemSection}>
                    <Image
                        source={
                            currentRental.items?.main_image_url
                                ? { uri: currentRental.items.main_image_url }
                                : require('../../assets/splash-icon.png')
                        }
                        style={styles.itemImage}
                    />

                    <View style={styles.itemInfo}>
                        <Text style={styles.itemTitle}>
                            {currentRental.items?.title || 'Item Title'}
                        </Text>
                        <Text style={styles.itemPrice}>
                            ₱{currentRental.items?.price_per_day || 'N/A'} per day
                        </Text>
                        <Text style={styles.itemDates}>
                            {new Date(currentRental.start_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })} - {new Date(currentRental.end_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </Text>
                    </View>
                </View>

                {/* Status Message */}
                <View style={styles.statusSection}>
                    <Text style={styles.statusTitle}>Your order is {getStatusMessage()}.</Text>

                    {/* Deposit Upload Section */}
                    {currentRental.status === 'confirmed' && (
                        <View style={styles.depositSection}>
                            <Text style={styles.depositText}>
                                Please upload proof of deposit to proceed with your rental.
                            </Text>
                            <TouchableOpacity
                                style={styles.uploadButton}
                                onPress={handleUploadDeposit}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.uploadButtonText}>Upload Deposit Proof</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* View Deposit Proof Section - Show for all statuses except confirmed
                    {currentRental.proof_of_deposit_url && currentRental.status !== 'confirmed' && (
                        <View style={styles.depositProofSection}>
                            <Text style={styles.depositProofText}>
                                Deposit proof uploaded ✓
                            </Text>
                            <TouchableOpacity
                                style={styles.viewProofButton}
                                onPress={handleViewDepositProof}
                            >
                                <Text style={styles.viewProofButtonText}>View Proof</Text>
                            </TouchableOpacity>
                        </View>
                    )} */}

                    {/* Mark as Delivered Section (for on_the_way status) */}
                    {currentRental.status === 'on_the_way' && (
                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={handleMarkAsDelivered}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.confirmButtonText}>Mark as Delivered</Text>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Return Section (for ongoing status) */}
                    {currentRental.status === 'ongoing' && (
                        <View style={styles.returnSection}>
                            <TouchableOpacity
                                style={[
                                    styles.confirmButton,
                                    (!isReturnEnabled() || currentRental.status === 'awaiting_owner_confirmation') && 
                                    styles.disabledButton
                                ]}
                                onPress={handleReturn}
                                disabled={!isReturnEnabled() || currentRental.status === 'awaiting_owner_confirmation' || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.confirmButtonText}>
                                        {currentRental.status === 'awaiting_owner_confirmation' 
                                            ? 'Return Requested' 
                                            : 'Return Item'
                                        }
                                    </Text>
                                )}
                            </TouchableOpacity>
                            
                            {!isReturnEnabled() && currentRental.status !== 'awaiting_owner_confirmation' && (
                                <Text style={styles.returnInfoText}>
                                    Return will be available after {new Date(currentRental.end_date).toLocaleDateString()}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Confirm Received Section (for delivered status) */}
                    {currentRental.status === 'delivered' && (
                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={handleConfirmReceived}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.confirmButtonText}>Confirm Received</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Details Section */}
                <View style={styles.detailsSection}>
                    <Text style={styles.sectionTitle}>Rental Details</Text>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Quantity:</Text>
                        <Text style={styles.detailValue}>{currentRental.quantity || 1}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Total Cost:</Text>
                        <Text style={styles.detailValue}>₱{currentRental.total_cost}</Text>
                    </View>

                    {currentRental.deposit_fee && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Deposit Fee:</Text>
                            <Text style={styles.detailValue}>₱{currentRental.deposit_fee}</Text>
                        </View>
                    )}

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Location:</Text>
                        <Text style={styles.detailValue}>{currentRental.items?.location || 'N/A'}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Owner:</Text>
                        <Text style={styles.detailValue}>
                            {currentRental.items?.users?.first_name} {currentRental.items?.users?.last_name}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Rental ID:</Text>
                        <Text style={styles.detailValue}>{currentRental.rental_id}</Text>
                    </View>

                    {currentRental.proof_of_deposit_url && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Deposit Status:</Text>
                            <Text style={[styles.detailValue, styles.depositSubmitted]}>
                                Submitted ✓
                            </Text>
                        </View>
                    )}

                    {/* Return Eligibility Info */}
                    {(currentRental.status === 'ongoing' || currentRental.status === 'delivered') && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Return Eligibility:</Text>
                            <Text style={[
                                styles.detailValue, 
                                isReturnEnabled() ? styles.eligibleText : styles.notEligibleText
                            ]}>
                                {isReturnEnabled() ? 'Eligible' : 'Not yet eligible'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Last Updated */}
                <View style={styles.updateSection}>
                    <Text style={styles.updateText}>
                        Last updated: {new Date().toLocaleTimeString()}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F5F5F5',
    },
    backButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    backButtonText: {
        fontSize: 18,
        color: '#666',
        fontWeight: 'bold',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
    },
    progressContainer: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        marginTop: 20,
        marginBottom: 16,
        borderRadius: 12,
        padding: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    connectionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        padding: 8,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
    },
    connectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    connected: {
        backgroundColor: '#4CAF50',
    },
    disconnected: {
        backgroundColor: '#FF9800',
    },
    connectionText: {
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    progressLine: {
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        marginBottom: 20,
        position: 'relative',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FF9900',
        borderRadius: 2,
    },
    phaseIndicators: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    phaseItem: {
        flex: 1,
        alignItems: 'center',
    },
    phaseCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    phaseCircleActive: {
        backgroundColor: '#FF9900',
    },
    phaseCircleInactive: {
        backgroundColor: '#E0E0E0',
    },
    phaseCircleInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    phaseCircleInnerActive: {
        backgroundColor: '#FFF',
    },
    phaseCircleInnerInactive: {
        backgroundColor: '#999',
    },
    phaseLabel: {
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '500',
    },
    phaseLabelActive: {
        color: '#FF9900',
    },
    phaseLabelInactive: {
        color: '#999',
    },
    itemSection: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        alignItems: 'center',
    },
    itemImage: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        marginBottom: 16,
    },
    itemInfo: {
        alignItems: 'center',
        width: '100%',
    },
    itemTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 8,
        textAlign: 'center',
    },
    itemPrice: {
        fontSize: 16,
        color: '#666',
        marginBottom: 4,
    },
    itemDates: {
        fontSize: 14,
        color: '#999',
    },
    statusSection: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        alignItems: 'center',
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#000',
        marginBottom: 16,
    },
    depositSection: {
        alignItems: 'center',
        marginBottom: 16,
    },
    depositText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 12,
    },
    uploadButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        minWidth: 200,
    },
    uploadButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    depositProofSection: {
        alignItems: 'center',
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#E8F5E8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    depositProofText: {
        fontSize: 14,
        color: '#2E7D32',
        fontWeight: '600',
        marginBottom: 8,
    },
    viewProofButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    viewProofButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 16,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    detailsSection: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    detailLabel: {
        fontSize: 14,
        color: '#666',
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000',
    },
    depositSubmitted: {
        color: '#4CAF50',
        fontWeight: 'bold',
    },
    confirmButton: {
        marginTop: 8,
        backgroundColor: '#FF9900',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        minWidth: 160,
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    confirmButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    updateSection: {
        alignItems: 'center',
        padding: 16,
    },
    updateText: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },
    returnSection: {
        alignItems: 'center',
        width: '100%',
    },
    returnInfoText: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic',
    },
    eligibleText: {
        color: '#4CAF50',
        fontWeight: 'bold',
    },
    notEligibleText: {
        color: '#FF9800',
        fontWeight: 'bold',
    },
});

export default ItemTrackingScreen;