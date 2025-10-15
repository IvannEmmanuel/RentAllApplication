import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  FlatList,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

import { supabase } from "../../../supbaseClient";
import { useFavorites } from "../../components/FavoritesContext";
import FavoritesModal from "../../components/FavoriteModal";
import BookItemModal from "../../components/BookItemModal";
import PictureModal from "../../components/PictureModal";
import SkeletonLoadingHome from "../../components/skeletonComponents/SkeletonLoadingHome";
import SkeletonLoadingMore from "../../components/skeletonComponents/SkeletonLoadingMore";

// ============================================================================
// CONSTANTS
// ============================================================================
const ITEMS_PER_PAGE = 6;
const SEARCH_DEBOUNCE_MS = 500;
const SEARCH_LIMIT = 10;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const deduplicateItems = (items) => {
  const map = new Map();
  items.forEach((item) => map.set(item.item_id, item));
  return Array.from(map.values());
};

const formatPrice = (price) => `₱${price}`;

const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

const getInitials = (firstName, lastName) => {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return `${first}${last}`.toUpperCase();
};

// ============================================================================
// DATA FETCHING SERVICES
// ============================================================================
class ImageService {
  static async getImageUrl(userId, itemId) {
    try {
      const dir = `${userId}/${itemId}`;
      const { data: files, error } = await supabase.storage
        .from("Items-photos")
        .list(dir, {
          limit: 1,
          sortBy: { column: "name", order: "desc" },
        });

      if (error || !files?.length) return undefined;

      const fullPath = `${dir}/${files[0].name}`;
      const { data: pub } = supabase.storage
        .from("Items-photos")
        .getPublicUrl(fullPath);

      return pub?.publicUrl;
    } catch (error) {
      console.warn("Image fetch failed:", error.message);
      return undefined;
    }
  }
}

class RatingsService {
  static async fetchItemRatings(itemIds) {
    if (!itemIds?.length) return {};

    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("item_id, rating")
        .in("item_id", itemIds);

      if (error) throw error;

      return this._calculateAverageRatings(data, "item_id");
    } catch (error) {
      console.error("Error fetching item ratings:", error);
      return {};
    }
  }

  static async fetchLessorRatings(lessorIds) {
    if (!lessorIds?.length) return {};

    try {
      const { data, error } = await supabase
        .from("lessor_reviews")
        .select("lessor_id, rating")
        .in("lessor_id", lessorIds);

      if (error) throw error;

      return this._calculateAverageRatings(data, "lessor_id");
    } catch (error) {
      console.error("Error fetching lessor ratings:", error);
      return {};
    }
  }

  static _calculateAverageRatings(data, idKey) {
    const ratingsMap = {};

    data.forEach((review) => {
      const id = review[idKey];
      if (!ratingsMap[id]) {
        ratingsMap[id] = { total: 0, count: 0 };
      }
      ratingsMap[id].total += review.rating;
      ratingsMap[id].count += 1;
    });

    const averageRatings = {};
    Object.entries(ratingsMap).forEach(([id, { total, count }]) => {
      averageRatings[id] = count > 0 ? (total / count).toFixed(1) : null;
    });

    return averageRatings;
  }
}

class ItemsService {
  static async fetchItems(page, categoryId) {
    try {
      const baseSelect =
        "item_id,user_id,category_id,title,description,price_per_day,deposit_fee,location,available,created_at,item_status,quantity";

      let query = supabase
        .from("items")
        .select(baseSelect)
        .eq("available", true)
        .eq("item_status", "approved")
        .order("created_at", { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (categoryId) {
        query = query.eq("category_id", Number(categoryId));
      }

      const { data, error } = await query;
      if (error) throw error;

      return await this._enrichItemsData(data || []);
    } catch (error) {
      console.error("Error fetching items:", error);
      throw error;
    }
  }

  static async _enrichItemsData(items) {
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const [imageUrl, userData] = await Promise.all([
          ImageService.getImageUrl(item.user_id, item.item_id),
          this._fetchUserData(item.user_id),
        ]);

        const lessorName = userData
          ? `${userData.first_name} ${userData.last_name}`
          : "Unknown";

        return {
          ...item,
          imageUrl,
          lessorId: userData?.id,
          lessorName,
          formattedPrice: formatPrice(item.price_per_day),
          formattedDate: formatDate(item.created_at),
        };
      })
    );

