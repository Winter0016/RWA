"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useGaslessTx } from '@/hooks/useGaslessTx';

type SmartAccountContextType = ReturnType<typeof useGaslessTx>;

const SmartAccountContext = createContext<SmartAccountContextType | null>(null);

export function SmartAccountProvider({ children }: { children: ReactNode }) {
  const gasless = useGaslessTx();
  return (
    <SmartAccountContext.Provider value={gasless}>
      {children}
    </SmartAccountContext.Provider>
  );
}

export function useSmartAccount() {
  const context = useContext(SmartAccountContext);
  if (!context) {
    throw new Error("useSmartAccount must be used within a SmartAccountProvider");
  }
  return context;
}
