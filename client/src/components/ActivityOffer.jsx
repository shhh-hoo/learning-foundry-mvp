import { ArrowRight, Play } from "lucide-react";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card, CardContent } from "./ui/card.jsx";

export function ActivityOffer({ capability, reason, onStart, starting = false }) {
  if (!capability) return null;

  return (
    <Card className="overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50 via-white to-white shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="outline" className="border-violet-200 bg-white text-violet-700">Try this next</Badge>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">{capability.title}</h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">{capability.purpose}</p>
            {reason && <p className="mt-3 text-sm leading-6 text-slate-500">{reason}</p>}
          </div>
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700">
            <Play className="size-5 fill-current" />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={onStart} disabled={starting} className="group">
            {starting ? "Opening…" : "Start activity"}
            {!starting && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
