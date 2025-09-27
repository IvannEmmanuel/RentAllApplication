import React, { useState, useEffect } from 'react';
import { useNotificationModal } from './NotificationModalContext';
import RatingsModal from './RatingsModal';
import YourItemsModal from './YourItemModal';
import PendingRentalModal from './PendingRentalModal';
import ActiveRentalModal from './ActiveRentalModal';
import { supabase } from '../../supbaseClient';

export default function AppModals({ currentUser }) {
  const { modalData, hideModal } = useNotificationModal();
  const [userRole, setUserRole] = useState(null); // 'lessor' or 'renter'
  const [isLoadingRole, setIsLoadingRole] = useState(false);

  // Determine user role for booking_completed notifications
  useEffect(() => {
    if (modalData.visible && modalData.type === 'booking_completed' && modalData.rentalId && currentUser?.id) {
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

          if (data.renter_id === currentUser.id) {
            setUserRole('renter');
          } else if (data.items.user_id === currentUser.id) {
            setUserRole('lessor');
          } else {
            setUserRole(null);
          }
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
  }, [modalData.visible, modalData.type, modalData.rentalId, currentUser?.id]);

  // Reset role when modal closes
  useEffect(() => {
    if (!modalData.visible) {
      setUserRole(null);
      setIsLoadingRole(false);
    }
  }, [modalData.visible]);

  // Determine which tab to show based on notification type
  const getInitialTab = (notificationType) => {
    switch (notificationType) {
      case 'booking_request':
        return 'pending';
      case 'booking_return':
        return 'confirmationReturned';
      case 'booking_started':
      case 'booking_confirmed':
        return 'active';
      case 'booking_completed':
        return 'completed';
      default:
        return 'pending';
    }
  };

  return (
    <>
      {/* Booking request - show PendingRentalModal for renter */}
      {modalData.visible && modalData.type === 'booking_confirmed' && (
        <ActiveRentalModal 
          visible={true}
          onClose={hideModal}
        />
      )}

      {/* Booking completed - show different modals based on user role */}
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
      
      {/* Other notification types - show YourItemsModal for lessor */}
      {modalData.visible && (
        modalData.type === 'booking_return' ||
        modalData.type === 'booking_started' ||
        modalData.type === 'booking_request'
      ) && (
        <YourItemsModal 
          visible={true}
          rentalId={modalData.rentalId}
          initialTab={getInitialTab(modalData.type)}
          onClose={hideModal}
          currentUser={currentUser}
        />
      )}
    </>
  );
}