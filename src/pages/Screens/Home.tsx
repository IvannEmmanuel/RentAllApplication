"use client"

import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList
} from "react-native"
import { useEffect, useState, useCallback } from "react"
import { supabase } from "../../../supbaseClient"
import FavoritesModal from "../../components/FavoriteModal"
import BookItemModal from "../../components/BookItemModal"
import PictureModal from "../../components/PictureModal"
import { useNavigation } from "@react-navigation/native"
import { useFavorites } from "../../components/FavoritesContext"
import { useFocusEffect } from '@react-navigation/native'
import SkeletonLoadingHome from "../../components/skeletonComponents/SkeletonLoadingHome"

const Home = ({ route }) => {
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
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 6
  const [itemRatings, setItemRatings] = useState({}) // Add this line
  const [pictureModalVisible, setPictureModalVisible] = useState(false)
  const [pictureItem, setPictureItem] = useState(null)
  const [lessorRatings, setLessorRatings] = useState({})

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

  useEffect(() => {
    if (items.length > 0) {
      const itemIds = items.map(item => item.item_id)
      fetchItemRatings(itemIds)
    }
  }, [items, fetchItemRatings])

  const fetchItemRatings = useCallback(async (itemIds) => {
    if (!itemIds || itemIds.length === 0) return

    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("item_id, rating")
        .in("item_id", itemIds)

      if (error) {
        console.error("Error fetching ratings:", error)
        return
      }

      // Calculate average ratings for each item
      const ratingsMap = {}
      data.forEach(review => {
        if (!ratingsMap[review.item_id]) {
          ratingsMap[review.item_id] = { total: 0, count: 0 }
        }
        ratingsMap[review.item_id].total += review.rating
        ratingsMap[review.item_id].count += 1
      })

      // Convert to average ratings
      const averageRatings = {}
      Object.keys(ratingsMap).forEach(itemId => {
        const { total, count } = ratingsMap[itemId]
        averageRatings[itemId] = count > 0 ? (total / count).toFixed(1) : null
      })

      setItemRatings(prev => ({ ...prev, ...averageRatings }))
    } catch (error) {
      console.error("Error calculating ratings:", error)
    }
  }, [])

  // When screen is focused, fetch items. If route param resetToAll is set, clear filters first.
  // useFocusEffect(
  //   useCallback(() => {
  //     console.log("Home screen focused, fetching items")
  //     if (route?.params?.resetToAll) {
  //       // reset filters to "All"
  //       setSelectedCategoryId("")
  //       setSearchTerm("")
  //       // clear the flag so it won't re-trigger repeatedly
  //       if (navigation?.setParams) {
  //         navigation.setParams({ resetToAll: false })
  //       }
  //     }
  //     setPage(1)
  //     fetchItems(1, false)
  //   }, [fetchItems, route?.params?.resetToAll])
  // )

  useFocusEffect(
    useCallback(() => {
      console.log("Home screen focused")

      // Only reset filters if explicitly requested
      if (route?.params?.resetToAll) {
        setSelectedCategoryId("")
        setSearchTerm("")
        // Clear the flag
        if (navigation?.setParams) {
          navigation.setParams({ resetToAll: false })
        }
        // Only fetch if we reset filters
        setPage(1)
        fetchItems(1, false)
      }
      // Otherwise, don't refetch - keep the existing data
    }, [route?.params?.resetToAll])
  )

  const dedupeItems = (itemsArray) => {
    const map = new Map()
    itemsArray.forEach((i) => map.set(i.item_id, i))
    return Array.from(map.values())
  }

  useEffect(() => {
    setPage(1)
    fetchItems(1, false)
  }, [fetchItems, searchTerm, selectedCategoryId])

  // Fetch user's bookings - SHARED FUNCTION
  const fetchUserBookings = useCallback(async () => {
    if (!currentUser) {
      setUserBookings([])
      return
    }

    try {
      console.log("Fetching user bookings for:", currentUser.id)
      const { data, error } = await supabase
        .from("rental_transactions")
        .select("item_id, status")
        .eq("renter_id", currentUser.id)
        .in("status", ["pending", "confirmed", "ongoing"])

      if (!error && data) {
        console.log("User bookings fetched:", data)
        setUserBookings(data)
      } else if (error) {
        console.error("Error fetching bookings:", error)
      }
    } catch (error) {
      console.error("Error fetching user bookings:", error)
    }
  }, [currentUser])

  // Check if user has pending/active booking for an item - SHARED FUNCTION
  const getUserBookingStatus = useCallback(
    (itemId) => {
      const status = userBookings.find((booking) => booking.item_id === itemId)?.status || null
      return status
    },
    [userBookings],
  )

  // Handle rent now button
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

  // Check if item belongs to current user
  const isUserItem = (item) => {
    return currentUser && currentUser.id === item.user_id
  }

  // Get button text and style based on item status - SHARED FUNCTION
  const getButtonInfo = useCallback(
    (item) => {
      const isOwner = isUserItem(item)
      const bookingStatus = getUserBookingStatus(item.item_id)

      if (isOwner) {
        return {
          text: "Your Item",
          disabled: true,
          style: "disabled",
        }
      }

      // Only disable button if booking is pending/confirmed/ongoing
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
  )

  // Toggle favorite
  const handleToggleFavorite = async (itemId) => {
    const result = await contextToggleFavorite(itemId)
    if (!result.success && result.message) {
      Alert.alert("Error", result.message)
    }
  }

  // Handle message button press
  const handleMessage = async (item) => {
    if (!currentUser) {
      Alert.alert("Login Required", "Please log in to send messages")
      return
    }

    if (currentUser.id === item.user_id) {
      Alert.alert("Cannot Message", "You cannot send a message to yourself")
      return
    }

    try {
      const { data: otherUser, error: userError } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", item.user_id)
        .single()

      if (userError) {
        console.error("Error fetching user:", userError)
        Alert.alert("Error", "Failed to get user information")
        return
      }

      const otherUserName = otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : "Unknown User"

      let { data: conversation, error } = await supabase
        .from("conversations")
        .select("*")
        .or(
          `and(user1_id.eq.${currentUser.id},user2_id.eq.${item.user_id}),and(user1_id.eq.${item.user_id},user2_id.eq.${currentUser.id})`,
        )
        .single()

      if (error && error.code !== "PGRST116") {
        throw error
      }

      if (!conversation) {
        const { data: newConversation, error: createError } = await supabase
          .from("conversations")
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
          .single()

        if (createError) throw createError
        conversation = newConversation
      }

      navigation.navigate("Chat", {
        conversationId: conversation.id,
        otherUserId: item.user_id,
        otherUserName: otherUserName,
        itemTitle: item.title,
        itemId: item.item_id,
      })
    } catch (error) {
      console.error("Error creating/finding conversation:", error)
      Alert.alert("Error", "Failed to start conversation")
    }
  }

  const getImageUrl = async (userId, itemId) => {
    try {
      const dir = `${userId}/${itemId}`
      const { data: files, error } = await supabase.storage.from("Items-photos").list(dir, {
        limit: 1,
        sortBy: { column: "name", order: "desc" },
      })

      if (error || !files || files.length === 0) return undefined

      const file = files[0]
      const fullPath = `${dir}/${file.name}`
      const { data: pub } = supabase.storage.from("Items-photos").getPublicUrl(fullPath)

      return pub?.publicUrl
    } catch (e) {
      console.warn("image list failed", e.message)
      return undefined
    }
  }

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase.from("categories").select("category_id,name").order("name")
    if (!error) setCategories(data || [])
  }, [])

  // OPTIMIZED: fetchItems with loading control
  const fetchItems = useCallback(
    async (pageNum = 1, append = false) => {
      if (pageNum === 1) setLoading(true)

      try {
        const baseSelect =
          "item_id,user_id,category_id,title,description,price_per_day,deposit_fee,location,available,created_at,item_status,quantity"

        let query = supabase
          .from("items")
          .select(baseSelect)
          .eq("available", true)
          .eq("item_status", "approved")
          .order("created_at", { ascending: false })
          .range((pageNum - 1) * LIMIT, pageNum * LIMIT - 1)

        if (selectedCategoryId) {
          query = query.eq("category_id", Number(selectedCategoryId))
        }

        // 👇 add this for searching
        if (searchTerm.trim() !== "") {
          query = query.or(
            `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`
          )
        }

        let { data, error } = await query
        if (error) throw error

        const withImages = await Promise.all(
          (data || []).map(async (item) => {
            const imageUrl = await getImageUrl(item.user_id, item.item_id)
            const { data: userData } = await supabase
              .from("users")
              .select("id, first_name, last_name")
              .eq("id", item.user_id)
              .single()

            const lessorName = userData ? `${userData.first_name} ${userData.last_name}` : "Unknown"
            return {
              ...item,
              imageUrl,
              lessorId: userData?.id,
              lessorName,
              formattedPrice: `₱${item.price_per_day}`,
              formattedDate: new Date(item.created_at).toLocaleDateString(),
            }
          }),
        )

        const lessorIds = withImages.map(item => item.lessorId).filter(Boolean)
        fetchLessorRatings(lessorIds)

        setItems((prev) => {
          const merged = append ? [...prev, ...withImages] : withImages
          const deduped = dedupeItems(merged)

          // Fetch ratings for the items
          const itemIds = deduped.map(item => item.item_id)
          fetchItemRatings(itemIds)

          return deduped
        })
        setHasMore((data || []).length === LIMIT)
      } catch (e) {
        console.error("Fetch items failed:", e.message)
      } finally {
        if (pageNum === 1) setLoading(false)
      }
    },
    [selectedCategoryId, searchTerm], // 👈 searchTerm dependency added
  )

  // SMART UPDATE: Handle real-time payload intelligently
  const handleItemsRealtimeUpdate = useCallback(
    async (payload) => {
      console.log("Items realtime update:", payload)

      const { eventType, new: newRecord, old: oldRecord } = payload

      switch (eventType) {
        case "INSERT":
          if (newRecord.item_status === "approved" && newRecord.available) {
            const imageUrl = await getImageUrl(newRecord.user_id, newRecord.item_id)

            setItems((prevItems) => {
              const merged = [
                {
                  ...newRecord,
                  imageUrl,
                  formattedPrice: `₱${newRecord.price_per_day}`,
                  formattedDate: new Date(newRecord.created_at).toLocaleDateString(),
                  quantity: newRecord.quantity,
                },
                ...prevItems,
              ]
              return dedupeItems(merged)
            })
          }
          break

        case "UPDATE": {
          const imageUrl = await getImageUrl(newRecord.user_id, newRecord.item_id)

          setItems((prevItems) => {
            const exists = prevItems.some((item) => item.item_id === newRecord.item_id)

            if (newRecord.item_status !== "approved" || !newRecord.available) {
              return prevItems.filter((item) => item.item_id !== newRecord.item_id)
            }

            let merged
            if (exists) {
              // Update existing
              merged = prevItems.map((item) =>
                item.item_id === newRecord.item_id
                  ? {
                    ...item,
                    ...newRecord,
                    imageUrl,
                    formattedPrice: `₱${newRecord.price_per_day}`,
                    formattedDate: new Date(newRecord.created_at).toLocaleDateString(),
                  }
                  : item,
              )
            } else {
              // If was pending → approved
              merged = [
                {
                  ...newRecord,
                  imageUrl,
                  formattedPrice: `₱${newRecord.price_per_day}`,
                  formattedDate: new Date(newRecord.created_at).toLocaleDateString(),
                },
                ...prevItems,
              ]
            }

            // ✅ Ensure no duplicates sneak in
            return dedupeItems(merged)
          })
        }
          break

        case "DELETE":
          setItems((prevItems) => prevItems.filter((item) => item.item_id !== oldRecord.item_id))
          break

        default:
          fetchItems(false)
      }
    },
    [fetchItems],
  )

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
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, handleItemsRealtimeUpdate)
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
        },
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
          <TouchableOpacity
            onPress={() => {
              setPictureItem(item)
              setPictureModalVisible(true)
            }}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
            ) : (
              <Image source={require("../../../assets/splash-icon.png")} style={styles.itemImage} resizeMode="cover" />
            )}
          </TouchableOpacity>
          <View style={styles.itemRateContainer}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Image source={require("../../../assets/rate.png")} style={styles.rateImage} />
              <Text> {itemRatings[item.item_id] || "No rating"}</Text>
            </View>
          </View>
          <Text style={styles.itemName}>{item.title}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("LessorReviews", { lessorId: item.lessorId })}
            style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start" }}
          >
            <Text style={styles.lessorText}>{item.lessorName}</Text>
            <Image source={require("../../../assets/rate.png")} style={styles.lessorRateImage} />
            <Text style={styles.lessorText}>{lessorRatings[item.lessorId] || "No rating"}</Text>
          </TouchableOpacity>
          <View style={{ alignSelf: "baseline", width: "100%" }}>
            <Text style={styles.text}>{item.location || "Location not specified"}</Text>
            <Text style={styles.text}>{item.formattedDate}</Text>
            <Text style={styles.text}>Quantity: {item.quantity ?? 1}</Text>
            <View style={styles.moneyRateContainer}>
              <Text style={styles.moneyText}>{item.formattedPrice}</Text>
              <View style={{ justifyContent: "flex-end", flexDirection: "row" }}>
                {!isOwner && (
                  <TouchableOpacity style={styles.messageContainer} onPress={() => handleMessage(item)}>
                    <Image source={require("../../../assets/message.png")} style={styles.messageImage} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleToggleFavorite(item.item_id)}>
                  <Image
                    source={
                      isFavorited(item.item_id)
                        ? require("../../../assets/liked.png")
                        : require("../../../assets/like.png")
                    }
                    style={styles.likeImage}
                  />
                </TouchableOpacity>
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
      </View >
    )
  }

  return (
    <>
      <FlatList
        style={styles.container}
        data={items}
        keyExtractor={(item) => item.item_id.toString()}
        renderItem={({ item }) => (
          <View style={styles.itemWrapper}>{renderItem(item)}</View>
        )}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: 10 }}
        contentContainerStyle={{ paddingBottom: 50 }}
        ListHeaderComponent={
          <>
            {/* Top menu bar & categories stay same */}
            <View style={styles.topMenuBar}>
              <TextInput
                placeholder="Search"
                placeholderTextColor={"#9c9c9cff"}
                style={styles.searchContainer}
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
              <TouchableOpacity onPress={() => setFavoritesModalVisible(true)}>
                <View style={styles.heartContainer}>
                  <Image source={require("../../../assets/heart.png")} style={styles.heartLogo} />
                  <Text>Likes({favorites.length})</Text>
                </View>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
              <TouchableOpacity onPress={() => setSelectedCategoryId("")}>
                <Text style={[styles.categoriesText, selectedCategoryId === "" && styles.selectedCategoryText]}>All</Text>
              </TouchableOpacity>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.category_id}
                  onPress={() =>
                    setSelectedCategoryId(
                      selectedCategoryId === String(category.category_id) ? "" : String(category.category_id),
                    )
                  }
                >
                  <Text
                    style={[
                      styles.categoriesText,
                      selectedCategoryId === String(category.category_id) && styles.selectedCategoryText,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.itemTextContainer}>
              <Text style={styles.itemText}>Items</Text>
            </View>

            {/* Show skeleton loading when initial loading */}
            {loading && page === 1 && <SkeletonLoadingHome />}
          </>
        }
        ListFooterComponent={
          loading && page > 1 ? (
            <ActivityIndicator size="large" color="#FFAB00" style={{ marginVertical: 20 }} />
          ) : hasMore ? (
            <ActivityIndicator size="large" color="#FFAB00" style={{ marginVertical: 20 }} />
          ) : (
            <Text style={{ textAlign: "center", marginVertical: 20 }}>No more items</Text>
          )
        }
        onEndReached={() => {
          if (hasMore && !loading) {
            const nextPage = page + 1
            setPage(nextPage)
            fetchItems(nextPage, true)
          }
        }}
        onEndReachedThreshold={0.5}
      />

      {/* Your existing modals remain the same */}
      <FavoritesModal
        visible={favoritesModalVisible}
        onClose={() => setFavoritesModalVisible(false)}
        currentUser={currentUser}
        userBookings={userBookings}
        getUserBookingStatus={getUserBookingStatus}
        getButtonInfo={getButtonInfo}
        onBookingUpdate={fetchUserBookings}
        onFavoriteRemoved={(itemId) => { }}
        onMessage={(item) => handleMessage(item)}
      />

      <BookItemModal
        visible={bookModalVisible}
        onClose={() => setBookModalVisible(false)}
        item={selectedItem}
        currentUserId={currentUser?.id}
        onBooked={() => {
          console.log("Booking completed, refreshing data...")
          setPage(1)
          fetchUserBookings()
          fetchItems(1, false)
        }}
      />

      <PictureModal
        visible={pictureModalVisible}
        onClose={() => setPictureModalVisible(false)}
        item={pictureItem}
      />
    </>
  )
}

