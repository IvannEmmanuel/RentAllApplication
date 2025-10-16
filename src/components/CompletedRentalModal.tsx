// src/components/CompletedRentalModal.tsx

import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Image,
  Modal,
  TouchableOpacity,
  FlatList,
} from "react-native"
import React, { useEffect, useState, useCallback } from "react"
import { supabase } from "../../supbaseClient"
import { useFavorites } from "./FavoritesContext"

const PAGE_SIZE = 6

const CompletedRentalModal = ({ visible, onClose }) => {
  const { currentUser } = useFavorites()
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchCompletedRentals = useCallback(
    async (reset = false) => {
      if (!currentUser) return

      if (reset) {
        setLoading(true)
        setPage(0)
        setHasMore(true)
      } else {
        setLoadingMore(true)
      }

      const from = reset ? 0 : page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error } = await supabase
        .from("rental_transactions")
        .select(
          `
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
            main_image_url,
            user: user_id (
              first_name,
              last_name
            )
          )
        `
        )
        .eq("renter_id", currentUser.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .range(from, to)

      if (error) {
        console.error("Error fetching completed rentals:", error)
      } else {
        if (reset) {
          setRentals(data)
        } else {
          setRentals((prev) => [...prev, ...data])
        }

        if (data.length < PAGE_SIZE) {
          setHasMore(false)
        }
      }

      setLoading(false)
      setLoadingMore(false)
    },
    [currentUser, page]
  )

  useEffect(() => {
    if (visible) {
      fetchCompletedRentals(true)
    }
  }, [visible, currentUser])

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setPage((prev) => prev + 1)
    }
  }

  useEffect(() => {
    if (page > 0) {
      fetchCompletedRentals(false)
    }
  }, [page])

  const getTimeAgo = (updatedAt) => {
    const now = new Date()
    const updated = new Date(updatedAt)
    const diffTime = now - updated
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const diffWeeks = Math.floor(diffDays / 7)
    const diffMonths = Math.floor(diffDays / 30)

    if (diffMonths > 0) return `${diffMonths} month${diffMonths !== 1 ? "s" : ""} ago`
    if (diffWeeks > 0) return `${diffWeeks} week${diffWeeks !== 1 ? "s" : ""} ago`
    if (diffDays > 0) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
    return "Recently"
  }

  const getRentalDuration = (startDate, endDate) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = end - start
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const formatDateRange = (startDate, endDate) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const startMonth = start.toLocaleDateString("en-US", { month: "short" })
    const endMonth = end.toLocaleDateString("en-US", { month: "short" })
    const startDay = start.getDate()
    const endDay = end.getDate()
    return startMonth === endMonth
      ? `${startMonth} ${startDay}-${endDay}`
      : `${startMonth} ${startDay} - ${endMonth} ${endDay}`
  }

  const renderRental = ({ item: rental, index }) => {
    const duration = getRentalDuration(rental.start_date, rental.end_date)
    const timeAgo = getTimeAgo(rental.created_at)
    const dateRange = formatDateRange(rental.start_date, rental.end_date)

    return (
      <View key={rental.rental_id} style={[styles.card, { marginTop: index === 0 ? 8 : 12 }]}>
        <View style={styles.cardContent}>
          <Image
            source={
              rental.items?.main_image_url
                ? { uri: rental.items.main_image_url }
                : require("../../assets/splash-icon.png")
            }
            style={styles.image}
          />

          <View style={styles.info}>
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={2}>
                {rental.items?.title}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Completed</Text>
              </View>
            </View>

            <Text style={styles.ownerText}>
              {rental.items?.user?.first_name} {rental.items?.user?.last_name}
            </Text>

            <View style={styles.metaContainer}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Duration</Text>
                <Text style={styles.metaValue}>{duration}d</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Quantity</Text>
                <Text style={styles.metaValue}>{rental.quantity}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Total</Text>
                <Text style={styles.priceText}>₱{rental.total_cost}</Text>
              </View>
            </View>

            <View style={styles.detailsContainer}>
              <Text style={styles.detailSmall}>{dateRange}</Text>
              <Text style={styles.detailSmall}>📍 {rental.items?.location}</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Completed Rentals</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButtonContainer}>
            <Text style={styles.closeButton}>×</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#1a1a1a" />
            <Text style={styles.loadingText}>Loading rental history...</Text>
          </View>
        ) : rentals.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No Completed Rentals</Text>
            <Text style={styles.emptySubtitle}>Your completed rentals will appear here</Text>
          </View>
        ) : (
          <FlatList
            data={rentals}
            keyExtractor={(item) => item.rental_id.toString()}
            renderItem={renderRental}
            contentContainerStyle={styles.scrollContent}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator color="#1a1a1a" />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  )
}

export default CompletedRentalModal

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  closeButtonContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    fontSize: 28,
    color: '#999',
    fontWeight: '300',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 4,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f5f5f5',
  },
  info: {
    flex: 1,
    justifyContent: 'space-between',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
    lineHeight: 22,
  },
  badge: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 70,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2e7d32',
    textAlign: 'center',
  },
  ownerText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 2,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#e0e0e0',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  detailsContainer: {
    gap: 4,
  },
  detailSmall: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#999',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
})