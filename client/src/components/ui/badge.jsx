// Adapted from shadcn/ui (MIT). See THIRD_PARTY_NOTICES.md.
import { cn } from "../../lib/utils.js";

const variants = {
  default: "bg-slate-950 text-white",
  secondary: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  outline: "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"
};

export function Badge({ className, variant = "secondary", ...props }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", variants[variant] ?? variants.secondary, className)} {...props} />;
}
