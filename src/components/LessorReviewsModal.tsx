import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
} from 'react-native';
import { supabase } from '../../supbaseClient';
import { useNavigation } from '@react-navigation/native';
import { useFavorites } from './FavoritesContext';
import BookItemModal from './BookItemModal';
import PictureModal from './PictureModal';
import ReportModal from './ReportModal';
import EditItemModal from './EditItem';

const LessorReviews = ({ route }) => {
  const { lessorId } = route.params;
  const navigation = useNavigation();
  const { favorites, currentUser, toggleFavorite, isFavorited } = useFavorites();

  const [lessorInfo, setLessorInfo] = useState(null);
  const [lessorRating, setLessorRating] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [lessorItems, setLessorItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemRatings, setItemRatings] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userBookings, setUserBookings] = useState([]);
  const LIMIT = 6;
  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [pictureModalVisible, setPictureModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [pictureItem, setPictureItem] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchUserBookings = useCallback(async () => {
    if (!currentUser) {
      setUserBookings([]);
      return;
    }

    try {
      console.log("Fetching user bookings for:", currentUser.id);
      const { data, error } = await supabase
        .from("rental_transactions")
        .select("item_id, status")
        .eq("renter_id", currentUser.id)
        .in("status", ["pending", "confirmed", "ongoing"]);

      if (!error && data) {
        console.log("User bookings fetched:", data);
        setUserBookings(data);
      } else if (error) {
        console.error("Error fetching bookings:", error);
      }
    } catch (error) {
      console.error("Error fetching user bookings:", error);
    }
  }, [currentUser]);

  const getUserBookingStatus = useCallback(
    (itemId) => {
      const status = userBookings.find((booking) => booking.item_id === itemId)?.status || null;
      return status;
    },
    [userBookings],
  );

  const isUserItem = (item) => {
    return currentUser && currentUser.id === item.user_id;
  }

  const getButtonInfo = useCallback(
    (item) => {
      const isOwner = isUserItem(item);
      const bookingStatus = getUserBookingStatus(item.item_id);

      if (isOwner) {
        if (item.item_status === 'pending') {
          return {
            text: "Under Review",
            disabled: true,
            style: "disabled",
          };
        }
        if (item.item_status === 'rejected') {
          return {
            text: "Item Rejected",
            disabled: true,
            style: "disabled",
          };
        }
        return {
          text: "Your Item",
          disabled: true,
          style: "disabled",
        };
      }

      if (bookingStatus && bookingStatus !== "completed") {
        const statusText = bookingStatus.charAt(0).toUpperCase() + bookingStatus.slice(1)
        return {
          text: statusText,
          disabled: true,
          style: "pending",
        }
      }

      if (item.quantity === 0) {
        return {
          text: "Out of Stock",
          disabled: true,
          style: "disabled",
        }
      }

      return {
        text: "Rent Now",
        disabled: false,
        style: "normal",
      }
    },
    [getUserBookingStatus],
  );

  const handleReportPress = () => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to submit a report.');
      return;
    }

    if (currentUser.id === lessorId) {
      Alert.alert('Cannot Report', 'You cannot report yourself.');
      return;
    }

    setReportModalVisible(true);
  };

  const handleRentNow = (item) => {
    if (!currentUser) {
      Alert.alert("Login Required", "Please log in to rent items")
      return
    }

    if (currentUser.id === item.user_id) {
      Alert.alert("Your Item", "You cannot rent your own item")
      return
    }

    const bookingStatus = getUserBookingStatus(item.item_id)
    if (bookingStatus) {
      Alert.alert("Already Booked", `You already have a ${bookingStatus} booking for this item.`)
      return
    }

    setSelectedItem(item)
    setBookModalVisible(true)
  }

  const fetchLessorInfo = useCallback(async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, first_name, last_name, face_image_url')
        .eq('id', lessorId)
        .single();

      if (userError) {
        console.error('Error fetching lessor info:', userError);
        return;
      }

      setLessorInfo(userData);
    } catch (error) {
      console.error('Error fetching lessor info:', error);
    }
  }, [lessorId]);

  const fetchLessorRatings = useCallback(async () => {
    try {
      const { data: reviews, error } = await supabase
        .from('lessor_reviews')
        .select('rating')
        .eq('lessor_id', lessorId);

      if (error) {
        console.error('Error fetching lessor ratings:', error);
        return;
      }

      if (reviews && reviews.length > 0) {
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = (totalRating / reviews.length).toFixed(1);
        setLessorRating(averageRating);
        setReviewCount(reviews.length);
      } else {
        setLessorRating(null);
        setReviewCount(0);
      }
    } catch (error) {
      console.error('Error calculating lessor ratings:', error);
    }
  }, [lessorId]);

  const dedupeItems = (itemsArray) => {
    const map = new Map();
    itemsArray.forEach((i) => map.set(i.item_id, i));
    return Array.from(map.values());
  };

  const fetchLessorItems = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1 && !append) {
      setLoadingMore(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const isOwnProfile = lessorId === currentUser?.id;

      let query = supabase
        .from('items')
        .select('item_id, user_id, category_id, title, description, price_per_day, deposit_fee, location, available, created_at, item_status, quantity')
        .eq('user_id', lessorId)
        .eq('available', true)
        .order('created_at', { ascending: false })
        .range((pageNum - 1) * LIMIT, pageNum * LIMIT - 1);

      if (isOwnProfile) {
        query = query.in('item_status', ['approved', 'pending', 'rejected']);
      } else {
        query = query.eq('item_status', 'approved');
      }

      const { data: items, error } = await query;

      if (error) {
        console.error('Error fetching lessor items:', error);
        return;
      }

      const itemsWithImages = await Promise.all(
        (items || []).map(async (item) => {
          const imageUrl = await getImageUrl(item.user_id, item.item_id);
          return {
            ...item,
            imageUrl,
            formattedPrice: `₱${item.price_per_day}`,
            formattedDate: new Date(item.created_at).toLocaleDateString(),
          };
        })
      );

      setLessorItems((prev) => {
        const merged = append ? [...prev, ...itemsWithImages] : itemsWithImages;
        const deduped = dedupeItems(merged);

        const itemIds = deduped.map(item => item.item_id);
        fetchItemRatings(itemIds);

        return deduped;
      });

      setHasMore((items || []).length === LIMIT);
    } catch (error) {
      console.error('Error fetching lessor items:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [lessorId, currentUser?.id]);

  const getImageUrl = async (userId, itemId) => {
    try {
      const dir = `${userId}/${itemId}`;
      const { data: files, error } = await supabase.storage
        .from('Items-photos')
        .list(dir, {
          limit: 1,
          sortBy: { column: 'name', order: 'desc' },
        });

      if (error || !files || files.length === 0) return undefined;

      const file = files[0];
      const fullPath = `${dir}/${file.name}`;
      const { data: pub } = supabase.storage
        .from('Items-photos')
        .getPublicUrl(fullPath);

      return pub?.publicUrl;
    } catch (e) {
      console.warn('image list failed', e.message);
      return undefined;
    }
  };

  const fetchItemRatings = useCallback(async (itemIds) => {
    if (!itemIds || itemIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('item_id, rating')
        .in('item_id', itemIds);

      if (error) {
        console.error('Error fetching ratings:', error);
        return;
      }

      const ratingsMap = {};
      data.forEach(review => {
        if (!ratingsMap[review.item_id]) {
          ratingsMap[review.item_id] = { total: 0, count: 0 };
        }
        ratingsMap[review.item_id].total += review.rating;
        ratingsMap[review.item_id].count += 1;
      });

      const averageRatings = {};
      Object.keys(ratingsMap).forEach(itemId => {
        const { total, count } = ratingsMap[itemId];
        averageRatings[itemId] = count > 0 ? (total / count).toFixed(1) : null;
      });

      setItemRatings(prev => ({ ...prev, ...averageRatings }));
    } catch (error) {
      console.error('Error calculating ratings:', error);
    }
  }, []);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchLessorItems(nextPage, true);
    }
  };

  const handleChatWithLessor = async () => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to send messages');
      return;
    }

    if (currentUser.id === lessorId) {
      Alert.alert('Cannot Message', 'You cannot send a message to yourself');
      return;
    }

    try {
      const otherUserName = lessorInfo ? `${lessorInfo.first_name} ${lessorInfo.last_name}` : 'Unknown User';

      let { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .or(
          `and(user1_id.eq.${currentUser.id},user2_id.eq.${lessorId}),and(user1_id.eq.${lessorId},user2_id.eq.${currentUser.id})`
        )
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!conversation) {
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert([
            {
              user1_id: currentUser.id,
              user2_id: lessorId,
              item_id: null,
              last_message: `Hello ${otherUserName}!`,
              last_message_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (createError) throw createError;
        conversation = newConversation;
      }

      navigation.navigate('Chat', {
        conversationId: conversation.id,
        otherUserId: lessorId,
        otherUserName: otherUserName,
        itemTitle: null,
        itemId: null,
      });
    } catch (error) {
      console.error('Error creating/finding conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  const handleViewReviews = () => {
    const lessorName = lessorInfo ? `${lessorInfo.first_name} ${lessorInfo.last_name}` : 'Unknown Lessor';
    navigation.navigate('LessorReviewee', {
      lessorId: lessorId,
      lessorName: lessorName
    });
  };

  const handleMessage = async (item) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to send messages');
      return;
    }

    if (currentUser.id === item.user_id) {
      Alert.alert('Cannot Message', 'You cannot send a message to yourself');
      return;
    }

    try {
      const otherUserName = lessorInfo ? `${lessorInfo.first_name} ${lessorInfo.last_name}` : 'Unknown User';

      let { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .or(
          `and(user1_id.eq.${currentUser.id},user2_id.eq.${item.user_id}),and(user1_id.eq.${item.user_id},user2_id.eq.${currentUser.id})`
        )
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!conversation) {
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert([
            {
              user1_id: currentUser.id,
              user2_id: item.user_id,
              item_id: item.item_id,
              last_message: `Interested in: ${item.title}`,
              last_message_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (createError) throw createError;
        conversation = newConversation;
      }

      navigation.navigate('Chat', {
        conversationId: conversation.id,
        otherUserId: item.user_id,
        otherUserName: otherUserName,
        itemTitle: item.title,
        itemId: item.item_id,
      });
    } catch (error) {
      console.error('Error creating/finding conversation:', error);
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  const handleToggleFavorite = async (itemId) => {
    const result = await toggleFavorite(itemId);
    if (!result.success && result.message) {
      Alert.alert('Error', result.message);
    }
  };

  const handleEdit = (item) => {
    setOptionsModalVisible(false);
    setSelectedItem(item);
    setEditModalVisible(true);
  };

  const handleDelete = async (item) => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('item_id', item.item_id);

      if (error) throw error;

      setOptionsModalVisible(false);
      setPage(1);
      fetchLessorItems(1, false);
      Alert.alert('Success', 'Item deleted successfully');
    } catch (error) {
      console.error('Error deleting item:', error);
      Alert.alert('Error', 'Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  const handleMoreOptions = (item) => {
    setSelectedItem(item);
    setOptionsModalVisible(true);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchLessorInfo(),
        fetchLessorRatings(),
        fetchLessorItems(1, false),
        fetchUserBookings()
      ]);
      setLoading(false);
    };

    if (lessorId) {
      loadData();
    }
  }, [lessorId, fetchLessorInfo, fetchLessorRatings, fetchLessorItems, fetchUserBookings]);

  // Real-time subscription for items
  useEffect(() => {
    if (!lessorId) return;

    const itemsSubscription = supabase
      .channel(`items:user_id=eq.${lessorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `user_id=eq.${lessorId}`,
        },
        (payload) => {
          console.log('Item change detected:', payload);
          // Refresh items when changes occur
          setPage(1);
          fetchLessorItems(1, false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsSubscription);
    };
  }, [lessorId, fetchLessorItems]);

  // Real-time subscription for user bookings
  useEffect(() => {
    if (!currentUser) return;

    const bookingsSubscription = supabase
      .channel(`rental_transactions:renter_id=eq.${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rental_transactions',
          filter: `renter_id=eq.${currentUser.id}`,
        },
        (payload) => {
          console.log('Booking change detected:', payload);
          // Refresh bookings when changes occur
          fetchUserBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsSubscription);
    };
  }, [currentUser, fetchUserBookings]);

  // Real-time subscription for lessor ratings
  useEffect(() => {
    if (!lessorId) return;

    const ratingsSubscription = supabase
      .channel(`lessor_reviews:lessor_id=eq.${lessorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lessor_reviews',
          filter: `lessor_id=eq.${lessorId}`,
        },
        (payload) => {
          console.log('Rating change detected:', payload);
          // Refresh ratings when changes occur
          fetchLessorRatings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ratingsSubscription);
    };
  }, [lessorId, fetchLessorRatings]);

  const renderItem = ({ item }) => {
    const buttonInfo = getButtonInfo(item);

    return (
      <View style={styles.itemContainer}>
        <View style={styles.itemImageContainer}>
          <TouchableOpacity
            onPress={() => {
              setPictureItem(item)
              setPictureModalVisible(true)
            }}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
            ) : (
              <Image source={require("../../assets/splash-icon.png")} style={styles.itemImage} resizeMode="cover" />
            )}
          </TouchableOpacity>
          <View style={styles.itemRateContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={require('../../assets/rate.png')} style={styles.rateImage} />
              <Text> {itemRatings[item.item_id] || 'No rating'}</Text>
            </View>
          </View>
          <Text style={styles.itemName}>{item.title}</Text>
          <View style={{ alignSelf: 'baseline', width: '100%' }}>
            <Text style={styles.text}>{item.location || 'Location not specified'}</Text>
            <Text style={styles.text}>{item.formattedDate}</Text>
            <Text style={styles.text}>Quantity: {item.quantity}</Text>
            <View style={styles.moneyRateContainer}>
              <Text style={styles.moneyText}>{item.formattedPrice}</Text>
              <View style={{ justifyContent: 'flex-end', flexDirection: 'row' }}>
                {currentUser && currentUser.id !== item.user_id && (
                  <TouchableOpacity style={styles.messageContainer} onPress={() => handleMessage(item)}>
                    <Image source={require('../../assets/message.png')} style={styles.messageImage} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleToggleFavorite(item.item_id)}>
                  <Image
                    source={
                      isFavorited(item.item_id)
                        ? require('../../assets/liked.png')
                        : require('../../assets/like.png')
                    }
                    style={styles.likeImage}
                  />
                </TouchableOpacity>
                {isUserItem(item) && (
                  <TouchableOpacity onPress={() => handleMoreOptions(item)} style={styles.moreOptions}>
                    <Text style={styles.moreOptionsText}>⋯</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.rentNowContainer}>
              <TouchableOpacity
                style={[
                  styles.buttonContainer,
                  buttonInfo.style === "disabled" && styles.disabledButtonContainer,
                  buttonInfo.style === "pending" && styles.pendingButtonContainer,
                ]}
                onPress={() => handleRentNow(item)}
                disabled={buttonInfo.disabled}
              >
                <Text
                  style={[
                    styles.rentText,
                    buttonInfo.style === "disabled" && styles.disabledRentText,
                    buttonInfo.style === "pending" && styles.pendingRentText,
                  ]}
                >
                  {buttonInfo.text}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFAB00" />
        <Text style={styles.loadingText}>Loading lessor profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lessor Profile</Text>
        <TouchableOpacity
          style={{ left: 120 }}
          onPress={handleReportPress}
        >
          <Image source={require('../../assets/report.png')} style={styles.reportPhoto} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileSection}>
          <View style={styles.profileContainer}>
            <View style={styles.avatarContainer}>
              {lessorInfo?.face_image_url ? (
                <Image
                  source={{ uri: lessorInfo.face_image_url }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {lessorInfo ? lessorInfo.first_name[0] + lessorInfo.last_name[0] : 'U'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.profileInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.lessorName}>
                  {lessorInfo ? `${lessorInfo.first_name} ${lessorInfo.last_name}` : 'Unknown Lessor'}
                </Text>
              </View>

              <View style={styles.ratingContainer}>
                <Image source={require('../../assets/rate.png')} style={styles.rateImage} />
                <Text style={styles.ratingText}>
                  {lessorRating || 'No rating'}
                </Text>
                <TouchableOpacity onPress={handleViewReviews}>
                  <Text style={styles.reviewCountText}>
                    ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
                  </Text>
                </TouchableOpacity>
                {currentUser && currentUser.id !== lessorId && (
                  <TouchableOpacity style={styles.chatButton} onPress={handleChatWithLessor}>
                    <Image source={require('../../assets/message.png')} style={styles.chatButtonImage} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Listed Items</Text>

          {lessorItems.length === 0 && !loadingMore ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No items listed by this lessor</Text>
            </View>
          ) : (
            <FlatList
              data={lessorItems}
              keyExtractor={(item) => item.item_id.toString()}
              renderItem={renderItem}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 10 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              scrollEnabled={false}
              ListFooterComponent={
                hasMore ? (
                  loadingMore ? (
                    <ActivityIndicator size="large" color="#FFAB00" style={{ marginVertical: 20 }} />
                  ) : (
                    <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
                      <Text style={styles.loadMoreText}>Load More Items</Text>
                    </TouchableOpacity>
                  )
                ) : lessorItems.length > 0 ? (
                  <Text style={styles.noMoreItemsText}>No more items</Text>
                ) : null
              }
            />
          )}
        </View>
      </ScrollView>

      {/* Options Modal */}
      <Modal
        visible={optionsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.optionsModalContainer}>
            <Text style={styles.optionsModalTitle}>Item Options</Text>
            
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => handleEdit(selectedItem)}
            >
              <Text style={styles.optionButtonText}>Edit</Text>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            <TouchableOpacity
              style={[styles.optionButton, styles.deleteOptionButton]}
              onPress={() => handleDelete(selectedItem)}
              disabled={deleting}
            >
              <Text style={[styles.optionButtonText, styles.deleteOptionText]}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Text>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => setOptionsModalVisible(false)}
            >
              <Text style={styles.optionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BookItemModal
        visible={bookModalVisible}
        onClose={() => setBookModalVisible(false)}
        item={selectedItem}
        currentUserId={currentUser?.id}
        onBooked={() => {
          console.log("Booking completed, refreshing data...")
          setPage(1)
          fetchUserBookings()
          fetchLessorItems(1, false)
        }}
      />

      <PictureModal
        visible={pictureModalVisible}
        onClose={() => setPictureModalVisible(false)}
        item={pictureItem}
      />

      <EditItemModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        item={selectedItem}
        onSaved={() => {
          setPage(1);
          fetchLessorItems(1, false);
        }}
      />

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        senderId={currentUser?.id}
        targetUserId={lessorId}
        rentalId={null}
        title="Report Lessor"
        description="Please provide details about why you are reporting this lessor. Our team will review your report and take appropriate action."
      />
    </View>
  );
};

export default LessorReviews;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5EF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF5EF',
  },
  loadingText: {
    marginTop: 10,
    color: '#9C9894',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#FAF5EF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 20,
    color: '#333',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'DM-Bold',
    color: '#333',
  },
  profileSection: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFAB00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarText: {
    fontSize: 20,
    fontFamily: 'DM-Bold',
    color: '#FFF',
  },
  profileInfo: {
    flex: 1,
  },
  lessorName: {
    fontSize: 18,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 4,
    marginRight: 8,
  },
  reviewCountText: {
    fontSize: 12,
    color: '#FFAB00',
    textDecorationLine: 'underline',
    marginRight: 10,
  },
  chatButton: {
    marginLeft: 10,
    padding: 8,
    backgroundColor: '#FFAB00',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButtonImage: {
    width: 16,
    height: 16,
    tintColor: '#FFF',
  },
  itemsSection: {
    paddingHorizontal: 10,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: 'DM-Bold',
    color: '#333',
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#9C9894',
    textAlign: 'center',
  },
  itemContainer: {
    width: '48%',
    marginBottom: 15,
  },
  itemImageContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  itemImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 10,
  },
  itemRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 30,
  },
  itemName: {
    flex: 1,
    fontFamily: 'DM-Medium',
    fontSize: 16,
  },
  rateImage: {
    width: 12,
    height: 12,
    marginRight: 3,
    alignSelf: 'center',
  },
  text: {
    color: '#9C9894',
    fontSize: 12,
    marginBottom: 2,
  },
  moneyText: {
    color: '#FFAB00',
    fontFamily: 'DM-Bold',
    fontSize: 16,
  },
  likeImage: {
    width: 20,
    height: 20,
  },
  messageImage: {
    width: 20,
    height: 20
  },
  messageContainer: {
    right: 5,
  },
  moneyRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: 130,
  },
  rentNowContainer: {
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonContainer: {
    backgroundColor: '#000',
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    alignSelf: 'flex-end',
    width: '70%',
  },
  disabledButtonContainer: {
    backgroundColor: '#CCC',
  },
  pendingButtonContainer: {
    backgroundColor: '#FF8C00',
  },
  rentText: {
    color: '#FFF',
    fontFamily: 'DM-Medium',
    textAlign: 'center',
  },
  disabledRentText: {
    color: '#999',
  },
  pendingRentText: {
    color: '#FFF',
  },
  loadMoreButton: {
    backgroundColor: '#FFAB00',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginVertical: 20,
  },
  loadMoreText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'DM-Bold',
    textAlign: 'center',
  },
  noMoreItemsText: {
    textAlign: 'center',
    marginVertical: 20,
    color: '#9C9894',
    fontSize: 14,
  },
  reportPhoto: {
    width: 25,
    height: 25
  },
  moreOptions: {
    marginLeft: 5,
    padding: 2,
  },
  moreOptionsText: {
    fontSize: 20,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  optionsModalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  optionsModalTitle: {
    fontSize: 18,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  optionButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionButtonText: {
    fontSize: 16,
    fontFamily: 'DM-Medium',
    color: '#333',
  },
  deleteOptionButton: {
    backgroundColor: '#FFF',
  },
  deleteOptionText: {
    color: '#F44336',
    fontFamily: 'DM-Bold',
  },
  optionDivider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 5,
  },
});