// import { Image, StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native'
// import React, { useEffect, useState } from 'react'
// import { supabase } from '../../../supbaseClient'
// import { useNavigation } from '@react-navigation/native'

// const Profile = () => {
//   const navigation = useNavigation()
//   const [recommendedItems, setRecommendedItems] = useState([])
//   const [favorites, setFavorites] = useState([])
//   const [currentUser, setCurrentUser] = useState(null)
//   const [userProfile, setUserProfile] = useState(null)


//   useEffect(() => {
//     const fetchUserProfile = async () => {
//       const { data: { user } } = await supabase.auth.getUser()
//       if (user) {
//         setCurrentUser(user)
//         const { data, error } = await supabase
//           .from('users')
//           .select('first_name, last_name, dob, face_image_url')
//           .eq('id', user.id)
//           .single()

//         if (!error) {
//           setUserProfile(data)
//         }
//       }
//     }

//     fetchUserProfile()
//   }, [])

//   // Fetch current user
//   useEffect(() => {
//     const fetchUser = async () => {
//       const { data: { user } } = await supabase.auth.getUser()
//       setCurrentUser(user)
//     }
//     fetchUser()
//   }, [])

//   // Fetch user's favorites
//   useEffect(() => {
//     const fetchFavorites = async () => {
//       if (!currentUser) return
//       const { data, error } = await supabase
//         .from('favorites')
//         .select('item_id')
//         .eq('user_id', currentUser.id)

//       if (!error) {
//         setFavorites(data.map(fav => fav.item_id))
//       }
//     }
//     fetchFavorites()
//   }, [currentUser])

//   // Toggle favorites
//   const toggleFavorite = async (itemId) => {
//     if (!currentUser) {
//       Alert.alert('Login Required', 'Please log in to add items to favorites')
//       return
//     }

//     const isFavorited = favorites.includes(itemId)

//     if (isFavorited) {
//       const { error } = await supabase
//         .from('favorites')
//         .delete()
//         .eq('user_id', currentUser.id)
//         .eq('item_id', itemId)

//       if (!error) {
//         setFavorites(prev => prev.filter(id => id !== itemId))
//       }
//     } else {
//       const { error } = await supabase
//         .from('favorites')
//         .insert([{ user_id: currentUser.id, item_id: itemId }])

//       if (!error) {
//         setFavorites(prev => [...prev, itemId])
//       }
//     }
//   }

//   const getImageUrl = async (userId, itemId) => {
//     try {
//       const dir = `${userId}/${itemId}`
//       const { data: files, error } = await supabase.storage
//         .from("Items-photos")
//         .list(dir, {
//           limit: 1,
//           sortBy: { column: "name", order: "desc" },
//         })

//       if (error || !files || files.length === 0) return undefined

//       const file = files[0]
//       const fullPath = `${dir}/${file.name}`
//       const { data: pub } = supabase.storage
//         .from("Items-photos")
//         .getPublicUrl(fullPath)

//       return pub?.publicUrl
//     } catch (e) {
//       return undefined
//     }
//   }

//   const fetchRecommendedItems = async () => {
//     try {
//       let { data, error } = await supabase
//         .from("items")
//         .select("item_id,user_id,title,description,price_per_day,location,created_at,available,item_status")
//         .eq("available", true)
//         .eq("item_status", "approved")

//       if (error) throw error

//       // Shuffle and select 4
//       const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 4)

//       const withImages = await Promise.all(
//         shuffled.map(async (item) => {
//           const imageUrl = await getImageUrl(item.user_id, item.item_id)
//           return {
//             ...item,
//             imageUrl,
//             formattedPrice: `₱${item.price_per_day}`,
//             formattedDate: new Date(item.created_at).toLocaleDateString()
//           }
//         })
//       )

//       setRecommendedItems(withImages)
//     } catch (e) {
//       console.error("Failed to load recommended items:", e.message)
//     }
//   }

//   useEffect(() => {
//     if (currentUser) fetchRecommendedItems()
//   }, [currentUser])

//   const handleMessage = async (item) => {
//     if (!currentUser) {
//       Alert.alert('Login Required', 'Please log in to send messages')
//       return
//     }

//     if (currentUser.id === item.user_id) {
//       Alert.alert('Cannot Message', 'You cannot send a message to yourself')
//       return
//     }

