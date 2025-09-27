import React, { createContext, useState, useContext } from 'react';

const NotificationModalContext = createContext(null);

export const NotificationModalProvider = ({ children }) => {
  const [modalData, setModalData] = useState<{ type?: string; rentalId?: string; visible: boolean }>({ visible: false });

  const showModal = (type: string, rentalId?: string) => {
    setModalData({ type, rentalId, visible: true });
  };

  const hideModal = () => setModalData({ visible: false });

  return (
    <NotificationModalContext.Provider value={{ modalData, showModal, hideModal }}>
      {children}
    </NotificationModalContext.Provider>
  );
};

export const useNotificationModal = () => useContext(NotificationModalContext);
