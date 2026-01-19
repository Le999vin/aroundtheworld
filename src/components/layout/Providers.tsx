"use client";

import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { defaultTransition } from "@/lib/motion";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user" transition={defaultTransition}>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </MotionConfig>
    </ThemeProvider>
  );
}

