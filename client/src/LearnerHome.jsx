import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Clock3 } from "lucide-react";
import { loadStudent } from "./api.js";
import { Badge } from "./components/ui/badge.jsx";
import { Button } from "./components/ui/button.jsx";
import { Card, CardContent } from "./components/ui/card.jsx";

function statusLabel(task) {
  if (!task) return "Not started";
  const labels = {
    NOT_STARTED: "Ready to start",
    GUIDANCE: "In progress",
    ACTIVITY_READY: "Activity ready",
    ACTIVITY_ACTIVE: "In progress",
    WAITING_FOR_TEACHER: "Waiting for teacher",
    NO_MATCH: "Needs a next step",
    RUNTIME_FAILURE: "Activity needs retry"
  };
  return labels[task.learnerState] ?? "In progress";
}

export function LearnerHome({ studentId }) {
  const { data: view, isPending, error } = useQuery({
    queryKey: ["student", studentId],
    queryFn: () => loadStudent(studentId)
  });

  if (isPending) return <div className="mx-auto max-w-5xl px-6 py-16 text-sm text-slate-500">Loading your learning…</div>;
  if (error) return <div className="mx-auto max-w-5xl px-6 py-16 text-sm text-red-600">{error.message}</div>;

  const tasks = [...(view?.tasks ?? [])].reverse();

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-10 max-w-2xl">
        <span className="text-sm font-medium text-violet-600">My learning</span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Good to see you, {view.student.name}.</h1>
        <p className="mt-3 text-base leading-7 text-slate-500">Pick up where you left off. Foundry will keep the conversation and activity together.</p>
      </div>

      {tasks.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><BookOpen className="size-5" /></div>
            <h2 className="mt-4 text-lg font-semibold">Nothing assigned yet</h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">Your next learning task will appear here when your teacher assigns it.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tasks.map((task, index) => (
            <Card key={task.id} className={index === 0 ? "border-slate-300" : "shadow-none"}>
              <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={task.learnerState === "ACTIVITY_ACTIVE" ? "success" : "secondary"}>{statusLabel(task)}</Badge>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Clock3 className="size-3.5" /> about 10 min</span>
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">{task.goal}</h2>
                  {task.teacherInstruction && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{task.teacherInstruction}</p>}
                </div>
                <Button asChild variant={index === 0 ? "default" : "outline"} className="shrink-0">
                  <a href={`#learn/${studentId}/${task.id}`}>
                    {task.learnerState === "NOT_STARTED" ? "Start" : "Continue"}
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
