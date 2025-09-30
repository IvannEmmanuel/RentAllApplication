import React from 'react';
import { View, StyleSheet } from 'react-native';

const SkeletonLoadingInbox = () => {
  // Create 6 skeleton items (typical loading state)
  const skeletonItems = Array.from({ length: 6 }, (_, index) => (
    <View key={index} style={styles.skeletonConversationItem}>
      {/* Avatar skeleton */}
      <View style={styles.skeletonAvatar} />
      
      {/* Content skeleton */}
      <View style={styles.skeletonContent}>
        {/* Header with name and timestamp */}
        <View style={styles.skeletonHeader}>
          <View style={[styles.skeletonLine, styles.skeletonName]} />
          <View style={[styles.skeletonLine, styles.skeletonTime]} />
        </View>
        
        {/* Item title skeleton */}
        <View style={[styles.skeletonLine, styles.skeletonItemTitle]} />
        
        {/* Message preview skeleton */}
        <View style={[styles.skeletonLine, styles.skeletonMessage]} />
        <View style={[styles.skeletonLine, styles.skeletonMessageShort]} />
      </View>
    </View>
  ));

  return (
    <View style={styles.container}>
      {/* Header skeleton */}
      <View style={styles.skeletonHeaderContainer}>
        <View style={[styles.skeletonLine, styles.skeletonMainTitle]} />
        <View style={[styles.skeletonLine, styles.skeletonSubtitle]} />
      </View>

      {/* Conversations list skeleton */}
      <View style={styles.skeletonConversationsList}>
        {skeletonItems}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5EF',
  },
  skeletonHeaderContainer: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
    backgroundColor: '#FAF5EF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  skeletonMainTitle: {
    width: 150,
    height: 28,
    marginBottom: 8,
    borderRadius: 6,
  },
  skeletonSubtitle: {
    width: 120,
    height: 16,
    borderRadius: 4,
  },
  skeletonConversationsList: {
    flex: 1,
  },
  skeletonConversationItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  skeletonAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5E5',
    marginRight: 15,
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  skeletonName: {
    width: 120,
    height: 18,
    borderRadius: 4,
  },
  skeletonTime: {
    width: 60,
    height: 14,
    borderRadius: 4,
  },
  skeletonItemTitle: {
    width: 140,
    height: 16,
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonMessage: {
    width: '90%',
    height: 14,
    borderRadius: 4,
    marginBottom: 4,
  },
  skeletonMessageShort: {
    width: '70%',
    height: 14,
    borderRadius: 4,
  },
  skeletonLine: {
    backgroundColor: '#E5E5E5',
  },
});

export default SkeletonLoadingInbox;