"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";

type WebGLGuardProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

function isWebGLAvailable() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export function WebGLGuard({ children, fallback = null }: WebGLGuardProps) {
  const [supported] = useState(() => isWebGLAvailable());
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return fallback;
  }

  return supported ? children : fallback;
}