export default Home

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FAF5EF",
    flex: 1,
    marginTop: 40,
  },
  topMenuBar: {
    flexDirection: "row",
    alignSelf: "center",
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchContainer: {
    width: "80%",
    height: 40,
    borderWidth: 1,
    borderColor: "#9c9c9cff",
    borderRadius: 20,
    paddingLeft: 20,
  },
  heartContainer: {
    flexDirection: "column",
    paddingLeft: 10,
    alignItems: "center",
  },
  heartLogo: {
    width: 30,
    height: 26.5,
  },
  categoriesContainer: {
    paddingLeft: 10,
    marginBottom: 10,
  },
  categoriesText: {
    fontFamily: "DM-Bold",
    margin: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
  },
  selectedCategoryText: {
    backgroundColor: "#FFAB00",
    color: "#FFFFFF",
  },
  itemTextContainer: {
    paddingLeft: 10,
    paddingVertical: 10,
  },
  itemText: {
    fontFamily: "DM-Bold",
    fontSize: 32,
    paddingLeft: 10,
  },
  itemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    justifyContent: "space-between",
  },
  itemWrapper: {
    width: "48%",
    marginBottom: 15,
  },
  itemContainer: {
    flex: 1,
  },
  itemImageContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  itemImage: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    marginBottom: 10,
  },
  itemRateContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 30,
  },
  itemName: {
    flex: 1,
    fontFamily: "DM-Medium",
    fontSize: 16,
  },
  rateImage: {
    width: 12,
    height: 12,
    marginRight: 3,
    alignSelf: 'center'
  },
  lessorRateImage: {
    width: 10,
    height: 10,
    marginRight: 3,
    alignSelf: 'center'
  },
  text: {
    color: "#9C9894",
    fontSize: 12,
    marginBottom: 2,
  },
  moneyText: {
    color: "#FFAB00",
    fontFamily: "DM-Bold",
    fontSize: 16,
  },
  likeImage: {
    width: 20,
    height: 20,
  },
  messageImage: {
    width: 20,
    height: 20,
  },
  messageContainer: {
    right: 5,
  },
  moneyRateContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: 130,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
    color: "#9C9894",
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyText: {
    color: "#9C9894",
    fontSize: 18,
    fontFamily: "DM-Medium",
  },
  rentNowContainer: {
    justifyContent: "center",
    marginTop: 10,
  },
  buttonContainer: {
    backgroundColor: "#000",
    borderRadius: 10,
    height: 30,
    justifyContent: "center",
    alignSelf: "flex-end",
    width: "70%",
  },
  disabledButtonContainer: {
    backgroundColor: "#CCC",
  },
  pendingButtonContainer: {
    backgroundColor: "#FF8C00",
  },
  rentText: {
    color: "#FFF",
    fontFamily: "DM-Medium",
    textAlign: "center",
  },
  disabledRentText: {
    color: "#999",
  },
  pendingRentText: {
    color: "#FFF",
  },
  lessorText: {
    fontSize: 12,
    color: "#555",
    marginBottom: 2,
    marginRight: 3,
  },
})