"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: reduceMotion ? "auto" : "smooth",
        })
      }
      className={cn(
        "fixed bottom-6 right-6 z-50 h-11 w-11 rounded-full border border-border/60 bg-background/80 shadow-lg backdrop-blur transition-all",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      )}
      aria-label="Back to top"
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  );
}

