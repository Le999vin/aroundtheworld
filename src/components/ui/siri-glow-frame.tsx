import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./siri-glow-frame.module.css";

type SiriGlowFrameProps = {
  active: boolean;
  className?: string;
  children: ReactNode;
};

export const SiriGlowFrame = ({ active, className, children }: SiriGlowFrameProps) => (
  <div data-active={active ? "true" : "false"} className={cn(styles.frame, className)}>
    <div className={styles.content}>{children}</div>
  </div>
);

export default SiriGlowFrame;
