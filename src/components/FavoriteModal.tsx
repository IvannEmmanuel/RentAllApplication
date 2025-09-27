"use client"

import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native"
import { useState, useEffect } from "react"
import { supabase } from "../../supbaseClient"
import BookItemModal from "./BookItemModal"
import PictureModal from "./PictureModal"
import { useFavorites } from "./FavoritesContext"

const FavoritesModal = ({
  visible,
  onClose,
  currentUser,
  userBookings, // RECEIVE SHARED STATE
  getUserBookingStatus, // RECEIVE SHARED FUNCTION
  getButtonInfo, // RECEIVE SHARED FUNCTION
  onBookingUpdate, // RECEIVE REFRESH FUNCTION
  onFavoriteRemoved,
  onMessage
}) => {
  const { favorites, toggleFavorite, fetchFavorites } = useFavorites() // Add updateItemQuantity from context
  const [favoriteItems, setFavoriteItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [bookModalVisible, setBookModalVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [pictureModalVisible, setPictureModalVisible] = useState(false)
  const [itemRatings, setItemRatings] = useState({});

  useEffect(() => {
    if (visible) {
      const fetchData = async () => {
        setLoading(true)
        try {
          const favs = await fetchFavorites()
          if (!favs) {
            setFavoriteItems([])
            return
          }

          // Fetch lessor names for each favorite item
          const withLessorNames = await Promise.all(
            favs.map(async (item) => {
              const { data: userData, error: userError } = await supabase
                .from("users")
                .select("first_name,last_name")
                .eq("id", item.user_id)
                .single()

              const lessorName = userData
                ? `${userData.first_name} ${userData.last_name}`
                : "Unknown"

              return {
                ...item,
                lessorName,
              }
            })
          )

          setFavoriteItems(withLessorNames)
        } catch (err) {
          console.error("Error fetching favorite items:", err)
        } finally {
          setLoading(false)
        }
      }

      fetchData()
    }
  }, [visible, fetchFavorites])

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

    // Check if user already has a booking for this item using SHARED function
    const bookingStatus = getUserBookingStatus(item.item_id)
    if (bookingStatus) {
      Alert.alert("Already Booked", `You already have a ${bookingStatus} booking for this item.`)
      return
    }

    setSelectedItem(item)
    setBookModalVisible(true)
  }

  const fetchItemRatings = async (itemIds) => {
    if (!itemIds || itemIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("item_id, rating")
        .in("item_id", itemIds);

      if (error) {
        console.error("Error fetching ratings:", error);
        return;
      }

      const ratingsMap = {};
      (data || []).forEach((r) => {
        const id = String(r.item_id);
        if (!ratingsMap[id]) ratingsMap[id] = { total: 0, count: 0 };
        ratingsMap[id].total += Number(r.rating);
        ratingsMap[id].count += 1;
      });

      const averages = {};
      Object.keys(ratingsMap).forEach((id) => {
        const { total, count } = ratingsMap[id];
        averages[id] = count > 0 ? (total / count).toFixed(1) : null;
      });

      setItemRatings((prev) => ({ ...prev, ...averages }));
    } catch (err) {
      console.error("fetchItemRatings error:", err);
    }
  };


  // Check if item belongs to current user
  const isUserItem = (item) => {
    return currentUser && currentUser.id === item.user_id
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

  const fetchFavoriteItems = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const { data: favoriteIds, error: favError } = await supabase
        .from("favorites")
        .select("item_id")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })

      if (favError) throw favError
      if (!favoriteIds || favoriteIds.length === 0) {
        setFavoriteItems([])
        setLoading(false)
        return
      }

      const itemIds = favoriteIds.map((fav) => fav.item_id)
      const { data: items, error: itemsError } = await supabase
        .from("items")
        .select("item_id,user_id,title,description,price_per_day,deposit_fee,location,created_at,quantity")
        .in("item_id", itemIds)
        .eq("available", true)

      if (itemsError) throw itemsError

      const sortedItems = itemIds.map((id) => items.find((item) => item.item_id === id)).filter(Boolean)

      const withExtras = await Promise.all(
        sortedItems.map(async (item) => {
          // get image
          const imageUrl = await getImageUrl(item.user_id, item.item_id)

          // get lessor name
          const { data: userData } = await supabase
            .from("users")
            .select("first_name,last_name")
            .eq("id", item.user_id)
            .single()

          const lessorName = userData
            ? `${userData.first_name} ${userData.last_name}`
            : "Unknown"

          return {
            ...item,
            imageUrl,
            formattedPrice: `₱${item.price_per_day}`,
            formattedDate: new Date(item.created_at).toLocaleDateString(),
            lessorName,
          }
        })
      )
      await fetchItemRatings(itemIds);

      setFavoriteItems(withExtras);
    } catch (error) {
      console.error("Error fetching favorites:", error)
      Alert.alert("Error", "Failed to load favorite items")
    } finally {
      setLoading(false)
    }
  }

  const removeFavorite = async (itemId) => {
    Alert.alert("Remove Favorite", "Are you sure you want to remove this item from your favorites?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          // 1️⃣ Remove locally for instant UI
          setFavoriteItems((prev) => prev.filter((item) => item.item_id !== itemId))

          // 2️⃣ Remove from global context / database
          try {
            await toggleFavorite(itemId)
          } catch (error) {
            console.error("Error removing favorite:", error)
            Alert.alert("Error", "Failed to remove favorite. Please try again.")
          }
        },
      },
    ])
  }

  useEffect(() => {
    if (visible && currentUser) {
      fetchFavoriteItems()
    }
  }, [visible, currentUser])

  const renderFavoriteItem = (item) => {
    const buttonInfo = getButtonInfo
      ? getButtonInfo(item)
      : {
        text: "Rent Now",
        disabled: false,
        style: "normal",
      }

    return (
      <View key={item.item_id} style={styles.favoriteItem}>
        <View style={styles.itemImageContainer}>
          <TouchableOpacity
            onPress={() => {
              setSelectedItem(item)
              setPictureModalVisible(true)
            }}
          >
            <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
          </TouchableOpacity>
        </View>

        <View style={styles.itemDetails}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <Image source={require("../../assets/rate.png")} style={{ width: 14, height: 14, marginRight: 4 }} />
            <Text style={{ fontSize: 12, color: "#333" }}>
              {itemRatings[String(item.item_id)] ?? "No rating"}
            </Text>
          </View>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.lessorText}>{item.lessorName}</Text>
          <Text style={styles.itemLocation} numberOfLines={1}>
            {item.location || "Location not specified"}
          </Text>
          <Text style={styles.itemDate}>{item.formattedDate}</Text>
          <Text style={styles.itemPrice}>{item.formattedPrice}/day</Text>

          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>Available:</Text>
            <Text style={styles.quantityValue}>{item.quantity || 0}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.rentButton,
              buttonInfo.style === "disabled" && styles.disabledRentButton,
              buttonInfo.style === "pending" && styles.pendingRentButton,
            ]}
            onPress={() => handleRentNow(item)}
            disabled={buttonInfo.disabled}
          >
            <Text
              style={[
                styles.rentButtonText,
                buttonInfo.style === "disabled" && styles.disabledRentButtonText,
                buttonInfo.style === "pending" && styles.pendingRentButtonText,
              ]}
            >
              {buttonInfo.text}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sideButtons}>
          {/* Remove favorite button */}
          <TouchableOpacity style={styles.removeButton} onPress={() => removeFavorite(item.item_id)}>
            <Text style={styles.removeButtonText}>✕</Text>
          </TouchableOpacity>

          {/* Message button */}
          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => onMessage && onMessage(item)}
          >
            <Image source={require("../../assets/message.png")} style={styles.messageIcon} />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Favorites</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFAB00" />
              <Text style={styles.loadingText}>Loading your favorites...</Text>
            </View>
          ) : favorites.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Image source={require("../../assets/heart.png")} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Favorites Yet</Text>
              <Text style={styles.emptySubtitle}>Start exploring and tap the heart icon on items you love!</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.favoritesList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.favoritesContent}
            >
              <Text style={styles.countText}>
                {favorites.length} item{favorites.length !== 1 ? "s" : ""} in your favorites
              </Text>
              {favoriteItems.map((item) => renderFavoriteItem(item))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Book Item Modal */}
      <BookItemModal
        visible={bookModalVisible}
        onClose={() => setBookModalVisible(false)}
        item={selectedItem}
        currentUserId={currentUser?.id}
        onBooked={() => {
          // Call parent's refresh function instead of local one
          console.log("Booking completed in FavoritesModal, calling parent refresh...") // Debug log
          if (onBookingUpdate) {
            onBookingUpdate()
          }
        }}
      />

      <PictureModal
        visible={pictureModalVisible}
        onClose={() => setPictureModalVisible(false)}
        item={selectedItem}
      />
    </>
  )
}

