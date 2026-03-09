import * as React from "react";

import { cn } from "@/lib/utils";

type ScrollAreaVariant = "default" | "glass";

type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: ScrollAreaVariant;
  viewportRef?: React.Ref<HTMLDivElement>;
  viewportClassName?: string;
  viewportProps?: Omit<React.HTMLAttributes<HTMLDivElement>, "ref">;
};

const glassViewportClasses = [
  "[scrollbar-width:thin]",
  "[scrollbar-color:rgba(255,255,255,0.25)_transparent]",
  "hover:[scrollbar-color:rgba(255,255,255,0.45)_rgba(255,255,255,0.08)]",
  "focus-within:[scrollbar-color:rgba(255,255,255,0.45)_rgba(255,255,255,0.08)]",
  "[scrollbar-gutter:stable]",
  "[-webkit-overflow-scrolling:touch]",
  "[&::-webkit-scrollbar]:w-[8px]",
  "[&::-webkit-scrollbar]:h-[8px]",
  "[&::-webkit-scrollbar-track]:bg-transparent",
  "hover:[&::-webkit-scrollbar-track]:bg-white/5",
  "focus-within:[&::-webkit-scrollbar-track]:bg-white/5",
  "[&::-webkit-scrollbar-thumb]:rounded-full",
  "[&::-webkit-scrollbar-thumb]:border",
  "[&::-webkit-scrollbar-thumb]:border-white/20",
  "[&::-webkit-scrollbar-thumb]:bg-white/20",
  "[&::-webkit-scrollbar-thumb]:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_10px_rgba(0,0,0,0.25)]",
  "[&::-webkit-scrollbar-thumb]:[background-clip:padding-box]",
  "[&::-webkit-scrollbar-thumb]:[backdrop-filter:blur(10px)]",
  "[&::-webkit-scrollbar-thumb]:transition-[background-color,border-color,box-shadow]",
  "hover:[&::-webkit-scrollbar-thumb]:bg-white/35",
  "hover:[&::-webkit-scrollbar-thumb]:border-white/30",
  "hover:[&::-webkit-scrollbar-thumb]:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_0_12px_rgba(0,0,0,0.3)]",
  "focus-within:[&::-webkit-scrollbar-thumb]:bg-white/35",
  "focus-within:[&::-webkit-scrollbar-thumb]:border-white/30",
  "focus-within:[&::-webkit-scrollbar-thumb]:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_0_12px_rgba(0,0,0,0.3)]",
].join(" ");

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    {
      className,
      children,
      variant = "default",
      viewportRef,
      viewportClassName,
      viewportProps,
      ...props
    },
    ref,
  ) => {
    const { className: viewportPropsClassName, ...viewportRest } =
      viewportProps ?? {};

    return (
      <div
        ref={ref}
        data-slot="scroll-area"
        data-variant={variant}
        className={cn("relative overflow-hidden", className)}
        {...props}
      >
        <div
          ref={viewportRef}
          data-slot="scroll-area-viewport"
          className={cn(
            "h-full w-full overflow-y-auto overflow-x-hidden",
            variant === "glass" ? glassViewportClasses : null,
            viewportClassName,
            viewportPropsClassName,
          )}
          {...viewportRest}
        >
          {children}
        </div>
      </div>
    );
  },
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
