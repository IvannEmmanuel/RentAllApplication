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
    const [itemRating, setItemRating] = useState(0);
    const [lessorRating, setLessorRating] = useState(0);
    const [itemComment, setItemComment] = useState("");
    const [lessorComment, setLessorComment] = useState("");
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
                    .select(`
                        rental_id, 
                        item_id, 
                        items(title, user_id, users(*)), 
                        reviews(review_id, rating, comment, item_id)
                    `)
                    .eq("renter_id", currentUserId)
                    .eq("status", "completed");

                if (error) {
                    console.error("Error fetching completed rentals:", error);
                    return;
                }

                // Filter rentals that don't have both item and lessor reviews
                const needsReview = completedRentals.filter((rental) => {
                    const existingReviews = rental.reviews || [];
                    const hasItemReview = existingReviews.some(review => review.item_id === rental.item_id);
                    const hasLessorReview = existingReviews.some(review => review.item_id === null);

                    return !hasItemReview || !hasLessorReview;
                });

                setPendingReviews(needsReview);
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
            setItemRating(0);
            setLessorRating(0);
            setItemComment("");
            setLessorComment("");
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
        setItemRating(0);
        setLessorRating(0);
        setItemComment("");
        setLessorComment("");
    };

    const submitReviews = async () => {
        if (!selectedRental || (itemRating === 0 && lessorRating === 0)) {
            Alert.alert("Error", "Please provide at least one rating");
            return;
        }

        setSubmitting(true);
        try {
            // Insert item review if rating provided
            if (itemRating > 0) {
                const { error: itemError } = await supabase
                    .from("reviews")
                    .insert([
                        {
                            rental_id: selectedRental.rental_id,
                            item_id: selectedRental.item_id, // Item review belongs here
                            reviewer_id: currentUserId,
                            reviewee_id: selectedRental.items.user_id, // lessor id, but review about item
                            rating: itemRating,
                            comment: itemComment,
                        }
                    ]);

                if (itemError) throw itemError;
            }

            // Insert lessor review if rating provided
            if (lessorRating > 0) {
                const { error: lessorError } = await supabase
                    .from("lessor_reviews")
                    .insert([
                        {
                            rental_id: selectedRental.rental_id,
                            lessor_id: selectedRental.items.user_id, // person being reviewed
                            reviewer_id: currentUserId,
                            rating: lessorRating,
                            comment: lessorComment,
                        }
                    ]);

                if (lessorError) throw lessorError;
            }

            Alert.alert("Success", "Reviews submitted successfully!", [
                {
                    text: "OK",
                    onPress: () => {
                        setPendingReviews((prev) =>
                            prev.filter((r) => r.rental_id !== selectedRental.rental_id)
                        );
                        handleCloseRatingForm();
                    },
                },
            ]);
        } catch (error) {
            console.error("Error submitting reviews:", error);
            Alert.alert("Error", "Could not submit reviews");
        } finally {
            setSubmitting(false);
        }
    };

    const renderStarRating = (currentRating, setRating, type) => {
        return (
            <View style={styles.starContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                        key={`${type}-${star}`}
                        onPress={() => setRating(star)}
                        style={styles.starButton}
                    >
                        <Text style={[
                            styles.star,
                            currentRating >= star ? styles.starFilled : styles.starEmpty
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
                    Lessor: {item.items?.users?.first_name && item.items?.users?.last_name
                        ? `${item.items.users.first_name} ${item.items.users.last_name}`
                        : "Unknown"}
                </Text>
                <Text style={styles.rentalItemAction}>
                    Tap to rate item and lessor
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
                                            Rate both the item quality and lessor experience
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
                        {/* Item Rating Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Rate the Item</Text>
                            <Text style={styles.sectionSubtitle}>
                                How was the quality and condition of the item?
                            </Text>

                            <View style={styles.ratingCard}>
                                <Text style={styles.ratingLabel}>Item Quality Rating</Text>
                                {renderStarRating(itemRating, setItemRating, "item")}
                                {itemRating > 0 && (
                                    <Text style={styles.ratingText}>
                                        {itemRating} out of 5 stars
                                    </Text>
                                )}

                                <Text style={styles.commentLabel}>
                                    Item Review (Optional)
                                </Text>
                                <TextInput
                                    style={styles.commentInput}
                                    placeholder="How was the item quality, condition, etc.?"
                                    value={itemComment}
                                    onChangeText={setItemComment}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                    maxLength={500}
                                />
                                <Text style={styles.characterCount}>
                                    {itemComment.length}/500 characters
                                </Text>
                            </View>
                        </View>

                        {/* Lessor Rating Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Rate the Lessor</Text>
                            <Text style={styles.sectionSubtitle}>
                                How was your experience with {selectedRental?.items?.users?.name || "the lessor"}?
                            </Text>

                            <View style={styles.ratingCard}>
                                <Text style={styles.ratingLabel}>Lessor Service Rating</Text>
                                {renderStarRating(lessorRating, setLessorRating, "lessor")}
                                {lessorRating > 0 && (
                                    <Text style={styles.ratingText}>
                                        {lessorRating} out of 5 stars
                                    </Text>
                                )}

                                <Text style={styles.commentLabel}>
                                    Lessor Review (Optional)
                                </Text>
                                <TextInput
                                    style={styles.commentInput}
                                    placeholder="How was the communication, responsiveness, etc.?"
                                    value={lessorComment}
                                    onChangeText={setLessorComment}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                    maxLength={500}
                                />
                                <Text style={styles.characterCount}>
                                    {lessorComment.length}/500 characters
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
                                (itemRating === 0 && lessorRating === 0) && styles.disabledButton
                            ]}
                            onPress={submitReviews}
                            disabled={(itemRating === 0 && lessorRating === 0) || submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.submitButtonText}>Submit Reviews</Text>
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
        paddingVertical: 16,
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
        lineHeight: 20,
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
        marginBottom: 2,
    },
    rentalItemAction: {
        fontSize: 12,
        color: '#FFAB00',
        fontFamily: 'DM-Medium',
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
        minHeight: 80,
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