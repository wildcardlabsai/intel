"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type RegisterInterestContextValue = {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
};

const RegisterInterestContext = createContext<RegisterInterestContextValue | null>(null);

export function RegisterInterestProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo(
    () => ({
      isOpen,
      openModal: () => setIsOpen(true),
      closeModal: () => setIsOpen(false),
    }),
    [isOpen]
  );

  return (
    <RegisterInterestContext.Provider value={value}>
      {children}
    </RegisterInterestContext.Provider>
  );
}

export function useRegisterInterest() {
  const ctx = useContext(RegisterInterestContext);
  if (!ctx) {
    throw new Error("useRegisterInterest must be used within a RegisterInterestProvider");
  }
  return ctx;
}
