import React, { useEffect, useState } from "react"
import { Modal, View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from "react-native"
import { supabase } from "../../supbaseClient"

const { width: screenWidth } = Dimensions.get('window')

const PictureModal = ({ visible, onClose, item }) => {
  const [ratings, setRatings] = useState([])
  const [averageRating, setAverageRating] = useState<number | null>(null)

  useEffect(() => {
    if (!visible || !item?.item_id) return

    const fetchReviews = async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          rating,
          comment,
          created_at,
          reviewer_id,
          users:reviewer_id (first_name, last_name)
        `)
        .eq("item_id", item.item_id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching reviews:", error)
        setRatings([])
        setAverageRating(null)
        return
      }

      setRatings(data || [])

      if (data && data.length > 0) {
        const total = data.reduce((sum, r) => sum + r.rating, 0)
        const avg = total / data.length
        setAverageRating(avg)
      } else {
        setAverageRating(null)
      }
    }

    fetchReviews()
  }, [visible, item?.item_id])

  if (!item) return null

  const renderStars = (rating: number, size: number = 16) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating - fullStars >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

    return (
      <View style={styles.starsContainer}>
        {[...Array(fullStars)].map((_, i) => (
          <Text key={`full-${i}`} style={[styles.star, { fontSize: size }]}>★</Text>
        ))}
        {hasHalfStar && (
          <Text style={[styles.starHalf, { fontSize: size }]}>★</Text>
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Text key={`empty-${i}`} style={[styles.starEmpty, { fontSize: size }]}>☆</Text>
        ))}
      </View>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header with close button */}
          <View style={styles.header}>
            <View style={styles.headerIndicator} />
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Image Container */}
            <View style={styles.imageContainer}>
              <Image
                source={item.imageUrl ? { uri: item.imageUrl } : require("../../assets/splash-icon.png")}
                style={styles.fullImage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay} />
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>
                {item.description || "No description available"}
              </Text>

              {/* Rating Summary Card */}
              {averageRating !== null && (
                <View style={styles.ratingSummaryCard}>
                  <View style={styles.ratingMainInfo}>
                    <View style={styles.ratingScoreContainer}>
                      <Text style={styles.averageScore}>{averageRating.toFixed(1)}</Text>
                      {renderStars(averageRating, 18)}
                    </View>
                    <Text style={styles.reviewCount}>
                      {ratings.length} review{ratings.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              )}

              {/* Reviews Section */}
              <View style={styles.reviewsSection}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                
                {ratings.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>💭</Text>
                    <Text style={styles.emptyStateText}>No reviews yet</Text>
                    <Text style={styles.emptyStateSubtext}>Be the first to share your thoughts!</Text>
                  </View>
                ) : (
                  <View style={styles.reviewsList}>
                    {ratings.map((review, idx) => (
                      <View key={idx} style={styles.reviewCard}>
                        <View style={styles.reviewHeader}>
                          <View style={styles.reviewerAvatar}>
                            <Text style={styles.reviewerInitial}>
                              {review.users?.first_name?.charAt(0) || "?"}
                            </Text>
                          </View>
                          <View style={styles.reviewerInfo}>
                            <Text style={styles.reviewerName}>
                              {review.users?.first_name} {review.users?.last_name}
                            </Text>
                            <View style={styles.reviewMeta}>
                              {renderStars(review.rating, 14)}
                              <Text style={styles.reviewDate}>
                                • {new Date(review.created_at).toLocaleDateString()}
                              </Text>
                            </View>
                          </View>
                        </View>
                        {review.comment && (
                          <Text style={styles.reviewComment}>{review.comment}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

export default PictureModal

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    maxHeight: "85%",
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerIndicator: {
    display: "none",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "600",
  },
  scrollContent: {
    paddingBottom: 32,
  },
  imageContainer: {
    position: "relative",
    marginBottom: 24,
  },
  fullImage: {
    width: "100%",
    height: 200,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    background: "linear-gradient(transparent, rgba(0,0,0,0.1))",
  },
  content: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    lineHeight: 36,
  },
  description: {
    fontSize: 16,
    color: "#6B7280",
    lineHeight: 24,
    marginBottom: 24,
  },
  ratingSummaryCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  ratingMainInfo: {
    alignItems: "center",
  },
  ratingScoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  averageScore: {
    fontSize: 32,
    fontWeight: "800",
    color: "#111827",
    marginRight: 12,
  },
  starsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  star: {
    color: "#F59E0B",
    marginRight: 2,
  },
  starHalf: {
    color: "#F59E0B",
    marginRight: 2,
    opacity: 0.5,
  },
  starEmpty: {
    color: "#D1D5DB",
    marginRight: 2,
  },
  reviewCount: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  reviewsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  reviewsList: {
    gap: 20,
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  reviewerInitial: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  reviewMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewDate: {
    fontSize: 12,
    color: "#9CA3AF",
    marginLeft: 8,
  },
  reviewComment: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
  },
})