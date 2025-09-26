import React, { useEffect, useState } from "react";
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    FlatList,
    TextInput,
    StyleSheet,
    Alert,
    ScrollView,
    ActivityIndicator,
} from "react-native";
import { supabase } from "../../supbaseClient";

const RatingsModal = ({ visible, onClose, currentUserId }) => {
    const [pendingReviews, setPendingReviews] = useState([]);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [selectedRental, setSelectedRental] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showRatingForm, setShowRatingForm] = useState(false);

    // Fetch rentals completed by this user but not yet rated
    useEffect(() => {
        if (!visible || !currentUserId) return;

        const fetchPendingReviews = async () => {
            setLoading(true);
            try {
                const { data: completedRentals, error } = await supabase
                    .from("rental_transactions")
                    .select("rental_id, item_id, items(title, user_id), review:reviews(review_id)")
                    .eq("renter_id", currentUserId)
                    .eq("status", "completed");

                if (error) {
                    console.error("Error fetching completed rentals:", error);
                    return;
                }

                // Filter rentals without an existing review
                const noReviews = completedRentals.filter((r) => !r.review?.length);
                setPendingReviews(noReviews);
            } catch (error) {
                console.error("Error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPendingReviews();
    }, [visible, currentUserId]);

    // Reset form when modal closes
    useEffect(() => {
        if (!visible) {
            setSelectedRental(null);
            setRating(0);
            setComment("");
            setShowRatingForm(false);
        }
    }, [visible]);

    const handleSelectRental = (rental) => {
        setSelectedRental(rental);
        setShowRatingForm(true);
    };

    const handleCloseRatingForm = () => {
        setShowRatingForm(false);
        setSelectedRental(null);
        setRating(0);
        setComment("");
    };

    const submitReview = async () => {
        if (!selectedRental || rating === 0) {
            Alert.alert("Error", "Please select a rating");
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase.from("reviews").insert([
                {
                    rental_id: selectedRental.rental_id,
                    item_id: selectedRental.item_id,
                    reviewer_id: currentUserId,
                    reviewee_id: selectedRental.items.user_id,
                    rating,
                    comment,
                },
            ]);

            if (error) {
                console.error("Error submitting review:", error);
                Alert.alert("Error", "Could not submit review");
            } else {
                Alert.alert("Success", "Review submitted successfully!", [
                    {
                        text: "OK",
                        onPress: () => {
                            setPendingReviews((prev) =>
                                prev.filter((r) => r.rental_id !== selectedRental.rental_id)
                            );
                            handleCloseRatingForm();
                        }
                    }
                ]);
            }
        } catch (error) {
            console.error("Error submitting review:", error);
            Alert.alert("Error", "Could not submit review");
        } finally {
            setSubmitting(false);
        }
    };

    const renderStarRating = () => {
        return (
            <View style={styles.starContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={star}
                        onPress={() => setRating(star)}
                        style={styles.starButton}
                    >
                        <Text style={[
                            styles.star,
                            rating >= star ? styles.starFilled : styles.starEmpty
                        ]}>
                            ★
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const renderRentalItem = ({ item }) => (
        <TouchableOpacity
            style={styles.rentalItem}
            onPress={() => handleSelectRental(item)}
        >
            <View style={styles.rentalItemContent}>
                <Text style={styles.rentalItemTitle}>
                    {item.items?.title || "Untitled Item"}
                </Text>
                <Text style={styles.rentalItemSubtitle}>
                    Tap to rate this item
                </Text>
            </View>
            <View style={styles.arrowIcon}>
                <Text style={styles.arrowText}>›</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <>
            {/* Main Modal */}
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
            >
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Rate Your Rentals</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#FFAB00" />
                                <Text style={styles.loadingText}>Loading your rentals...</Text>
                            </View>
                        ) : pendingReviews.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyTitle}>No items to rate</Text>
                                <Text style={styles.emptySubtitle}>
                                    You'll see completed rentals here once they're finished
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={pendingReviews}
                                keyExtractor={(item) => item.rental_id}
                                renderItem={renderRentalItem}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.listContent}
                                ListHeaderComponent={
                                    <View style={styles.listHeader}>
                                        <Text style={styles.sectionTitle}>Items to Rate</Text>
                                        <Text style={styles.sectionSubtitle}>
                                            Rate your completed rentals to help other users
                                        </Text>
                                    </View>
                                }
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Rating Form Modal */}
            <Modal
                visible={showRatingForm}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={handleCloseRatingForm}
            >
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>
                            Rate "{selectedRental?.items?.title}"
                        </Text>
                        <TouchableOpacity style={styles.closeButton} onPress={handleCloseRatingForm}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Your Rating</Text>
                            <Text style={styles.sectionSubtitle}>
                                Share your experience with this rental
                            </Text>

                            <View style={styles.ratingCard}>
                                <Text style={styles.ratingLabel}>How would you rate this item?</Text>
                                {renderStarRating()}
                                {rating > 0 && (
                                    <Text style={styles.ratingText}>
                                        {rating} out of 5 stars
                                    </Text>
                                )}

                                <Text style={styles.commentLabel}>
                                    Write a Review (Optional)
                                </Text>
                                <TextInput
                                    style={styles.commentInput}
                                    placeholder="Share your thoughts about this rental..."
                                    value={comment}
                                    onChangeText={setComment}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                    maxLength={500}
                                />
                                <Text style={styles.characterCount}>
                                    {comment.length}/500 characters
                                </Text>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={handleCloseRatingForm}
                            disabled={submitting}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.submitButton,
                                rating === 0 && styles.disabledButton
                            ]}
                            onPress={submitReview}
                            disabled={rating === 0 || submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.submitButtonText}>Submit Review</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
};

