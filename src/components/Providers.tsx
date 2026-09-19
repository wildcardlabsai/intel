"use client";

import type { ReactNode } from "react";
import { RegisterInterestProvider } from "@/context/RegisterInterestContext";
import RegisterInterestModal from "@/components/RegisterInterestModal";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <RegisterInterestProvider>
      {children}
      <RegisterInterestModal />
    </RegisterInterestProvider>
  );
}
