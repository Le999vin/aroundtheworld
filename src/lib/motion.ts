import type { Variants, Transition } from "framer-motion";

export const easing = {
  out: [0.16, 1, 0.3, 1] as Transition["ease"],
  inOut: [0.45, 0, 0.55, 1] as Transition["ease"],
};

export const durations = {
  fast: 0.2,
  base: 0.45,
  slow: 0.7,
  slower: 1,
};

export const defaultTransition: Transition = {
  duration: durations.base,
  ease: easing.out,
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { ...defaultTransition } },
  exit: { opacity: 0, y: -8, transition: { duration: durations.fast, ease: easing.inOut } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { ...defaultTransition } },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { ...defaultTransition } },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  show: { opacity: 1, y: 0, transition: { ...defaultTransition } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

export const reducedMotionVariants: Variants = {
  hidden: { opacity: 1, y: 0, x: 0 },
  show: { opacity: 1, y: 0, x: 0 },
};

export function revealVariants(distance = 24): Variants {
  return {
    hidden: { opacity: 0, y: distance },
    show: { opacity: 1, y: 0, transition: { ...defaultTransition } },
  };
}