    return enrichedItems;
  }

  static async _fetchUserData(userId) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .eq("id", userId)
        .single();

      return error ? null : data;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  }
}

class SearchService {
  static async search(searchTerm) {
    try {
      const [usersData, itemsData] = await Promise.all([
        this._searchUsers(searchTerm),
        this._searchItems(searchTerm),
      ]);

      return {
        users: usersData || [],
        items: itemsData || [],
      };
    } catch (error) {
      console.error("Search failed:", error);
      throw error;
    }
  }

  static async _searchUsers(searchTerm) {
    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, last_name, face_image_url")
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
      .limit(SEARCH_LIMIT);

    if (error) throw error;
    return data;
  }

  static async _searchItems(searchTerm) {
    const { data, error } = await supabase
      .from("items")
      .select(
        "item_id, user_id, category_id, title, description, price_per_day, deposit_fee, location, available, created_at, item_status, quantity"
      )
      .eq("available", true)
      .eq("item_status", "approved")
      .or(
        `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`
      )
      .limit(SEARCH_LIMIT);

    if (error) throw error;
    return await ItemsService._enrichItemsData(data || []);
  }
}

class BookingsService {
  static async fetchUserBookings(userId) {
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from("rental_transactions")
        .select("item_id, status")
        .eq("renter_id", userId)
        .in("status", ["pending", "confirmed", "ongoing"]);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      return [];
    }
  }
}

