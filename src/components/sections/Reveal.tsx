"use client";

import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import { useRef } from "react";

import { reducedMotionVariants } from "@/lib/motion";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  variants: Variants;
  delay?: number;
  once?: boolean;
};

export function Reveal({
  children,
  className,
  variants,
  delay = 0,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once, margin: "-20% 0px" });
  const reduceMotion = useReducedMotion();
  const resolvedVariants = reduceMotion ? reducedMotionVariants : variants;

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      variants={resolvedVariants}
      initial="hidden"
      animate={isInView ? "show" : "hidden"}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </motion.div>
  );
}

