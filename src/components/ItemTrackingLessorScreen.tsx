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

    const phases = [
        { id: 1, title: 'Ready for Pickup', status: 'confirmed' },
        { id: 2, title: 'On the Way', status: 'ongoing' },
        { id: 3, title: 'Delivered', status: 'delivered' },
    ];

    const getCurrentPhase = () => {
        if (!currentBooking) return 1;
        switch (currentBooking.status) {
            case 'confirmed':
                return 1;
            case 'ongoing':
                return 2;
            case 'delivered':
            case 'awaiting_owner_confirmation':
            case 'completed':
                return 3;
            default:
                return 1;
        }
    };

    const handleActionPress = async () => {
        if (!currentBooking) return;

        setLoading(true);
        try {
            const oldStatus = currentBooking.status;
            let newStatus = currentBooking.status;

            if (currentBooking.status === 'confirmed') {
                newStatus = 'ongoing';
            } else if (currentBooking.status === 'awaiting_owner_confirmation') {
                newStatus = 'completed';

                // Restore item quantity in the Items table
                if (currentBooking.items) {
                    const { data: itemData, error: itemError } = await supabase
                        .from('items')
                        .select('quantity')
                        .eq('item_id', currentBooking.item_id)
                        .single();

                    if (itemError) throw itemError;

                    const updatedQuantity = (itemData.quantity || 0) + (currentBooking.quantity || 1);

                    const { error: updateError } = await supabase
                        .from('items')
                        .update({ quantity: updatedQuantity })
                        .eq('item_id', currentBooking.item_id);

                    if (updateError) throw updateError;
                }
            }

            // Update booking status
            const { error } = await supabase
                .from('rental_transactions')
                .update({ status: newStatus })
                .eq('rental_id', currentBooking.rental_id);

            if (error) throw error;

            setCurrentBooking(prev => ({ ...prev, status: newStatus }));

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

    const getActionButtonLabel = () => {
        if (!currentBooking) return null;
        if (currentBooking.status === 'confirmed') return 'Mark as On The Way';
        if (currentBooking.status === 'awaiting_owner_confirmation') return 'Item Received';
        return null;
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

    const currentPhase = getCurrentPhase();

    const renderProgressBar = () => (
        <View style={styles.progressContainer}>

            <View style={styles.progressLine}>
                <View
                    style={[
                        styles.progressFill,
                        { width: `${((currentPhase - 1) / (phases.length - 1)) * 100}%` },
                    ]}
                />
            </View>
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
                        <Text style={styles.itemPrice}>{currentBooking.items?.price_per_day || 'N/A'} per day</Text>
                        <Text style={styles.itemDates}>
                            {new Date(currentBooking.start_date).toLocaleDateString()} -{' '}
                            {new Date(currentBooking.end_date).toLocaleDateString()}
                        </Text>
                    </View>
                </View>

                {/* Status Section */}
                <View style={styles.statusSection}>
                    <Text style={styles.statusTitle}>
                        Status: {currentBooking.status.replace(/_/g, ' ').toUpperCase()}
                    </Text>

                    {getActionButtonLabel() && (
                        <TouchableOpacity style={styles.confirmButton} onPress={handleActionPress} disabled={loading}>
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmButtonText}>{getActionButtonLabel()}</Text>}
                        </TouchableOpacity>
                    )}
                </View>

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
                </View>
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
        backgroundColor: '#F5F5F5',
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', flex: 1 },
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
    },
    progressLine: {
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        marginBottom: 20,
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
    },
    statusTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', color: '#000' },
    detailsSection: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        elevation: 2,
    },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#000', marginBottom: 12 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    detailLabel: { fontSize: 14, color: '#666' },
    detailValue: { fontSize: 14, fontWeight: '600', color: '#000' },
    confirmButton: { marginTop: 16, backgroundColor: '#28A745', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center' },
    confirmButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});

export default ItemTrackingLessorScreen;