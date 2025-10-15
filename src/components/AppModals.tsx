import React, { useState, useEffect } from 'react';
import { useNotificationModal } from './NotificationModalContext';
import RatingsModal from './RatingsModal';
import YourItemsModal from './YourItemModal';
import PendingRentalModal from './PendingRentalModal';
import ActiveRentalModal from './ActiveRentalModal';
import { supabase } from '../../supbaseClient';
import ItemTrackingLessorScreen from './ItemTrackingLessorScreen';

export default function AppModals({ currentUser }) {
  const { modalData, hideModal } = useNotificationModal();
  const [userRole, setUserRole] = useState(null); // 'lessor' or 'renter'
  const [isLoadingRole, setIsLoadingRole] = useState(false);

  // Determine user role
  useEffect(() => {
    if (modalData.visible && modalData.rentalId && currentUser?.id) {
      setIsLoadingRole(true);

      const determineUserRole = async () => {
        try {
          const { data, error } = await supabase
            .from('rental_transactions')
            .select(`
              renter_id,
              items!inner(user_id)
            `)
            .eq('rental_id', modalData.rentalId)
            .single();

          if (error) throw error;

          if (data.renter_id === currentUser.id) setUserRole('renter');
          else if (data.items.user_id === currentUser.id) setUserRole('lessor');
          else setUserRole(null);
        } catch (error) {
          console.error('Error determining user role:', error);
          setUserRole(null);
        } finally {
          setIsLoadingRole(false);
        }
      };

      determineUserRole();
    } else {
      setUserRole(null);
    }
  }, [modalData.visible, modalData.rentalId, currentUser?.id]);

  useEffect(() => {
    if (!modalData.visible) {
      setUserRole(null);
      setIsLoadingRole(false);
    }
  }, [modalData.visible]);

  const getInitialTab = (notificationType) => {
    switch (notificationType) {
      case 'booking_request': return 'pending';
      case 'booking_return': return 'confirmationReturned';
      case 'booking_started':
      case 'booking_confirmed': return 'active';
      case 'booking_completed': return 'completed';
      default: return 'pending';
    }
  };

  return (
    <>
      {/* Active rentals - for booking_confirmed, booking_started, AND booking_ongoing */}
      {modalData.visible &&
        (
          modalData.type === 'booking_confirmed' ||
          modalData.type === 'booking_started' ||
          (modalData.type === 'booking_started' && userRole === 'renter')
        ) &&
        !isLoadingRole && (
          <ActiveRentalModal visible={true} onClose={hideModal} />
        )}

      {/* Booking completed */}
      {modalData.visible && modalData.type === 'booking_completed' && !isLoadingRole && (
        <>
          {userRole === 'renter' && (
            <RatingsModal
              visible={true}
              onClose={hideModal}
              currentUserId={currentUser?.id}
            />
          )}
          {userRole === 'lessor' && (
            <YourItemsModal
              visible={true}
              rentalId={modalData.rentalId}
              initialTab="completed"
              onClose={hideModal}
              currentUser={currentUser}
            />
          )}
        </>
      )}

      {/* Booking request - show modal based on role */}
      {modalData.visible && !isLoadingRole && modalData.type === 'booking_request' && (
        userRole === 'lessor' ? (
          <YourItemsModal
            visible={true}
            rentalId={modalData.rentalId}
            initialTab="pending"
            onClose={hideModal}
            currentUser={currentUser}
          />
        ) : userRole === 'renter' ? (
          <PendingRentalModal
            visible={true}
            onClose={hideModal}
          />
        ) : null
      )}

      {/* Other notifications for lessor */}
      {modalData.visible && !isLoadingRole && userRole === 'lessor' &&
        (modalData.type === 'booking_return' ||
          modalData.type === 'booking_started' ||
          modalData.type === 'booking_ongoing' ||
          modalData.type === 'deposit_submitted' ||
          modalData.type === 'on_the_way' ||
          modalData.type === 'booking_delivered') && (
          <ItemTrackingLessorScreen
            visible={true}
            rentalId={modalData.rentalId}
            onClose={hideModal}
            currentUser={currentUser}
          />
        )
      }

      {/* Add a fallback for any unhandled notification types */}
      {modalData.visible && !isLoadingRole && (
        console.log('🔍 Modal data:', {
          type: modalData.type,
          rentalId: modalData.rentalId,
          userRole: userRole
        })
      )}
    </>
  );
}