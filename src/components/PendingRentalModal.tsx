// src/components/PendingRentalModal.tsx

import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  TouchableOpacity,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supbaseClient';
import { useFavorites } from './FavoritesContext';

const PendingRentalModal = ({ visible, onClose }) => {
  const { currentUser } = useFavorites();
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !visible) return;

    const fetchPendingRentals = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('rental_transactions')
        .select(`
          rental_id,
          item_id,
          start_date,
          end_date,
          status,
          quantity,
          total_cost,
          created_at,
          items (
            title,
            price_per_day,
            location,
            main_image_url
          )
        `)
        .eq('renter_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending rentals:', error);
      } else {
        setRentals(data);
      }
      setLoading(false);
    };

    fetchPendingRentals();
  }, [currentUser, visible]);

  const getTimeAgo = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffTime = now - created;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const getDaysUntilStart = (startDate) => {
    const today = new Date();
    const start = new Date(startDate);
    const diffTime = start - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>Pending Rentals</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.center}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFAB00" />
              <Text style={styles.loadingText}>Loading pending requests...</Text>
            </View>
          </View>
        ) : rentals.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>⏳</Text>
              <Text style={styles.emptyTitle}>No Pending Rentals</Text>
              <Text style={styles.emptySubtitle}>
                You don't have any pending rental requests at the moment
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {rentals.map((rental, index) => {
              const daysUntilStart = getDaysUntilStart(rental.start_date);
              const timeAgo = getTimeAgo(rental.created_at);
              
              return (
                <View key={rental.rental_id} style={[styles.card, { marginTop: index === 0 ? 8 : 12 }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>⏱️ Pending Approval</Text>
                    </View>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeText}>{timeAgo}</Text>
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <Image
                      source={
                        rental.items?.main_image_url
                          ? { uri: rental.items.main_image_url }
                          : require('../../assets/splash-icon.png')
                      }
                      style={styles.image}
                    />

                    <View style={styles.info}>
                      <Text style={styles.title} numberOfLines={2}>
                        {rental.items?.title}
                      </Text>
                      
                      <View style={styles.detailRow}>
                        <Text style={styles.detailIcon}>📅</Text>
                        <Text style={styles.detailText}>
                          {new Date(rental.start_date).toLocaleDateString('en-US', { 
                            month: 'short', day: 'numeric' 
                          })} → {new Date(rental.end_date).toLocaleDateString('en-US', { 
                            month: 'short', day: 'numeric' 
                          })}
                        </Text>
                      </View>

                      {daysUntilStart > 0 && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailIcon}>🚀</Text>
                          <Text style={styles.detailText}>
                            Starts in {daysUntilStart} day{daysUntilStart !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}

                      <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Quantity</Text>
                          <Text style={styles.detailValue}>{rental.quantity}</Text>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Total Cost</Text>
                          <Text style={styles.priceText}>₱{rental.total_cost}</Text>
                        </View>
                      </View>

                      <View style={styles.locationContainer}>
                        <Text style={styles.detailIcon}>📍</Text>
                        <Text style={styles.locationText} numberOfLines={1}>
                          {rental.items?.location}
                        </Text>
                      </View>

                      <View style={styles.waitingContainer}>
                        <Text style={styles.waitingText}>
                          Waiting for owner's approval...
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

export default PendingRentalModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5EF'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginTop: 30
  },
  headerText: {
    fontFamily: 'DM-Bold',
    fontSize: 18,
  },
  closeButton: {
    fontSize: 20,
    color: '#FF4444',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  statusBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
  },
  timeBadge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 11,
    color: '#757575',
    fontWeight: '500',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  info: {
    flex: 1,
  },
  title: {
    fontFamily: 'DM-Bold',
    fontSize: 16,
    marginBottom: 8,
    color: '#2C3E50',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#5D6D7E',
    flex: 1,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFAB00',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 12,
    color: '#5D6D7E',
    flex: 1,
  },
  waitingContainer: {
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  waitingText: {
    fontSize: 12,
    color: '#F57C00',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7F8C8D',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 20,
  },
});