import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, CircleHelp, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { loadState, loadStudent, sendLearnerTurn, startRuntime } from "./api.js";
import { ActivityOffer } from "./components/ActivityOffer.jsx";
import { FoundryChatProvider } from "./components/FoundryChatProvider.jsx";
import { FoundryThread } from "./components/FoundryThread.jsx";
import { Badge } from "./components/ui/badge.jsx";
import { Button } from "./components/ui/button.jsx";
import { Card, CardContent } from "./components/ui/card.jsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./components/ui/sheet.jsx";
import { RuntimeFrame } from "./RuntimeFrame.jsx";

function latest(items, field) {
  return [...items].sort((a, b) => String(b[field] ?? "").localeCompare(String(a[field] ?? "")))[0] ?? null;
}

function friendlyState(state) {
  return {
    NOT_STARTED: "Ready",
    GUIDANCE: "Talking it through",
    ACTIVITY_READY: "Activity ready",
    ACTIVITY_ACTIVE: "In activity",
    WAITING_FOR_TEACHER: "Waiting for teacher",
    NO_MATCH: "Choosing a next step",
    RUNTIME_FAILURE: "Activity interrupted"
  }[state] ?? "In progress";
}

export function LearnerWorkspace({ studentId, taskId }) {
  const queryClient = useQueryClient();
  const openingTaskRef = useRef(null);

  const studentQuery = useQuery({
    queryKey: ["student", studentId],
    queryFn: () => loadStudent(studentId)
  });
  const stateQuery = useQuery({
    queryKey: ["state"],
    queryFn: loadState
  });

  const view = studentQuery.data;
  const state = stateQuery.data;
  const task = view?.tasks?.find((item) => item.id === taskId) ?? view?.tasks?.at(-1) ?? null;
  const conversation = useMemo(
    () => (view?.conversationEvents ?? []).filter((event) => event.taskId === task?.id),
    [view, task]
  );
  const decisions = useMemo(
    () => (view?.orchestrationDecisions ?? []).filter((decision) => decision.taskId === task?.id),
    [view, task]
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["student", studentId] }),
      queryClient.invalidateQueries({ queryKey: ["state"] })
    ]);
  };

  const openingMutation = useMutation({
    mutationFn: () => sendLearnerTurn({ studentId, taskId: task.id, trigger: "TASK_OPENED" }),
    onSuccess: refresh
  });

  useEffect(() => {
    if (!task || openingMutation.isPending) return;
    const opened = decisions.some((decision) => decision.trigger === "TASK_OPENED");
    if (opened || openingTaskRef.current === task.id) return;
    openingTaskRef.current = task.id;
    openingMutation.mutate();
  }, [task, decisions, openingMutation]);

  const currentSession = task?.currentRuntimeSessionId
    ? (view?.sessions ?? []).find((session) => session.id === task.currentRuntimeSessionId) ?? null
    : null;
  const readyActivity = currentSession?.status === "READY";
  const activeActivity = currentSession && ["LOADING", "RUNNING"].includes(currentSession.status);
  const capability = currentSession
    ? state?.capabilities?.find((item) => item.id === currentSession.capabilityId && item.version === currentSession.capabilityVersion) ?? null
    : null;

  const taskAttempts = (view?.attempts ?? []).filter((attempt) => attempt.taskId === task?.id);
  const latestAttempt = latest(taskAttempts, "submittedAt");
  const lastCompletedSession = latest(
    (view?.sessions ?? []).filter((session) => session.taskId === task?.id && session.status === "COMPLETED"),
    "completedAt"
  );
  const currentDecision = decisions.find((item) => item.id === task?.currentDecisionId) ?? decisions.at(-1) ?? null;
  const selectionReason = currentDecision?.committedAction?.rationale || currentDecision?.proposal?.actionProposal?.reason || "";
  const isTransition = Boolean(lastCompletedSession && currentDecision?.trigger === "COMPONENT_COMPLETED");

  const startMutation = useMutation({
    mutationFn: () => startRuntime({ taskId: task.id, runtimeSessionId: currentSession.id }),
    onSuccess: refresh
  });

  if (studentQuery.isPending || stateQuery.isPending) {
    return <div className="mx-auto max-w-5xl px-6 py-16 text-sm text-slate-500">Opening your task…</div>;
  }

  const loadError = studentQuery.error || stateQuery.error;
  if (loadError) return <div className="mx-auto max-w-5xl px-6 py-16 text-sm text-red-600">{loadError.message}</div>;
  if (!task) return <div className="mx-auto max-w-5xl px-6 py-16 text-sm text-slate-500">This task is no longer available.</div>;

  const chat = (
    <FoundryChatProvider studentId={studentId} taskId={task.id} conversationEvents={conversation}>
      <FoundryThread compact={Boolean(activeActivity)} placeholder={activeActivity ? "Ask for help with this activity…" : "Tell Foundry what you're thinking…"} />
    </FoundryChatProvider>
  );

  if (activeActivity && capability) {
    return (
      <div className="min-h-[calc(100vh-41px)] bg-white">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Button asChild variant="ghost" size="icon-sm" className="shrink-0 rounded-full">
                <a href={`#student/${studentId}`} aria-label="Back to my learning"><ArrowLeft className="size-4" /></a>
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{capability.title}</p>
                <p className="truncate text-xs text-slate-500">{task.goal}</p>
              </div>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline"><CircleHelp className="size-4" />Ask Foundry</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Ask Foundry</SheetTitle>
                  <SheetDescription>The activity stays open while you ask for help.</SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 p-4">{chat}</div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <main className="mx-auto flex max-w-7xl flex-col px-4 py-5 sm:px-6">
          {selectionReason && <p className="mb-4 max-w-3xl text-sm leading-6 text-slate-500">{selectionReason}</p>}
          <div className="min-h-[68vh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
            <RuntimeFrame session={currentSession} capability={capability} onTerminal={refresh} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Button asChild variant="ghost" className="-ml-3 text-slate-500">
          <a href={`#student/${studentId}`}><ArrowLeft className="size-4" />My learning</a>
        </Button>
        <Badge variant="outline">{friendlyState(task.learnerState)}</Badge>
      </div>

      <header className="mb-8 max-w-3xl">
        <p className="text-sm font-medium text-violet-600">Current task</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{task.goal}</h1>
        {task.teacherInstruction && <p className="mt-3 text-base leading-7 text-slate-500">{task.teacherInstruction}</p>}
      </header>

      {isTransition && (
        <Card className="mb-5 border-emerald-200 bg-emerald-50/60 shadow-none">
          <CardContent className="flex gap-3 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-950">Your work is saved.</p>
              <p className="mt-1 text-sm leading-6 text-emerald-800/80">
                {latestAttempt?.correct === true
                  ? "That activity is complete. Foundry is using what happened there to guide the next step."
                  : "That activity is complete. We can use what happened there to decide what will help next."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {task.learnerState === "WAITING_FOR_TEACHER" && (
        <Card className="mb-5 border-amber-200 bg-amber-50/60 shadow-none">
          <CardContent className="p-4 text-sm leading-6 text-amber-900">Your work is saved. Your teacher needs to review this part before the next activity changes. You can still ask Foundry questions.</CardContent>
        </Card>
      )}
      {task.learnerState === "NO_MATCH" && (
        <Card className="mb-5 border-slate-200 shadow-none"><CardContent className="p-4 text-sm leading-6 text-slate-600">There isn't a suitable activity ready for this step yet. Keep talking with Foundry while the next step is worked out.</CardContent></Card>
      )}
      {task.learnerState === "RUNTIME_FAILURE" && (
        <Card className="mb-5 border-red-200 bg-red-50/60 shadow-none"><CardContent className="p-4 text-sm leading-6 text-red-800">The activity was interrupted. Your saved work is still here.</CardContent></Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-xl bg-violet-100 text-violet-700"><Sparkles className="size-4" /></div>
              <div>
                <p className="text-sm font-semibold">Foundry</p>
                <p className="text-xs text-slate-400">Talk through what you know, what is confusing, or what you want to try.</p>
              </div>
            </div>
            {chat}
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-4">
          {readyActivity && capability ? (
            <ActivityOffer
              capability={capability}
              reason={selectionReason}
              starting={startMutation.isPending}
              onStart={() => startMutation.mutate()}
            />
          ) : (
            <Card className="shadow-none">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-slate-900">What happens next?</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">Keep the conversation going. If an interactive activity would help, it will appear here for you to start.</p>
              </CardContent>
            </Card>
          )}

          {latestAttempt && (
            <Card className="shadow-none">
              <CardContent className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Latest work</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{latestAttempt.correct === true ? "Completed successfully" : latestAttempt.correct === false ? "Worth another look" : "Saved"}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Your answer is saved and can inform what happens next.</p>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
