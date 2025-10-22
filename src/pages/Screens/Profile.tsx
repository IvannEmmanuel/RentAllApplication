import { Image, StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator, FlatList } from 'react-native'
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../supbaseClient'
import { useNavigation } from '@react-navigation/native'
import { useFavorites } from '../../components/FavoritesContext'
import BookItemModal from '../../components/BookItemModal'
import YourItemModal from '../../components/YourItemModal'
import ActiveRentalModal from '../../components/ActiveRentalModal'
import PendingRentalModal from '../../components/PendingRentalModal'
import CompletedRentalModal from '../../components/CompletedRentalModal'
import RatingsModal from '../../components/RatingsModal'
import PictureModal from '../../components/PictureModal'
import LessorReviews from '../../components/LessorReviewsModal'
import SkeletonLoadingProfile from '../../components/skeletonComponents/SkeletonLoadingProfile'
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import EditProfileModal from '../../components/EditProfileModal'
import ItemCard from '../../components/ItemCard' // Import the same ItemCard component

const Profile = () => {
  const navigation = useNavigation()
  const [recommendedItems, setRecommendedItems] = useState([])
  const [userBookings, setUserBookings] = useState([])
  const [bookModalVisible, setBookModalVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isYourItemModalVisible, setIsYourItemModalVisible] = useState(false)
  const [showActiveRental, setShowActiveRental] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [pictureModalVisible, setPictureModalVisible] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lessorRatings, setLessorRatings] = useState({});
  const [lessorReviewsVisible, setLessorReviewsVisible] = useState(false);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [itemRatings, setItemRatings] = useState({});
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const { favorites, currentUser, setCurrentUser, toggleFavorite, isFavorited, logout } = useFavorites()

  useEffect(() => {
    if (!currentUser) {
      // optional fallback fetch if not set (e.g. refresh or deep link)
      supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setCurrentUser({ ...authUser, ...data })
        })
    }
  }, [])

  // Fetch lessor ratings
  const fetchLessorRatings = useCallback(async (lessorIds) => {
    if (!lessorIds || lessorIds.length === 0) return

    try {
      const { data, error } = await supabase
        .from("lessor_reviews")
        .select("lessor_id, rating")
        .in("lessor_id", lessorIds)

      if (error) {
        console.error("Error fetching lessor ratings:", error)
        return
      }

      const ratingsMap = {}
      data.forEach((review) => {
        if (!ratingsMap[review.lessor_id]) {
          ratingsMap[review.lessor_id] = { total: 0, count: 0 }
        }
        ratingsMap[review.lessor_id].total += review.rating
        ratingsMap[review.lessor_id].count += 1
      })

      const averageRatings = {}
      Object.keys(ratingsMap).forEach((lessorId) => {
        const { total, count } = ratingsMap[lessorId]
        averageRatings[lessorId] = count > 0 ? (total / count).toFixed(1) : null
      })

      setLessorRatings(prev => ({ ...prev, ...averageRatings }))
    } catch (error) {
      console.error("Error calculating lessor ratings:", error)
    }
  }, [])

  // Fetch user's bookings
  const fetchUserBookings = useCallback(async () => {
    if (!currentUser) {
      setUserBookings([])
      return
    }

    try {
      console.log('Fetching user bookings for:', currentUser.id)
      const { data, error } = await supabase
        .from('rental_transactions')
        .select('item_id, status')
        .eq('renter_id', currentUser.id)
        .in('status', ['pending', 'confirmed', 'ongoing'])

      if (!error && data) {
        console.log('User bookings fetched:', data)
        setUserBookings(data)
      } else if (error) {
        console.error('Error fetching bookings:', error)
      }
    } catch (error) {
      console.error('Error fetching user bookings:', error)
    }
  }, [currentUser])

  // Check if user has pending/active booking for an item
  const getUserBookingStatus = useCallback((itemId) => {
    const status = userBookings.find(booking => booking.item_id === itemId)?.status || null
    return status
  }, [userBookings])

  // Check if item belongs to current user
  const isUserItem = useCallback((item) => {
    return currentUser && currentUser.id === item.user_id
  }, [currentUser])

  // Get button text and style based on item status - SAME AS HOME.tsx
  const getButtonInfo = useCallback((item) => {
    if (isUserItem(item)) {
      return { text: "Your Item", disabled: true, style: "disabled" };
    }

    const bookingStatus = getUserBookingStatus(item.item_id);
    if (bookingStatus && !["completed", "cancelled", "rejected"].includes(bookingStatus)) {
      return {
        text: bookingStatus.charAt(0).toUpperCase() + bookingStatus.slice(1),
        disabled: true,
        style: "pending",
      };
    }

    if (item.quantity === 0) {
      return { text: "Out of Stock", disabled: true, style: "disabled" };
    }

    return { text: "Rent Now", disabled: false, style: "normal" };
  }, [getUserBookingStatus, isUserItem])

  // Handle rent now button - SAME AS HOME.tsx
  const handleRentNow = useCallback((item) => {
    if (!currentUser) {
      Alert.alert("Login Required", "Please log in to rent items");
      return;
    }
    if (getButtonInfo(item).disabled) {
      return;
    }
    setSelectedItem(item);
    setBookModalVisible(true);
  }, [currentUser, getButtonInfo])

  // Toggle favorites - SAME AS HOME.tsx
  const handleToggleFavorite = useCallback(async (itemId) => {
    const result = await toggleFavorite(itemId);
    if (!result.success && result.message) {
      Alert.alert("Error", result.message);
    }
  }, [toggleFavorite])

  const getImageUrl = async (userId, itemId) => {
    try {
      const dir = `${userId}/${itemId}`
      const { data: files, error } = await supabase.storage
        .from("Items-photos")
        .list(dir, {
          limit: 1,
          sortBy: { column: "name", order: "desc" },
        })

      if (error || !files || files.length === 0) return undefined

      const file = files[0]
      const fullPath = `${dir}/${file.name}`
      const { data: pub } = supabase.storage
        .from("Items-photos")
        .getPublicUrl(fullPath)

      return pub?.publicUrl
    } catch (e) {
      return undefined
    }
  }

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
      (data || []).forEach((r) => {
        const id = String(r.item_id);
        if (!ratingsMap[id]) ratingsMap[id] = { total: 0, count: 0 };
        ratingsMap[id].total += Number(r.rating);
        ratingsMap[id].count += 1;
      });

      const averageRatings = {};
      Object.keys(ratingsMap).forEach((id) => {
        const { total, count } = ratingsMap[id];
        averageRatings[id] = count > 0 ? (total / count).toFixed(1) : null;
      });

      setItemRatings((prev) => ({ ...prev, ...averageRatings }));
    } catch (err) {
      console.error('fetchItemRatings error:', err);
    }
  }, []);

  // Real-time subscription for items
  useEffect(() => {
    console.log('Setting up real-time subscription for items');

    const channel = supabase
      .channel('profile_items_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'items',
        },
        (payload) => {
          console.log('Real-time item change detected:', payload);
          setLastUpdated(new Date());

          switch (payload.eventType) {
            case 'INSERT':
              if (payload.new.available && payload.new.item_status === 'approved') {
                fetchRecommendedItems();
              }
              break;

            case 'UPDATE':
              setRecommendedItems(prev =>
                prev.map(item =>
                  item.item_id === payload.new.item_id
                    ? { ...item, ...payload.new }
                    : item
                )
              );
              break;

            case 'DELETE':
              setRecommendedItems(prev =>
                prev.filter(item => item.item_id !== payload.old.item_id)
              );
              break;

            default:
              fetchRecommendedItems();
              break;
          }
        }
      )
      .subscribe((status) => {
        console.log('Items real-time subscription status:', status);
        setIsSubscribed(status === 'SUBSCRIBED');
      });

    return () => {
      console.log('Cleaning up items real-time subscription');
      supabase.removeChannel(channel);
      setIsSubscribed(false);
    };
  }, []);

  // Real-time subscription for rental transactions
  useEffect(() => {
    if (!currentUser) return

    console.log('Setting up rental transactions real-time subscription')
    const channel = supabase
      .channel("rental_transactions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rental_transactions",
          filter: `renter_id=eq.${currentUser.id}`
        },
        (payload) => {
          console.log('Rental transaction change detected:', payload)
          fetchUserBookings()
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up rental transactions subscription')
      supabase.removeChannel(channel)
    }
  }, [currentUser, fetchUserBookings])

  const fetchRecommendedItems = useCallback(async () => {
    try {
      let { data, error } = await supabase
        .from("items")
        .select(`
        item_id,
        user_id,
        title,
        description,
        price_per_day,
        location,
        created_at,
        available,
        item_status,
        quantity,
        users (
          first_name,
          last_name
        )
      `)
        .eq("available", true)
        .eq("item_status", "approved")
        .gt("quantity", 0)

      if (error) throw error

      // Shuffle and select 4 items only
      const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 4)

      const withImages = await Promise.all(
        shuffled.map(async (item) => {
          const imageUrl = await getImageUrl(item.user_id, item.item_id)
          return {
            ...item,
            lessorName: item.users ? `${item.users.first_name} ${item.users.last_name}` : "Unknown",
            lessorId: item.user_id,
            imageUrl,
            formattedPrice: `₱${item.price_per_day}`,
            formattedDate: new Date(item.created_at).toLocaleDateString(),
            stockStatus: item.quantity > 0 ? `${item.quantity} available` : 'Out of stock'
          }
        })
      )

      const itemIds = withImages.map(i => i.item_id).filter(Boolean);
      const lessorIds = withImages.map(i => i.lessorId).filter(Boolean);

      fetchItemRatings(itemIds);
      fetchLessorRatings(lessorIds);

      setRecommendedItems(withImages)
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Failed to load recommended items:", e.message)
    }
  }, [])

  // Load user data when user is available
  useEffect(() => {
    if (currentUser) {
      fetchUserBookings()
      fetchRecommendedItems()
    }
  }, [currentUser, fetchUserBookings, fetchRecommendedItems])

  // Handle message button press - SAME AS HOME.tsx
  const handleMessage = useCallback(async (item) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to send messages')
      return
    }

    if (currentUser.id === item.user_id) {
      Alert.alert('Cannot Message', 'You cannot send a message to yourself')
      return
    }

    try {
      const { data: otherUser, error: userError } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', item.user_id)
        .single()

      if (userError) {
        console.error('Error fetching user:', userError)
        Alert.alert('Error', 'Failed to get user information')
        return
      }

      const otherUserName = otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'Unknown User'

      let { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${item.user_id}),and(user1_id.eq.${item.user_id},user2_id.eq.${currentUser.id})`)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (!conversation) {
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert([{
            user1_id: currentUser.id,
            user2_id: item.user_id,
            item_id: item.item_id,
            last_message: `Interested in: ${item.title}`,
            last_message_at: new Date().toISOString()
          }])
          .select()
          .single()

        if (createError) throw createError
        conversation = newConversation
      }

      navigation.navigate('Chat', {
        conversationId: conversation.id,
        otherUserId: item.user_id,
        otherUserName: otherUserName,
        itemTitle: item.title,
        itemId: item.item_id
      })

    } catch (error) {
      console.error('Error creating/finding conversation:', error)
      Alert.alert('Error', 'Failed to start conversation')
    }
  }, [currentUser, navigation])

  // Handle lessor name click - SAME AS HOME.tsx
  const handleLessorPress = useCallback((lessorId) => {
    if (lessorId) {
      navigation.navigate("LessorReviews", { lessorId });
    }
  }, [navigation])

  const handlePicturePress = useCallback((item) => {
    setSelectedItem(item);
    setPictureModalVisible(true);
  }, []);

  const handleLogout = async () => {
    if (!currentUser) return

    try {
      await logout()

      setUserBookings([])
      setSelectedItem(null)

      navigation.reset({
        index: 0,
        routes: [{ name: 'LandingPage' }],
      })
    } catch (err) {
      console.error('Logout error:', err)
      Alert.alert('Error', 'Failed to logout. Please try again.')
    }
  }

  // Render item using the same ItemCard component as Home.tsx
  const renderItemCard = useCallback(({ item }) => (
    <ItemCard
      item={item}
      itemRating={itemRatings[item.item_id]}
      lessorRating={lessorRatings[item.lessorId]}
      isFavorited={isFavorited(item.item_id)}
      buttonInfo={getButtonInfo(item)}
      onPicturePress={handlePicturePress}
      onLessorPress={handleLessorPress}
      onMessage={handleMessage}
      onToggleFavorite={handleToggleFavorite}
      onRentNow={handleRentNow}
    />
  ), [itemRatings, lessorRatings, isFavorited, getButtonInfo, handleToggleFavorite, handleRentNow, handleMessage, handleLessorPress, handlePicturePress])

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.profileText}>Profile</Text>
          <View style={styles.profileContainer}>
            <View style={styles.subprofileContainer}>
              <Image
                source={
                  currentUser?.face_image_url
                    ? { uri: currentUser.face_image_url }
                    : require('../../../assets/splash-icon.png')
                }
                style={styles.profileImage}
              />
              <View style={styles.informationContainer}>
                <Text style={styles.nameText}>
                  {currentUser
                    ? `${currentUser.first_name} ${currentUser.last_name}`
                    : 'Loading...'}
                </Text>
                <Text style={styles.birthdayText}>
                  {currentUser?.dob
                    ? new Date(currentUser.dob).toLocaleDateString()
                    : 'Birthdate not available'}
                </Text>
                <View style={styles.editButton}>
                  <TouchableOpacity onPress={() => setEditModalVisible(true)}>
                    <Text style={styles.editText}>Edit Profile</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.transactContainer}>
            <Text style={styles.transactionText}>Transaction Management</Text>
          </View>

          <View style={styles.mainActivitiesContainer}>
            <View style={styles.firstActivitiesContainer}>
              <TouchableOpacity
                style={styles.subActivitiesContainer}
                onPress={() => setShowPendingModal(true)}
              >
                <Image source={require('../../../assets/pending.png')} style={styles.pendingImage} />
                <Text>Pending</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activitiesContainer}>
              <TouchableOpacity
                onPress={() => setShowActiveRental(true)}
                style={styles.subActivitiesContainer}
              >
                <Image source={require('../../../assets/active_rental.png')} style={styles.image} />
                <Text>Active Rental</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activitiesContainer}>
              <TouchableOpacity
                style={styles.subActivitiesContainer}
                onPress={() => setShowCompletedModal(true)}
              >
                <Image source={require('../../../assets/completed.png')} style={styles.pendingImage} />
                <Text>Completed</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activitiesContainer}>
              <TouchableOpacity
                style={styles.subActivitiesContainer}
                onPress={() => setIsYourItemModalVisible(true)}
              >
                <Image source={require('../../../assets/item.png')} style={styles.pendingImage} />
                <Text>Your Item</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activitiesContainer}>
              <TouchableOpacity
                style={styles.subActivitiesContainer}
                onPress={() => setShowRatingsModal(true)}
              >
                <Image source={require("../../../assets/rating.png")} style={styles.pendingImage} />
                <Text>Ratings</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.mainActivitiesContainer}>
            <TouchableOpacity
              style={styles.subActivitiesContainer}
              onPress={() => navigation.navigate('LessorReviews', {
                lessorId: currentUser?.id,
                lessorName: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Unknown'
              })}
            >
              <Image source={require('../../../assets/product.png')} style={styles.pendingImage} />
              <Text>Product</Text>
            </TouchableOpacity>
          </View>

          {/* Items for you section with same design as Home */}
          <View style={styles.mainItemContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.itemText}>Items for you</Text>
            </View>
            
            {recommendedItems.length === 0 ? (
              <SkeletonLoadingProfile />
            ) : (
              <FlatList
                data={recommendedItems}
                renderItem={renderItemCard}
                keyExtractor={(item) => item.item_id.toString()}
                numColumns={2}
                scrollEnabled={false} // Disable scrolling since we only have 4 items
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.itemsGrid}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modals */}
      <BookItemModal
        visible={bookModalVisible}
        onClose={() => setBookModalVisible(false)}
        item={selectedItem}
        currentUserId={currentUser?.id}
        onBooked={() => {
          console.log('Booking completed, refreshing data...')
          fetchUserBookings()
          fetchRecommendedItems()
        }}
      />

      <YourItemModal
        visible={isYourItemModalVisible}
        onClose={() => setIsYourItemModalVisible(false)}
        currentUser={currentUser}
      />

      <ActiveRentalModal
        visible={showActiveRental}
        onClose={() => setShowActiveRental(false)}
      />

      <PendingRentalModal
        visible={showPendingModal}
        onClose={() => setShowPendingModal(false)}
      />

      <CompletedRentalModal
        visible={showCompletedModal}
        onClose={() => setShowCompletedModal(false)}
      />

      <RatingsModal
        visible={showRatingsModal}
        onClose={() => setShowRatingsModal(false)}
        currentUserId={currentUser?.id}
      />

      <PictureModal
        visible={pictureModalVisible}
        onClose={() => setPictureModalVisible(false)}
        item={selectedItem}
      />

      <EditProfileModal
        visible={isEditModalVisible}
        onClose={() => setEditModalVisible(false)}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />
    </>
  )
}

export default Profile

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5EF'
  },
  header: {
    marginTop: 30,
  },
  profileText: {
    fontFamily: 'DM-Bold',
    fontSize: 32,
    flexWrap: 'wrap',
    paddingLeft: 20
  },
  profileImage: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    borderRadius: 50
  },
  profileContainer: {
    alignSelf: 'center',
    width: '90%',
    marginTop: 10
  },
  subprofileContainer: {
    flexDirection: 'row',
    backgroundColor: '#FAF5EF',
    height: 120,
    borderRadius: 20,
    paddingLeft: 10,
    elevation: 10,
  },
  informationContainer: {
    flexShrink: 1,
    alignSelf: 'center',
    paddingLeft: 10,
  },
  nameText: {
    fontFamily: 'DM-Bold',
    fontSize: 20
  },
  birthdayText: {
    fontFamily: 'DM-Regular',
  },
  transactionText: {
    fontFamily: 'DM-Bold',
    fontSize: 20
  },
  transactContainer: {
    paddingLeft: 20,
    marginTop: 5
  },
  mainActivitiesContainer: {
    flexDirection: 'row',
    paddingLeft: 20,
    marginTop: 10
  },
  firstActivitiesContainer: {
    flexDirection: 'row',
  },
  activitiesContainer: {
    flexDirection: 'row',
    paddingLeft: 10,
  },
  image: {
    width: 19,
    height: 25
  },
  pendingImage: {
    width: 25,
    height: 25
  },
  subActivitiesContainer: {
    flexDirection: 'column',
    alignItems: 'center'
  },
  mainItemContainer: {
    marginTop: 10,
    paddingHorizontal: 15
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemText: {
    fontFamily: 'DM-Bold',
    fontSize: 20,
  },
  // Items grid styles to match Home.tsx
  itemsGrid: {
    paddingBottom: 10,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  logoutButton: {
    backgroundColor: '#EA4141',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  logoutText: {
    color: '#FFF',
    fontFamily: 'DM-Bold',
    fontSize: 16,
  },
  editButton: {
    backgroundColor: '#FFAB00',
    borderRadius: 20,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
    width: '70%'
  },
  editText: {
    fontFamily: 'DM-Medium',
    fontSize: 12
  }
})