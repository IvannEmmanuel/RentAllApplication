import React from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
} from 'react-native';

const SkeletonLoadingHome = () => {
    return (
        <View style={styles.container}>
            {/* Items Grid Skeleton */}
            <View style={styles.itemsGrid}>
                {/* Row 1 */}
                <View style={styles.itemWrapper}>
                    <View style={[styles.skeleton, styles.itemContainer]}>
                        <View style={[styles.skeleton, styles.itemImageSkeleton]} />
                        <View style={styles.itemContent}>
                            <View style={[styles.skeleton, styles.ratingSkeleton]} />
                            <View style={[styles.skeleton, styles.titleSkeleton]} />
                            <View style={[styles.skeleton, styles.lessorSkeleton]} />
                            <View style={[styles.skeleton, styles.locationSkeleton]} />
                            <View style={[styles.skeleton, styles.dateSkeleton]} />
                            <View style={[styles.skeleton, styles.quantitySkeleton]} />
                            <View style={styles.bottomRow}>
                                <View style={[styles.skeleton, styles.priceSkeleton]} />
                                <View style={styles.actions}>
                                    <View style={[styles.skeleton, styles.messageSkeleton]} />
                                    <View style={[styles.skeleton, styles.likeSkeleton]} />
                                </View>
                            </View>
                            <View style={[styles.skeleton, styles.rentButtonSkeleton]} />
                        </View>
                    </View>
                </View>

                <View style={styles.itemWrapper}>
                    <View style={[styles.skeleton, styles.itemContainer]}>
                        <View style={[styles.skeleton, styles.itemImageSkeleton]} />
                        <View style={styles.itemContent}>
                            <View style={[styles.skeleton, styles.ratingSkeleton]} />
                            <View style={[styles.skeleton, styles.titleSkeleton]} />
                            <View style={[styles.skeleton, styles.lessorSkeleton]} />
                            <View style={[styles.skeleton, styles.locationSkeleton]} />
                            <View style={[styles.skeleton, styles.dateSkeleton]} />
                            <View style={[styles.skeleton, styles.quantitySkeleton]} />
                            <View style={styles.bottomRow}>
                                <View style={[styles.skeleton, styles.priceSkeleton]} />
                                <View style={styles.actions}>
                                    <View style={[styles.skeleton, styles.messageSkeleton]} />
                                    <View style={[styles.skeleton, styles.likeSkeleton]} />
                                </View>
                            </View>
                            <View style={[styles.skeleton, styles.rentButtonSkeleton]} />
                        </View>
                    </View>
                </View>

                {/* Row 2 */}
                <View style={styles.itemWrapper}>
                    <View style={[styles.skeleton, styles.itemContainer]}>
                        <View style={[styles.skeleton, styles.itemImageSkeleton]} />
                        <View style={styles.itemContent}>
                            <View style={[styles.skeleton, styles.ratingSkeleton]} />
                            <View style={[styles.skeleton, styles.titleSkeleton]} />
                            <View style={[styles.skeleton, styles.lessorSkeleton]} />
                            <View style={[styles.skeleton, styles.locationSkeleton]} />
                            <View style={[styles.skeleton, styles.dateSkeleton]} />
                            <View style={[styles.skeleton, styles.quantitySkeleton]} />
                            <View style={styles.bottomRow}>
                                <View style={[styles.skeleton, styles.priceSkeleton]} />
                                <View style={styles.actions}>
                                    <View style={[styles.skeleton, styles.messageSkeleton]} />
                                    <View style={[styles.skeleton, styles.likeSkeleton]} />
                                </View>
                            </View>
                            <View style={[styles.skeleton, styles.rentButtonSkeleton]} />
                        </View>
                    </View>
                </View>

                <View style={styles.itemWrapper}>
                    <View style={[styles.skeleton, styles.itemContainer]}>
                        <View style={[styles.skeleton, styles.itemImageSkeleton]} />
                        <View style={styles.itemContent}>
                            <View style={[styles.skeleton, styles.ratingSkeleton]} />
                            <View style={[styles.skeleton, styles.titleSkeleton]} />
                            <View style={[styles.skeleton, styles.lessorSkeleton]} />
                            <View style={[styles.skeleton, styles.locationSkeleton]} />
                            <View style={[styles.skeleton, styles.dateSkeleton]} />
                            <View style={[styles.skeleton, styles.quantitySkeleton]} />
                            <View style={styles.bottomRow}>
                                <View style={[styles.skeleton, styles.priceSkeleton]} />
                                <View style={styles.actions}>
                                    <View style={[styles.skeleton, styles.messageSkeleton]} />
                                    <View style={[styles.skeleton, styles.likeSkeleton]} />
                                </View>
                            </View>
                            <View style={[styles.skeleton, styles.rentButtonSkeleton]} />
                        </View>
                    </View>
                </View>

                {/* Row 3 */}
                <View style={styles.itemWrapper}>
                    <View style={[styles.skeleton, styles.itemContainer]}>
                        <View style={[styles.skeleton, styles.itemImageSkeleton]} />
                        <View style={styles.itemContent}>
                            <View style={[styles.skeleton, styles.ratingSkeleton]} />
                            <View style={[styles.skeleton, styles.titleSkeleton]} />
                            <View style={[styles.skeleton, styles.lessorSkeleton]} />
                            <View style={[styles.skeleton, styles.locationSkeleton]} />
                            <View style={[styles.skeleton, styles.dateSkeleton]} />
                            <View style={[styles.skeleton, styles.quantitySkeleton]} />
                            <View style={styles.bottomRow}>
                                <View style={[styles.skeleton, styles.priceSkeleton]} />
                                <View style={styles.actions}>
                                    <View style={[styles.skeleton, styles.messageSkeleton]} />
                                    <View style={[styles.skeleton, styles.likeSkeleton]} />
                                </View>
                            </View>
                            <View style={[styles.skeleton, styles.rentButtonSkeleton]} />
                        </View>
                    </View>
                </View>

                <View style={styles.itemWrapper}>
                    <View style={[styles.skeleton, styles.itemContainer]}>
                        <View style={[styles.skeleton, styles.itemImageSkeleton]} />
                        <View style={styles.itemContent}>
                            <View style={[styles.skeleton, styles.ratingSkeleton]} />
                            <View style={[styles.skeleton, styles.titleSkeleton]} />
                            <View style={[styles.skeleton, styles.lessorSkeleton]} />
                            <View style={[styles.skeleton, styles.locationSkeleton]} />
                            <View style={[styles.skeleton, styles.dateSkeleton]} />
                            <View style={[styles.skeleton, styles.quantitySkeleton]} />
                            <View style={styles.bottomRow}>
                                <View style={[styles.skeleton, styles.priceSkeleton]} />
                                <View style={styles.actions}>
                                    <View style={[styles.skeleton, styles.messageSkeleton]} />
                                    <View style={[styles.skeleton, styles.likeSkeleton]} />
                                </View>
                            </View>
                            <View style={[styles.skeleton, styles.rentButtonSkeleton]} />
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF5EF',
        paddingHorizontal: 10,
    },
    skeleton: {
        backgroundColor: '#E5E5E5', // Changed to gray like SkeletonLoadingChat
        borderRadius: 4,
    },
    topMenuBar: {
        flexDirection: 'row',
        alignSelf: 'center',
        paddingHorizontal: 10,
        marginBottom: 10,
    },
    searchSkeleton: {
        width: '80%',
        height: 40,
        borderRadius: 20,
    },
    heartSkeleton: {
        width: 60,
        height: 40,
        borderRadius: 10,
        marginLeft: 10,
    },
    categoriesContainer: {
        marginBottom: 10,
    },
    categoriesContent: {
        paddingHorizontal: 10,
    },
    categorySkeleton: {
        width: 80,
        height: 35,
        borderRadius: 15,
        marginHorizontal: 5,
    },
    itemsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    itemWrapper: {
        width: '48%',
        marginBottom: 15,
    },
    itemContainer: {
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
    itemImageSkeleton: {
        width: '100%',
        height: 120,
        borderRadius: 10,
        marginBottom: 10,
    },
    itemContent: {
        width: '100%',
    },
    ratingSkeleton: {
        width: 60,
        height: 12,
        marginBottom: 8,
    },
    titleSkeleton: {
        width: '100%',
        height: 16,
        marginBottom: 6,
    },
    lessorSkeleton: {
        width: '80%',
        height: 12,
        marginBottom: 4,
    },
    locationSkeleton: {
        width: '70%',
        height: 12,
        marginBottom: 4,
    },
    dateSkeleton: {
        width: '60%',
        height: 12,
        marginBottom: 4,
    },
    quantitySkeleton: {
        width: '50%',
        height: 12,
        marginBottom: 8,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    priceSkeleton: {
        width: 60,
        height: 16,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    messageSkeleton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginRight: 8,
    },
    likeSkeleton: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    rentButtonSkeleton: {
        width: '70%',
        height: 30,
        borderRadius: 10,
        alignSelf: 'flex-end',
    },
});

export default SkeletonLoadingHome;