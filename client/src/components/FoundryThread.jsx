import {
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState
} from "@assistant-ui/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "./ui/button.jsx";

function ThreadMessage() {
  const role = useAuiState((state) => state.message.role);
  const isUser = role === "user";

  return (
    <MessagePrimitive.Root className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={isUser
        ? "max-w-[82%] rounded-2xl rounded-br-md bg-slate-950 px-4 py-3 text-sm leading-6 text-white"
        : "max-w-[88%] px-1 py-2 text-[15px] leading-7 text-slate-800"
      }>
        {!isUser && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Foundry</div>}
        <MessagePrimitive.Parts>
          {({ part }) => part.type === "text" ? (
            <p className="whitespace-pre-wrap"><MessagePartPrimitive.Text /></p>
          ) : null}
        </MessagePrimitive.Parts>
      </div>
    </MessagePrimitive.Root>
  );
}

export function FoundryThread({ compact = false, placeholder = "Tell Foundry what feels unclear…" }) {
  return (
    <ThreadPrimitive.Root className={compact ? "flex h-full min-h-0 flex-col" : "flex min-h-[430px] flex-col"}>
      <ThreadPrimitive.Viewport className="relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-1 py-2">
          <div className="flex flex-col gap-4 py-2">
            <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mt-auto bg-gradient-to-t from-white via-white to-white/70 pt-8">
            <ThreadPrimitive.ScrollToBottom asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full shadow-sm disabled:hidden"
                aria-label="Scroll to latest message"
              >
                <ArrowDown className="size-4" />
              </Button>
            </ThreadPrimitive.ScrollToBottom>

            <ComposerPrimitive.Root className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-slate-300 focus-within:ring-4 focus-within:ring-slate-100">
              <ComposerPrimitive.Input
                rows={1}
                autoFocus={!compact}
                placeholder={placeholder}
                aria-label="Message Foundry"
                className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-6 text-slate-900 outline-none placeholder:text-slate-400"
              />
              <ComposerPrimitive.Send asChild>
                <Button size="icon" className="size-10 rounded-xl" aria-label="Send message">
                  <ArrowUp className="size-4" />
                </Button>
              </ComposerPrimitive.Send>
            </ComposerPrimitive.Root>
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
}
