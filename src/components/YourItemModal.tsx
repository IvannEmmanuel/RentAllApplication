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

const YourItemsModal = ({ visible, onClose, currentUser, rentalId = null }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('pending');
  const [highlightedRentalId, setHighlightedRentalId] = useState(rentalId);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const navigation = useNavigation();

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
            quantity
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
            is_highlighted: booking.rental_id === highlightedRentalId
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
  }, [currentUser, activeTab, highlightedRentalId]);

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

      const { error } = await supabase
        .from('rental_transactions')
        .update({ status: newStatus })
        .eq('rental_id', rentalId);

      if (error) throw error;

      setBookings(prev =>
        prev
          .map(b => (b.rental_id === rentalId ? { ...b, status: newStatus } : b))
          .filter(b => !(activeTab === 'active' && b.status === 'cancelled'))
      );

      // Trigger notifications
      await handleBookingStatusChange(oldBooking, oldBooking.status, newStatus);

      Alert.alert('Success', `Booking ${newStatus.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update booking');
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
    return (
      <TouchableOpacity
        key={booking.rental_id}
        style={[styles.bookingCard, booking.is_highlighted && styles.highlightedCard]}
        activeOpacity={0.7}
        onPress={isActiveTab ? () => handleActiveCardPress(booking) : undefined}
      >
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
            </View>
          </View>
        </View>

        <View style={styles.itemInfo}>
          <Image source={booking.item_image ? { uri: booking.item_image } : require('../../assets/splash-icon.png')} style={styles.itemImage} />
          <View style={styles.itemDetails}>
            <Text style={styles.itemTitle}>{booking.items.title}</Text>
            <Text style={styles.itemLocation}>{booking.items.location}</Text>
            <Text style={styles.itemLocation}>Quantity: {booking.quantity || 1}</Text>
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

        {isActiveTab && (
          <View style={styles.trackIndicator}>
            <Text style={styles.trackText}>Tap to track order</Text>
            <Text style={styles.trackIcon}>👆</Text>
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  renterInfo: { flexDirection: 'row', alignItems: 'center' },
  renterImage: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  renterDetails: {},
  renterName: { fontSize: 16, fontFamily: 'DM-Bold', color: '#333' },
  requestDate: { fontSize: 12, color: '#666' },
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
});

export default YourItemsModal;