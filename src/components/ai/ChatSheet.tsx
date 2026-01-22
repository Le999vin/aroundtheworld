"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AtlasChat } from "@/components/ai/AtlasChat";
import type {
  AiActionExecutionResult,
  AiActionEnvelope,
  AiAgentMode,
  AiUiContext,
} from "@/lib/ai/actions";
import type { AiChatContext } from "@/lib/ai/types";

type ChatSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadKey: string;
  context: AiChatContext;
  agentMode: AiAgentMode;
  onAgentModeChange?: (mode: AiAgentMode) => void;
  onExecuteActions?: (envelope: AiActionEnvelope) => Promise<AiActionExecutionResult>;
  uiContext?: AiUiContext;
};

export const ChatSheet = ({
  open,
  onOpenChange,
  threadKey,
  context,
  agentMode,
  onAgentModeChange,
  onExecuteActions,
  uiContext,
}: ChatSheetProps) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="right"
      className="flex h-svh min-h-0 w-[420px] max-w-[94vw] flex-col overflow-hidden overflow-x-hidden rounded-l-[32px] border-l border-white/10 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl"
    >
      <SheetHeader className="shrink-0 border-b border-white/10 px-6 pb-4 pt-6">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Atlas Assistant</p>
        <SheetTitle className="font-display text-2xl text-white">Chat</SheetTitle>
      </SheetHeader>

      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 pt-4">
        <AtlasChat
          variant="sheet"
          threadKey={threadKey}
          context={context}
          agentMode={agentMode}
          onAgentModeChange={onAgentModeChange}
          onExecuteActions={onExecuteActions}
          uiContext={uiContext}
        />
      </div>
    </SheetContent>
  </Sheet>
);

export default ChatSheet;
