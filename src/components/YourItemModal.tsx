import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { supabase } from '../../supbaseClient';
import { handleBookingStatusChange } from '../notifications/notifications';
import { useNavigation } from '@react-navigation/native';

const ITEMS_PER_PAGE = 6;

const YourItemsModal = ({ visible, onClose, currentUser, rentalId = null, initialTab = 'pending' }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState(initialTab);
  const [highlightedRentalId, setHighlightedRentalId] = useState(rentalId);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
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

  // Reset highlighted rental after 5s
  useEffect(() => {
    if (highlightedRentalId) {
      const timer = setTimeout(() => setHighlightedRentalId(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [highlightedRentalId]);

  // Fetch bookings with pagination
  const fetchBookings = useCallback(async (showLoading = true, page = 0, append = false) => {
    if (!currentUser) return;
    if (showLoading) setLoading(true);
    if (append) setLoadingMore(true);

    try {
      let statusFilter;
      if (activeTab === 'pending') statusFilter = ['pending'];
      else if (activeTab === 'active') statusFilter = ['confirmed', 'ongoing', 'delivered', 'awaiting_owner_confirmation'];
      else statusFilter = ['completed'];

      const from = page * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data: transactions, error, count } = await supabase
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
            quantity,
            category_id
          ),
          users!rental_transactions_renter_id_fkey(
            first_name,
            last_name,
            face_image_url
          )
        `, { count: 'exact' })
        .eq('items.user_id', currentUser.id)
        .in('status', statusFilter)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const bookingsWithImages = await Promise.all(
        (transactions || []).map(async (booking) => {
          const imageUrl = await getItemImage(booking.items.user_id, booking.item_id);

          // Check if item is Accommodation
          const isAccommodation = categories[booking.items.category_id] === 'Accommodation';

          // Check if current date is equal to or past end_date for accommodation
          const today = new Date();
          const endDate = new Date(booking.end_date);
          today.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);

          const isCheckoutAvailable = isAccommodation &&
            activeTab === 'active' &&
            today >= endDate;

          return {
            ...booking,
            item_image: imageUrl,
            renter_name: `${booking.users.first_name} ${booking.users.last_name}`,
            formatted_dates: {
              start: new Date(booking.start_date).toLocaleDateString(),
              end: new Date(booking.end_date).toLocaleDateString(),
              created: new Date(booking.created_at).toLocaleDateString()
            },
            is_overdue: activeTab === 'active' && new Date(booking.end_date) < new Date(),
            is_highlighted: booking.rental_id === highlightedRentalId,
            is_accommodation: isAccommodation,
            is_checkout_available: isCheckoutAvailable
          };
        })
      );

      if (append) {
        setBookings(prev => [...prev, ...bookingsWithImages]);
      } else {
        setBookings(bookingsWithImages);
      }

      // Check if there are more items to load
      setHasMore((count || 0) > (page + 1) * ITEMS_PER_PAGE);

    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      if (showLoading) setLoading(false);
      if (append) setLoadingMore(false);
    }
  }, [currentUser, activeTab, highlightedRentalId, categories]);

  // Get item image
  const getItemImage = async (userId, itemId) => {
    try {
      const dir = `${userId}/${itemId}`;
      const { data: files } = await supabase.storage.from('Items-photos').list(dir, { limit: 1, sortBy: { column: 'name', order: 'desc' } });
      if (!files || files.length === 0) return null;
      const fullPath = `${dir}/${files[0].name}`;
      const { data: pub } = supabase.storage.from('Items-photos').getPublicUrl(fullPath);
      return pub?.publicUrl;
    } catch {
      return null;
    }
  };

  const handleActiveCardPress = (booking) => {
    // Don't navigate if it's an Accommodation item
    if (booking.is_accommodation) {
      Alert.alert('Accommodation Item', 'Tracking is not available for accommodation items.');
      return;
    }

    onClose();
    navigation.navigate('ItemTrackingLessorScreen', {
      booking: { ...booking, items: { ...booking.items, main_image_url: booking.item_image } },
      userRole: 'lessor'
    });
  };

  // Handle Accept/Decline
  const handleBookingAction = async (rentalId, newStatus) => {
    setProcessingIds(prev => new Set(prev).add(rentalId));
    try {
      const oldBooking = bookings.find(b => b.rental_id === rentalId);

      // CHECK IF ITEM IS ACCOMMODATION
      const isAccommodation = categories[oldBooking.items.category_id] === 'Accommodation';

      // FOR ACCOMMODATION: Change status directly to 'ongoing' instead of 'confirmed'
      let actualNewStatus = newStatus;
      if (isAccommodation && newStatus === 'confirmed') {
        actualNewStatus = 'ongoing';
        console.log('Accommodation item: Changing status directly to ongoing');

        // MANUALLY DEDUCT QUANTITY FOR ACCOMMODATION ITEMS
        const { data: itemData, error: itemError } = await supabase
          .from('items')
          .select('quantity')
          .eq('item_id', oldBooking.item_id)
          .single();

        if (itemError) throw itemError;

        const currentQuantity = itemData.quantity || 0;
        const bookingQuantity = oldBooking.quantity || 1;

        if (currentQuantity < bookingQuantity) {
          throw new Error(`Not enough quantity available. Only ${currentQuantity} left, but booking requires ${bookingQuantity}.`);
        }

        const updatedQuantity = currentQuantity - bookingQuantity;

        const { error: updateError } = await supabase
          .from('items')
          .update({ quantity: updatedQuantity })
          .eq('item_id', oldBooking.item_id);

        if (updateError) throw updateError;
      }

      // Update booking status
      const { error } = await supabase
        .from('rental_transactions')
        .update({ status: actualNewStatus })
        .eq('rental_id', rentalId);

      if (error) throw error;

      setBookings(prev =>
        prev
          .map(b => (b.rental_id === rentalId ? { ...b, status: actualNewStatus } : b))
          .filter(b => !(activeTab === 'active' && b.status === 'cancelled'))
      );

      // Trigger notifications
      await handleBookingStatusChange(oldBooking, oldBooking.status, actualNewStatus);

      Alert.alert('Success', `Booking ${actualNewStatus.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', err.message || 'Failed to update booking');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(rentalId);
        return newSet;
      });
    }
  };

  // Handle Check Out for Accommodation
  const handleCheckOut = async (rentalId) => {
    setProcessingIds(prev => new Set(prev).add(rentalId));
    try {
      const oldBooking = bookings.find(b => b.rental_id === rentalId);

      // Update status to 'completed'
      const { error } = await supabase
        .from('rental_transactions')
        .update({ status: 'completed' })
        .eq('rental_id', rentalId);

      if (error) throw error;

      // Restore item quantity - AYAW HILABTI NI KAY DAPAT PAG ACCEPT MAKWAAN NA ANG QUANTITY
      if (oldBooking.items) {
        const { data: itemData, error: itemError } = await supabase
          .from('items')
          .select('quantity')
          .eq('item_id', oldBooking.item_id)
          .single();

        if (!itemError && itemData) {
          const updatedQuantity = (itemData.quantity || 0) + (oldBooking.quantity || 1);

          const { error: updateError } = await supabase
            .from('items')
            .update({ quantity: updatedQuantity })
            .eq('item_id', oldBooking.item_id);

          if (updateError) throw updateError;
        }
      }

      // Update local state
      setBookings(prev =>
        prev.filter(b => b.rental_id !== rentalId) // Remove from active tab
      );

      // Trigger notifications
      await handleBookingStatusChange(oldBooking, oldBooking.status, 'completed');

      Alert.alert('Success', 'Check out completed successfully!');
    } catch (err) {
      console.error('Check out error:', err);
      Alert.alert('Error', 'Failed to process check out');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(rentalId);
        return newSet;
      });
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setCurrentPage(0);
    setHasMore(true);
    await fetchBookings(false, 0, false);
    setRefreshing(false);
  }, [fetchBookings]);

  // Load more when scrolling
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchBookings(false, nextPage, true);
    }
  }, [loadingMore, hasMore, loading, currentPage, fetchBookings]);

  // Handle scroll event
  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 20;

    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      handleLoadMore();
    }
  };

  // Reset when tab changes or modal opens
  useEffect(() => {
    if (visible && currentUser) {
      setCurrentPage(0);
      setHasMore(true);
      setBookings([]);
      fetchBookings(true, 0, false);
    }
  }, [visible, currentUser, activeTab]);

  // Real-time subscription
  useEffect(() => {
    if (!visible || !currentUser) return;
    const channel = supabase.channel('your_items_changes').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rental_transactions' },
      () => {
        setCurrentPage(0);
        setHasMore(true);
        fetchBookings(false, 0, false);
      }
    ).subscribe();

    return () => supabase.removeChannel(channel);
  }, [visible, currentUser, activeTab]);

  const renderBookingItem = (booking) => {
    const isActiveTab = activeTab === 'active';
    const isAccommodation = booking.is_accommodation;
    const isCheckoutAvailable = booking.is_checkout_available;
    const isProcessing = processingIds.has(booking.rental_id);

    return (
      <TouchableOpacity
        key={booking.rental_id}
        style={[
          styles.bookingCard,
          booking.is_highlighted && styles.highlightedCard,
          isAccommodation && styles.accommodationCard
        ]}
        activeOpacity={0.7}
        onPress={isActiveTab ? () => handleActiveCardPress(booking) : undefined}
        disabled={isActiveTab && isAccommodation} // Disable if accommodation in active tab
      >
        {/* Accommodation Badge */}
        {isAccommodation && (
          <View style={styles.accommodationBadge}>
            <Text style={styles.accommodationBadgeText}>🏠 Accommodation</Text>
          </View>
        )}

        <View style={styles.cardHeader}>
          <View style={styles.renterInfo}>
            <Image
              source={booking.users.face_image_url ? { uri: booking.users.face_image_url } : require('../../assets/splash-icon.png')}
              style={styles.renterImage}
            />
            <View style={styles.renterDetails}>
              <Text style={styles.renterName}>{booking.renter_name}</Text>
              <Text style={styles.requestDate}>
                {activeTab === 'pending' ? `Requested on ${booking.formatted_dates.created}` : `Rental Period: ${booking.formatted_dates.start} - ${booking.formatted_dates.end}`}
              </Text>
              {isActiveTab && isAccommodation && (
                <Text style={[
                  styles.checkoutStatus,
                  isCheckoutAvailable ? styles.checkoutAvailable : styles.checkoutNotAvailable
                ]}>
                  {isCheckoutAvailable ? 'Ready for check out' : '⏳ Check out available on end date'}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.itemInfo}>
          <Image source={booking.item_image ? { uri: booking.item_image } : require('../../assets/splash-icon.png')} style={styles.itemImage} />
          <View style={styles.itemDetails}>
            <Text style={styles.itemTitle}>{booking.items.title}</Text>
            <Text style={styles.itemLocation}>{booking.items.location}</Text>
            <Text style={styles.itemLocation}>Quantity: {booking.quantity || 0}</Text>
            <Text style={styles.totalCost}>Total: ₱{Number(booking.total_cost).toFixed(2)}</Text>
          </View>
        </View>

        {/* Action buttons for pending bookings */}
        {activeTab === 'pending' && booking.status === 'pending' && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => handleBookingAction(booking.rental_id, 'confirmed')}
              disabled={processingIds.has(booking.rental_id)}
            >
              <Text style={styles.actionButtonText}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
              onPress={() => handleBookingAction(booking.rental_id, 'cancelled')}
              disabled={processingIds.has(booking.rental_id)}
            >
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Check Out button for Accommodation items */}
        {isActiveTab && isAccommodation && isCheckoutAvailable && (
          <TouchableOpacity
            style={[styles.checkoutButton, isProcessing && styles.checkoutButtonDisabled]}
            onPress={() => handleCheckOut(booking.rental_id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.checkoutButtonText}>Check Out</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Track indicator - only show for non-accommodation items */}
        {isActiveTab && !isAccommodation && (
          <View style={styles.trackIndicator}>
            <Text style={styles.trackText}>Tap to track order</Text>
            <Text style={styles.trackIcon}>👆</Text>
          </View>
        )}

        {/* Accommodation message for active tab */}
        {isActiveTab && isAccommodation && !isCheckoutAvailable && (
          <View style={styles.accommodationMessage}>
            <Text style={styles.accommodationMessageText}>
              🏠 Accommodation booking - No tracking required
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const getEmptyStateText = () => ({
    pending: { title: 'No Pending Bookings', subtitle: "You don't have any pending booking requests at the moment." },
    active: { title: 'No Active Rentals', subtitle: "You don't have any active rentals at the moment." },
    completed: { title: 'No Completed Rentals', subtitle: "You don't have any completed rentals yet." }
  }[activeTab] || { title: 'No Items', subtitle: 'No items found.' });

  const emptyState = getEmptyStateText();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Items</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}><Text style={styles.closeButtonText}>✕</Text></TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.methodSelector}>
          {['pending', 'active', 'completed'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.methodButton, activeTab === tab && styles.methodButtonActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.methodButtonText, activeTab === tab && styles.methodButtonTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFAB00" />
            <Text style={styles.loadingText}>Loading {activeTab} bookings...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={400}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FFAB00']} tintColor="#FFAB00" />}
          >
            {bookings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Image source={require('../../assets/pending.png')} style={styles.emptyImage} />
                <Text style={styles.emptyTitle}>{emptyState.title}</Text>
                <Text style={styles.emptyText}>{emptyState.subtitle}</Text>
              </View>
            ) : (
              <>
                <View style={styles.bookingsList}>{bookings.map(renderBookingItem)}</View>
                {loadingMore && (
                  <View style={styles.loadingMoreContainer}>
                    <ActivityIndicator size="small" color="#FFAB00" />
                    <Text style={styles.loadingMoreText}>Loading more...</Text>
                  </View>
                )}
                {!hasMore && bookings.length > 0 && (
                  <View style={styles.endContainer}>
                    <Text style={styles.endText}>No more items to load</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF5EF' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: '#FAF5EF' },
  headerTitle: { fontSize: 20, fontFamily: 'DM-Bold', color: '#333', flex: 1 },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  closeButtonText: { fontSize: 18, color: '#666', fontWeight: 'bold' },
  methodSelector: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 25, padding: 4, marginHorizontal: 20, marginBottom: 20 },
  methodButton: { flex: 1, paddingVertical: 20, borderRadius: 30, alignItems: 'center' },
  methodButtonActive: { backgroundColor: '#FFAB00' },
  methodButtonText: { fontSize: 14, fontFamily: 'DM-Medium', color: '#333' },
  methodButtonTextActive: { color: '#FFF' },
  content: { paddingHorizontal: 20 },
  bookingCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  highlightedCard: { borderWidth: 2, borderColor: '#FFAB00' },
  accommodationCard: { borderLeftWidth: 4, borderLeftColor: '#8B4513' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  renterInfo: { flexDirection: 'row', alignItems: 'center' },
  renterImage: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  renterDetails: { flex: 1 },
  renterName: { fontSize: 16, fontFamily: 'DM-Bold', color: '#333' },
  requestDate: { fontSize: 12, color: '#666' },
  checkoutStatus: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  checkoutAvailable: { color: '#4CAF50' },
  checkoutNotAvailable: { color: '#FF9800' },
  itemInfo: { flexDirection: 'row', marginTop: 12 },
  itemImage: { width: 64, height: 64, borderRadius: 12, marginRight: 12 },
  itemDetails: { flex: 1 },
  itemTitle: { fontSize: 14, fontFamily: 'DM-Bold', color: '#333' },
  itemLocation: { fontSize: 12, color: '#666' },
  totalCost: { fontSize: 14, color: '#333', fontFamily: 'DM-Bold', marginTop: 4 },
  trackIndicator: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  trackText: { fontSize: 12, color: '#FFAB00', marginRight: 8 },
  trackIcon: { fontSize: 16 },
  actionButtonsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  actionButton: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginHorizontal: 4 },
  actionButtonText: { color: '#FFF', fontWeight: 'bold' },
  checkoutButton: {
    marginTop: 12,
    backgroundColor: '#8B4513',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#A9A9A9',
    opacity: 0.7,
  },
  checkoutButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  loadingMoreContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
  loadingMoreText: { marginLeft: 8, color: '#666', fontSize: 12 },
  endContainer: { paddingVertical: 20, alignItems: 'center' },
  endText: { color: '#999', fontSize: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyImage: { width: 120, height: 120, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'DM-Bold', color: '#333', marginBottom: 4 },
  emptyText: { fontSize: 12, color: '#666', textAlign: 'center', paddingHorizontal: 20 },
  bookingsList: { marginBottom: 20 },
  // New styles for accommodation
  accommodationBadge: {
    backgroundColor: '#8B4513',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  accommodationBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  accommodationMessage: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#8B4513',
  },
  accommodationMessageText: {
    fontSize: 12,
    color: '#8B4513',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default YourItemsModal;