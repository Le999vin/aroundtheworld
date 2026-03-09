"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { AtlasChat } from "@/components/ai/AtlasChat";
import { SiriGlowFrame } from "@/components/ui/siri-glow-frame";
import type { AiChatContext } from "@/lib/ai/types";
import type { UiIntent } from "@/lib/ai/atlasAssistant.types";

type ChatSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadKey: string;
  context: AiChatContext;
  onSelectCountry?: (code: string) => void;
  onExecuteIntents?: (intents: UiIntent[]) => void;
  uiState?: Record<string, unknown>;
};

export const ChatSheet = ({
  open,
  onOpenChange,
  threadKey,
  context,
  onSelectCountry,
  onExecuteIntents,
  uiState,
}: ChatSheetProps) => {
  const [isLoadingOrStreaming, setIsLoadingOrStreaming] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIsLoadingOrStreaming(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex h-svh min-h-0 w-[420px] max-w-[94vw] flex-col rounded-l-[32px] border-l border-white/10 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl"
      >
        {/* Siri loading border active when isLoadingOrStreaming */}
        <SiriGlowFrame
          active={open && isLoadingOrStreaming}
          className="flex h-full min-h-0 flex-col rounded-l-[32px]"
        >
          <SheetHeader className="shrink-0 border-b border-white/10 px-6 pb-4 pt-6">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Atlas Assistant</p>
            <SheetTitle className="font-display text-2xl text-white">Chat</SheetTitle>
            {context.mode === "country" ? (
              <div className="pt-2">
                <Badge variant="secondary" className="text-xs">
                  Context: {context.country?.name ?? context.country?.code ?? "Country"}
                </Badge>
              </div>
            ) : null}
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 pt-4">
            <AtlasChat
              variant="sheet"
              threadKey={threadKey}
              context={context}
              onSelectCountry={onSelectCountry}
              onExecuteIntents={onExecuteIntents}
              onLoadingStateChange={setIsLoadingOrStreaming}
              uiState={uiState}
            />
          </div>
        </SiriGlowFrame>
      </SheetContent>
    </Sheet>
  );
};

export default ChatSheet;
