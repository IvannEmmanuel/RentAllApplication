// RegistrationContext.js
import React, { createContext, useContext, useState } from 'react';

const RegistrationContext = createContext();

export const RegistrationProvider = ({ children }) => {
  const [registrationData, setRegistrationData] = useState({});

  const updateRegistrationData = (data) => {
    setRegistrationData(prev => ({ ...prev, ...data }));
  };

  const clearRegistrationData = () => {
    setRegistrationData({});
  };

  return (
    <RegistrationContext.Provider value={{
      registrationData,
      updateRegistrationData,
      clearRegistrationData
    }}>
      {children}
    </RegistrationContext.Provider>
  );
};

export const useRegistration = () => {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error('useRegistration must be used within a RegistrationProvider');
  }
  return context;
};