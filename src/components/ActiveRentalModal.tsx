// src/components/ActiveRentalModal.tsx

import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supbaseClient';
import { useFavorites } from './FavoritesContext';
import { handleBookingStatusChange } from '../notifications/notifications';
import { useNavigation } from '@react-navigation/native';

const ActiveRentalModal = ({ visible, onClose }) => {
  const { currentUser } = useFavorites();
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [returningIds, setReturningIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState({}); // Store category names by ID

  const navigation = useNavigation();

  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('category_id, name');

      if (error) throw error;

      const categoriesMap = {};
      data.forEach(cat => {
        categoriesMap[cat.category_id] = cat.name;
      });
      setCategories(categoriesMap);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Helper: format payment method
  const formatPaymentMethod = (method: string | null | undefined) => {
    if (method === 'meet_up') return 'Meet-up';
    if (method === 'cash_on_delivery') return 'Cash On Delivery';
    return method || '—';
  };

  // Fetch initial data and set up real-time subscription
  useEffect(() => {
    if (!currentUser || !visible) return;

    let subscription;

    const fetchActiveRentals = async () => {
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
          payment_method,
          items (
            title,
            price_per_day,
            location,
            main_image_url,
            category_id,
            users:user_id (
              first_name,
              last_name,
              face_image_url
            )
          )
        `)
        .eq('renter_id', currentUser.id)
        .in('status', ['confirmed', 'ongoing', 'delivered', 'deposit_submitted', 'on_the_way', 'awaiting_owner_confirmation'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching active rentals:', error);
      } else {
        // Add accommodation info to rentals
        const rentalsWithAccommodationInfo = data.map(rental => ({
          ...rental,
          is_accommodation: categories[rental.items?.category_id] === 'Accommodation'
        }));
        setRentals(rentalsWithAccommodationInfo);
      }
      setLoading(false);
    };

    const setupRealtimeSubscription = () => {
      // Subscribe to changes in rental_transactions table
      subscription = supabase
        .channel('active-rentals-changes')
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
      console.log('Real-time update received for active rentals:', payload);

      switch (payload.eventType) {
        case 'INSERT':
          // New rental added - check if it should be in active status
          if (['confirmed', 'ongoing', 'delivered'].includes(payload.new.status)) {
            fetchItemDetailsAndAddRental(payload.new);
          }
          break;

        case 'UPDATE':
          // Rental updated
          const newStatus = payload.new.status;

          if (['confirmed', 'ongoing', 'delivered'].includes(newStatus)) {
            // Update existing rental or add if it's a status change from pending
            setRentals(prev => {
              const existingIndex = prev.findIndex(rental =>
                rental.rental_id === payload.new.rental_id
              );

              if (existingIndex >= 0) {
                // Update existing rental
                const updatedRental = {
                  ...prev[existingIndex],
                  ...payload.new,
                  is_accommodation:
                    categories[payload.new.items?.category_id] === 'Accommodation'
                };
                return prev.map(rental =>
                  rental.rental_id === payload.new.rental_id
                    ? updatedRental
                    : rental
                );
              } else {
                // This was a pending rental that got confirmed - fetch details
                fetchItemDetailsAndAddRental(payload.new);
                return prev;
              }
            });
          } else {
            // Remove from list if status is no longer active
            setRentals(prev => prev.filter(rental =>
              rental.rental_id !== payload.new.rental_id
            ));
          }
          break;

        case 'DELETE':
          // Rental deleted
          setRentals(prev => prev.filter(rental =>
            rental.rental_id !== payload.old.rental_id
          ));
          break;

        default:
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
            category_id,
            users:user_id (
              first_name,
              last_name,
              face_image_url
            )
          `)
          .eq('item_id', newRental.item_id)
          .single();

        if (!itemError && itemData) {
          const completeRental = {
            ...newRental,
            items: itemData,
            is_accommodation: categories[itemData.category_id] === 'Accommodation'
          };

          setRentals(prev => [completeRental, ...prev]);
        }
      } catch (error) {
        console.error('Error fetching item details for new rental:', error);
      }
    };

    // Initial fetch and setup
    fetchActiveRentals();
    setupRealtimeSubscription();

    // Cleanup function
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [currentUser, visible, categories]);

  // Manual refresh function
  const refreshRentals = async () => {
    if (!currentUser) return;

    setRefreshing(true);
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
        payment_method,
        items (
          title,
          price_per_day,
          location,
          main_image_url,
          category_id,
          users:user_id (
            first_name,
            last_name,
            face_image_url
          )
        )
      `)
      .eq('renter_id', currentUser.id)
      .in('status', ['confirmed', 'ongoing', 'delivered'])
      .order('created_at', { ascending: false });

    if (!error) {
      const rentalsWithAccommodationInfo = data.map(rental => ({
        ...rental,
        is_accommodation: categories[rental.items?.category_id] === 'Accommodation'
      }));
      setRentals(rentalsWithAccommodationInfo);
    }
    setRefreshing(false);
  };

  const onRefresh = async () => {
    await refreshRentals();
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'confirmed': '#4CAF50',
      'ongoing': '#FF9800',
      'delivered': '#2196F3'
    };
    return statusColors[status] || '#FF9800';
  };

  const getStatusBgColor = (status) => {
    const statusBgColors = {
      'confirmed': '#E8F5E8',
      'ongoing': '#FFF3E0',
      'delivered': '#E3F2FD'
    };
    return statusBgColors[status] || '#FFF3E0';
  };

  const getStatusDisplayText = (status) => {
    const statusTexts = {
      'confirmed': '✓ Confirmed',
      'ongoing': '🔄 Ongoing',
      'delivered': '📦 Delivered'
    };
    return statusTexts[status] || '🔄 Active';
  };

  const getRemainingDays = (endDate) => {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleCardPress = (rental) => {
    onClose();
    navigation.navigate('ItemTrackingScreen', {
      rental,
      isAccommodation: rental.is_accommodation
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>My Bookings</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={onClose} style={styles.closeButtonContainer}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.center}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFAB00" />
              <Text style={styles.loadingText}>Loading your rentals...</Text>
            </View>
          </View>
        ) : rentals.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No Active Rentals</Text>
              <Text style={styles.emptySubtitle}>You don't have any active rentals at the moment</Text>
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
              const remainingDays = getRemainingDays(rental.end_date);
              const isReturning = returningIds.includes(rental.rental_id);
              const isAccommodation = rental.is_accommodation;

              return (
                <TouchableOpacity
                  key={rental.rental_id}
                  style={[
                    styles.card,
                    { marginTop: index === 0 ? 8 : 12 },
                    isAccommodation && styles.accommodationCard
                  ]}
                  onPress={() => handleCardPress(rental)}
                  activeOpacity={0.7}
                  disabled={isReturning}
                >
                  {/* Accommodation Badge */}
                  {isAccommodation && (
                    <View style={styles.accommodationBadge}>
                      <Text style={styles.accommodationBadgeText}>🏠 Accommodation</Text>
                    </View>
                  )}

                  <View style={styles.cardHeader}>
                    {remainingDays > 0 && (
                      <View style={styles.daysBadge}>
                        <Text style={styles.daysText}>
                          {remainingDays} day{remainingDays !== 1 ? 's' : ''} left
                        </Text>
                      </View>
                    )}
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
                      <View style={styles.lessorRow}>
                        <Image
                          source={
                            rental.items?.users?.face_image_url
                              ? { uri: rental.items.users.face_image_url }
                              : require('../../assets/splash-icon.png')
                          }
                          style={styles.lessorImage}
                        />
                        <Text style={styles.lessorName}>
                          {rental.items?.users?.first_name} {rental.items?.users?.last_name}
                        </Text>
                      </View>

                      <Text style={styles.title} numberOfLines={2}>
                        {rental.items?.title}
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

                      {/* Payment method display */}
                      <View style={styles.paymentRow}>
                        <Text style={styles.detailLabel}>Payment Method</Text>
                        <Text style={styles.detailValue}>
                          {formatPaymentMethod(rental.payment_method)}
                        </Text>
                      </View>

                      <View style={styles.locationContainer}>
                        <Text style={styles.detailIcon}>📍</Text>
                        <Text style={styles.locationText} numberOfLines={1}>
                          {rental.items?.location}
                        </Text>
                      </View>

                      {/* Track indicator - Show different message for accommodation */}
                      <View style={styles.trackIndicator}>
                        {isAccommodation ? (
                          <Text style={styles.accommodationTrackText}>
                            Accommodation - No tracking available
                          </Text>
                        ) : (
                          <>
                            <Text style={styles.trackText}>Tap to track order</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

export default ActiveRentalModal;

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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    marginRight: 12,
    padding: 4,
  },
  refreshIcon: {
    fontSize: 18,
    color: '#FFAB00',
  },
  closeButtonContainer: {
    width: 30,
    height: 30,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    borderRadius: 20
  },
  closeButton: {
    fontSize: 18,
    color: '#000000ff',
    alignSelf: 'center',
    fontFamily: 'DM-Bold'
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
  },
  accommodationCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B4513',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  daysBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysText: {
    fontSize: 11,
    color: '#1976D2',
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
    marginBottom: 12,
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
    marginBottom: 8,
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
  // new payment row
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 12,
    color: '#5D6D7E',
    flex: 1,
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
  returnButton: {
    marginTop: 8,
    backgroundColor: '#FF7043',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  returnButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  returnButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  lessorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  lessorImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  lessorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#34495E',
  },
  trackIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8E1',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 4,
  },
  trackText: {
    fontSize: 12,
    color: '#F57C00',
    fontWeight: '500',
    marginRight: 4,
  },
  trackIcon: {
    fontSize: 12,
  },
  accommodationTrackText: {
    fontSize: 12,
    color: '#8B4513',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  accommodationBadge: {
    backgroundColor: '#8B4513',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginTop: 8,
  },
  accommodationBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