export default FavoritesModal

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF5EF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#FAF5EF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "DM-Bold",
    color: "#333",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  closeButtonText: {
    fontSize: 18,
    color: "#666",
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    fontFamily: "DM-Medium",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    marginBottom: 24,
    opacity: 0.3,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: "DM-Bold",
    color: "#333",
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
  },
  favoritesList: {
    flex: 1,
  },
  favoritesContent: {
    padding: 20,
  },
  countText: {
    fontSize: 16,
    fontFamily: "DM-Medium",
    color: "#666",
    marginBottom: 20,
  },
  favoriteItem: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 12,
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemDetails: {
    flex: 1,
    justifyContent: "space-between",
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: "DM-Bold",
    color: "#333",
    marginBottom: 4,
  },
  itemLocation: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  itemDate: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontFamily: "DM-Bold",
    color: "#FFAB00",
    marginBottom: 8,
  },
  rentButton: {
    backgroundColor: "#000",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  disabledRentButton: {
    backgroundColor: "#CCC",
  },
  pendingRentButton: {
    backgroundColor: "#FF8C00", // Orange color for pending status
  },
  rentButtonText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "DM-Bold",
    textAlign: "center",
  },
  disabledRentButtonText: {
    color: "#999",
  },
  pendingRentButtonText: {
    color: "#FFF",
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FF6B6B",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  removeButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  quantityLabel: {
    fontSize: 12,
    color: "#666",
    marginRight: 8,
    fontFamily: "DM-Medium",
  },
  quantityValue: {
    fontSize: 14,
    fontFamily: "DM-Bold",
    color: "#333",
  },
  sideButtons: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  messageButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageIcon: {
    width: 16,
    height: 16,
    tintColor: "#FFAB00",
  },
  lessorText: {
    fontSize: 12,
    color: "#555",
    marginBottom: 2,
  },
})