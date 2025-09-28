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
  Alert
} from 'react-native';
import { supabase } from '../../supbaseClient';
import { useNavigation } from '@react-navigation/native';
import { useFavorites } from './FavoritesContext';

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
  const LIMIT = 6;

  // Fetch lessor basic information including face image
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

  // Fetch lessor ratings and review count
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

  // Dedupe items to prevent duplicates
  const dedupeItems = (itemsArray) => {
    const map = new Map();
    itemsArray.forEach((i) => map.set(i.item_id, i));
    return Array.from(map.values());
  };

  // Fetch lessor's items with pagination
  const fetchLessorItems = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1 && !append) {
      setLoadingMore(false);
    } else {
      setLoadingMore(true);
    }

    try {
      let query = supabase
        .from('items')
        .select('item_id, user_id, category_id, title, description, price_per_day, deposit_fee, location, available, created_at, item_status, quantity')
        .eq('user_id', lessorId)
        .eq('available', true)
        .eq('item_status', 'approved')
        .order('created_at', { ascending: false })
        .range((pageNum - 1) * LIMIT, pageNum * LIMIT - 1);

      const { data: items, error } = await query;

      if (error) {
        console.error('Error fetching lessor items:', error);
        return;
      }

      // Add images and format data
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

        // Fetch ratings for the items
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
  }, [lessorId]);

  // Get image URL for items
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

  // Fetch item ratings
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

      // Calculate average ratings for each item
      const ratingsMap = {};
      data.forEach(review => {
        if (!ratingsMap[review.item_id]) {
          ratingsMap[review.item_id] = { total: 0, count: 0 };
        }
        ratingsMap[review.item_id].total += review.rating;
        ratingsMap[review.item_id].count += 1;
      });

      // Convert to average ratings
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

  // Handle load more items
  const handleLoadMore = () => {
    if (hasMore && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchLessorItems(nextPage, true); // append new items
    }
  };

  // Handle chat with lessor directly
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
              item_id: null, // No specific item for lessor chat
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

  // Handle message button press for items
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

  // Toggle favorite
  const handleToggleFavorite = async (itemId) => {
    const result = await toggleFavorite(itemId);
    if (!result.success && result.message) {
      Alert.alert('Error', result.message);
    }
  };

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchLessorInfo(),
        fetchLessorRatings(),
        fetchLessorItems(1, false) // Load first page
      ]);
      setLoading(false);
    };

    if (lessorId) {
      loadData();
    }
  }, [lessorId, fetchLessorInfo, fetchLessorRatings, fetchLessorItems]);

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemImageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <Image source={require('../../assets/splash-icon.png')} style={styles.itemImage} resizeMode="cover" />
        )}
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
          <Text style={styles.text}>Quantity: {item.quantity ?? 1}</Text>
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
            </View>
          </View>
        </View>
      </View>
    </View>
  );

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lessor Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Lessor Profile Section */}
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
              <Text style={styles.lessorName}>
                {lessorInfo ? `${lessorInfo.first_name} ${lessorInfo.last_name}` : 'Unknown Lessor'}
              </Text>
              
              <View style={styles.ratingContainer}>
                <Image source={require('../../assets/rate.png')} style={styles.rateImage} />
                <Text style={styles.ratingText}>
                  {lessorRating || 'No rating'}
                </Text>
                <Text style={styles.reviewCountText}>
                  ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
                </Text>
                {/* Chat button added here */}
                {currentUser && currentUser.id !== lessorId && (
                  <TouchableOpacity style={styles.chatButton} onPress={handleChatWithLessor}>
                    <Image source={require('../../assets/message.png')} style={styles.chatButtonImage} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Listed Items Section */}
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
    </View>
  );
};

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
    color: '#9C9894',
    flex: 1,
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
    height: 20,
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
});

export default LessorReviews;