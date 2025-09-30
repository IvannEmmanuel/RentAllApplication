import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supbaseClient';
import { handleBookingStatusChange } from '../notifications/notifications';

const ItemTrackingScreen = ({ route, navigation }) => {
    const { rental } = route.params;
    const [currentRental, setCurrentRental] = useState(rental);
    const [loading, setLoading] = useState(false);

    console.log(currentRental)

    // Phase configurations for renter
    const phases = [
        { id: 1, title: 'Item Accepted', status: 'confirmed' },
        { id: 2, title: 'On the Way', status: 'ongoing' },
        { id: 3, title: 'Delivered', status: 'delivered' },
    ];

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
                // Update local state
                setCurrentRental(prev => ({ ...prev, status: 'awaiting_owner_confirmation' }));

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
                // Update local state
                setCurrentRental(prev => ({ ...prev, status: 'delivered' }));

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
            }
        } catch (err) {
            console.log(err);
            alert('Something went wrong.');
        } finally {
            setLoading(false);
        }
    };


    // Get current phase based on rental status
    const getCurrentPhase = () => {
        switch (currentRental.status) {
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

    // Real-time subscription for status updates
    useEffect(() => {
        const channel = supabase
            .channel('rental_tracking')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rental_transactions',
                    filter: `rental_id=eq.${currentRental.rental_id}`,
                },
                (payload) => {
                    console.log('Rental status updated:', payload);
                    setCurrentRental(prev => ({
                        ...prev,
                        status: payload.new.status
                    }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentRental.rental_id]);

    const currentPhase = getCurrentPhase();

    const renderProgressBar = () => {
        return (
            <View style={styles.progressContainer}>
                {/* Progress Line */}
                <View style={styles.progressLine}>
                    <View
                        style={[
                            styles.progressFill,
                            { width: `${((currentPhase - 1) / (phases.length - 1)) * 100}%` }
                        ]}
                    />
                </View>

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

    const getStatusMessage = () => {
        switch (currentRental.status) {
            case 'confirmed':
                return 'accepted';
            case 'ongoing':
                return 'on the way';
            case 'delivered':
                return 'delivered';
            case 'awaiting_owner_confirmation':
                return 'awaiting owner confirmation';
            default:
                return 'being processed';
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
                    {/* <Ionicons name="arrow-back" size={24} color="#000" /> */}
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
                            {currentRental.items?.price_per_day || 'N/A'} for 1 day
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

                    {currentRental.status === 'ongoing' && (
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

                    {currentRental.status === 'delivered' && (
                        <TouchableOpacity
                            style={[
                                styles.confirmButton,
                                currentRental.status === 'awaiting_owner_confirmation' && { backgroundColor: '#ccc' },
                            ]}
                            onPress={handleReturn}
                            disabled={currentRental.status === 'awaiting_owner_confirmation' || loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.confirmButtonText}>Return</Text>
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
    },
    detailsSection: {
        backgroundColor: '#FFF',
        marginHorizontal: 16,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
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
    confirmButton: {
        marginTop: 16,
        backgroundColor: '#FF9900',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default ItemTrackingScreen;