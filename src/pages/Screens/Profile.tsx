import { Image, StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native'
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
import SkeletonLoadingProfile from '../../components/skeletonComponents/SkeletonLoadingProfile'

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

  const { favorites, currentUser, setCurrentUser, toggleFavorite, isFavorited, logout } = useFavorites()

  const [itemRatings, setItemRatings] = useState({});

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
  const isUserItem = (item) => {
    return currentUser && currentUser.id === item.user_id
  }

  // Get button text and style based on item status
  const getButtonInfo = useCallback((item) => {
    const isOwner = isUserItem(item)
    const bookingStatus = getUserBookingStatus(item.item_id)

    if (isOwner) {
      return {
        text: 'Your Item',
        disabled: true,
        style: 'disabled'
      }
    }

    if (bookingStatus) {
      let statusText = bookingStatus.charAt(0).toUpperCase() + bookingStatus.slice(1)
      return {
        text: statusText,
        disabled: true,
        style: 'pending'
      }
    }

    // Check if item is out of stock
    if (item.quantity <= 0) {
      return {
        text: 'Out of Stock',
        disabled: true,
        style: 'disabled'
      }
    }

    return {
      text: 'Rent Now',
      disabled: false,
      style: 'normal'
    }
  }, [getUserBookingStatus])

  // Handle rent now button
  const handleRentNow = (item) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to rent items')
      return
    }

    if (currentUser.id === item.user_id) {
      Alert.alert('Your Item', 'You cannot rent your own item')
      return
    }

    // Check if item is out of stock
    if (item.quantity <= 0) {
      Alert.alert('Out of Stock', 'This item is currently unavailable for rent.')
      return
    }

    // Check if user already has a booking for this item
    const bookingStatus = getUserBookingStatus(item.item_id)
    if (bookingStatus) {
      Alert.alert(
        'Already Booked',
        `You already have a ${bookingStatus} booking for this item.`
      )
      return
    }

    // Show BookItemModal
    setSelectedItem(item)
    setBookModalVisible(true)
  }

  // Toggle favorites
  const handleToggleFavorite = async (itemId) => {
    const result = await toggleFavorite(itemId)
    if (!result.success && result.message) {
      Alert.alert('Error', result.message)
    }
  }

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
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'items',
        },
        (payload) => {
          console.log('Real-time item change detected:', payload);
          setLastUpdated(new Date());

          // Handle different events
          switch (payload.eventType) {
            case 'INSERT':
              // New item added - check if it should be in recommendations
              if (payload.new.available && payload.new.item_status === 'approved') {
                fetchRecommendedItems();
              }
              break;

            case 'UPDATE':
              // Item updated - refresh if it's in our current list
              setRecommendedItems(prev =>
                prev.map(item =>
                  item.item_id === payload.new.item_id
                    ? { ...item, ...payload.new }
                    : item
                )
              );
              break;

            case 'DELETE':
              // Item deleted - remove from list
              setRecommendedItems(prev =>
                prev.filter(item => item.item_id !== payload.old.item_id)
              );
              break;

            default:
              // For any other change, refresh the list
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

  const [lastUpdated, setLastUpdated] = useState(new Date());

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
        .gt("quantity", 0)  // Only show items with quantity > 0

      if (error) throw error

      // Shuffle and select 4
      const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 4)

      const withImages = await Promise.all(
        shuffled.map(async (item) => {
          const imageUrl = await getImageUrl(item.user_id, item.item_id)
          return {
            ...item,
            lessorName: item.users ? `${item.users.first_name} ${item.users.last_name}` : "Unknown",
            lessorId: item.user_id, // Add lessorId for ratings
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

  // Handle message button press
  const handleMessage = async (item) => {
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
  }

  // Handle lessor name click - navigate to LessorReviews
  const handleLessorNamePress = (lessorId, lessorName) => {
    if (!lessorId) {
      Alert.alert('Error', 'Lessor information not available');
      return;
    }

    navigation.navigate('LessorReviews', { 
      lessorId: lessorId,
      lessorName: lessorName 
    });
  }

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

  const renderItem = (item) => {
    const isOwner = isUserItem(item)
    const buttonInfo = getButtonInfo(item)

    return (
      <View key={item.item_id} style={styles.itemContainer}>
        <View style={styles.itemImageContainer}>
          <TouchableOpacity
            onPress={() => {
              setSelectedItem(item)
              setPictureModalVisible(true)
            }}
          >
            <Image
              source={
                item?.imageUrl
                  ? { uri: item.imageUrl }
                  : require('../../../assets/splash-icon.png')
              }
              style={styles.itemImage}
            />
          </TouchableOpacity>

          <View style={styles.itemRateContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={require('../../../assets/rate.png')} style={styles.rateImage} />
              <Text> {itemRatings[String(item.item_id)] ?? 'No rating'}</Text>
            </View>
          </View>
          
          <Text style={styles.itemName}>{item.title}</Text>
          
          {/* Lessor Name with Rating - Clickable */}
          <TouchableOpacity
            onPress={() => handleLessorNamePress(item.lessorId, item.lessorName)}
            style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 4 }}
          >
            <Text style={styles.lessorText}>{item.lessorName}</Text>
            <Image source={require('../../../assets/rate.png')} style={styles.lessorRateImage} />
            <Text style={styles.lessorText}>{lessorRatings[item.lessorId] || 'No rating'}</Text>
          </TouchableOpacity>

          <Text style={styles.text}>{item.location || 'Location not specified'}</Text>
          <Text style={styles.text}>{item.formattedDate}</Text>
          <Text style={styles.text}>Quantity: {item.quantity <= 0 ? 'Out of Stock' : `${item.quantity}`}</Text>
          
          <View style={styles.moneyRateContainer}>
            <Text style={styles.moneyText}>{item.formattedPrice}</Text>
            <View style={{ flexDirection: 'row' }}>
              {!isOwner && (
                <TouchableOpacity
                  style={styles.messageContainer}
                  onPress={() => handleMessage(item)}
                >
                  <Image source={require('../../../assets/message.png')} style={styles.messageImage} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleToggleFavorite(item.item_id)}>
                <Image
                  source={isFavorited(item.item_id)
                    ? require('../../../assets/liked.png')
                    : require('../../../assets/like.png')}
                  style={styles.likeImage}
                />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Rent Now Button */}
          <View style={styles.rentNowContainer}>
            <TouchableOpacity
              style={[
                styles.buttonContainer,
                buttonInfo.style === 'disabled' && styles.disabledButtonContainer,
                buttonInfo.style === 'pending' && styles.pendingButtonContainer
              ]}
              onPress={() => handleRentNow(item)}
              disabled={buttonInfo.disabled}
            >
              <Text style={[
                styles.rentText,
                buttonInfo.style === 'disabled' && styles.disabledRentText,
                buttonInfo.style === 'pending' && styles.pendingRentText
              ]}>
                {buttonInfo.text}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

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
              </View>
            </View>
          </View>

          <View style={styles.transactContainer}>
            <Text style={styles.transactionText}>Transaction Management</Text>
          </View>

          <View style={styles.mainActivitiesContainer}>
            <View style={styles.firstActivitiesContainer}>
              <TouchableOpacity
                style={styles.subActivitiesContainer} onPress={() => setShowPendingModal(true)}
              >
                <Image source={require('../../../assets/pending.png')} style={styles.pendingImage} />
                <Text>Pending</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activitiesContainer}>
              <TouchableOpacity onPress={() => setShowActiveRental(true)} style={styles.subActivitiesContainer}>
                <Image source={require('../../../assets/active_rental.png')} style={styles.image} />
                <Text>Active Rental</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activitiesContainer}>
              <TouchableOpacity style={styles.subActivitiesContainer} onPress={() => setShowCompletedModal(true)}>
                <Image source={require('../../../assets/completed.png')} style={styles.pendingImage} />
                <Text>Completed</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activitiesContainer}>
              <TouchableOpacity style={styles.subActivitiesContainer}
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

          <View style={styles.mainItemContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.itemText}>Items for you</Text>
            </View>
            {recommendedItems.length === 0 ? (
              <SkeletonLoadingProfile />
            ) : (
              <View style={styles.itemsGrid}>
                {recommendedItems.map(renderItem)}
              </View>
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
    height: 100,
    borderRadius: 20,
    paddingLeft: 10,
    elevation: 10,
  },
  informationContainer: {
    flexDirection: 'column',
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
    flexDirection: 'row'
  },
  firstActivitiesContainer: {
    flexDirection: 'row',
    paddingLeft: 20,
    marginTop: 10
  },
  activitiesContainer: {
    flexDirection: 'row',
    paddingLeft: 10,
    marginTop: 10
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
    paddingHorizontal: 20
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
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
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
    marginRight: 8,
  },
  lastUpdatedText: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
  },
  itemContainer: {
    width: '49%',
    marginBottom: 20
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  itemImageContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 10
  },
  quantityBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quantityBadgeOutOfStock: {
    backgroundColor: '#F44336',
  },
  quantityText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  quantityTextOutOfStock: {
    color: '#FFF',
  },
  itemRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  itemName: {
    flex: 1,
    fontFamily: 'DM-Medium',
    fontSize: 14
  },
  rateImage: {
    width: 12,
    height: 12,
    marginRight: 3
  },
  lessorRateImage: {
    width: 10,
    height: 10,
    marginRight: 3,
    alignSelf: 'center'
  },
  lessorText: {
    fontSize: 12,
    color: '#555',
    marginBottom: 2,
    marginRight: 3,
  },
  text: {
    color: '#9C9894',
    fontSize: 12,
    marginBottom: 2
  },
  moneyText: {
    color: '#FFAB00',
    fontFamily: 'DM-Bold',
    fontSize: 16
  },
  likeImage: {
    width: 20,
    height: 20,
    marginLeft: 10
  },
  messageImage: {
    width: 20,
    height: 20
  },
  messageContainer: {
    marginRight: 10
  },
  moneyRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8
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
    width: '70%'
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
    textAlign: 'center'
  },
  disabledRentText: {
    color: '#999',
  },
  pendingRentText: {
    color: '#FFF',
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
  }
})