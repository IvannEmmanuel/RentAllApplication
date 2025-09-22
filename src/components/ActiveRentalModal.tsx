// src/components/ActiveRentalModal.tsx

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

const ActiveRentalModal = ({ visible, onClose }) => {
  const { currentUser } = useFavorites();
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !visible) return;

    const fetchActiveRentals = async () => {
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
        .in('status', ['confirmed', 'ongoing'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching active rentals:', error);
      } else {
        setRentals(data);
      }
      setLoading(false);
    };

    fetchActiveRentals();
  }, [currentUser, visible]);

  const getStatusColor = (status) => {
    return status === 'confirmed' ? '#4CAF50' : '#FF9800';
  };

  const getStatusBgColor = (status) => {
    return status === 'confirmed' ? '#E8F5E8' : '#FFF3E0';
  };

  const getRemainingDays = (endDate) => {
    const today = new Date();
    const end = new Date(endDate);
    const diffTime = end - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header - Keep unchanged */}
        <View style={styles.header}>
          <Text style={styles.headerText}>Active Rentals</Text>
          <TouchableOpacity onPress={onClose} style={{width: 30, height: 30, backgroundColor: '#FFF', justifyContent: 'center', borderRadius: 20}}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.center}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFAB00" />
              <Text style={styles.loadingText}>Loading your rentals...</Text>
            </View>
          </View>
        ) : rentals.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No Active Rentals</Text>
              <Text style={styles.emptySubtitle}>You don't have any active rentals at the moment</Text>
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {rentals.map((rental, index) => {
              const remainingDays = getRemainingDays(rental.end_date);
              return (
                <View key={rental.rental_id} style={[styles.card, { marginTop: index === 0 ? 8 : 12 }]}>
                  <View style={styles.cardHeader}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusBgColor(rental.status) }
                    ]}>
                      <Text style={[styles.statusText, { color: getStatusColor(rental.status) }]}>
                        {rental.status === 'confirmed' ? '✓ Confirmed' : '🔄 Ongoing'}
                      </Text>
                    </View>
                    {remainingDays > 0 && (
                      <View style={styles.daysBadge}>
                        <Text style={styles.daysText}>
                          {remainingDays} day{remainingDays !== 1 ? 's' : ''} left
                        </Text>
                      </View>
                    )}
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

export default ActiveRentalModal;

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
    fontSize: 18,
    color: '#000000ff',
    alignSelf: 'center',
    fontFamily: 'DM-Bold'
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  daysBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysText: {
    fontSize: 11,
    color: '#1976D2',
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
    marginBottom: 12,
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
  },
  locationText: {
    fontSize: 12,
    color: '#5D6D7E',
    flex: 1,
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