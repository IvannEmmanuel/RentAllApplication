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

const YourItemsModal = ({ visible, onClose, currentUser }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'active', 'completed'

  // Fetch bookings based on status
  const fetchBookings = useCallback(async (showLoading = true) => {
    if (!currentUser) return;

    if (showLoading) setLoading(true);

    try {
      let statusFilter;
      if (activeTab === 'pending') {
        statusFilter = ['pending'];
      } else if (activeTab === 'active') {
        statusFilter = ['confirmed', 'ongoing'];
      } else if (activeTab === 'confirmationReturned') {
        statusFilter = ['awaiting_owner_confirmation'];
      } else {
        statusFilter = ['completed'];
      }

      // Get transactions where current user owns the item
      // In the fetchBookings function, update the select query to include quantity:
      const { data: transactions, error } = await supabase
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
        .eq('items.user_id', currentUser.id)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Inside your fetchBookings function, after fetching transactions
      if (activeTab === 'active') {
        const now = new Date();

        // Filter confirmed bookings that should start now
        const toStart = transactions.filter(
          booking => booking.status === 'confirmed' && new Date(booking.start_date) <= now
        );

        for (const booking of toStart) {
          const rentedQuantity = booking.quantity || 1;

          try {
            // Fetch current item stock
            const { data: itemData, error: itemError } = await supabase
              .from('items')
              .select('quantity')
              .eq('item_id', booking.item_id)
              .single();

            if (itemError) throw itemError;

            if (itemData.quantity < rentedQuantity) {
              console.warn(`Not enough stock for item ${booking.item_id}`);
              continue; // skip if not enough stock
            }

            // Update rental status to ongoing
            await supabase
              .from('rental_transactions')
              .update({ status: 'ongoing' })
              .eq('rental_id', booking.rental_id);

            // Update local object for UI
            booking.status = 'ongoing';
          } catch (err) {
            console.error('Error starting booking:', err);
          }
        }
      }

      // Fetch images for each item
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
            is_overdue: activeTab === 'active' && new Date(booking.end_date) < new Date()
          };
        })
      );

      setBookings(bookingsWithImages);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [currentUser, activeTab]);

  // Get item image
  const getItemImage = async (userId, itemId) => {
    try {
      const dir = `${userId}/${itemId}`;
      const { data: files, error } = await supabase.storage
        .from('Items-photos')
        .list(dir, {
          limit: 1,
          sortBy: { column: 'name', order: 'desc' }
        });

      if (error || !files || files.length === 0) return null;

      const fullPath = `${dir}/${files[0].name}`;
      const { data: pub } = supabase.storage
        .from('Items-photos')
        .getPublicUrl(fullPath);

      return pub?.publicUrl;
    } catch (error) {
      console.error('Error getting item image:', error);
      return null;
    }
  };

  // Handle accept booking (for pending) - WITHOUT quantity in rental_transactions
  const handleAccept = async (booking) => {
    const rentalId = booking.rental_id;

    if (processingIds.has(rentalId)) return;

    Alert.alert(
      'Accept Booking',
      `Accept ${booking.renter_name}'s request to rent "${booking.items.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: async () => {
            setProcessingIds(prev => new Set([...prev, rentalId]));

            try {
              // Update the rental transaction status only
              const { error } = await supabase
                .from('rental_transactions')
                .update({ status: 'confirmed' })
                .eq('rental_id', rentalId);

              if (error) throw error;

              // Notify the renter
              await handleBookingStatusChange(
                booking,
                'pending',
                'confirmed'
              );

              // Remove booking from pending list
              setBookings(prev =>
                prev.filter(b => b.rental_id !== rentalId)
              );

              Alert.alert('Success', 'Booking accepted successfully!');
            } catch (error) {
              console.error('Error accepting booking:', error);
              Alert.alert('Error', 'Failed to accept booking. Please try again.');
            } finally {
              setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(rentalId);
                return newSet;
              });
            }
          }
        }
      ]
    );
  };

  // Handle decline booking (for pending)
  const handleDecline = async (booking) => {
    const rentalId = booking.rental_id;

    if (processingIds.has(rentalId)) return;

    Alert.alert(
      'Decline Booking',
      `Decline ${booking.renter_name}'s request to rent "${booking.items.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessingIds(prev => new Set([...prev, rentalId]));

            try {
              const { error } = await supabase
                .from('rental_transactions')
                .update({ status: 'cancelled' })
                .eq('rental_id', rentalId);

              if (error) throw error;

              await handleBookingStatusChange(
                booking,
                'pending',
                'cancelled'
              );

              setBookings(prev =>
                prev.filter(b => b.rental_id !== rentalId)
              );

              Alert.alert('Booking Declined', 'The renter has been notified.');
            } catch (error) {
              console.error('Error declining booking:', error);
              Alert.alert('Error', 'Failed to decline booking. Please try again.');
            } finally {
              setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(rentalId);
                return newSet;
              });
            }
          }
        }
      ]
    );
  };

  const handleConfirmReturn = async (booking) => {
    const rentalId = booking.rental_id;
    if (processingIds.has(rentalId)) return;

    Alert.alert(
      'Confirm Return',
      `Confirm "${booking.items.title}" has been returned by ${booking.renter_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setProcessingIds(prev => new Set([...prev, rentalId]));
            const returnedQuantity = booking.quantity || 1;

            try {
              // 1️⃣ Add the returned quantity back to the item stock
              const { data: itemData, error: itemError } = await supabase
                .from('items')
                .select('quantity')
                .eq('item_id', booking.item_id)
                .single();

              if (itemError) throw itemError;

              await supabase
                .from('items')
                .update({ quantity: itemData.quantity + returnedQuantity })
                .eq('item_id', booking.item_id);

              // 2️⃣ Update rental status to 'completed'
              const { error: updateError } = await supabase
                .from('rental_transactions')
                .update({ status: 'completed' })
                .eq('rental_id', rentalId);

              if (updateError) throw updateError;

              // 3️⃣ Optional: notify the renter/owner
              await handleBookingStatusChange(booking, 'awaiting_owner_confirmation', 'completed');

              // 4️⃣ Remove from local state so UI updates
              setBookings(prev => prev.filter(b => b.rental_id !== rentalId));

              Alert.alert('Success', 'Return confirmed and stock updated!');
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to confirm return.');
            } finally {
              setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(rentalId);
                return newSet;
              });
            }
          }
        }
      ]
    );
  };

  // Handle returned (for active rentals)
  const handleReturned = async (booking) => {
    const rentalId = booking.rental_id;

    if (processingIds.has(rentalId)) return;

    Alert.alert(
      'Mark as Returned',
      `Mark "${booking.items.title}" as returned by ${booking.renter_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Returned',
          style: 'default',
          onPress: async () => {
            setProcessingIds(prev => new Set([...prev, rentalId]));

            try {
              // Only update status to awaiting_owner_confirmation
              const { error } = await supabase
                .from('rental_transactions')
                .update({ status: 'awaiting_owner_confirmation' })
                .eq('rental_id', rentalId);

              if (error) throw error;

              await handleBookingStatusChange(booking, 'ongoing', 'awaiting_owner_confirmation');

              setBookings(prev =>
                prev.filter(b => b.rental_id !== rentalId)
              );

              Alert.alert('Success', 'Return requested! Awaiting your confirmation.');
            } catch (error) {
              console.error('Error marking as returned:', error);
              Alert.alert('Error', 'Failed to mark return.');
            } finally {
              setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(rentalId);
                return newSet;
              });
            }
          }
        }
      ]
    );
  };

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBookings(false);
    setRefreshing(false);
  }, [fetchBookings]);

  // Fetch data when modal opens or tab changes
  useEffect(() => {
    if (visible && currentUser) {
      fetchBookings();
    }
  }, [visible, currentUser, activeTab, fetchBookings]);

  // Real-time subscription
  useEffect(() => {
    if (!visible || !currentUser) return;

    const channel = supabase
      .channel('your_items_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rental_transactions'
        },
        (payload) => {
          console.log('Rental transaction change in YourItemsModal:', payload);
          fetchBookings(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible, currentUser, fetchBookings]);

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'PENDING';
      case 'confirmed': return 'CONFIRMED';
      case 'ongoing': return 'ONGOING';
      case 'completed': return 'COMPLETED';
      case 'returned': return 'RETURNED';
      default: return status.toUpperCase();
    }
  };

  const getStatusColor = (status, isOverdue = false) => {
    if (isOverdue) return '#FF0000'; // Red for overdue
    switch (status) {
      case 'pending': return '#FF8C00';
      case 'confirmed': return '#4CAF50';
      case 'ongoing': return '#2196F3';
      case 'completed': return '#9E9E9E';
      case 'returned': return '#4CAF50';
      default: return '#FF8C00';
    }
  };

  const renderBookingItem = (booking) => {
    const isProcessing = processingIds.has(booking.rental_id);

    return (
      <View key={booking.rental_id} style={styles.bookingCard}>
        <View style={styles.cardHeader}>
          <View style={styles.renterInfo}>
            <Image
              source={
                booking.users.face_image_url
                  ? { uri: booking.users.face_image_url }
                  : require('../../assets/splash-icon.png')
              }
              style={styles.renterImage}
            />
            <View style={styles.renterDetails}>
              <Text style={styles.renterName}>{booking.renter_name}</Text>
              <Text style={styles.requestDate}>
                {activeTab === 'pending' && `Requested on ${booking.formatted_dates.created}`}
                {activeTab === 'active' && `${booking.status === 'confirmed' ? 'Starts' : 'Started'} on ${booking.formatted_dates.start}`}
                {activeTab === 'completed' && `Completed on ${booking.formatted_dates.end}`}
              </Text>
            </View>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(booking.status, booking.is_overdue) }
          ]}>
            <Text
              style={[
                styles.statusText,
                activeTab === 'confirmationReturned' ? { fontSize: 7 } : { fontSize: 10 }
              ]}
            >
              {booking.is_overdue ? 'OVERDUE' : getStatusText(booking.status)}
            </Text>
          </View>
        </View>

        <View style={styles.itemInfo}>
          <Image
            source={
              booking.item_image
                ? { uri: booking.item_image }
                : require('../../assets/splash-icon.png')
            }
            style={styles.itemImage}
          />
          <View style={styles.itemDetails}>
            <Text style={styles.itemTitle}>{booking.items.title}</Text>
            <Text style={styles.itemLocation}>{booking.items.location}</Text>
            <Text style={styles.itemLocation}>
              Quantity: {booking.quantity || 1}
            </Text>
            <View style={styles.rentalPeriod}>
              <Text style={styles.dateText}>
                {booking.formatted_dates.start} - {booking.formatted_dates.end}
              </Text>
              <Text style={styles.totalCost}>
                Total: ₱{Number(booking.total_cost).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action buttons based on tab */}
        {activeTab === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.declineButton]}
              onPress={() => handleDecline(booking)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FF6B6B" />
              ) : (
                <Text style={styles.declineButtonText}>Decline</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={() => handleAccept(booking)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* {activeTab === 'active' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.returnedButton]}
              onPress={() => handleReturned(booking)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.returnedButtonText}>Returned</Text>
              )}
            </TouchableOpacity>
          </View>
        )} */}

        {activeTab === 'confirmationReturned' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.acceptButton]}
              onPress={() => handleConfirmReturn(booking)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.acceptButtonText}>Confirm Return</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const getEmptyStateText = () => {
    switch (activeTab) {
      case 'pending':
        return {
          title: 'No Pending Bookings',
          subtitle: "You don't have any pending booking requests at the moment."
        };
      case 'active':
        return {
          title: 'No Active Rentals',
          subtitle: "You don't have any active rentals at the moment."
        };
      case 'completed':
        return {
          title: 'No Completed Rentals',
          subtitle: "You don't have any completed rentals yet."
        };
      case 'confirmationReturned':
        return {
          title: 'No Confirmation Returned',
          subtitle: "You don't have any bookings awaiting your confirmation."
        };
      default:
        return {
          title: 'No Items',
          subtitle: 'No items found.'
        };
    }
  };

  const emptyState = getEmptyStateText();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Items</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Navigation - Login-style design */}
        <View style={styles.methodSelector}>
          <TouchableOpacity
            style={[styles.methodButton, activeTab === "pending" && styles.methodButtonActive]}
            onPress={() => setActiveTab("pending")}
          >
            <Text style={[styles.methodButtonText, activeTab === "pending" && styles.methodButtonTextActive]}>
              Pending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodButton, activeTab === "active" && styles.methodButtonActive]}
            onPress={() => setActiveTab("active")}
          >
            <Text style={[styles.methodButtonText, activeTab === "active" && styles.methodButtonTextActive]}>
              Active
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodButton, activeTab === "confirmationReturned" && styles.methodButtonActive]}
            onPress={() => setActiveTab("confirmationReturned")}
          >
            <Text style={[styles.methodButtonText, activeTab === "confirmationReturned" && styles.methodButtonTextActive]}>
              Confirmation
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodButton, activeTab === "completed" && styles.methodButtonActive]}
            onPress={() => setActiveTab("completed")}
          >
            <Text style={[styles.methodButtonText, activeTab === "completed" && styles.methodButtonTextActive]}>
              Completed
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Image source={require('../../assets/search.png')} style={styles.searchIcon} />
            <Text style={styles.searchPlaceholder}>Search Items...</Text>
          </View>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFAB00" />
            <Text style={styles.loadingText}>Loading {activeTab} bookings...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
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
            {bookings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Image
                  source={require('../../assets/pending.png')}
                  style={styles.emptyImage}
                />
                <Text style={styles.emptyTitle}>{emptyState.title}</Text>
                <Text style={styles.emptyText}>{emptyState.subtitle}</Text>
              </View>
            ) : (
              <View style={styles.bookingsList}>
                {bookings.map(renderBookingItem)}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5EF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FAF5EF',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'DM-Bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
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
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  // Login-style method selector
  methodSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffffff',
    borderRadius: 25,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 30,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: '#FFE1BE',
  },
  methodButtonText: {
    fontSize: 12,
    fontFamily: 'DM-Medium',
    color: '#666',
  },
  methodButtonTextActive: {
    color: 'black',
    fontFamily: 'DM-Bold',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
    tintColor: '#999',
  },
  searchPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyImage: {
    width: 80,
    height: 80,
    marginBottom: 20,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  bookingsList: {
    paddingVertical: 20,
  },
  bookingCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  renterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  renterImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  renterDetails: {
    flex: 1,
  },
  renterName: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#333',
  },
  requestDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#FF8C00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'DM-Bold',
    color: '#FFF',
  },
  itemInfo: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 4,
  },
  itemLocation: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  rentalPeriod: {
    gap: 4,
  },
  dateText: {
    fontSize: 14,
    fontFamily: 'DM-Medium',
    color: '#333',
  },
  totalCost: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#FFAB00',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  declineButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  acceptButton: {
    backgroundColor: '#28A745',
  },
  returnedButton: {
    backgroundColor: '#2196F3',
  },
  declineButtonText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontFamily: 'DM-Bold',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'DM-Bold',
  },
  returnedButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'DM-Bold',
  },
});

export default YourItemsModal;