//     try {
//       const { data: otherUser, error: userError } = await supabase
//         .from('users')
//         .select('first_name, last_name')
//         .eq('id', item.user_id)
//         .single()

//       if (userError) return

//       const otherUserName = otherUser
//         ? `${otherUser.first_name} ${otherUser.last_name}`
//         : 'Unknown User'

//       let { data: conversation, error } = await supabase
//         .from('conversations')
//         .select('*')
//         .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${item.user_id}),and(user1_id.eq.${item.user_id},user2_id.eq.${currentUser.id})`)
//         .single()

//       if (!conversation) {
//         const { data: newConversation } = await supabase
//           .from('conversations')
//           .insert([{
//             user1_id: currentUser.id,
//             user2_id: item.user_id,
//             item_id: item.item_id,
//             last_message: `Interested in: ${item.title}`,
//             last_message_at: new Date().toISOString()
//           }])
//           .select()
//           .single()

//         conversation = newConversation
//       }

//       navigation.navigate('Chat', {
//         conversationId: conversation.id,
//         otherUserId: item.user_id,
//         otherUserName,
//         itemTitle: item.title,
//         itemId: item.item_id
//       })

//     } catch (e) {
//       Alert.alert('Error', 'Failed to start conversation')
//     }
//   }

//   const renderItem = (item) => (
//     <View key={item.item_id} style={styles.itemContainer}>
//       <View style={styles.itemImageContainer}>
//         <Image
//           source={item.imageUrl ? { uri: item.imageUrl } : require('../../../assets/splash-icon.png')}
//           style={styles.itemImage}
//           resizeMode="cover"
//         />
//         <View style={styles.itemRateContainer}>
//           <Text style={styles.itemName}>{item.title}</Text>
//           <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10 }}>
//             <Image source={require('../../../assets/rate.png')} style={styles.rateImage} />
//             <Text> 5.0</Text>
//           </View>
//         </View>
//         <Text style={styles.text}>{item.location || 'Location not specified'}</Text>
//         <Text style={styles.text}>{item.formattedDate}</Text>
//         <View style={styles.moneyRateContainer}>
//           <Text style={styles.moneyText}>{item.formattedPrice}</Text>
//           <View style={{ flexDirection: 'row' }}>
//             <TouchableOpacity
//               style={styles.messageContainer}
//               onPress={() => handleMessage(item)}
//             >
//               <Image source={require('../../../assets/message.png')} style={styles.messageImage} />
//             </TouchableOpacity>
//             <TouchableOpacity onPress={() => toggleFavorite(item.item_id)}>
//               <Image
//                 source={favorites.includes(item.item_id)
//                   ? require('../../../assets/liked.png')
//                   : require('../../../assets/like.png')}
//                 style={styles.likeImage}
//               />
//             </TouchableOpacity>
//           </View>
//         </View>
//       </View>
//     </View>
//   )

//   return (
//     <ScrollView style={styles.container}>
//       <View style={styles.header}>
//         <Text style={styles.profileText}>Profile</Text>
//         <View style={styles.profileContainer}>
//           <View style={styles.subprofileContainer}>
//             <Image
//               source={
//                 userProfile?.face_image_url
//                   ? { uri: userProfile.face_image_url }
//                   : require('../../../assets/splash-icon.png') // fallback
//               }
//               style={styles.profileImage}
//             />
//             <View style={styles.informationContainer}>
//               <Text style={styles.nameText}>
//                 {userProfile
//                   ? `${userProfile.first_name} ${userProfile.last_name}`
//                   : 'Loading...'}
//               </Text>

//               <Text style={styles.birthdayText}>
//                 {userProfile?.dob
//                   ? new Date(userProfile.dob).toLocaleDateString()
//                   : 'Birthdate not available'}
//               </Text>
//             </View>
//           </View>
//         </View>

//         <View style={styles.transactContainer}>
//           <Text style={styles.transactionText}>Transaction Management</Text>
//         </View>

