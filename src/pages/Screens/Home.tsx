import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView, ActivityIndicator, Alert } from 'react-native'
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../supbaseClient'
import FavoritesModal from '../../components/FavoriteModal'
import BookItemModal from '../../components/BookItemModal'
import { useNavigation } from '@react-navigation/native'
import { useFavorites } from '../../components/FavoritesContext'

const Home = () => {
  const navigation = useNavigation()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [categories, setCategories] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const { favorites, currentUser, toggleFavorite: contextToggleFavorite, isFavorited } = useFavorites()
  const [favoritesModalVisible, setFavoritesModalVisible] = useState(false)
  const [bookModalVisible, setBookModalVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [userBookings, setUserBookings] = useState([])

  // Fetch user's bookings - SHARED FUNCTION
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

  // Check if user has pending/active booking for an item - SHARED FUNCTION
  const getUserBookingStatus = useCallback((itemId) => {
    const status = userBookings.find(booking => booking.item_id === itemId)?.status || null
    return status
  }, [userBookings])

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

    const bookingStatus = getUserBookingStatus(item.item_id)
    if (bookingStatus) {
      Alert.alert(
        'Already Booked',
        `You already have a ${bookingStatus} booking for this item.`
      )
      return
    }

    setSelectedItem(item)
    setBookModalVisible(true)
  }

  // Check if item belongs to current user
  const isUserItem = (item) => {
    return currentUser && currentUser.id === item.user_id
  }

  // Get button text and style based on item status - SHARED FUNCTION
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

    // Only disable button if booking is pending/confirmed/ongoing
    if (bookingStatus && bookingStatus !== 'completed') {
      let statusText = bookingStatus.charAt(0).toUpperCase() + bookingStatus.slice(1)
      return {
        text: statusText,
        disabled: true,
        style: 'pending'
      }
    }

    return {
      text: 'Rent Now',
      disabled: false,
      style: 'normal'
    }
  }, [getUserBookingStatus])

  // Toggle favorite
  const handleToggleFavorite = async (itemId) => {
    const result = await contextToggleFavorite(itemId)
    if (!result.success && result.message) {
      Alert.alert('Error', result.message)
    }
  }

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
      console.warn("image list failed", e.message)
      return undefined
    }
  }

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("category_id,name")
      .order("name")
    if (!error) setCategories(data || [])
  }, [])

  // OPTIMIZED: fetchItems with loading control
  const fetchItems = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)

    try {
      let baseSelect = "item_id,user_id,category_id,title,description,price_per_day,deposit_fee,location,available,created_at,item_status"
      let query = supabase
        .from("items")
        .select(baseSelect)
        .eq("available", true)
        .eq("item_status", "approved")
        .order("created_at", { ascending: false })

      if (selectedCategoryId) {
        query = query.eq("category_id", Number(selectedCategoryId))
      }

      let { data, error } = await query

      // Fallback if item_status column does not exist
      if (error && (error.code === "42703" || /item_status/i.test(error.message))) {
        console.warn("item_status column missing; showing all available items.")
        let fallbackQuery = supabase
          .from("items")
          .select("item_id,user_id,category_id,title,description,price_per_day,deposit_fee,location,available,created_at")
          .eq("available", true)
          .order("created_at", { ascending: false })

        if (selectedCategoryId) {
          fallbackQuery = fallbackQuery.eq("category_id", Number(selectedCategoryId))
        }

        const fallback = await fallbackQuery
        data = fallback.data
        error = fallback.error
      }

      if (error) throw error

      // Fetch images for each item
      const withImages = await Promise.all(
        (data || []).map(async (item) => {
          const imageUrl = await getImageUrl(item.user_id, item.item_id)
          return {
            ...item,
            imageUrl: imageUrl,
            formattedPrice: `₱${item.price_per_day}`,
            formattedDate: new Date(item.created_at).toLocaleDateString()
          }
        })
      )

      // Filter based on search term
      const filtered = withImages.filter((item) => {
        if (!searchTerm) return true
        const needle = searchTerm.toLowerCase()
        return (
          item.title.toLowerCase().includes(needle) ||
          (item.description && item.description.toLowerCase().includes(needle)) ||
          (item.location && item.location.toLowerCase().includes(needle))
        )
      })

      setItems(filtered)
    } catch (e) {
      console.error("Fetch items failed:", e.message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [searchTerm, selectedCategoryId])

  // SMART UPDATE: Handle real-time payload intelligently
  const handleItemsRealtimeUpdate = useCallback(async (payload) => {
    console.log('Items realtime update:', payload)

    const { eventType, new: newRecord, old: oldRecord } = payload

    switch (eventType) {
      case 'INSERT':
        if (newRecord.item_status === 'approved' && newRecord.available) {
          const imageUrl = await getImageUrl(newRecord.user_id, newRecord.item_id)

          setItems(prevItems => [
            {
              ...newRecord,
              imageUrl, // 👈 match what renderItem expects
              formattedPrice: `₱${newRecord.price_per_day}`,
              formattedDate: new Date(newRecord.created_at).toLocaleDateString(),
            },
            ...prevItems,
          ])
        }
        break

      case 'UPDATE':
        {
          const imageUrl = await getImageUrl(newRecord.user_id, newRecord.item_id)

          setItems(prevItems => {
            const exists = prevItems.some(item => item.item_id === newRecord.item_id)

            if (newRecord.item_status !== 'approved' || !newRecord.available) {
              return prevItems.filter(item => item.item_id !== newRecord.item_id)
            }

            if (exists) {
              return prevItems.map(item =>
                item.item_id === newRecord.item_id
                  ? {
                    ...item,
                    ...newRecord,
                    imageUrl, // 👈 update correctly
                    formattedPrice: `₱${newRecord.price_per_day}`,
                    formattedDate: new Date(newRecord.created_at).toLocaleDateString(),
                  }
                  : item
              )
            }

            // If was pending → approved
            return [
              {
                ...newRecord,
                imageUrl, // 👈 match fetchItems
                formattedPrice: `₱${newRecord.price_per_day}`,
                formattedDate: new Date(newRecord.created_at).toLocaleDateString(),
              },
              ...prevItems,
            ]
          })
        }
        break

      case 'DELETE':
        setItems(prevItems => prevItems.filter(item => item.item_id !== oldRecord.item_id))
        break

      default:
        fetchItems(false)
    }
  }, [fetchItems])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Initial load with loading spinner
  useEffect(() => {
    fetchItems(true) // true = show loading spinner
  }, [fetchItems])

  // Load user bookings when user is available
  useEffect(() => {
    if (currentUser) {
      fetchUserBookings()
    }
  }, [currentUser, fetchUserBookings])

  // OPTIMIZED: Smart real-time updates for items
  useEffect(() => {
    const channel = supabase
      .channel("items_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        handleItemsRealtimeUpdate
      )
      .subscribe()

    return () => {
      console.log("Cleaning up items subscription")
      supabase.removeChannel(channel)
    }
  }, [handleItemsRealtimeUpdate])

  // Real-time updates for rental transactions
  useEffect(() => {
    if (!currentUser) return

    console.log("Setting up rental transactions real-time subscription")
    const channel = supabase
      .channel("rental_transactions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rental_transactions",
          filter: `renter_id=eq.${currentUser.id}`,
        },
        (payload) => {
          console.log("Rental transaction change detected:", payload)
          fetchUserBookings()
        }
      )
      .subscribe()

    return () => {
      console.log("Cleaning up rental transactions subscription")
      supabase.removeChannel(channel)
    }
  }, [currentUser, fetchUserBookings])

  const renderItem = (item) => {
    const isOwner = isUserItem(item)
    const buttonInfo = getButtonInfo(item)

    return (
      <View style={styles.itemContainer}>
        <View style={styles.itemImageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <Image
              source={require('../../../assets/splash-icon.png')}
              style={styles.itemImage}
              resizeMode="cover"
            />
          )}
          <View style={styles.itemRateContainer}>
            <Text style={styles.itemName}>{item.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10 }}>
              <Image source={require('../../../assets/rate.png')} style={styles.rateImage} />
              <Text> 5.0</Text>
            </View>
          </View>
          <View style={{ alignSelf: 'baseline', width: '100%' }}>
            <Text style={styles.text}>{item.location || 'Location not specified'}</Text>
            <Text style={styles.text}>{item.formattedDate}</Text>
            <View style={styles.moneyRateContainer}>
              <Text style={styles.moneyText}>{item.formattedPrice}</Text>
              <View style={{ justifyContent: 'flex-end', flexDirection: 'row' }}>
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
      </View>
    )
  }

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topMenuBar}>
          <TextInput
            placeholder='Search'
            placeholderTextColor={'#000'}
            style={styles.searchContainer}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          <TouchableOpacity onPress={() => setFavoritesModalVisible(true)}>
            <View style={styles.heartContainer}>
              <Image source={require('../../../assets/heart.png')} style={styles.heartLogo} />
              <Text>Likes({favorites.length})</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
        >
          <TouchableOpacity onPress={() => setSelectedCategoryId("")}>
            <Text style={[
              styles.categoriesText,
              selectedCategoryId === "" && styles.selectedCategoryText
            ]}>
              All
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.category_id}
              onPress={() => setSelectedCategoryId(selectedCategoryId === String(category.category_id) ? "" : String(category.category_id))}
            >
              <Text style={[
                styles.categoriesText,
                selectedCategoryId === String(category.category_id) && styles.selectedCategoryText
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.itemTextContainer}>
          <Text style={styles.itemText}>Items</Text>
        </View>

        {/* Items Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFAB00" />
            <Text style={styles.loadingText}>Loading items...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        ) : (
          <View style={styles.itemsGrid}>
            {items.map((item, index) => (
              <View key={item.item_id.toString()} style={styles.itemWrapper}>
                {renderItem(item)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <FavoritesModal
        visible={favoritesModalVisible}
        onClose={() => setFavoritesModalVisible(false)}
        currentUser={currentUser}
        userBookings={userBookings}
        getUserBookingStatus={getUserBookingStatus}
        getButtonInfo={getButtonInfo}
        onBookingUpdate={fetchUserBookings}
        onFavoriteRemoved={(itemId) => { }}
      />

      <BookItemModal
        visible={bookModalVisible}
        onClose={() => setBookModalVisible(false)}
        item={selectedItem}
        currentUserId={currentUser?.id}
        onBooked={() => {
          console.log('Booking completed, refreshing data...')
          fetchUserBookings()
          fetchItems(false) // Silent refresh without loading spinner
        }}
      />
    </>
  )
}

export default Home

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FAF5EF',
    flex: 1,
    marginTop: 40
  },
  topMenuBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    paddingHorizontal: 10,
    marginBottom: 10
  },
  searchContainer: {
    width: '80%',
    height: 50,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 20,
    paddingLeft: 20
  },
  heartContainer: {
    flexDirection: 'column',
    paddingLeft: 10,
    alignItems: 'center'
  },
  heartLogo: {
    width: 34,
    height: 30.5
  },
  categoriesContainer: {
    paddingLeft: 10,
    marginBottom: 10
  },
  categoriesText: {
    fontFamily: 'DM-Bold',
    margin: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: '#FFFFFF'
  },
  selectedCategoryText: {
    backgroundColor: '#FFAB00',
    color: '#FFFFFF'
  },
  itemTextContainer: {
    paddingLeft: 10,
    paddingVertical: 10
  },
  itemText: {
    fontFamily: 'DM-Bold',
    fontSize: 32,
    paddingLeft: 10
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    justifyContent: 'space-between'
  },
  itemWrapper: {
    width: '48%',
    marginBottom: 15
  },
  itemContainer: {
    flex: 1
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
    marginBottom: 10
  },
  itemRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50
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
    height: 20
  },
  messageImage: {
    width: 20,
    height: 20
  },
  messageContainer: {
    right: 5
  },
  moneyRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: 130
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50
  },
  loadingText: {
    marginTop: 10,
    color: '#9C9894',
    fontSize: 16
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50
  },
  emptyText: {
    color: '#9C9894',
    fontSize: 18,
    fontFamily: 'DM-Medium'
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
  }
})