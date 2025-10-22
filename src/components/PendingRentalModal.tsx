import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  TouchableOpacity,
  Alert
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supbaseClient';
import { useFavorites } from './FavoritesContext';

const PendingRentalModal = ({ visible, onClose }) => {
  const { currentUser } = useFavorites();
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);

  const cancelBooking = async (rentalId) => {
    try {
      const { error } = await supabase
        .from('rental_transactions')
        .update({ status: 'canceled' })
        .eq('rental_id', rentalId);

      if (error) {
        console.error('Error canceling booking:', error);
      } else {
        // Optimistically update UI
        setRentals(prev => prev.filter(r => r.rental_id !== rentalId));
      }
    } catch (err) {
      console.error('Unexpected error canceling booking:', err);
    }
  };

  const confirmCancelBooking = (rentalId) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes, Cancel", style: "destructive", onPress: () => cancelBooking(rentalId) }
      ]
    );
  };

  const checkAndRejectExpiredRentals = async () => {
    const now = new Date();

    for (const rental of rentals) {
      const startDate = new Date(rental.start_date);

      if (startDate < now && rental.status === 'pending') {
        try {
          const { error } = await supabase
            .from('rental_transactions')
            .update({ status: 'rejected' })
            .eq('rental_id', rental.rental_id);

          if (error) {
            console.error('Error auto-rejecting rental:', error);
          } else {
            // Update UI immediately
            setRentals(prev =>
              prev.filter(r => r.rental_id !== rental.rental_id)
            );
          }
        } catch (err) {
          console.error('Unexpected error auto-rejecting rental:', err);
        }
      }
    }
  };


  // Fetch initial data and set up real-time subscription
  useEffect(() => {
    if (!currentUser || !visible) return;

    let subscription;

    const fetchPendingRentals = async () => {
      setLoading(true);
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
          items (
            title,
            price_per_day,
            location,
            main_image_url,
            user: user_id (
              first_name,
              last_name
            )
          )
        `)
        .eq('renter_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending rentals:', error);
      } else {
        setRentals(data);
        checkAndRejectExpiredRentals();
      }
      setLoading(false);
    };

    const setupRealtimeSubscription = () => {
      // Subscribe to changes in rental_transactions table
      subscription = supabase
        .channel('pending-rentals-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'rental_transactions',
            filter: `renter_id=eq.${currentUser.id}`,
          },
          (payload) => {
            handleRealtimeUpdate(payload);
          }
        )
        .subscribe();
    };

    const handleRealtimeUpdate = (payload) => {
      console.log('Real-time update received:', payload);

      const rental = payload.new || payload.old;

      // Auto-reject if start_date already passed
      if (payload.new && payload.new.status === 'pending') {
        const now = new Date();
        const startDate = new Date(payload.new.start_date);

        if (startDate < now) {
          supabase
            .from('rental_transactions')
            .update({ status: 'rejected' })
            .eq('rental_id', payload.new.rental_id)
            .then(({ error }) => {
              if (error) console.error('Error auto-rejecting in realtime:', error);
            });
          return; // don’t bother adding it to state
        }
      }

      switch (payload.eventType) {
        case 'INSERT':
          if (payload.new.status === 'pending') {
            fetchItemDetailsAndAddRental(payload.new);
          }
          break;

        case 'UPDATE':
          if (payload.new.status !== 'pending') {
            setRentals(prev => prev.filter(r => r.rental_id !== payload.new.rental_id));
          } else {
            setRentals(prev => prev.map(r =>
              r.rental_id === payload.new.rental_id ? { ...r, ...payload.new } : r
            ));
          }
          break;

        case 'DELETE':
          setRentals(prev => prev.filter(r => r.rental_id !== payload.old.rental_id));
          break;
      }
    };

    const fetchItemDetailsAndAddRental = async (newRental) => {
      try {
        // Fetch item details for the new rental
        const { data: itemData, error: itemError } = await supabase
          .from('items')
          .select(`
            title,
            price_per_day,
            location,
            main_image_url,
            user: user_id (
              first_name,
              last_name
            )
          `)
          .eq('item_id', newRental.item_id)
          .single();

        if (!itemError && itemData) {
          const completeRental = {
            ...newRental,
            items: itemData
          };

          setRentals(prev => [completeRental, ...prev]);
        }
      } catch (error) {
        console.error('Error fetching item details for new rental:', error);
      }
    };

    // Initial fetch and setup
    fetchPendingRentals();
    setupRealtimeSubscription();

    // Cleanup function
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [currentUser, visible]);

  // Optional: Manual refresh function
  const refreshRentals = async () => {
    if (!currentUser) return;

    setLoading(true);
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
        items (
          title,
          price_per_day,
          location,
          main_image_url,
          user: user_id (
            first_name,
            last_name
          )
        )
      `)
      .eq('renter_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error) {
      setRentals(data);
      checkAndRejectExpiredRentals();
    }
    setLoading(false);
  };

  // Add pull-to-refresh functionality
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshRentals();
    setRefreshing(false);
  };

  const getTimeAgo = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffTime = now - created;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const getDaysUntilStart = (startDate) => {
    const today = new Date();
    const start = new Date(startDate);
    const diffTime = start - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>Pending Rentals</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.center}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFAB00" />
              <Text style={styles.loadingText}>Loading pending requests...</Text>
            </View>
          </View>
        ) : rentals.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>⏳</Text>
              <Text style={styles.emptyTitle}>No Pending Rentals</Text>
              <Text style={styles.emptySubtitle}>
                You don't have any pending rental requests at the moment
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#FFAB00']}
                tintColor="#FFAB00"
              />
            }
          >
            {rentals.map((rental, index) => {
              const daysUntilStart = getDaysUntilStart(rental.start_date);
              const timeAgo = getTimeAgo(rental.created_at);

              return (
                <View key={rental.rental_id} style={[styles.card, { marginTop: index === 0 ? 8 : 12 }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>⏱️ Pending Approval</Text>
                    </View>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeText}>{timeAgo}</Text>
                    </View>

                    <View style={styles.actionsContainer}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => confirmCancelBooking(rental.rental_id)}
                      >
                        <Text style={styles.cancelButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <Image
                      source={
                        rental.items?.main_image_url
                          ? { uri: rental.items.main_image_url }
                          : require('../../assets/splash-icon.png')
                      }
                      style={styles.image}
                    />

                    <View style={styles.info}>
                      <Text style={styles.title} numberOfLines={2}>
                        {rental.items?.title}
                      </Text>
                      <Text style={styles.detailText}>
                        {rental.items?.user?.first_name} {rental.items?.user?.last_name}
                      </Text>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailIcon}>📅</Text>
                        <Text style={styles.detailText}>
                          {new Date(rental.start_date).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric'
                          })} → {new Date(rental.end_date).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric'
                          })}
                        </Text>
                      </View>

                      {daysUntilStart > 0 && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailIcon}>🚀</Text>
                          <Text style={styles.detailText}>
                            Starts in {daysUntilStart} day{daysUntilStart !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}

                      <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Quantity</Text>
                          <Text style={styles.detailValue}>{rental.quantity}</Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Total Cost</Text>
                          <Text style={styles.priceText}>₱{rental.total_cost}</Text>
                        </View>
                      </View>

                      <View style={styles.locationContainer}>
                        <Text style={styles.detailIcon}>📍</Text>
                        <Text style={styles.locationText} numberOfLines={1}>
                          {rental.items?.location}
                        </Text>
                      </View>

                      <View style={styles.waitingContainer}>
                        <Text style={styles.waitingText}>
                          Waiting for owner's approval...
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

export default PendingRentalModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5EF'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginTop: 30
  },
  headerText: {
    fontFamily: 'DM-Bold',
    fontSize: 18,
  },
  closeButton: {
    fontSize: 20,
    color: '#FF4444',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  statusBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
  },
  timeBadge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 11,
    color: '#757575',
    fontWeight: '500',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  info: {
    flex: 1,
  },
  title: {
    fontFamily: 'DM-Bold',
    fontSize: 16,
    marginBottom: 8,
    color: '#2C3E50',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#5D6D7E',
    flex: 1,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFAB00',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 12,
    color: '#5D6D7E',
    flex: 1,
  },
  waitingContainer: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  waitingText: {
    fontSize: 12,
    color: '#F57C00',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7F8C8D',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 20,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    marginRight: 16,
    padding: 4,
  },
  refreshIcon: {
    fontSize: 18,
    color: '#FFAB00',
  },
  actionsContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    backgroundColor: '#FF4444',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});