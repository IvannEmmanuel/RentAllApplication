// src/components/ItemCard.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { formatPrice } from '../services/supabaseServices';

const ItemCard = ({
    item,
    itemRating,
    lessorRating,
    isFavorited,
    buttonInfo,
    onPicturePress,
    onLessorPress,
    onMessage,
    onToggleFavorite,
    onRentNow,
}) => {
    const isOwner = buttonInfo.text === 'Your Item';

    return (
        <View style={styles.itemWrapper}>
            <View style={styles.itemContainer}>
                {/* Top section of the card */}
                <View>
                    <TouchableOpacity onPress={() => onPicturePress(item)}>
                        <Image
                            source={
                                item.imageUrl
                                    ? { uri: item.imageUrl }
                                    : require('../../assets/splash-icon.png') // Adjust path
                            }
                            style={styles.itemImage}
                            resizeMode="cover"
                        />
                    </TouchableOpacity>
                    <View style={styles.ratingRow}>
                        <Image
                            source={require('../../assets/rate.png')} // Adjust path
                            style={styles.rateImage}
                        />
                        <Text style={styles.ratingText}>{itemRating || 'No rating'}</Text>
                    </View>
                    <Text style={styles.itemName} numberOfLines={2}>
                        {item.title}
                    </Text>
                </View>

                {/* Bottom section of the card */}
                <View>
                    <TouchableOpacity
                        onPress={() => onLessorPress(item.lessorId)}
                        style={styles.lessorContainer}>
                        <Text style={styles.lessorText} numberOfLines={1}>
                            {item.lessorName}
                        </Text>
                        <Image
                            source={require('../../assets/rate.png')} // Adjust path
                            style={styles.lessorRateImage}
                        />
                        <Text style={styles.lessorText}>{lessorRating || 'No rating'}</Text>
                    </TouchableOpacity>
                    <Text style={styles.detailText} numberOfLines={1}>
                        {item.location || 'Location not specified'}
                    </Text>
                    <Text style={styles.detailText}>
                        Quantity: {item.quantity ?? 1}
                    </Text>
                    <View style={styles.priceActionsRow}>
                        <Text style={styles.priceText}>{formatPrice(item.price_per_day)}</Text>
                        <View style={styles.actionsContainer}>
                            {!isOwner && (
                                <TouchableOpacity
                                    style={styles.messageButton}
                                    onPress={() => onMessage(item)}>
                                    <Image
                                        source={require('../../assets/message.png')} // Adjust path
                                        style={styles.actionIcon}
                                    />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => onToggleFavorite(item.item_id)}>
                                <Image
                                    source={
                                        isFavorited
                                            ? require('../../assets/liked.png') // Adjust path
                                            : require('../../assets/like.png') // Adjust path
                                    }
                                    style={styles.actionIcon}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.rentButton,
                            buttonInfo.style === 'disabled' && styles.rentButtonDisabled,
                            buttonInfo.style === 'pending' && styles.rentButtonPending,
                        ]}
                        onPress={() => onRentNow(item)}
                        disabled={buttonInfo.disabled}>
                        <Text style={styles.rentButtonText}>{buttonInfo.text}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

export default React.memo(ItemCard);

const styles = StyleSheet.create({
    itemWrapper: {
        width: '48%',
        marginBottom: 15,
    },
    // KEY STYLES FOR EQUAL HEIGHT
    itemContainer: {
        flex: 1, // Allows the container to grow to fill the space.
        justifyContent: 'space-between', // Pushes content to top and bottom.
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
    },
    itemImage: {
        width: '100%',
        aspectRatio: 1.2, // Use aspect ratio for consistent image sizes.
        borderRadius: 10,
        marginBottom: 10,
    },
    itemName: {
        fontFamily: 'DM-Medium',
        fontSize: 16,
        marginBottom: 5,
        minHeight: 40, // Ensures space is reserved for two lines of text.
    },
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
    lessorContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 5,
    },
    lessorText: {
        fontSize: 12,
        color: "#555",
        maxWidth: '80%',  // ⬅ prevent long names from pushing rating out
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