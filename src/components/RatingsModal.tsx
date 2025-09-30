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
    Image,
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
    const [loadingMore, setLoadingMore] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showRatingForm, setShowRatingForm] = useState(false);
    const [itemImage, setItemImage] = useState(null);
    
    // Pagination states
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 10;

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

    // Fetch initial rentals completed by this user but not yet rated
    const fetchPendingReviews = async (pageNum = 0, isLoadMore = false) => {
        if (!currentUserId) return;

        if (isLoadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
        }

        try {
            const from = pageNum * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data: completedRentals, error, count } = await supabase
                .from("rental_transactions")
                .select(`
                    rental_id, 
                    item_id, 
                    items(title, user_id, users(id, first_name, last_name, face_image_url)), 
                    reviews(review_id, rating, comment, item_id)
                `, { count: 'exact' })
                .eq("renter_id", currentUserId)
                .eq("status", "completed")
                .order('created_at', { ascending: false })
                .range(from, to);

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

            // Add item images to the pending reviews
            const reviewsWithImages = await Promise.all(
                needsReview.map(async (rental) => {
                    const imageUrl = await getImageUrl(rental.items.user_id, rental.item_id);
                    return {
                        ...rental,
                        itemImageUrl: imageUrl,
                    };
                })
            );

            if (isLoadMore) {
                setPendingReviews(prev => [...prev, ...reviewsWithImages]);
            } else {
                setPendingReviews(reviewsWithImages);
            }

            // Check if there are more items to load
            setHasMore(completedRentals.length === PAGE_SIZE);

        } catch (error) {
            console.error("Error:", error);
        } finally {
            if (isLoadMore) {
                setLoadingMore(false);
            } else {
                setLoading(false);
            }
        }
    };

    // Load initial data when modal opens
    useEffect(() => {
        if (visible && currentUserId) {
            setPage(0);
            setHasMore(true);
            fetchPendingReviews(0, false);
        }
    }, [visible, currentUserId]);

    // Reset form when modal closes
    useEffect(() => {
        if (!visible) {
            setPendingReviews([]);
            setSelectedRental(null);
            setItemRating(0);
            setLessorRating(0);
            setItemComment("");
            setLessorComment("");
            setShowRatingForm(false);
            setItemImage(null);
            setPage(0);
            setHasMore(true);
        }
    }, [visible]);

    // Handle load more
    const handleLoadMore = async () => {
        if (!loadingMore && hasMore && !loading) {
            const nextPage = page + 1;
            setPage(nextPage);
            await fetchPendingReviews(nextPage, true);
        }
    };

    const handleSelectRental = (rental) => {
        setSelectedRental(rental);
        setItemImage(rental.itemImageUrl);
        setShowRatingForm(true);
    };

    const handleCloseRatingForm = () => {
        setShowRatingForm(false);
        setSelectedRental(null);
        setItemRating(0);
        setLessorRating(0);
        setItemComment("");
        setLessorComment("");
        setItemImage(null);
    };

    const submitReviews = async () => {
        if (!selectedRental || (itemRating === 0 && lessorRating === 0)) {
            Alert.alert("Error", "Please provide at least one rating");
            return;
        }

        setSubmitting(true);
        try {
            // Check for existing reviews first
            const { data: existingReviews, error: checkError } = await supabase
                .from("reviews")
                .select("*")
                .eq("rental_id", selectedRental.rental_id)
                .eq("reviewer_id", currentUserId);

            if (checkError) throw checkError;

            // Insert item review if rating provided and doesn't already exist
            if (itemRating > 0) {
                const hasItemReview = existingReviews.some(review => review.item_id === selectedRental.item_id);

                if (!hasItemReview) {
                    const { error: itemError } = await supabase
                        .from("reviews")
                        .insert([
                            {
                                rental_id: selectedRental.rental_id,
                                item_id: selectedRental.item_id,
                                reviewer_id: currentUserId,
                                reviewee_id: selectedRental.items.user_id,
                                rating: itemRating,
                                comment: itemComment,
                            }
                        ]);

                    if (itemError) throw itemError;
                }
            }

            // Insert lessor review if rating provided and doesn't already exist
            if (lessorRating > 0) {
                const hasLessorReview = existingReviews.some(review => review.item_id === null);

                if (!hasLessorReview) {
                    const { error: lessorError } = await supabase
                        .from("lessor_reviews")
                        .insert([
                            {
                                rental_id: selectedRental.rental_id,
                                lessor_id: selectedRental.items.user_id,
                                reviewer_id: currentUserId,
                                rating: lessorRating,
                                comment: lessorComment,
                            }
                        ]);

                    if (lessorError) throw lessorError;
                }
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
            <View style={styles.rentalItemImageContainer}>
                {item.itemImageUrl ? (
                    <Image
                        source={{ uri: item.itemImageUrl }}
                        style={styles.rentalItemImage}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.rentalItemImagePlaceholder}>
                        <Text style={styles.rentalItemImagePlaceholderText}>No Image</Text>
                    </View>
                )}
            </View>
            <View style={styles.rentalItemContent}>
                <Text style={styles.rentalItemTitle}>
                    {item.items?.title || "Untitled Item"}
                </Text>
                <View style={styles.lessorInfoContainer}>
                    {item.items?.users?.face_image_url ? (
                        <Image
                            source={{ uri: item.items.users.face_image_url }}
                            style={styles.lessorAvatarSmall}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.lessorAvatarSmallPlaceholder}>
                            <Text style={styles.lessorAvatarSmallText}>
                                {item.items?.users?.first_name?.[0] || '?'}{item.items?.users?.last_name?.[0] || ''}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.rentalItemSubtitle}>
                        {item.items?.users?.first_name && item.items?.users?.last_name
                            ? `${item.items.users.first_name} ${item.items.users.last_name}`
                            : "Unknown Lessor"}
                    </Text>
                </View>
                <Text style={styles.rentalItemAction}>
                    Tap to rate item and lessor
                </Text>
            </View>
            <View style={styles.arrowIcon}>
                <Text style={styles.arrowText}>›</Text>
            </View>
        </TouchableOpacity>
    );

    const renderFooter = () => {
        if (!loadingMore) return null;

        return (
            <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color="#FFAB00" />
                <Text style={styles.footerLoadingText}>Loading more rentals...</Text>
            </View>
        );
    };

    const renderEmptyComponent = () => {
        if (loading) return null;

        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No items to rate</Text>
                <Text style={styles.emptySubtitle}>
                    You'll see completed rentals here once they're finished
                </Text>
            </View>
        );
    };

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
                        {loading && pendingReviews.length === 0 ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#FFAB00" />
                                <Text style={styles.loadingText}>Loading your rentals...</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={pendingReviews}
                                keyExtractor={(item) => item.rental_id}
                                renderItem={renderRentalItem}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.listContent}
                                ListHeaderComponent={
                                    pendingReviews.length > 0 ? (
                                        <View style={styles.listHeader}>
                                            <Text style={styles.sectionTitle}>Items to Rate</Text>
                                            <Text style={styles.sectionSubtitle}>
                                                Rate both the item quality and lessor experience
                                            </Text>
                                        </View>
                                    ) : null
                                }
                                ListEmptyComponent={renderEmptyComponent}
                                ListFooterComponent={renderFooter}
                                onEndReached={handleLoadMore}
                                onEndReachedThreshold={0.5}
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
                                {/* Item Image */}
                                <View style={styles.itemImageContainer}>
                                    {itemImage ? (
                                        <Image
                                            source={{ uri: itemImage }}
                                            style={styles.itemImageLarge}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={styles.itemImagePlaceholder}>
                                            <Text style={styles.itemImagePlaceholderText}>No Image</Text>
                                        </View>
                                    )}
                                </View>

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
                                How was your experience with {selectedRental?.items?.users?.first_name && selectedRental?.items?.users?.last_name
                                    ? `${selectedRental.items.users.first_name} ${selectedRental.items.users.last_name}`
                                    : "the lessor"}?
                            </Text>

                            <View style={styles.ratingCard}>
                                {/* Lessor Profile Section */}
                                <View style={styles.lessorProfileContainer}>
                                    {selectedRental?.items?.users?.face_image_url ? (
                                        <Image
                                            source={{ uri: selectedRental.items.users.face_image_url }}
                                            style={styles.lessorAvatarLarge}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={styles.lessorAvatarLargePlaceholder}>
                                            <Text style={styles.lessorAvatarLargeText}>
                                                {selectedRental?.items?.users?.first_name?.[0] || '?'}
                                                {selectedRental?.items?.users?.last_name?.[0] || ''}
                                            </Text>
                                        </View>
                                    )}
                                    <Text style={styles.lessorNameText}>
                                        {selectedRental?.items?.users?.first_name && selectedRental?.items?.users?.last_name
                                            ? `${selectedRental.items.users.first_name} ${selectedRental.items.users.last_name}`
                                            : "Unknown Lessor"}
                                    </Text>
                                </View>

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
    rentalItemImageContainer: {
        marginRight: 12,
    },
    rentalItemImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
    },
    rentalItemImagePlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rentalItemImagePlaceholderText: {
        fontSize: 10,
        color: '#999',
        textAlign: 'center',
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
    lessorInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    lessorAvatarSmall: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginRight: 6,
    },
    lessorAvatarSmallPlaceholder: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFAB00',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 6,
    },
    lessorAvatarSmallText: {
        fontSize: 8,
        fontFamily: 'DM-Bold',
        color: '#FFF',
    },
    rentalItemSubtitle: {
        fontSize: 12,
        color: '#666',
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
    itemImageContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    itemImageLarge: {
        width: 120,
        height: 120,
        borderRadius: 12,
    },
    itemImagePlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 12,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemImagePlaceholderText: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
    lessorProfileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    lessorAvatarLarge: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    lessorAvatarLargePlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFAB00',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    lessorAvatarLargeText: {
        fontSize: 16,
        fontFamily: 'DM-Bold',
        color: '#FFF',
    },
    lessorNameText: {
        fontSize: 16,
        fontFamily: 'DM-Bold',
        color: '#333',
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
    // New styles for pagination
    footerLoading: {
        paddingVertical: 20,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    footerLoadingText: {
        fontSize: 14,
        color: '#666',
    },
});