//         <View style={styles.mainActivitiesContainer}>
//           <View style={styles.firstActivitiesContainer}>
//             <TouchableOpacity style={styles.subActivitiesContainer}>
//               <Image source={require('../../../assets/active_rental.png')} style={styles.image} />
//               <Text>Active Rental</Text>
//             </TouchableOpacity>
//           </View>
//           <View style={styles.activitiesContainer}>
//             <TouchableOpacity style={styles.subActivitiesContainer}>
//               <Image source={require('../../../assets/pending.png')} style={styles.pendingImage} />
//               <Text>Pending</Text>
//             </TouchableOpacity>
//           </View>
//           <View style={styles.activitiesContainer}>
//             <TouchableOpacity style={styles.subActivitiesContainer}>
//               <Image source={require('../../../assets/completed.png')} style={styles.pendingImage} />
//               <Text>Completed</Text>
//             </TouchableOpacity>
//           </View>
//         </View>

//         <View style={styles.mainItemContainer}>
//           <Text style={styles.itemText}>Items for you</Text>
//           {recommendedItems.length === 0 ? (
//             <ActivityIndicator size="large" color="#FFAB00" style={{ marginTop: 20 }} />
//           ) : (
//             recommendedItems.map(renderItem)
//           )}
//         </View>
//       </View>
//     </ScrollView>
//   )
// }

// export default Profile

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#FAF5EF'
//   },
//   header: {
//     marginTop: 30,
//   },
//   profileText: {
//     fontFamily: 'DM-Bold',
//     fontSize: 32,
//     paddingLeft: 20
//   },
//   profileImage: {
//     width: 80,
//     height: 80,
//     alignSelf: 'center',
//     borderRadius: 50
//   },
//   profileContainer: {
//     alignSelf: 'center',
//     width: '90%',
//     marginTop: 10
//   },
//   subprofileContainer: {
//     flexDirection: 'row',
//     backgroundColor: '#FAF5EF',
//     height: 100,
//     borderRadius: 20,
//     paddingLeft: 10,
//     elevation: 10,
//   },
//   subProfileContainer: {
//     flexDirection: 'column',
//     justifyContent: 'center',
//     paddingLeft: 10
//   },
//   nameText: {
//     fontFamily: 'DM-Bold',
//     fontSize: 20
//   },
//   birthdayText: {
//     fontFamily: 'DM-Regular',
//   },
//   transactionText: {
//     fontFamily: 'DM-Bold',
//     fontSize: 20
//   },
//   transactContainer: {
//     paddingLeft: 20,
//     marginTop: 5
//   },
//   mainActivitiesContainer: {
//     flexDirection: 'row'
//   },
//   firstActivitiesContainer: {
//     flexDirection: 'row',
//     paddingLeft: 20,
//     marginTop: 10
//   },
//   activitiesContainer: {
//     flexDirection: 'row',
//     paddingLeft: 10,
//     marginTop: 10
//   },
//   image: {
//     width: 19,
//     height: 25
//   },
//   pendingImage: {
//     width: 25,
//     height: 25
//   },
//   subActivitiesContainer: {
//     flexDirection: 'column',
//     alignItems: 'center'
//   },
//   mainItemContainer: {
//     marginTop: 10,
//     paddingHorizontal: 20
//   },
//   itemText: {
//     fontFamily: 'DM-Bold',
//     fontSize: 20,
//     marginBottom: 10
//   },
//   itemContainer: {
//     marginBottom: 20
//   },
//   itemImageContainer: {
//     backgroundColor: '#FFFFFF',
//     borderRadius: 10,
//     padding: 10,
//     elevation: 2,
//   },
//   itemImage: {
//     width: '100%',
//     height: 120,
//     borderRadius: 10,
//     marginBottom: 10
//   },
//   itemRateContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 5,
//   },
//   itemName: {
//     flex: 1,
//     fontFamily: 'DM-Medium',
//     fontSize: 14
//   },
//   rateImage: {
//     width: 12,
//     height: 12,
//     marginRight: 3
//   },
//   text: {
//     color: '#9C9894',
//     fontSize: 12,
//     marginBottom: 2
//   },
//   moneyText: {
//     color: '#FFAB00',
//     fontFamily: 'DM-Bold',
//     fontSize: 16
//   },
//   likeImage: {
//     width: 20,
//     height: 20,
//     marginLeft: 10
//   },
//   messageImage: {
//     width: 20,
//     height: 20
//   },
//   messageContainer: {
//     marginRight: 10
//   },
//   moneyRateContainer: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginTop: 8
//   },
//   informationContainer: {
//     flexDirection: 'column',
//     alignSelf: 'center',
//     paddingLeft: 10,
//   }
// })


