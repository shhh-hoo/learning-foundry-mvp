// Adapted from shadcn/ui's Radix Sheet (MIT). See THIRD_PARTY_NOTICES.md.
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "../../lib/utils.js";

export function Sheet(props) {
  return <Dialog.Root {...props} />;
}

export function SheetTrigger(props) {
  return <Dialog.Trigger {...props} />;
}

export function SheetClose(props) {
  return <Dialog.Close {...props} />;
}

export function SheetContent({ children, className, ...props }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/25 backdrop-blur-[2px] data-[state=closed]:opacity-0" />
      <Dialog.Content
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl outline-none sm:w-[420px]",
          className
        )}
        {...props}
      >
        {children}
        <Dialog.Close className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function SheetHeader({ className, ...props }) {
  return <div className={cn("border-b border-slate-100 px-5 py-5 pr-14", className)} {...props} />;
}

export function SheetTitle({ className, ...props }) {
  return <Dialog.Title className={cn("text-base font-semibold text-slate-950", className)} {...props} />;
}

export function SheetDescription({ className, ...props }) {
  return <Dialog.Description className={cn("mt-1 text-sm leading-6 text-slate-500", className)} {...props} />;
}
