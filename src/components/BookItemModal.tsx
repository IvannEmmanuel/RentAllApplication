import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native'
import React, { useState, useEffect, useMemo } from 'react'
import { Calendar } from 'react-native-calendars'
import { supabase } from '../../supbaseClient'
import { handleBookingStatusChange } from '../notifications/notifications'
import ReportItemModal from './ReportItemModal'

const BookItemModal = ({ visible, onClose, item, currentUserId, onBooked }) => {
  const [loading, setLoading] = useState(false)
  const [busyDates, setBusyDates] = useState({}) // For calendar marking
  const [selectedDates, setSelectedDates] = useState({})
  const [imageUrl, setImageUrl] = useState()
  const [errorMsg, setErrorMsg] = useState("")

  const sentNotifications = new Set<string>();

  const today = new Date().toISOString().split('T')[0]

  const [selectedQuantity, setSelectedQuantity] = useState(1);

  //Ratings
  const [ratings, setRatings] = useState([])
  const [averageRating, setAverageRating] = useState<number | null>(null);

  const [reportModalVisible, setReportModalVisible] = useState(false);

  useEffect(() => {
    if (!visible || !item?.item_id) return;

    const fetchReviews = async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
        rating,
        comment,
        created_at,
        reviewer_id,
        users:reviewer_id (first_name, last_name)
      `)
        .eq("item_id", item.item_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching reviews:", error);
        setRatings([]);
        setAverageRating(null);
        return;
      }

      setRatings(data || []);

      if (data && data.length > 0) {
        const total = data.reduce((sum, r) => sum + r.rating, 0);
        const avg = total / data.length;
        setAverageRating(avg);
      } else {
        setAverageRating(null);
      }
    };

    fetchReviews();
  }, [visible, item?.item_id]);


  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedQuantity(1); // reset back to 1 on close
    }
  }, [visible]);

  // Get busy dates from database
  useEffect(() => {
    if (!visible || !item?.item_id) return

    const fetchBusyDates = async () => {
      const { data, error } = await supabase
        .from("rental_transactions")
        .select("start_date,end_date,status")
        .eq("item_id", item.item_id)
        .in("status", ["pending", "confirmed", "ongoing"])

      if (error) return

      const markedDates = {}

      // Mark all busy dates as disabled
      data?.forEach(transaction => {
        const startDate = new Date(transaction.start_date)
        const endDate = new Date(transaction.end_date)

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0]
          markedDates[dateStr] = {
            disabled: true,
            disableTouchEvent: true,
            color: '#ffcccc',
            textColor: '#999'
          }
        }
      })

      setBusyDates(markedDates)
    }

    fetchBusyDates()
  }, [visible, item?.item_id])

  // Get item image
  useEffect(() => {
    if (!visible || !item?.item_id || !item?.user_id) return

    const fetchImage = async () => {
      try {
        const dir = `${item.user_id}/${item.item_id}`
        const { data: files, error } = await supabase.storage
          .from("Items-photos")
          .list(dir, {
            limit: 1,
            sortBy: { column: "name", order: "desc" },
          })

        if (error || !files || files.length === 0) {
          setImageUrl(undefined)
          return
        }

        const fullPath = `${dir}/${files[0].name}`
        const { data: pub } = supabase.storage
          .from("Items-photos")
          .getPublicUrl(fullPath)

        setImageUrl(pub?.publicUrl)
      } catch {
        setImageUrl(undefined)
      }
    }

    fetchImage()
  }, [visible, item?.item_id, item?.user_id])

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedDates({})
      setErrorMsg("")
    }
  }, [visible])

  // Calculate days and total cost
  const { daysCount, total, startDate, endDate } = useMemo(() => {
    const dates = Object.keys(selectedDates).filter(date => selectedDates[date].selected)

    if (dates.length === 0) {
      return { daysCount: 0, total: 0, startDate: null, endDate: null }
    }

    const sortedDates = dates.sort()
    const start = sortedDates[0]
    const end = sortedDates[sortedDates.length - 1]

    // Check for gaps in selection
    const startDateObj = new Date(start)
    const endDateObj = new Date(end)
    let hasGaps = false

    for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      if (!selectedDates[dateStr]?.selected) {
        hasGaps = true
        break
      }
    }

    if (hasGaps) {
      return { daysCount: 0, total: 0, startDate: null, endDate: null }
    }

    const days = dates.length
    const price = Number(item?.price_per_day || 0)
    const deposit = Number(item?.deposit_fee || 0)

    // Multiply price by days and quantity
    const subtotal = price * days * selectedQuantity

    // Multiply deposit by quantity * days (as per your example)
    const depositTotal = deposit * days * selectedQuantity

    const totalCost = subtotal + depositTotal

    return {
      daysCount: days,
      total: totalCost,
      startDate: start,
      endDate: end
    }
  }, [selectedDates, item?.price_per_day, item?.deposit_fee, selectedQuantity])

  const onDayPress = (day) => {
    const dateStr = day.dateString

    // Don't allow selection of past dates or busy dates
    if (dateStr < today || busyDates[dateStr]?.disabled) {
      return
    }

    const selectedDateKeys = Object.keys(selectedDates).filter(date => selectedDates[date].selected)

    if (selectedDateKeys.length === 0) {
      // First selection - set as start date
      setSelectedDates({
        [dateStr]: {
          selected: true,
          color: '#FFAB00',
          textColor: '#FFF'
        }
      })
    } else if (selectedDateKeys.length === 1) {
      const startDate = selectedDateKeys[0]

      if (dateStr === startDate) {
        // Clicking same date - keep as single day rental
        return
      } else {
        // Second selection - set range between start and end
        const start = new Date(startDate)
        const end = new Date(dateStr)

        // Ensure start is before end
        const actualStart = start <= end ? start : end
        const actualEnd = start <= end ? end : start

        // Check if there are any busy dates in between
        let hasConflict = false
        for (let d = new Date(actualStart); d <= actualEnd; d.setDate(d.getDate() + 1)) {
          const checkDate = d.toISOString().split('T')[0]
          if (busyDates[checkDate]?.disabled) {
            hasConflict = true
            break
          }
        }

        if (hasConflict) {
          Alert.alert('Date Conflict', 'Selected date range contains unavailable dates. Please select different dates.')
          return
        }

        // Create range selection
        const newSelectedDates = {}
        for (let d = new Date(actualStart); d <= actualEnd; d.setDate(d.getDate() + 1)) {
          const rangeDate = d.toISOString().split('T')[0]
          newSelectedDates[rangeDate] = {
            selected: true,
            color: '#FFAB00',
            textColor: '#FFF'
          }
        }

        setSelectedDates(newSelectedDates)
      }
    } else {
      // Already have a range selected - start new selection
      setSelectedDates({
        [dateStr]: {
          selected: true,
          color: '#FFAB00',
          textColor: '#FFF'
        }
      })
    }
  }

  const clearDates = () => {
    setSelectedDates({})
    setErrorMsg("")
  }

  const isOwner = currentUserId && item?.user_id && currentUserId === item.user_id
  const canSubmit = !loading && !isOwner && daysCount > 0 && !!currentUserId

  // const submit = async () => {
  //   setErrorMsg("")

  //   if (!currentUserId) {
  //     setErrorMsg("Please sign in to request a booking.")
  //     return
  //   }

  //   if (!item?.item_id) return

  //   if (daysCount === 0) {
  //     setErrorMsg("Select rental dates to continue.")
  //     return
  //   }

  //   if (isOwner) {
  //     setErrorMsg("You can't rent your own item.")
  //     return
  //   }

  //   try {
  //     setLoading(true)

  //     const payload = {
  //       item_id: item.item_id,
  //       renter_id: currentUserId,
  //       start_date: startDate,
  //       end_date: endDate,
  //       total_cost: total,
  //     }

  //     const { error } = await supabase
  //       .from("rental_transactions")
  //       .insert([payload])

  //     if (error) throw error

  //     Alert.alert(
  //       'Booking Requested',
  //       'Your rental request has been submitted successfully!',
  //       [{
  //         text: 'OK', onPress: () => {
  //           onBooked?.()
  //           onClose()
  //         }
  //       }]
  //     )

  //   } catch (e) {
  //     console.error('Booking error:', e)
  //     setErrorMsg("Failed to submit booking. Please try again.")
  //   } finally {
  //     setLoading(false)
  //   }
  // }

  const submit = async () => {
    setErrorMsg("")

    if (!currentUserId) {
      setErrorMsg("Please sign in to request a booking.")
      return
    }

    if (!item?.item_id) return

    if (daysCount === 0) {
      setErrorMsg("Select rental dates to continue.")
      return
    }

    if (isOwner) {
      setErrorMsg("You can't rent your own item.")
      return
    }

    try {
      setLoading(true)

      const payload = {
        item_id: item.item_id,
        renter_id: currentUserId,
        start_date: startDate,
        end_date: endDate,
        total_cost: total * selectedQuantity,
        quantity: selectedQuantity,
        status: 'pending'
      }

      const { data: newBooking, error } = await supabase
        .from("rental_transactions")
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      // Send notification to lessor about new booking request
      try {
        await handleBookingStatusChange(
          {
            rental_id: newBooking.rental_id,
            renter_id: currentUserId,
            item_id: item.item_id,
          },
          null, // no old status
          'pending'
        )
        console.log('Notification sent successfully')
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError)
        // Don't fail the booking if notification fails
      }

      Alert.alert(
        'Booking Requested',
        'Your rental request has been submitted successfully! The owner will be notified.',
        [{
          text: 'OK', onPress: () => {
            onBooked?.()
            onClose()
          }
        }]
      )

    } catch (e) {
      console.error('Booking error:', e)
      setErrorMsg("Failed to submit booking. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Combine busy dates with selected dates for calendar
  const markedDates = {
    ...busyDates,
    ...selectedDates
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rent "{item?.title}"</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Item Info */}
          <View style={styles.itemInfo}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.itemImage} />
            ) : (
              <Image source={require('../../assets/splash-icon.png')} style={styles.itemImage} />
            )}

            <View style={styles.itemDetails}>
              <View style={styles.priceRow}>
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>Price per day</Text>
                  <Text style={styles.priceValue}>₱{Number(item?.price_per_day || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.priceItem}>
                  <Text style={styles.priceLabel}>Deposit fee</Text>
                  <Text style={styles.priceValue}>₱{Number(item?.deposit_fee || 0).toFixed(2)}</Text>
                </View>
              </View>
              <View style={styles.quantityRow}>
                <Text style={styles.priceLabel}>Quantity: {item?.quantity}</Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={[styles.qtyButton, selectedQuantity <= 1 && styles.qtyDisabled]}
                    disabled={selectedQuantity <= 1}
                    onPress={() => setSelectedQuantity(prev => Math.max(1, prev - 1))}
                  >
                    <Text style={styles.qtyButtonText}>−</Text>
                  </TouchableOpacity>

                  <Text style={styles.priceValue}>{selectedQuantity}</Text>

                  <TouchableOpacity
                    style={[
                      styles.qtyButton,
                      selectedQuantity >= (item?.quantity || 1) && styles.qtyDisabled
                    ]}
                    disabled={selectedQuantity >= (item?.quantity || 1)}
                    onPress={() =>
                      setSelectedQuantity(prev => Math.min(item?.quantity || 1, prev + 1))
                    }
                  >
                    <Text style={styles.qtyButtonText}>＋</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {item?.location && (
                <View style={styles.locationContainer}>
                  <Text style={styles.locationLabel}>Location</Text>
                  <Text style={styles.locationValue}>{item.location}</Text>
                </View>
              )}

              <TouchableOpacity onPress={() => setReportModalVisible(true)} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
                <Image source={require('../../assets/report.png')} style={{ width: 20, height: 20, marginRight: 6 }} />
                <Text style={{ color: '#FF4B4B', fontWeight: '600' }}>Report this item</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.separator} />

          {/* Calendar Section */}
          <View style={styles.calendarSection}>
            <View style={styles.calendarHeader}>
              <Text style={styles.sectionTitle}>Select rental dates</Text>
              <TouchableOpacity onPress={clearDates} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Clear dates</Text>
              </TouchableOpacity>
            </View>

            <Calendar
              current={today}
              minDate={today}
              onDayPress={onDayPress}
              markedDates={markedDates}
              theme={{
                selectedDayBackgroundColor: '#FFAB00',
                selectedDayTextColor: '#FFF',
                todayTextColor: '#FFAB00',
                dayTextColor: '#2d4150',
                textDisabledColor: '#d9e1e8',
                arrowColor: '#FFAB00',
                disabledArrowColor: '#d9e1e8',
                monthTextColor: '#2d4150',
                indicatorColor: '#FFAB00',
                textDayFontFamily: 'DM-Regular',
                textMonthFontFamily: 'DM-Bold',
                textDayHeaderFontFamily: 'DM-Medium',
              }}
            />

            <View style={styles.calendarLegend}>
              <Text style={styles.legendText}>• First tap: Select start date</Text>
              <Text style={styles.legendText}>• Second tap: Select end date (creates range)</Text>
              <Text style={styles.legendText}>• Third tap: Start new selection</Text>
              <Text style={styles.legendText}>• Red dates are unavailable</Text>
              <Text style={styles.noteText}>{"\n"}NOTE: A booking request must be confirmed by the lessor prior to the scheduled rental start date. 
                Unconfirmed booking requests by the start date are automatically canceled and removed from the system.</Text>
            </View>
          </View>

          {/* Booking Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.sectionTitle}>Booking summary</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Start date</Text>
              <Text style={styles.summaryValue}>
                {startDate ? new Date(startDate).toLocaleDateString() : "—"}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>End date</Text>
              <Text style={styles.summaryValue}>
                {endDate ? new Date(endDate).toLocaleDateString() : "—"}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Days</Text>
              <Text style={styles.summaryValue}>{daysCount}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Quantity</Text>
              <Text style={styles.summaryValue}>{selectedQuantity}</Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal x {selectedQuantity}</Text>
              <Text style={styles.summaryValue}>
                ₱{(Number(item?.price_per_day || 0) * daysCount * selectedQuantity).toFixed(2)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Deposit x {selectedQuantity}</Text>
              <Text style={styles.summaryValue}>
                ₱{(Number(item?.deposit_fee || 0) * daysCount * selectedQuantity).toFixed(2)}
              </Text>
            </View>

            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₱{total.toFixed(2)}</Text>
            </View>

            {/* Error Messages */}
            {isOwner && (
              <Text style={styles.errorText}>
                You are the owner of this item and cannot book it.
              </Text>
            )}

            {!currentUserId && (
              <Text style={styles.warningText}>
                Please sign in to request a booking.
              </Text>
            )}

            {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
          </View>

          <View style={styles.ratingsContainer}>
            <View style={styles.ratingsHeader}>
              <Text style={styles.sectionTitle}>Ratings & Reviews</Text>

              {averageRating !== null && (
                <Text style={styles.ratingSummary}>
                  ⭐ {averageRating.toFixed(1)} · {ratings.length} review{ratings.length > 1 ? "s" : ""}
                </Text>
              )}
            </View>

            {ratings.length === 0 ? (
              <Text style={styles.noRatingsText}>No reviews yet for this item.</Text>
            ) : (
              ratings.map((r, idx) => (
                <View key={idx} style={styles.ratingCard}>
                  <Text style={styles.ratingScore}>⭐ {r.rating}/5</Text>
                  {r.comment && <Text style={styles.ratingReview}>{r.comment}</Text>}
                  <Text style={styles.ratingUser}>
                    {r.users?.first_name} {r.users?.last_name} ·{" "}
                    {new Date(r.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.submitButton, !canSubmit && styles.disabledButton]}
            onPress={submit}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Request Booking</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {item && (
        <ReportItemModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          targetUserId={item.user_id}
          senderId={currentUserId}
          itemId={item.item_id}
          rentalId={null}  // Add this explicitly
        />
      )}
    </Modal>
  )
}

export default BookItemModal

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
  itemInfo: {
    flexDirection: 'row',
    paddingVertical: 20,
    gap: 16,
  },
  itemImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
  },
  itemDetails: {
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  priceItem: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 18,
    fontFamily: 'DM-Bold',
    color: '#333',
  },
  locationContainer: {
    marginTop: 10
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  locationValue: {
    fontSize: 14,
    color: '#333',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 16,
  },
  calendarSection: {
    marginBottom: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#333',
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 6,
    backgroundColor: '#FFF',
  },
  clearButtonText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'DM-Medium',
  },
  calendarLegend: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  noteText: {
    fontSize: 11,
    fontFamily: 'DM-Bold',
    color: '#FFAB00',
  },
  legendText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  summaryContainer: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'DM-Medium',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontFamily: 'DM-Bold',
    color: '#FFAB00',
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#FF8C00',
    marginTop: 8,
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
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  qtyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFAB00",
    justifyContent: "center",
    alignItems: "center",
  },
  qtyDisabled: {
    backgroundColor: "#DDD",
  },
  qtyButtonText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFF",
  },
  ratingsContainer: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noRatingsText: {
    fontSize: 13,
    color: "#666",
    marginTop: 6,
    fontStyle: "italic",
  },
  ratingCard: {
    marginTop: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  ratingScore: {
    fontSize: 14,
    fontFamily: "DM-Bold",
    color: "#FFAB00",
  },
  ratingReview: {
    fontSize: 13,
    color: "#333",
    marginTop: 4,
  },
  ratingUser: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  ratingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  ratingSummary: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
})