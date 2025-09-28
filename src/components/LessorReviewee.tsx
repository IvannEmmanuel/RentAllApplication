import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '../../supbaseClient';
import { useNavigation } from '@react-navigation/native';

const LessorReviewee = ({ route }) => {
  const { lessorId, lessorName } = route.params;
  const navigation = useNavigation();
  
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [lessorInfo, setLessorInfo] = useState(null); // Added lessor info state

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

  // Fetch all reviews for this lessor
  const fetchLessorReviews = useCallback(async () => {
    try {
      const { data: reviewsData, error } = await supabase
        .from('lessor_reviews')
        .select(`
          review_id,
          rating,
          comment,
          created_at,
          reviewer_id,
          users!lessor_reviews_reviewer_id_fkey(
            id,
            first_name,
            last_name,
            face_image_url
          )
        `)
        .eq('lessor_id', lessorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching lessor reviews:', error);
        return;
      }

      setReviews(reviewsData || []);
      setTotalReviews(reviewsData?.length || 0);

      // Calculate average rating
      if (reviewsData && reviewsData.length > 0) {
        const total = reviewsData.reduce((sum, review) => sum + review.rating, 0);
        setAverageRating((total / reviewsData.length).toFixed(1));
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  }, [lessorId]);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchLessorInfo(),
        fetchLessorReviews()
      ]);
    };
    loadData();
  }, [fetchLessorInfo, fetchLessorReviews]);

  const renderStarRating = (rating) => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Text
            key={star}
            style={[
              styles.star,
              rating >= star ? styles.starFilled : styles.starEmpty
            ]}
          >
            ★
          </Text>
        ))}
      </View>
    );
  };

  const renderReviewItem = ({ item }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          {item.users?.face_image_url ? (
            <Image 
              source={{ uri: item.users.face_image_url }} 
              style={styles.reviewerAvatar}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.reviewerAvatarPlaceholder}>
              <Text style={styles.reviewerAvatarText}>
                {item.users?.first_name?.[0] || '?'}{item.users?.last_name?.[0] || ''}
              </Text>
            </View>
          )}
          <View style={styles.reviewerDetails}>
            <Text style={styles.reviewerName}>
              {item.users?.first_name && item.users?.last_name
                ? `${item.users.first_name} ${item.users.last_name}`
                : 'Anonymous User'}
            </Text>
            <Text style={styles.reviewDate}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
        {renderStarRating(item.rating)}
      </View>
      
      {item.comment && item.comment.trim() !== '' && (
        <Text style={styles.reviewComment}>{item.comment}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFAB00" />
        <Text style={styles.loadingText}>Loading reviews...</Text>
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
        <Text style={styles.headerTitle}>Reviews</Text>
      </View>

      {/* Lessor Profile Section - Added this section */}
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
              {lessorInfo ? `${lessorInfo.first_name} ${lessorInfo.last_name}` : lessorName || 'Unknown Lessor'}
            </Text>
            
            <View style={styles.ratingContainer}>
              {renderStarRating(Math.round(averageRating))}
              <Text style={styles.averageRatingText}>{averageRating}</Text>
              <Text style={styles.totalReviewsText}>
                ({totalReviews} review{totalReviews !== 1 ? 's' : ''})
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No reviews yet</Text>
          <Text style={styles.emptySubtext}>
            This lessor hasn't received any reviews yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.review_id}
          renderItem={renderReviewItem}
          contentContainerStyle={styles.reviewsList}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  // Added profile section styles
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
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Updated summary section styles to remove duplicate
  lessorName: {
    fontSize: 18,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 8,
  },
  starContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  star: {
    fontSize: 16,
    marginRight: 2,
  },
  starFilled: {
    color: '#FFAB00',
  },
  starEmpty: {
    color: '#DDD',
  },
  averageRatingText: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginRight: 8,
  },
  totalReviewsText: {
    fontSize: 12,
    color: '#9C9894',
  },
  reviewsList: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  reviewItem: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFAB00',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerAvatarText: {
    fontSize: 14,
    fontFamily: 'DM-Bold',
    color: '#FFF',
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9C9894',
  },
  reviewComment: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    fontFamily: 'DM-Regular',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'DM-Bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9C9894',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default LessorReviewee;