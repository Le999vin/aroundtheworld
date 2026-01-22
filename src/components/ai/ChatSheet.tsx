"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AtlasChat } from "@/components/ai/AtlasChat";
import type { AiChatContext } from "@/lib/ai/types";

type ChatSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadKey: string;
  context: AiChatContext;
};

export const ChatSheet = ({
  open,
  onOpenChange,
  threadKey,
  context,
}: ChatSheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="right"
      className="flex w-[380px] max-w-[92vw] flex-col rounded-l-[32px] border-l border-white/10 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl"
    >
      <SheetHeader className="border-b border-white/10 px-6 pb-4 pt-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Atlas Assistant
        </p>
        <SheetTitle className="font-display text-2xl text-white">
          Chat
        </SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-hidden px-6 pb-6 pt-4">
        <AtlasChat variant="sheet" threadKey={threadKey} context={context} />
      </div>
    </SheetContent>
  </Sheet>
);

export default ChatSheet;
