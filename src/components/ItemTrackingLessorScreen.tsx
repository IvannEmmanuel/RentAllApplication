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
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supbaseClient';
import { handleBookingStatusChange } from '../notifications/notifications';

const ItemTrackingLessorScreen = ({ route, navigation, visible, onClose, rentalId, currentUser }) => {
    // Handle both navigation route params and direct props
    const isModal = visible !== undefined;
    const bookingFromRoute = route?.params?.booking;

    const [currentBooking, setCurrentBooking] = useState(bookingFromRoute || null);
    const [loading, setLoading] = useState(false);
    const [fetchingBooking, setFetchingBooking] = useState(isModal && !bookingFromRoute);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [depositImageModalVisible, setDepositImageModalVisible] = useState(false);

    // Real-time subscription for booking updates
    useEffect(() => {
        const rentalIdToSubscribe = currentBooking?.rental_id || rentalId;

        if (!rentalIdToSubscribe) return;

        console.log('Setting up real-time subscription for rental:', rentalIdToSubscribe);

        const channel = supabase
            .channel(`lessor_tracking_${rentalIdToSubscribe}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rental_transactions',
                    filter: `rental_id=eq.${rentalIdToSubscribe}`,
                },
                async (payload) => {
                    console.log('Real-time booking update received:', payload);
                    console.log('Payload new:', payload.new); // DEBUG: See what's actually coming
                    setLastUpdated(new Date());

                    // Update the current booking with new status
                    setCurrentBooking(prev => ({
                        ...prev,
                        ...payload.new,
                    }));

                    // If the update doesn't include complete item details, fetch them
                    if (!payload.new.items && currentBooking?.item_id) {
                        await fetchUpdatedBookingDetails();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'items',
                    filter: `item_id=eq.${currentBooking?.item_id}`,
                },
                (payload) => {
                    console.log('Real-time item update received:', payload);
                    setLastUpdated(new Date());

                    // Update item details if they change
                    setCurrentBooking(prev => ({
                        ...prev,
                        items: {
                            ...prev.items,
                            ...payload.new
                        }
                    }));
                }
            )
            .subscribe((status) => {
                console.log('Lessor tracking subscription status:', status);
                setIsSubscribed(status === 'SUBSCRIBED');
            });

        return () => {
            console.log('Cleaning up lessor real-time subscription');
            supabase.removeChannel(channel);
            setIsSubscribed(false);
        };
    }, [currentBooking?.rental_id, currentBooking?.item_id, rentalId]);

    // Fetch booking data when used as modal
    useEffect(() => {
        if (isModal && rentalId && !bookingFromRoute) {
            fetchBookingData();
        }
    }, [isModal, rentalId, bookingFromRoute]);

    const fetchBookingData = async () => {
        setFetchingBooking(true);
        try {
            const { data, error } = await supabase
                .from('rental_transactions')
                .select(`
                rental_id,
                item_id,
                renter_id,
                start_date,
                end_date,
                total_cost,
                status,
                quantity,
                created_at,
                proof_of_deposit_url,
                items!inner(
                    title,
                    price_per_day,
                    user_id,
                    location,
                    quantity
                ),
                users!rental_transactions_renter_id_fkey(
                    first_name,
                    last_name,
                    face_image_url
                )
            `)
                .eq('rental_id', rentalId)
                .single();

            if (error) throw error;

            console.log('📦 Fetched booking data:', data); // ADD THIS
            console.log('🖼️ Proof of deposit URL:', data.proof_of_deposit_url); // ADD THIS

            // Get item image
            const imageUrl = await getItemImage(data.items.user_id, data.item_id);

            setCurrentBooking({
                ...data,
                items: {
                    ...data.items,
                    main_image_url: imageUrl,
                    users: data.users // Ensure users is in items
                },
                users: data.users // Also keep at root for compatibility
            });
        } catch (error) {
            console.error('Error fetching booking:', error);
            Alert.alert('Error', 'Failed to load booking details');
            if (onClose) onClose();
        } finally {
            setFetchingBooking(false);
        }
    };

    // Fetch updated booking details with complete information
    const fetchUpdatedBookingDetails = async () => {
        try {
            const rentalIdToFetch = currentBooking?.rental_id || rentalId;
            if (!rentalIdToFetch) return;

            const { data, error } = await supabase
                .from('rental_transactions')
                .select(`
                rental_id,
                item_id,
                renter_id,
                start_date,
                end_date,
                total_cost,
                status,
                quantity,
                created_at,
                proof_of_deposit_url,
                items!inner(
                    title,
                    price_per_day,
                    user_id,
                    location,
                    quantity
                ),
                users!rental_transactions_renter_id_fkey(
                    first_name,
                    last_name,
                    face_image_url
                )
            `)
                .eq('rental_id', rentalIdToFetch)
                .single();

            if (error) throw error;

            // Get item image if not already available
            const imageUrl = data.items?.main_image_url || await getItemImage(data.items.user_id, data.item_id);

            setCurrentBooking({
                ...data,
                items: {
                    ...data.items,
                    main_image_url: imageUrl,
                    users: data.users
                },
                users: data.users
            });
        } catch (error) {
            console.error('Error fetching updated booking details:', error);
        }
    };

    const getItemImage = async (userId, itemId) => {
        try {
            const dir = `${userId}/${itemId}`;
            const { data: files } = await supabase.storage
                .from('Items-photos')
                .list(dir, { limit: 1, sortBy: { column: 'name', order: 'desc' } });

            if (!files || files.length === 0) return null;

            const fullPath = `${dir}/${files[0].name}`;
            const { data: pub } = supabase.storage
                .from('Items-photos')
                .getPublicUrl(fullPath);

            return pub?.publicUrl;
        } catch {
            return null;
        }
    };

    // UPDATED: Phases to include Deposit Review
    const phases = [
        { id: 1, title: 'Ready for Pickup', status: 'confirmed' },
        { id: 2, title: 'Deposit Review', status: 'deposit_submitted' },
        { id: 3, title: 'On the Way', status: 'on_the_way' },
        { id: 4, title: 'Ongoing', status: 'ongoing' },
        { id: 5, title: 'Delivered', status: 'delivered' },
    ];

    // UPDATED: Get current phase based on booking status
    // UPDATED: Get current phase based on booking status
    const getCurrentPhase = () => {
        if (!currentBooking) return 1;
        switch (currentBooking.status) {
            case 'confirmed':
                return 1;
            case 'deposit_submitted':
                return 2;
            case 'on_the_way':
                return 3;
            case 'ongoing':
                return 4;
            case 'awaiting_owner_confirmation':
                return 5;
            case 'completed':
                return 5; // Completed also goes to delivered phase
            default:
                return 1;
        }
    };

    // UPDATED: Handle action press with deposit review logic
    const handleActionPress = async () => {
        if (!currentBooking) return;

        setLoading(true);
        try {
            const oldStatus = currentBooking.status;
            let newStatus = currentBooking.status;

            if (currentBooking.status === 'confirmed') {
                // Wait for deposit submission before proceeding
                Alert.alert('Info', 'Waiting for renter to submit deposit proof.');
                setLoading(false);
                return;
            } else if (currentBooking.status === 'deposit_submitted') {
                newStatus = 'ongoing';
            } else if (currentBooking.status === 'awaiting_owner_confirmation') {
                newStatus = 'completed';

                // // Restore item quantity in the Items table ONLY for completed status
                // if (currentBooking.items) {
                //     const { data: itemData, error: itemError } = await supabase
                //         .from('items')
                //         .select('quantity')
                //         .eq('item_id', currentBooking.item_id)
                //         .single();

                //     if (itemError) throw itemError;

                //     const updatedQuantity = (itemData.quantity || 0) + (currentBooking.quantity || 1);

                //     const { error: updateError } = await supabase
                //         .from('items')
                //         .update({ quantity: updatedQuantity })
                //         .eq('item_id', currentBooking.item_id);

                //     if (updateError) throw updateError;
                // }
            }

            // Update booking status - real-time subscription will handle the UI update
            const { error } = await supabase
                .from('rental_transactions')
                .update({ status: newStatus })
                .eq('rental_id', currentBooking.rental_id);

            if (error) throw error;

            // Note: Real-time subscription will automatically update the state
            console.log('Status update submitted:', newStatus);

            // Fetch complete rental for notifications
            const { data: fullRental, error: fetchError } = await supabase
                .from('rental_transactions')
                .select('*')
                .eq('rental_id', currentBooking.rental_id)
                .single();

            if (!fetchError && fullRental) {
                await handleBookingStatusChange(fullRental, oldStatus, newStatus);
            }

            Alert.alert('Success', `Status updated to ${newStatus.toUpperCase()}`);
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to update status');
        } finally {
            setLoading(false);
        }
    };

    // NEW: Handle deposit approval
    const handleApproveDeposit = async () => {
        if (!currentBooking) return;

        setLoading(true);
        try {
            const oldStatus = currentBooking.status;
            const newStatus = 'on_the_way';

            // Update booking status
            const { error } = await supabase
                .from('rental_transactions')
                .update({ status: newStatus })
                .eq('rental_id', currentBooking.rental_id);

            if (error) throw error;

            // Fetch complete rental for notifications
            const { data: fullRental, error: fetchError } = await supabase
                .from('rental_transactions')
                .select('*')
                .eq('rental_id', currentBooking.rental_id)
                .single();

            if (!fetchError && fullRental) {
                await handleBookingStatusChange(fullRental, oldStatus, newStatus);
            }

            Alert.alert('Success', 'Deposit approved! Item is now on the way.');
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to approve deposit');
        } finally {
            setLoading(false);
        }
    };

    // NEW: Handle deposit rejection
    const handleRejectDeposit = async () => {
        Alert.alert(
            'Reject Deposit',
            'Are you sure you want to reject this deposit proof? The renter will need to upload a new one.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const oldStatus = currentBooking.status;
                            const newStatus = 'confirmed';

                            // Update booking status back to confirmed
                            const { error } = await supabase
                                .from('rental_transactions')
                                .update({
                                    status: newStatus,
                                    proof_of_deposit_url: null
                                })
                                .eq('rental_id', currentBooking.rental_id);

                            if (error) throw error;

                            // Fetch complete rental for notifications
                            const { data: fullRental, error: fetchError } = await supabase
                                .from('rental_transactions')
                                .select('*')
                                .eq('rental_id', currentBooking.rental_id)
                                .single();

                            if (!fetchError && fullRental) {
                                await handleBookingStatusChange(fullRental, oldStatus, newStatus);
                            }

                            Alert.alert('Deposit Rejected', 'The renter has been notified to upload a new deposit proof.');
                        } catch (err) {
                            console.error(err);
                            Alert.alert('Error', 'Failed to reject deposit');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // UPDATED: Get action button label
    const getActionButtonLabel = () => {
        if (!currentBooking) return null;
        if (currentBooking.status === 'deposit_submitted') return 'Review Deposit';
        if (currentBooking.status === 'awaiting_owner_confirmation') return 'Item Received';
        return null;
    };

    const getActionButtonColor = () => {
        if (!currentBooking) return '#28A745';
        if (currentBooking.status === 'deposit_submitted') return '#FF9900';
        if (currentBooking.status === 'awaiting_owner_confirmation') return '#28A745';
        return '#28A745';
    };

    const handleClose = () => {
        if (onClose) {
            onClose();
        } else if (navigation) {
            navigation.goBack();
        }
    };

    const getRenterName = () => {
        if (!currentBooking) return 'N/A';

        // Try different possible locations for user data
        if (currentBooking.users) {
            // From direct navigation (YourItemsModal)
            return `${currentBooking.users.first_name} ${currentBooking.users.last_name}`;
        } else if (currentBooking.items?.users) {
            // From modal fetch or other sources
            return `${currentBooking.items.users.first_name} ${currentBooking.items.users.last_name}`;
        } else if (currentBooking.renter_name) {
            // Fallback to renter_name if available
            return currentBooking.renter_name;
        }

        return 'N/A';
    };

    const getStatusColor = () => {
        if (!currentBooking) return '#757575';

        switch (currentBooking.status) {
            case 'confirmed':
                return '#4CAF50';
            case 'deposit_submitted':
                return '#FF9800';
            case 'ongoing':
                return '#2196F3';
            case 'delivered':
                return '#2196F3';
            case 'awaiting_owner_confirmation':
                return '#FF7043';
            case 'completed':
                return '#4CAF50';
            default:
                return '#757575';
        }
    };

    const currentPhase = getCurrentPhase();

    const renderProgressBar = () => (
        <View style={styles.progressContainer}>
            {/* <View style={styles.progressLine}>
                <View
                    style={[
                        styles.progressFill,
                        { width: `${((currentPhase - 1) / (phases.length - 1)) * 100}%` },
                    ]}
                />
            </View> */}
            <View style={styles.phaseIndicators}>
                {phases.map(phase => (
                    <View key={phase.id} style={styles.phaseItem}>
                        <View
                            style={[
                                styles.phaseCircle,
                                phase.id <= currentPhase ? styles.phaseCircleActive : styles.phaseCircleInactive,
                            ]}
                        >
                            <View
                                style={[
                                    styles.phaseCircleInner,
                                    phase.id <= currentPhase ? styles.phaseCircleInnerActive : styles.phaseCircleInnerInactive,
                                ]}
                            />
                        </View>
                        <Text
                            style={[
                                styles.phaseLabel,
                                phase.id <= currentPhase ? styles.phaseLabelActive : styles.phaseLabelInactive,
                            ]}
                        >
                            {phase.title}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );

    // NEW: Render deposit review section
    const renderDepositReviewSection = () => {
        if (currentBooking.status !== 'deposit_submitted') return null;

        return (
            <View style={styles.depositSection}>
                <Text style={styles.sectionTitle}>Deposit Proof Review</Text>

                {currentBooking.proof_of_deposit_url ? (
                    <View style={styles.depositProofContainer}>
                        <Text style={styles.depositText}>
                            Renter has submitted deposit proof. Please review:
                        </Text>

                        <TouchableOpacity
                            style={styles.depositImageContainer}
                            onPress={() => setDepositImageModalVisible(true)}
                        >
                            <Image
                                source={{ uri: currentBooking.proof_of_deposit_url }}
                                style={styles.depositImage}
                                resizeMode="cover"
                            />
                            <View style={styles.depositImageOverlay}>
                                <Text style={styles.depositImageText}>Tap to view full image</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.depositActions}>
                            <TouchableOpacity
                                style={[styles.depositButton, styles.rejectButton]}
                                onPress={handleRejectDeposit}
                                disabled={loading}
                            >
                                <Text style={styles.depositButtonText}>Reject</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.depositButton, styles.approveButton]}
                                onPress={handleApproveDeposit}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.depositButtonText}>Approve & Continue</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <Text style={styles.noDepositText}>
                        Waiting for renter to upload deposit proof...
                    </Text>
                )}
            </View>
        );
    };

    const renderContent = () => {
        if (fetchingBooking) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF9900" />
                    <Text style={styles.loadingText}>Loading booking details...</Text>
                </View>
            );
        }

        if (!currentBooking) {
            return (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Booking not found</Text>
                </View>
            );
        }

        return (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Progress Bar */}
                {renderProgressBar()}

                {/* Item Section */}
                <View style={styles.itemSection}>
                    <Image
                        source={
                            currentBooking.items?.main_image_url
                                ? { uri: currentBooking.items.main_image_url }
                                : require('../../assets/splash-icon.png')
                        }
                        style={styles.itemImage}
                    />
                    <View style={styles.itemInfo}>
                        <Text style={styles.itemTitle}>{currentBooking.items?.title || 'Item Title'}</Text>
                        <Text style={styles.itemPrice}>₱{currentBooking.items?.price_per_day || 'N/A'} per day</Text>
                        <Text style={styles.itemDates}>
                            {new Date(currentBooking.start_date).toLocaleDateString()} -{' '}
                            {new Date(currentBooking.end_date).toLocaleDateString()}
                        </Text>
                    </View>
                </View>

                {/* Status Section */}
                <View style={styles.statusSection}>
                    <View style={styles.statusHeader}>
                        <Text style={styles.statusTitle}>
                            Current Status: {currentBooking.status.toUpperCase()}
                        </Text>
                    </View>

                    {getActionButtonLabel() && currentBooking.status === 'awaiting_owner_confirmation' && (
                        <TouchableOpacity
                            style={[styles.confirmButton, { backgroundColor: getActionButtonColor() }]}
                            onPress={handleActionPress}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.confirmButtonText}>{getActionButtonLabel()}</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Deposit Review Section */}
                {renderDepositReviewSection()}

                {/* Details Section */}
                <View style={styles.detailsSection}>
                    <Text style={styles.sectionTitle}>Booking Details</Text>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Quantity:</Text>
                        <Text style={styles.detailValue}>{currentBooking.quantity || 1}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Total Cost:</Text>
                        <Text style={styles.detailValue}>₱{currentBooking.total_cost}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Location:</Text>
                        <Text style={styles.detailValue}>{currentBooking.items?.location || 'N/A'}</Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Renter:</Text>
                        <Text style={styles.detailValue}>
                            {getRenterName()}
                        </Text>
                    </View>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Rental ID:</Text>
                        <Text style={styles.detailValue}>{currentBooking.rental_id}</Text>
                    </View>

                    {currentBooking.proof_of_deposit_url && (
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Deposit Status:</Text>
                            <Text style={[styles.detailValue, styles.depositSubmitted]}>
                                {currentBooking.status === 'deposit_submitted' ? 'Under Review' : 'Submitted ✓'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Last Updated */}
                <View style={styles.updateSection}>
                    <Text style={styles.updateText}>
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </Text>
                </View>

                {/* Deposit Image Modal */}
                <Modal
                    visible={depositImageModalVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setDepositImageModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Deposit Proof</Text>
                                <TouchableOpacity
                                    style={styles.closeModalButton}
                                    onPress={() => setDepositImageModalVisible(false)}
                                >
                                    <Text style={styles.closeModalButtonText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                            <Image
                                source={{ uri: currentBooking.proof_of_deposit_url }}
                                style={styles.fullSizeImage}
                                resizeMode="contain"
                            />
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        );
    };

    // Render as modal if visible prop is provided
    if (isModal) {
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
                <SafeAreaView style={styles.container}>
                    {/* Header for modal */}
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Order Tracking</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    {renderContent()}
                </SafeAreaView>
            </Modal>
        );
    }

    // Render as regular screen
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Order Tracking</Text>
                <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                    <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
            </View>
            {renderContent()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
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
    content: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { fontSize: 16, color: '#666' },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#F5F5F5',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', flex: 1, textAlign: 'center' },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    closeButtonText: { fontSize: 18, color: '#666', fontWeight: 'bold' },
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
    phaseItem: { flex: 1, alignItems: 'center' },
    phaseCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    phaseCircleActive: { backgroundColor: '#FF9900' },
    phaseCircleInactive: { backgroundColor: '#E0E0E0' },
    phaseCircleInner: { width: 8, height: 8, borderRadius: 4 },
    phaseCircleInnerActive: { backgroundColor: '#FFF' },
    phaseCircleInnerInactive: { backgroundColor: '#999' },
    phaseLabel: { fontSize: 12, textAlign: 'center', fontWeight: '500' },
    phaseLabelActive: { color: '#FF9900' },
    phaseLabelInactive: { color: '#999' },
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
    itemImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 16 },
    itemInfo: { alignItems: 'center', width: '100%' },
    itemTitle: { fontSize: 20, fontWeight: 'bold', color: '#000', marginBottom: 8, textAlign: 'center' },
    itemPrice: { fontSize: 16, color: '#666', marginBottom: 4 },
    itemDates: { fontSize: 14, color: '#999' },
    statusSection: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#000',
        marginRight: 8,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    // NEW: Deposit Review Styles
    depositSection: {
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
    depositProofContainer: {
        alignItems: 'center',
    },
    depositText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 16,
    },
    noDepositText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    depositImageContainer: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
        position: 'relative',
    },
    depositImage: {
        width: '100%',
        height: '100%',
    },
    depositImageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        alignItems: 'center',
    },
    depositImageText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    depositActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        gap: 12,
    },
    depositButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    rejectButton: {
        backgroundColor: '#FF4444',
    },
    approveButton: {
        backgroundColor: '#4CAF50',
    },
    depositButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        height: '80%',
        backgroundColor: '#FFF',
        borderRadius: 12,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F5F5F5',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    closeModalButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    closeModalButtonText: {
        fontSize: 18,
        color: '#666',
        fontWeight: 'bold',
    },
    fullSizeImage: {
        width: '100%',
        height: '100%',
        flex: 1,
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
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#000', marginBottom: 12 },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0'
    },
    detailLabel: { fontSize: 14, color: '#666' },
    detailValue: { fontSize: 14, fontWeight: '600', color: '#000' },
    depositSubmitted: {
        color: '#4CAF50',
        fontWeight: 'bold',
    },
    confirmButton: {
        marginTop: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        minWidth: 160,
    },
    confirmButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    updateSection: {
        alignItems: 'center',
        padding: 16,
    },
    updateText: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },
});

export default ItemTrackingLessorScreen;