export default RatingsModal;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF5EF',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#FAF5EF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5E5',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'DM-Bold',
        color: '#333',
        flex: 1,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    closeButtonText: {
        fontSize: 18,
        color: '#666',
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    listContent: {
        paddingBottom: 20,
    },
    listHeader: {
        paddingTop: 20,
        paddingBottom: 16,
    },
    section: {
        paddingVertical: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'DM-Bold',
        color: '#333',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        fontSize: 14,
        color: '#666',
        marginTop: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    emptyTitle: {
        fontSize: 16,
        fontFamily: 'DM-Bold',
        color: '#333',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        lineHeight: 20,
    },
    rentalItem: {
        backgroundColor: '#FFF',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    rentalItemContent: {
        flex: 1,
    },
    rentalItemTitle: {
        fontSize: 16,
        fontFamily: 'DM-Bold',
        color: '#333',
        marginBottom: 4,
    },
    rentalItemSubtitle: {
        fontSize: 12,
        color: '#666',
    },
    arrowIcon: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowText: {
        fontSize: 18,
        color: '#FFAB00',
        fontWeight: 'bold',
    },
    ratingCard: {
        backgroundColor: '#FFF',
        borderRadius: 8,
        padding: 20,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    ratingLabel: {
        fontSize: 14,
        fontFamily: 'DM-Bold',
        color: '#333',
        marginBottom: 12,
    },
    starContainer: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    starButton: {
        marginRight: 8,
    },
    star: {
        fontSize: 32,
    },
    starFilled: {
        color: '#FFAB00',
    },
    starEmpty: {
        color: '#DDD',
    },
    ratingText: {
        fontSize: 12,
        color: '#666',
        marginBottom: 20,
    },
    commentLabel: {
        fontSize: 14,
        fontFamily: 'DM-Bold',
        color: '#333',
        marginBottom: 8,
    },
    commentInput: {
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#333',
        backgroundColor: '#FAFAFA',
        minHeight: 100,
        fontFamily: 'DM-Regular',
    },
    characterCount: {
        fontSize: 12,
        color: '#999',
        textAlign: 'right',
        marginTop: 6,
    },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 20,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E5E5',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    cancelButton: {
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#DDD',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
        fontFamily: 'DM-Medium',
    },
    submitButton: {
        backgroundColor: '#FFAB00',
    },
    disabledButton: {
        backgroundColor: '#CCC',
    },
    submitButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'DM-Bold',
    },
});