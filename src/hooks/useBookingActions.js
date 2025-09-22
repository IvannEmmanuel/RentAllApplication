// hooks/useBookingActions.js - Create this new file
import { supabase } from '../supbaseClient'
import { handleBookingStatusChange } from '../notifications/notifications'

export const useBookingActions = () => {
  const updateBookingStatus = async (rentalId, newStatus) => {
    try {
      // Get current booking data
      const { data: currentBooking, error: fetchError } = await supabase
        .from('rental_transactions')
        .select('*')
        .eq('rental_id', rentalId)
        .single()

      if (fetchError) throw fetchError

      const oldStatus = currentBooking.status

      // Update booking status
      const { error: updateError } = await supabase
        .from('rental_transactions')
        .update({ status: newStatus })
        .eq('rental_id', rentalId)

      if (updateError) throw updateError

      // Send notification about status change
      try {
        await handleBookingStatusChange(
          currentBooking,
          oldStatus,
          newStatus
        )
        console.log('Status updated and notification sent successfully')
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError)
        // Don't fail the update if notification fails
      }

      return { success: true }
    } catch (error) {
      console.error('Error updating booking status:', error)
      return { success: false, error: error.message }
    }
  }

  return { updateBookingStatus }
}