import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  FlatList,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// --- Local Imports ---
// (Adjust these paths to match your project structure)
import { useFavorites } from "../../components/FavoritesContext";
import { useHomeData } from "../../hooks/useHomeData";
import { useSearch } from "../../hooks/useSearch";
import ItemCard from "../../components/ItemCard";
import FavoritesModal from "../../components/FavoriteModal";
import BookItemModal from "../../components/BookItemModal";
import PictureModal from "../../components/PictureModal";
import SkeletonLoadingHome from "../../components/skeletonComponents/SkeletonLoadingHome";
import SkeletonLoadingMore from "../../components/skeletonComponents/SkeletonLoadingMore";
import { getInitials } from "../../services/supabaseServices";
import { supabase } from "../../../supbaseClient"; // For handleMessage

// --- Type Definitions ---
// (Define these in a types file if you prefer)
type RootStackParamList = {
  Home: { resetToAll?: boolean };
  Chat: { /* params for chat screen */ };
  LessorReviews: { lessorId: string };
};

type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

// --- Main Component ---
const Home = ({ route }: HomeProps) => {
  const navigation = useNavigation<any>(); // Use a typed navigator if available
  const { favorites, currentUser, toggleFavorite, isFavorited } = useFavorites();

  // --- State Management ---
  const {
    items,
    loading,
    loadingMore,
    hasMore,
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    userBookings,
    itemRatings,
    lessorRatings,
    handleLoadMore,
    refresh, // Use this for pull-to-refresh
  } = useHomeData(currentUser, navigation, route);

  const [searchTerm, setSearchTerm] = useState("");
  const { searchResults, isSearching, showResults } = useSearch(searchTerm);

  // Modal States
  const [favoritesModalVisible, setFavoritesModalVisible] = useState(false);
  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [pictureModalVisible, setPictureModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // --- Business Logic & Callbacks ---
  const isUserItem = useCallback(
    (item: any) => currentUser?.id === item.user_id,
    [currentUser]
  );

  const getUserBookingStatus = useCallback(
    (itemId: string) => {
      return userBookings.find((booking) => booking.item_id === itemId)?.status || null;
    },
    [userBookings]
  );

  const getButtonInfo = useCallback(
    (item: any) => {
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
    },
    [getUserBookingStatus, isUserItem]
  );

  // --- Event Handlers ---
  const handleRentNow = useCallback((item: any) => {
    if (!currentUser) {
      Alert.alert("Login Required", "Please log in to rent items");
      return;
    }
    if (getButtonInfo(item).disabled) {
      // You can add a more specific alert here if you want
      return;
    }
    setSelectedItem(item);
    setBookModalVisible(true);
  },
    [currentUser, getButtonInfo]
  );

  const handleToggleFavorite = useCallback(async (itemId: string) => {
    const result = await toggleFavorite(itemId);
    if (!result.success && result.message) {
      Alert.alert("Error", result.message);
    }
  },
    [toggleFavorite]
  );

  const handleMessage = useCallback(async (item: any) => {
    if (!currentUser) {
      Alert.alert("Login Required", "Please log in to send messages");
      return;
    }
    if (isUserItem(item)) {
      Alert.alert("Cannot Message", "You cannot send a message to yourself");
      return;
    }
    // Your existing handleMessage logic for creating/navigating to a conversation
    // This logic can also be moved to a service for even cleaner code
    try {
      let { data: conversation, error } = await supabase
        .from("conversations")
        .select("*")
        .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${item.user_id}),and(user1_id.eq.${item.user_id},user2_id.eq.${currentUser.id})`)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (!conversation) {
        // ... create new conversation logic ...
      }

      navigation.navigate("Chat", {
        // ... navigation params ...
      });
    } catch (error: any) {
      console.error("Error handling message:", error);
      Alert.alert("Error", "Could not start conversation.");
    }
  },
    [currentUser, isUserItem, navigation]
  );

  const handlePicturePress = useCallback((item: any) => {
    setSelectedItem(item);
    setPictureModalVisible(true);
  }, []);

  const handleLessorPress = useCallback((lessorId: string) => {
    if (lessorId) {
      navigation.navigate("LessorReviews", { lessorId });
    }
  },
    [navigation]
  );

  const handleBookingComplete = useCallback(() => {
    refresh(); // Simply call the refresh function from our hook
  }, [refresh]);


  // --- Render Functions ---
  const renderItemCard = useCallback(({ item }: { item: any }) => (
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
  ),
    [itemRatings, lessorRatings, isFavorited, getButtonInfo, handleToggleFavorite, handleRentNow, handleMessage, handleLessorPress, handlePicturePress]
  );

  const renderUserResult = useCallback((user: any) => (
    <TouchableOpacity
      key={user.id}
      style={styles.userResultContainer}
      onPress={() => handleLessorPress(user.id)}
    >
      <View style={styles.userImageContainer}>
        {user.face_image_url ? (
          <Image source={{ uri: user.face_image_url }} style={styles.userImage} />
        ) : (
          <View style={styles.userPlaceholder}>
            <Text style={styles.userPlaceholderText}>
              {getInitials(user.first_name, user.last_name)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.first_name} {user.last_name}
        </Text>
        <Text style={styles.userType}>Lessor</Text>
      </View>
    </TouchableOpacity>
  ), [handleLessorPress]);

  const renderListHeader = useMemo(() => (
    <>
      <View style={styles.topMenuBar}>
        <TextInput
          placeholder="Search users, items, locations..."
          placeholderTextColor="#9c9c9c"
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        <TouchableOpacity onPress={() => setFavoritesModalVisible(true)}>
          <View style={styles.favoritesButton}>
            <Image source={require("../../../assets/heart.png")} style={styles.heartIcon} />
            <Text style={styles.favoritesText}>Likes({favorites.length})</Text>
          </View>
        </TouchableOpacity>
      </View>

      {showResults ? (
        <View style={styles.searchResultsContainer}>
          <Text style={styles.searchResultsTitle}>Search Results for "{searchTerm}"</Text>
          {isSearching && <ActivityIndicator size="large" color="#FFAB00" />}

          {!isSearching && searchResults.users.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Users</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {searchResults.users.map(renderUserResult)}
              </ScrollView>
            </>
          )}

          {!isSearching && searchResults.items.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Items</Text>
              <View style={styles.itemsGrid}>
                {searchResults.items.map((item) => (
                  <View key={item.item_id} style={{ width: '100%' }}>
                    {renderItemCard({ item })}
                  </View>
                ))}
              </View>
            </>
          )}

          {!isSearching && searchResults.users.length === 0 && searchResults.items.length === 0 && (
            <Text style={styles.noResultsText}>No results found.</Text>
          )}
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
            <TouchableOpacity onPress={() => setSelectedCategoryId("")}>
              <Text style={[styles.categoryChip, selectedCategoryId === "" && styles.categoryChipSelected]}>All</Text>
            </TouchableOpacity>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.category_id}
                onPress={() => setSelectedCategoryId(selectedCategoryId === String(category.category_id) ? "" : String(category.category_id))}
              >
                <Text style={[styles.categoryChip, selectedCategoryId === String(category.category_id) && styles.categoryChipSelected]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.itemsTitle}>Items</Text>
          </View>
        </>
      )}
    </>
  ), [searchTerm, favorites.length, showResults, isSearching, searchResults, categories, selectedCategoryId, renderUserResult, renderItemCard]);

  const renderListFooter = useMemo(() => {
    if (showResults) return null;

    if (loadingMore) {
      return (
        <View style={{ paddingVertical: 30 }}>
          <SkeletonLoadingMore />
        </View>
      );
    }

    if (!loading && items.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateText}>No items found in this category.</Text>
        </View>
      );
    }

    if (!hasMore) {
      return <Text style={styles.endOfListText}>You've reached the end!</Text>;
    }

    return null;
  }, [showResults, loadingMore, loading, items.length, hasMore]);

  // --- Main Render ---
  return (
    <>
      <View style={styles.container}>
        {(loading && items.length === 0 && !showResults) ? (
          <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
            {renderListHeader}
            <SkeletonLoadingHome />
          </ScrollView>
        ) : (
          <FlatList
            data={showResults ? [] : items}
            renderItem={renderItemCard}
            keyExtractor={(item) => item.item_id.toString()}
            numColumns={2}
            ListHeaderComponent={renderListHeader}
            ListFooterComponent={renderListFooter}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.contentContainer}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            onRefresh={refresh}
            refreshing={loading}
            maxToRenderPerBatch={6}
            windowSize={10}
            initialNumToRender={6}
          />
        )}
      </View>

      {/* --- Modals --- */}
      <FavoritesModal
        visible={favoritesModalVisible}
        onClose={() => setFavoritesModalVisible(false)}
        currentUser={currentUser}
        userBookings={userBookings}
        getUserBookingStatus={getUserBookingStatus}
        getButtonInfo={getButtonInfo}
        onBookingUpdate={refresh}
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
        item={selectedItem}
      />
    </>
  );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF5EF",
    paddingTop: 40,
  },
  contentContainer: {
    paddingBottom: 50,
  },
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  topMenuBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 45,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 25,
    paddingHorizontal: 20,
    fontFamily: "DM-Medium",
  },
  favoritesButton: {
    marginLeft: 10,
    alignItems: "center",
  },
  heartIcon: {
    width: 28,
    height: 25,
  },
  favoritesText: {
    fontFamily: "DM-Bold",
    fontSize: 10,
    marginTop: 2,
  },
  categoriesContainer: {
    paddingHorizontal: 10,
    marginBottom: 10,
    flexDirection: 'row',
  },
  categoryChip: {
    fontFamily: "DM-Bold",
    fontSize: 14,
    marginHorizontal: 5,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    color: '#333',
    overflow: 'hidden', // for iOS rounded corners
  },
  categoryChipSelected: {
    backgroundColor: "#FFAB00",
    color: "#FFFFFF",
  },
  sectionTitleContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  itemsTitle: {
    fontFamily: "DM-Bold",
    fontSize: 28,
  },
  sectionTitle: {
    fontFamily: "DM-Bold",
    fontSize: 20,
    marginBottom: 10,
    marginTop: 15,
    paddingHorizontal: 15,
  },
  // Search Results
  searchResultsContainer: {
    paddingHorizontal: 5,
  },
  searchResultsTitle: {
    fontFamily: "DM-Bold",
    fontSize: 22,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  userResultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 5,
    width: 220, // fixed width for horizontal scroll
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userImageContainer: {
    marginRight: 10,
  },
  userImage: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  userPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
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
    fontFamily: "DM-Bold",
    fontSize: 15,
  },
  userType: {
    color: "#9C9894",
    fontSize: 12,
  },
  itemsGrid: {
    paddingHorizontal: 5,
  },
  noResultsText: {
    textAlign: "center",
    color: "#9C9894",
    fontSize: 16,
    fontFamily: "DM-Medium",
    marginTop: 40,
  },
  // Empty & Footer States
  emptyStateContainer: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateText: {
    color: "#9C9894",
    fontSize: 16,
    fontFamily: "DM-Medium",
  },
  endOfListText: {
    textAlign: "center",
    marginVertical: 20,
    color: "#9C9894",
    fontSize: 14,
  },
});

export default Home;