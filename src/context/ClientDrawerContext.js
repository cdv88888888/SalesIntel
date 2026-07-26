'use client';

import React, { createContext, useContext, useState } from 'react';
import { getSingleDealerIntelligence } from '../app/actions';

const ClientDrawerContext = createContext();

export function ClientDrawerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dealerId, setDealerId] = useState(null);
  const [dealer, setDealer] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const openClient = async (dealerOrId, segmentOverride = null) => {
    setIsOpen(true);
    
    if (typeof dealerOrId === 'string') {
      const id = dealerOrId;
      setDealerId(id);
      setDealer(null);
      setIsLoading(true);
      
      // Determine segment dynamically from window location or fallback
      let segment = segmentOverride;
      if (!segment && typeof window !== 'undefined') {
        segment = new URLSearchParams(window.location.search).get('segment');
      }
      segment = segment || 'dealer';
      
      try {
        const fullData = await getSingleDealerIntelligence(id, segment);
        if (fullData) {
          setDealer(fullData);
        } else {
          // If not found in segment, try fetching from other segments or fallback to minimum object
          setDealer({ id, name: id });
        }
      } catch (err) {
        console.error("Failed to load global client details:", err);
        setDealer({ id, name: id });
      } finally {
        setIsLoading(false);
      }
    } else if (dealerOrId && typeof dealerOrId === 'object') {
      setDealerId(dealerOrId.id);
      setDealer(dealerOrId);
      setIsLoading(false);
    }
  };

  const closeClient = () => {
    setIsOpen(false);
    setDealerId(null);
    setDealer(null);
    setIsLoading(false);
  };

  return (
    <ClientDrawerContext.Provider value={{
      isOpen,
      dealerId,
      dealer,
      isLoading,
      openClient,
      closeClient
    }}>
      {children}
    </ClientDrawerContext.Provider>
  );
}

export function useClientDrawer() {
  return useContext(ClientDrawerContext);
}
