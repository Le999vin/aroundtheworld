"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ChatFabProps = {
  onClick: () => void;
  className?: string;
};

export const ChatFab = ({ onClick, className }: ChatFabProps) => (
  <Button
    type="button"
    size="sm"
    variant="secondary"
    onClick={onClick}
    className={cn(
      "rounded-full border border-white/10 bg-white/10 text-white shadow-lg hover:bg-white/20",
      className
    )}
  >
    <MessageCircle className="size-4" />
    Chat
  </Button>
);

export default ChatFab;