import { Image, StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native'
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../supbaseClient'
import { useNavigation } from '@react-navigation/native'
import { useFavorites } from '../../components/FavoritesContext'
import BookItemModal from '../../components/BookItemModal' // Import BookItemModal

const Profile = () => {
  const navigation = useNavigation()
  const [recommendedItems, setRecommendedItems] = useState([])
  const [userProfile, setUserProfile] = useState(null)
  const [userBookings, setUserBookings] = useState([]) // Track user's bookings - SHARED STATE
  const [bookModalVisible, setBookModalVisible] = useState(false) // Add modal state
  const [selectedItem, setSelectedItem] = useState(null) // Add selected item state

  // Use shared favorites context instead of local state
  const { favorites, currentUser, toggleFavorite, isFavorited, logout } = useFavorites()

  // Fetch user's bookings - SHARED FUNCTION
  const fetchUserBookings = useCallback(async () => {
    if (!currentUser) {
      setUserBookings([])
      return
    }

    try {
      console.log('Fetching user bookings for:', currentUser.id) // Debug log
      const { data, error } = await supabase
        .from('rental_transactions')
        .select('item_id, status')
        .eq('renter_id', currentUser.id)
        .in('status', ['pending', 'confirmed', 'ongoing'])

      if (!error && data) {
        console.log('User bookings fetched:', data) // Debug log
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

    if (bookingStatus) {
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

  // Handle rent now button - UPDATED to show BookItemModal
  const handleRentNow = (item) => {
    if (!currentUser) {
      Alert.alert('Login Required', 'Please log in to rent items')
      return
    }

    if (currentUser.id === item.user_id) {
      Alert.alert('Your Item', 'You cannot rent your own item')
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

    // Show BookItemModal instead of alert
    setSelectedItem(item)
    setBookModalVisible(true)
  }

  useEffect(() => {
    const fetchUserProfile = async () => {
      // currentUser now comes from context
      if (currentUser) {
        const { data, error } = await supabase
          .from('users')
          .select('first_name, last_name, dob, face_image_url')
          .eq('id', currentUser.id)
          .single()

        if (!error) {
          setUserProfile(data)
        }
      }
    }

    fetchUserProfile()
  }, [currentUser]) // currentUser from context

  // Toggle favorites - SIMPLIFIED (now uses context)
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

  const fetchRecommendedItems = useCallback(async () => {
    try {
      let { data, error } = await supabase
        .from("items")
        .select("item_id,user_id,title,description,price_per_day,location,created_at,available,item_status")
        .eq("available", true)
        .eq("item_status", "approved")

      if (error) throw error

      // Shuffle and select 4
      const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, 4)

      const withImages = await Promise.all(
        shuffled.map(async (item) => {
          const imageUrl = await getImageUrl(item.user_id, item.item_id)
          return {
            ...item,
            imageUrl,
            formattedPrice: `₱${item.price_per_day}`,
            formattedDate: new Date(item.created_at).toLocaleDateString()
          }
        })
      )

      setRecommendedItems(withImages)
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

  // Handle message button press - UPDATED to navigate to Chat
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
      // First, get the other user's name
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

      // Create the display name
      const otherUserName = otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'Unknown User'

      // Get or create conversation
      let { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${item.user_id}),and(user1_id.eq.${item.user_id},user2_id.eq.${currentUser.id})`)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }

      if (!conversation) {
        // Create new conversation
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

      // Navigate to chat screen
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

  // Real-time updates for rental transactions - SHARED SUBSCRIPTION
  useEffect(() => {
    if (!currentUser) return

    console.log('Setting up rental transactions real-time subscription') // Debug log
    const channel = supabase
      .channel("rental_transactions_changes") // Use same channel name as Home.tsx
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rental_transactions",
          filter: `renter_id=eq.${currentUser.id}`
        },
        (payload) => {
          console.log('Rental transaction change detected:', payload) // Debug log
          fetchUserBookings()
        }
      )
      .subscribe()

    return () => {
      console.log('Cleaning up rental transactions subscription') // Debug log
      supabase.removeChannel(channel)
    }
  }, [currentUser, fetchUserBookings])

  // Real-time updates for items - SHARED SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel("items_changes") // Use same channel name as Home.tsx
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        () => {
          fetchRecommendedItems()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchRecommendedItems])

  // const handleLogout = async () => {
  //   if (!currentUser) return

  //   try {
  //     await logout() // logs out and clears context

  //     // Clear local state if needed
  //     setUserProfile(null)
  //     setUserBookings([])
  //     setSelectedItem(null)

  //     // Navigate to LandingPage
  //     navigation.reset({
  //       index: 0,
  //       routes: [{ name: 'LandingPage' }],
  //     })
  //   } catch (err) {
  //     console.error('Logout error:', err)
  //     Alert.alert('Error', 'Failed to logout. Please try again.')
  //   }
  // }

  const renderItem = (item) => {
    const isOwner = isUserItem(item)
    const buttonInfo = getButtonInfo(item)

    return (
      <View key={item.item_id} style={styles.itemContainer}>
        <View style={styles.itemImageContainer}>
          <Image
            source={item.imageUrl ? { uri: item.imageUrl } : require('../../../assets/splash-icon.png')}
            style={styles.itemImage}
            resizeMode="cover"
          />
          <View style={styles.itemRateContainer}>
            <Text style={styles.itemName}>{item.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10 }}>
              <Image source={require('../../../assets/rate.png')} style={styles.rateImage} />
              <Text> 5.0</Text>
            </View>
          </View>
          <Text style={styles.text}>{item.location || 'Location not specified'}</Text>
          <Text style={styles.text}>{item.formattedDate}</Text>
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
          {/* Rent Now Button with shared logic */}
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
                  userProfile?.face_image_url
                    ? { uri: userProfile.face_image_url }
                    : require('../../../assets/splash-icon.png') // fallback
                }
                style={styles.profileImage}
              />
              <View style={styles.informationContainer}>
                <Text style={styles.nameText}>
                  {userProfile
                    ? `${userProfile.first_name} ${userProfile.last_name}`
                    : 'Loading...'}
                </Text>

                <Text style={styles.birthdayText}>
                  {userProfile?.dob
                    ? new Date(userProfile.dob).toLocaleDateString()
                    : 'Birthdate not available'}
                </Text>
              </View>
              {/* <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity> */}
            </View>
          </View>

          <View style={styles.transactContainer}>
            <Text style={styles.transactionText}>Transaction Management</Text>
          </View>

          <View style={styles.mainActivitiesContainer}>
            <View style={styles.firstActivitiesContainer}>
              <TouchableOpacity style={styles.subActivitiesContainer}>
                <Image source={require('../../../assets/active_rental.png')} style={styles.image} />
                <Text>Active Rental</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activitiesContainer}>
              <TouchableOpacity style={styles.subActivitiesContainer}>
                <Image source={require('../../../assets/pending.png')} style={styles.pendingImage} />
                <Text>Pending</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.activitiesContainer}>
              <TouchableOpacity style={styles.subActivitiesContainer}>
                <Image source={require('../../../assets/completed.png')} style={styles.pendingImage} />
                <Text>Completed</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.mainItemContainer}>
            <Text style={styles.itemText}>Items for you</Text>
            {recommendedItems.length === 0 ? (
              <ActivityIndicator size="large" color="#FFAB00" style={{ marginTop: 20 }} />
            ) : (
              recommendedItems.map(renderItem)
            )}
          </View>
        </View>
      </ScrollView>

      {/* BookItemModal - Same as Home.tsx */}
      <BookItemModal
        visible={bookModalVisible}
        onClose={() => setBookModalVisible(false)}
        item={selectedItem}
        currentUserId={currentUser?.id}
        onBooked={() => {
          // Refresh user bookings and items after booking
          console.log('Booking completed, refreshing data...') // Debug log
          fetchUserBookings()
          fetchRecommendedItems()
        }}
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
  subProfileContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingLeft: 10
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
  itemText: {
    fontFamily: 'DM-Bold',
    fontSize: 20,
    marginBottom: 10
  },
  itemContainer: {
    marginBottom: 20
  },
  itemImageContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    elevation: 2,
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
  informationContainer: {
    flexDirection: 'column',
    alignSelf: 'center',
    paddingLeft: 10,
  },
  // New styles for rent button
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
    backgroundColor: '#FF8C00', // Orange color for pending status
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
    marginTop: 20,
    backgroundColor: '#FF3B30',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  logoutText: {
    color: '#FFF',
    fontFamily: 'DM-Bold',
    fontSize: 16,
  }

})