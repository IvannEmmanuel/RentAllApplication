import React from 'react';
import { View, StyleSheet } from 'react-native';

const SkeletonItemCard = () => {
    return (
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
    );
};

// These styles are copied from your original SkeletonLoadingHome.tsx
const styles = StyleSheet.create({
    itemWrapper: {
        width: '48%',
        marginBottom: 15,
    },
    skeleton: {
        backgroundColor: '#E5E5E5',
        borderRadius: 4,
    },
    itemContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 10,
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

export default SkeletonItemCard;