class CategoriesService {
  static async fetchCategories() {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("category_id, name")
        .order("name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  }
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================
const useSearch = (searchTerm) => {
  const [searchResults, setSearchResults] = useState({ users: [], items: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const timerId = setTimeout(async () => {
      const trimmed = searchTerm.trim();

      if (!trimmed) {
        setShowResults(false);
        setSearchResults({ users: [], items: [] });
        return;
      }

      setIsSearching(true);
      try {
        const results = await SearchService.search(trimmed);
        setSearchResults(results);
        setShowResults(true);
      } catch (error) {
        Alert.alert("Error", "Search failed");
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timerId);
  }, [searchTerm]);

  return { searchResults, isSearching, showResults, setShowResults };
};

const useRatings = () => {
  const [itemRatings, setItemRatings] = useState({});
  const [lessorRatings, setLessorRatings] = useState({});

  const fetchItemRatings = useCallback(async (itemIds) => {
    const ratings = await RatingsService.fetchItemRatings(itemIds);
    setItemRatings((prev) => ({ ...prev, ...ratings }));
  }, []);

  const fetchLessorRatings = useCallback(async (lessorIds) => {
    const ratings = await RatingsService.fetchLessorRatings(lessorIds);
    setLessorRatings((prev) => ({ ...prev, ...ratings }));
  }, []);

  return {
    itemRatings,
    lessorRatings,
    fetchItemRatings,
    fetchLessorRatings,
  };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const Home = ({ route }) => {
  const navigation = useNavigation();
  const { favorites, currentUser, toggleFavorite, isFavorited } = useFavorites();

  // State Management
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [userBookings, setUserBookings] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Modal States
  const [favoritesModalVisible, setFavoritesModalVisible] = useState(false);
  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [pictureModalVisible, setPictureModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pictureItem, setPictureItem] = useState(null);

  // Custom Hooks
  const { searchResults, isSearching, showResults, setShowResults } =
    useSearch(searchTerm);
  const { itemRatings, lessorRatings, fetchItemRatings, fetchLessorRatings } =
    useRatings();

  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  const loadItems = useCallback(
    async (pageNum = 1, append = false) => {
      if (showResults) return;

      if (pageNum === 1) setLoading(true);

      try {
        const fetchedItems = await ItemsService.fetchItems(
          pageNum,
          selectedCategoryId
        );

        const itemIds = fetchedItems.map((item) => item.item_id);
        const lessorIds = fetchedItems
          .map((item) => item.lessorId)
          .filter(Boolean);

        await Promise.all([
          fetchItemRatings(itemIds),
          fetchLessorRatings(lessorIds),
        ]);

        setItems((prev) => {
          const merged = append ? [...prev, ...fetchedItems] : fetchedItems;
          return deduplicateItems(merged);
        });

        setHasMore(fetchedItems.length === ITEMS_PER_PAGE);
      } catch (error) {
        console.error("Failed to load items:", error);
      } finally {
        setLoading(false);
      }
    },
    [
      selectedCategoryId,
      showResults,
      fetchItemRatings,
      fetchLessorRatings,
    ]
  );

  const loadUserBookings = useCallback(async () => {
    if (!currentUser) {
      setUserBookings([]);
      return;
    }

    const bookings = await BookingsService.fetchUserBookings(currentUser.id);
    setUserBookings(bookings);
  }, [currentUser]);

  const loadCategories = useCallback(async () => {
    const categoriesData = await CategoriesService.fetchCategories();
    setCategories(categoriesData);
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  useFocusEffect(
    useCallback(() => {
      if (route?.params?.resetToAll) {
        setSelectedCategoryId("");
        setSearchTerm("");
        setShowResults(false);
        navigation.setParams?.({ resetToAll: false });
        setPage(1);
        loadItems(1, false);
      }
    }, [route?.params?.resetToAll, navigation, loadItems])
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!showResults) {
      setPage(1);
      loadItems(1, false);
    }
  }, [showResults, selectedCategoryId]);

  useEffect(() => {
    if (currentUser) {
      loadUserBookings();
    }
  }, [currentUser, loadUserBookings]);

  // Realtime Subscriptions
  useEffect(() => {
    const handleRealtimeUpdate = async (payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case "INSERT":
          if (newRecord.item_status === "approved" && newRecord.available) {
            const imageUrl = await ImageService.getImageUrl(
              newRecord.user_id,
              newRecord.item_id
            );
            setItems((prev) =>
              deduplicateItems([
                {
                  ...newRecord,
                  imageUrl,
                  formattedPrice: formatPrice(newRecord.price_per_day),
                  formattedDate: formatDate(newRecord.created_at),
                },
                ...prev,
              ])
            );
          }
          break;

        case "UPDATE": {
          const imageUrl = await ImageService.getImageUrl(
            newRecord.user_id,
            newRecord.item_id
          );

          setItems((prev) => {
            if (
              newRecord.item_status !== "approved" ||
              !newRecord.available
            ) {
              return prev.filter((item) => item.item_id !== newRecord.item_id);
            }

            const exists = prev.some(
              (item) => item.item_id === newRecord.item_id
            );
            const updated = exists
              ? prev.map((item) =>
                  item.item_id === newRecord.item_id
                    ? {
                        ...item,
                        ...newRecord,
                        imageUrl,
                        formattedPrice: formatPrice(newRecord.price_per_day),
                        formattedDate: formatDate(newRecord.created_at),
                      }
                    : item
                )
              : [
                  {
                    ...newRecord,
                    imageUrl,
                    formattedPrice: formatPrice(newRecord.price_per_day),
                    formattedDate: formatDate(newRecord.created_at),
                  },
                  ...prev,
                ];

            return deduplicateItems(updated);
          });
          break;
        }

        case "DELETE":
          setItems((prev) =>
            prev.filter((item) => item.item_id !== oldRecord.item_id)
          );
          break;

        default:
          loadItems(1, false);
      }
    };

    const itemsChannel = supabase
      .channel("items_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        handleRealtimeUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(itemsChannel);
    };
  }, [loadItems]);

  useEffect(() => {
    if (!currentUser) return;

    const transactionsChannel = supabase
      .channel("rental_transactions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rental_transactions",
          filter: `renter_id=eq.${currentUser.id}`,
        },
        () => loadUserBookings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(transactionsChannel);
    };
  }, [currentUser, loadUserBookings]);

  // ============================================================================
  // BUSINESS LOGIC
  // ============================================================================
  const getUserBookingStatus = useCallback(
    (itemId) => {
      return (
        userBookings.find((booking) => booking.item_id === itemId)?.status ||
        null
      );
    },
    [userBookings]
  );

  const isUserItem = useCallback(
    (item) => currentUser?.id === item.user_id,
    [currentUser]
  );

  const getButtonInfo = useCallback(
    (item) => {
      if (isUserItem(item)) {
        return { text: "Your Item", disabled: true, style: "disabled" };
      }

      const bookingStatus = getUserBookingStatus(item.item_id);
      if (bookingStatus && bookingStatus !== "completed") {
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
    },
    [getUserBookingStatus, isUserItem]
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  const handleRentNow = useCallback(
    (item) => {
      if (!currentUser) {
        Alert.alert("Login Required", "Please log in to rent items");
        return;
      }

      if (isUserItem(item)) {
        Alert.alert("Your Item", "You cannot rent your own item");
        return;
      }

      const bookingStatus = getUserBookingStatus(item.item_id);
      if (bookingStatus) {
        Alert.alert(
          "Already Booked",
          `You already have a ${bookingStatus} booking for this item.`
        );
        return;
      }

      setSelectedItem(item);
      setBookModalVisible(true);
    },
    [currentUser, isUserItem, getUserBookingStatus]
  );

  const handleToggleFavorite = useCallback(
    async (itemId) => {
      const result = await toggleFavorite(itemId);
      if (!result.success && result.message) {
        Alert.alert("Error", result.message);
      }
    },
    [toggleFavorite]
  );

  const handleMessage = useCallback(
    async (item) => {
      if (!currentUser) {
        Alert.alert("Login Required", "Please log in to send messages");
        return;
      }

      if (isUserItem(item)) {
        Alert.alert("Cannot Message", "You cannot send a message to yourself");
        return;
      }

      try {
        const { data: otherUser, error: userError } = await supabase
          .from("users")
          .select("first_name, last_name")
          .eq("id", item.user_id)
          .single();

        if (userError) throw userError;

        const otherUserName = otherUser
          ? `${otherUser.first_name} ${otherUser.last_name}`
          : "Unknown User";

        let { data: conversation, error } = await supabase
          .from("conversations")
          .select("*")
          .or(
            `and(user1_id.eq.${currentUser.id},user2_id.eq.${item.user_id}),and(user1_id.eq.${item.user_id},user2_id.eq.${currentUser.id})`
          )
          .single();

        if (error && error.code !== "PGRST116") throw error;

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
            .single();

          if (createError) throw createError;
          conversation = newConversation;
        }

        navigation.navigate("Chat", {
          conversationId: conversation.id,
          otherUserId: item.user_id,
          otherUserName,
          itemTitle: item.title,
          itemId: item.item_id,
        });
      } catch (error) {
        console.error("Error creating conversation:", error);
        Alert.alert("Error", "Failed to start conversation");
      }
    },
    [currentUser, isUserItem, navigation]
  );

  const handleLoadMore = useCallback(() => {
    if (!showResults && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadItems(nextPage, true);
    }
  }, [showResults, hasMore, loading, page, loadItems]);

  const handlePicturePress = useCallback((item) => {
    setPictureItem(item);
    setPictureModalVisible(true);
  }, []);

  const handleLessorPress = useCallback(
    (lessorId) => {
      navigation.navigate("LessorReviews", { lessorId });
    },
    [navigation]
  );

  const handleBookingComplete = useCallback(() => {
    setPage(1);
    loadUserBookings();
    loadItems(1, false);
  }, [loadUserBookings, loadItems]);

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================
  const renderUserResult = useCallback(
    (user) => (
      <TouchableOpacity
        style={styles.userResultContainer}
        onPress={() => handleLessorPress(user.id)}
      >
        <View style={styles.userImageContainer}>
          {user.face_image_url ? (
            <Image
              source={{ uri: user.face_image_url }}
              style={styles.userImage}
            />
          ) : (
            <View style={styles.userPlaceholder}>
              <Text style={styles.userPlaceholderText}>
                {getInitials(user.first_name, user.last_name)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {user.first_name} {user.last_name}
          </Text>
          <Text style={styles.userType}>Lessor</Text>
        </View>
      </TouchableOpacity>
    ),
    [handleLessorPress]
  );

  const renderItemCard = useCallback(
    (item) => {
      const buttonInfo = getButtonInfo(item);
      const isOwner = isUserItem(item);

      return (
        <View style={styles.itemContainer}>
          <View style={styles.itemImageContainer}>
            <TouchableOpacity onPress={() => handlePicturePress(item)}>
              <Image
                source={
                  item.imageUrl
                    ? { uri: item.imageUrl }
                    : require("../../../assets/splash-icon.png")
                }
                style={styles.itemImage}
                resizeMode="cover"
              />
            </TouchableOpacity>

            <View style={styles.itemRateContainer}>
              <View style={styles.ratingRow}>
                <Image
                  source={require("../../../assets/rate.png")}
                  style={styles.rateImage}
                />
                <Text style={styles.ratingText}>
                  {itemRatings[item.item_id] || "No rating"}
                </Text>
              </View>
            </View>

            <Text style={styles.itemName} numberOfLines={2}>
              {item.title}
            </Text>

            <TouchableOpacity
              onPress={() => handleLessorPress(item.lessorId)}
              style={styles.lessorContainer}
            >
              <Text style={styles.lessorText} numberOfLines={1}>
                {item.lessorName}
              </Text>
              <Image
                source={require("../../../assets/rate.png")}
                style={styles.lessorRateImage}
              />
              <Text style={styles.lessorText}>
                {lessorRatings[item.lessorId] || "No rating"}
              </Text>
            </TouchableOpacity>

            <View style={styles.itemDetailsContainer}>
              <Text style={styles.detailText} numberOfLines={1}>
                {item.location || "Location not specified"}
              </Text>
              <Text style={styles.detailText}>{item.formattedDate}</Text>
              <Text style={styles.detailText}>
                Quantity: {item.quantity ?? 1}
              </Text>

              <View style={styles.priceActionsRow}>
                <Text style={styles.priceText}>{item.formattedPrice}</Text>
                <View style={styles.actionsContainer}>
                  {!isOwner && (
                    <TouchableOpacity
                      style={styles.messageButton}
                      onPress={() => handleMessage(item)}
                    >
                      <Image
                        source={require("../../../assets/message.png")}
                        style={styles.actionIcon}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => handleToggleFavorite(item.item_id)}
                  >
                    <Image
                      source={
                        isFavorited(item.item_id)
                          ? require("../../../assets/liked.png")
                          : require("../../../assets/like.png")
                      }
                      style={styles.actionIcon}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.rentButton,
                  buttonInfo.style === "disabled" &&
                    styles.rentButtonDisabled,
                  buttonInfo.style === "pending" && styles.rentButtonPending,
                ]}
                onPress={() => handleRentNow(item)}
                disabled={buttonInfo.disabled}
              >
                <Text
                  style={[
                    styles.rentButtonText,
                    buttonInfo.style === "disabled" &&
                      styles.rentButtonTextDisabled,
                    buttonInfo.style === "pending" &&
                      styles.rentButtonTextPending,
                  ]}
                >
                  {buttonInfo.text}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    },
    [
      getButtonInfo,
      isUserItem,
      itemRatings,
      lessorRatings,
      handlePicturePress,
      handleLessorPress,
      handleMessage,
      handleToggleFavorite,
      handleRentNow,
      isFavorited,
    ]
  );

  const renderListHeader = useMemo(
    () => (
      <>
        {/* Search Bar */}
        <View style={styles.topMenuBar}>
          <TextInput
            placeholder="Search users, items, locations..."
            placeholderTextColor="#9c9c9cff"
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          <TouchableOpacity onPress={() => setFavoritesModalVisible(true)}>
            <View style={styles.favoritesButton}>
              <Image
                source={require("../../../assets/heart.png")}
                style={styles.heartIcon}
              />
              <Text style={styles.favoritesText}>
                Likes({favorites.length})
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        {showResults && (
          <View style={styles.searchResultsContainer}>
            <Text style={styles.searchResultsTitle}>
              Search Results for "{searchTerm}"
            </Text>

            {/* Users Section */}
            {searchResults.users.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Users</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.usersScrollView}
                >
                  {searchResults.users.map((user) => (
                    <View key={user.id} style={styles.userResultWrapper}>
                      {renderUserResult(user)}
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Items Section */}
            {searchResults.items.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Items</Text>
                <View style={styles.itemsGrid}>
                  {searchResults.items.map((item) => (
                    <View key={item.item_id} style={styles.itemWrapper}>
                      {renderItemCard(item)}
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* No Results */}
            {searchResults.users.length === 0 &&
              searchResults.items.length === 0 &&
              !isSearching && (
                <Text style={styles.noResultsText}>No results found</Text>
              )}

            {/* Loading */}
            {isSearching && (
              <ActivityIndicator
                size="large"
                color="#FFAB00"
                style={styles.searchLoading}
              />
            )}
          </View>
        )}

        {/* Categories */}
        {!showResults && (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesContainer}
            >
              <TouchableOpacity onPress={() => setSelectedCategoryId("")}>
                <Text
                  style={[
                    styles.categoryChip,
                    selectedCategoryId === "" && styles.categoryChipSelected,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.category_id}
                  onPress={() =>
                    setSelectedCategoryId(
                      selectedCategoryId === String(category.category_id)
                        ? ""
                        : String(category.category_id)
                    )
                  }
                >
                  <Text
                    style={[
                      styles.categoryChip,
                      selectedCategoryId === String(category.category_id) &&
                        styles.categoryChipSelected,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sectionTitleContainer}>
              <Text style={styles.itemsTitle}>Items</Text>
            </View>

            {loading && page === 1 && <SkeletonLoadingHome />}
          </>
        )}
      </>
    ),
    [
      searchTerm,
      favorites.length,
      showResults,
      searchResults,
      isSearching,
      categories,
      selectedCategoryId,
      loading,
      page,
      renderUserResult,
      renderItemCard,
    ]
  );

  const renderListFooter = useMemo(() => {
    if (showResults) return null;

    // Show "No items found" when not loading and no items
    if (!loading && items.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateText}>No items found</Text>
        </View>
      );
    }

    if (loading && page > 1) {
      return <SkeletonLoadingHome />;
    }

    if (hasMore) {
      return <SkeletonLoadingMore />;
    }

    return (
      <Text style={styles.endOfListText}>No more items</Text>
    );
  }, [showResults, items.length, loading, page, hasMore]);

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <>
      <FlatList
        style={styles.container}
        data={showResults ? [] : items}
        keyExtractor={(item) => item.item_id.toString()}
        renderItem={({ item }) => (
          <View style={styles.itemWrapper}>{renderItemCard(item)}</View>
        )}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.contentContainer}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={6}
      />

      {/* Modals */}
      <FavoritesModal
        visible={favoritesModalVisible}
        onClose={() => setFavoritesModalVisible(false)}
        currentUser={currentUser}
        userBookings={userBookings}
        getUserBookingStatus={getUserBookingStatus}
        getButtonInfo={getButtonInfo}
        onBookingUpdate={loadUserBookings}
        onFavoriteRemoved={() => {}}
        onMessage={handleMessage}
      />

      <BookItemModal
        visible={bookModalVisible}
        onClose={() => setBookModalVisible(false)}
        item={selectedItem}
        currentUserId={currentUser?.id}
        onBooked={handleBookingComplete}
      />

      <PictureModal
        visible={pictureModalVisible}
        onClose={() => setPictureModalVisible(false)}
        item={pictureItem}
      />
    </>
  );
};

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF5EF",
    marginTop: 40,
  },
  contentContainer: {
    paddingBottom: 50,
  },
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },

  // Top Menu Bar
  topMenuBar: {
    flexDirection: "row",
    alignSelf: "center",
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: {
    width: "80%",
    height: 40,
    borderWidth: 1,
    borderColor: "#9c9c9cff",
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  favoritesButton: {
    flexDirection: "column",
    paddingLeft: 10,
    alignItems: "center",
  },
  heartIcon: {
    width: 30,
    height: 26.5,
  },
  favoritesText: {
    fontFamily: "DM-Bold",
    fontSize: 12,
  },

  // Categories
  categoriesContainer: {
    paddingLeft: 10,
    marginBottom: 10,
  },
  categoryChip: {
    fontFamily: "DM-Bold",
    margin: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
  },
  categoryChipSelected: {
    backgroundColor: "#FFAB00",
    color: "#FFFFFF",
  },

  // Section Titles
  sectionTitleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  itemsTitle: {
    fontFamily: "DM-Bold",
    fontSize: 32,
  },
  sectionTitle: {
    fontFamily: "DM-Bold",
    fontSize: 18,
    marginBottom: 10,
    marginTop: 10,
    paddingHorizontal: 10,
  },

  // Item Cards
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
    shadowOffset: { width: 0, height: 2 },
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
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rateImage: {
    width: 12,
    height: 12,
    marginRight: 3,
  },
  ratingText: {
    fontSize: 12,
    color: "#333",
  },
  itemName: {
    fontFamily: "DM-Medium",
    fontSize: 16,
    marginBottom: 5,
  },
  lessorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  lessorText: {
    fontSize: 12,
    color: "#555",
    marginRight: 3,
  },
  lessorRateImage: {
    width: 10,
    height: 10,
    marginRight: 3,
  },
  itemDetailsContainer: {
    width: "100%",
  },
  detailText: {
    color: "#9C9894",
    fontSize: 12,
    marginBottom: 2,
  },
  priceActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },
  priceText: {
    color: "#FFAB00",
    fontFamily: "DM-Bold",
    fontSize: 16,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  messageButton: {
    marginRight: 5,
  },
  actionIcon: {
    width: 20,
    height: 20,
  },
  rentButton: {
    backgroundColor: "#000",
    borderRadius: 10,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    width: "70%",
    alignSelf: "flex-end",
  },
  rentButtonDisabled: {
    backgroundColor: "#CCC",
  },
  rentButtonPending: {
    backgroundColor: "#FF8C00",
  },
  rentButtonText: {
    color: "#FFF",
    fontFamily: "DM-Medium",
    fontSize: 14,
  },
  rentButtonTextDisabled: {
    color: "#999",
  },
  rentButtonTextPending: {
    color: "#FFF",
  },

  // Search Results
  searchResultsContainer: {
    padding: 10,
  },
  searchResultsTitle: {
    fontFamily: "DM-Bold",
    fontSize: 20,
    marginBottom: 15,
  },
  usersScrollView: {
    marginBottom: 10,
  },
  userResultWrapper: {
    marginRight: 15,
  },
  userResultContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    width: 200,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  userImageContainer: {
    marginRight: 10,
  },
  userImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFAB00",
    justifyContent: "center",
    alignItems: "center",
  },
  userPlaceholderText: {
    color: "#FFFFFF",
    fontFamily: "DM-Bold",
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: "DM-Medium",
    fontSize: 16,
    marginBottom: 2,
  },
  userType: {
    color: "#9C9894",
    fontSize: 12,
  },
  itemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  noResultsText: {
    textAlign: "center",
    color: "#9C9894",
    fontSize: 16,
    marginTop: 20,
  },
  searchLoading: {
    marginTop: 20,
  },
  endOfListText: {
    textAlign: "center",
    marginVertical: 20,
    color: "#9C9894",
    fontSize: 14,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyStateText: {
    color: "#9C9894",
    fontSize: 18,
    fontFamily: "DM-Medium",
  },
});

export default Home;