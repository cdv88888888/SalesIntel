'use client';

import React from 'react';
import { useClientDrawer } from '../context/ClientDrawerContext';

export default function ClientClickWrapper({ dealerId, children, className, style }) {
  const { openClient } = useClientDrawer();
  
  return (
    <div 
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openClient(dealerId);
      }} 
      className={className} 
      style={{ cursor: 'pointer', ...style }}
    >
      {children}
    </div>
  );
}
