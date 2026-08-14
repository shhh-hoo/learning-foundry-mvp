import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpenCheck, MessageCircle, Settings2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { api, loadState } from "./api.js";
import { Badge } from "./components/ui/badge.jsx";
import { Button } from "./components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card.jsx";

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : "";
}

function statusCopy(state) {
  return {
    NOT_STARTED: "Not started",
    GUIDANCE: "Talking with Foundry",
    ACTIVITY_READY: "Activity suggested",
    ACTIVITY_ACTIVE: "Working on an activity",
    WAITING_FOR_TEACHER: "Needs teacher review",
    NO_MATCH: "Needs a next step",
    RUNTIME_FAILURE: "Activity interrupted"
  }[state] ?? "In progress";
}

export function TeacherWorkspace({ selectedStudentId = "alice" }) {
  const queryClient = useQueryClient();
  const { data: state, isPending, error } = useQuery({ queryKey: ["state"], queryFn: loadState });
  const [goal, setGoal] = useState("Build confidence with proportional reasoning");
  const [instruction, setInstruction] = useState("Focus on what the relationship means before using a calculation shortcut.");
  const [selectedStudents, setSelectedStudents] = useState(new Set(["alice", "bob", "charlie"]));

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["state"] });
  const assignMutation = useMutation({
    mutationFn: () => api("/api/assignments", {
      method: "POST",
      body: JSON.stringify({ goal, teacherInstruction: instruction, studentIds: [...selectedStudents] })
    }),
    onSuccess: refresh
  });
  const decisionMutation = useMutation({
    mutationFn: ({ taskId, action, capabilityId = null }) => api("/api/teacher-decisions", {
      method: "POST",
      body: JSON.stringify({ taskId, action, capabilityId })
    }),
    onSuccess: refresh
  });

  const selected = state?.students?.find((student) => student.id === selectedStudentId) ?? state?.students?.[0] ?? null;
  const tasks = useMemo(() => (state?.tasks ?? []).filter((task) => task.studentId === selected?.id), [state, selected]);
  const task = tasks.at(-1) ?? null;
  const conversation = (state?.conversationEvents ?? []).filter((event) => event.taskId === task?.id);
  const attempts = (state?.attempts ?? []).filter((attempt) => attempt.taskId === task?.id);
  const decisions = (state?.orchestrationDecisions ?? []).filter((decision) => decision.taskId === task?.id);
  const teacherDecisions = (state?.teacherDecisions ?? []).filter((decision) => decision.taskId === task?.id);
  const currentDecision = decisions.find((decision) => decision.id === task?.currentDecisionId) ?? decisions.at(-1) ?? null;
  const currentSession = task?.currentRuntimeSessionId
    ? (state?.runtimeSessions ?? []).find((session) => session.id === task.currentRuntimeSessionId) ?? null
    : null;
  const capability = currentSession
    ? state?.capabilities?.find((item) => item.id === currentSession.capabilityId && item.version === currentSession.capabilityVersion) ?? null
    : null;
  const latestAttempt = attempts.at(-1) ?? null;
  const latestAssistant = [...conversation].reverse().find((event) => event.role === "ASSISTANT") ?? null;
  const reason = currentDecision?.committedAction?.rationale || currentDecision?.proposal?.actionProposal?.reason || "";

  if (isPending) return <div className="mx-auto max-w-7xl px-6 py-16 text-sm text-slate-500">Loading teacher workspace…</div>;
  if (error) return <div className="mx-auto max-w-7xl px-6 py-16 text-sm text-red-600">{error.message}</div>;

  const busy = assignMutation.isPending || decisionMutation.isPending;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8 lg:py-10">
      <aside className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <div className="mb-2 grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-700"><BookOpenCheck className="size-4" /></div>
            <CardTitle>Assign a learning goal</CardTitle>
            <CardDescription>One goal can become different learning paths for different students.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                assignMutation.mutate();
              }}
            >
              <label className="block text-sm font-medium text-slate-700">
                Goal
                <textarea className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal leading-6 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" value={goal} onChange={(event) => setGoal(event.target.value)} required />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Guidance for students
                <textarea className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal leading-6 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" value={instruction} onChange={(event) => setInstruction(event.target.value)} />
              </label>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Students</p>
                <div className="space-y-2">
                  {state.students.map((student) => (
                    <label key={student.id} className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-slate-300"
                        checked={selectedStudents.has(student.id)}
                        onChange={(event) => {
                          const next = new Set(selectedStudents);
                          if (event.target.checked) next.add(student.id);
                          else next.delete(student.id);
                          setSelectedStudents(next);
                        }}
                      />
                      {student.name}
                    </label>
                  ))}
                </div>
              </div>
              <Button className="w-full" disabled={busy || selectedStudents.size === 0}>Assign task</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2"><Users className="size-4 text-slate-400" /><CardTitle>Students</CardTitle></div>
          </CardHeader>
          <CardContent className="space-y-1">
            {state.students.map((student) => {
              const latestTask = state.tasks.filter((item) => item.studentId === student.id).at(-1);
              return (
                <a key={student.id} href={`#teacher/${student.id}`} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${student.id === selected?.id ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
                  <span className="font-medium">{student.name}</span>
                  <span className={student.id === selected?.id ? "text-slate-300" : "text-slate-400"}>{latestTask ? statusCopy(latestTask.learnerState) : "No task"}</span>
                </a>
              );
            })}
          </CardContent>
        </Card>
      </aside>

      <main className="min-w-0 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-violet-600">Student view</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{selected?.name}</h1>
          </div>
          <Button asChild variant="outline"><a href={`#student/${selected?.id ?? "alice"}`}>Open learner view <ArrowRight className="size-4" /></a></Button>
        </div>

        {!task ? (
          <Card className="border-dashed shadow-none"><CardContent className="py-16 text-center text-sm text-slate-500">Assign a task to {selected?.name} to start the learner journey.</CardContent></Card>
        ) : (
          <>
            <Card>
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-2xl">
                    <div className="mb-2 flex items-center gap-2"><Badge variant={task.learnerState === "WAITING_FOR_TEACHER" ? "warning" : "secondary"}>{statusCopy(task.learnerState)}</Badge></div>
                    <h2 className="text-xl font-semibold tracking-tight">{task.goal}</h2>
                    {task.teacherInstruction && <p className="mt-2 text-sm leading-6 text-slate-500">{task.teacherInstruction}</p>}
                  </div>
                  {capability && <div className="rounded-xl bg-slate-50 px-3 py-2 text-right"><p className="text-xs text-slate-400">Current activity</p><p className="mt-0.5 text-sm font-medium text-slate-800">{capability.title}</p></div>}
                </div>

                {(reason || latestAssistant) && (
                  <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Why this step</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{reason || "Foundry is keeping the learner in guidance for now."}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Latest guidance</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{latestAssistant?.content ?? "No guidance yet."}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="shadow-none">
                <CardHeader><div className="flex items-center gap-2"><MessageCircle className="size-4 text-slate-400" /><CardTitle>Conversation</CardTitle></div><CardDescription>What the student and Foundry have said in this task.</CardDescription></CardHeader>
                <CardContent>
                  {conversation.length ? (
                    <div className="max-h-[360px] space-y-3 overflow-y-auto pr-2">
                      {conversation.map((event) => (
                        <div key={event.id} className={event.role === "LEARNER" ? "ml-8 rounded-xl bg-slate-100 p-3" : "mr-8 p-3"}>
                          <p className="mb-1 text-xs font-semibold text-slate-400">{event.role === "LEARNER" ? selected.name : "Foundry"}</p>
                          <p className="text-sm leading-6 text-slate-700">{event.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">The student has not opened this task yet.</p>}
                </CardContent>
              </Card>

              <Card className="shadow-none">
                <CardHeader><CardTitle>Recent work</CardTitle><CardDescription>Saved attempts from interactive activities.</CardDescription></CardHeader>
                <CardContent>
                  {attempts.length ? (
                    <div className="space-y-3">
                      {[...attempts].reverse().map((attempt) => (
                        <div key={attempt.id} className="rounded-xl border border-slate-100 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-800">{state.capabilities.find((item) => item.id === attempt.capabilityId)?.title ?? attempt.capabilityId}</p>
                            <Badge variant={attempt.correct === true ? "success" : attempt.correct === false ? "warning" : "outline"}>{attempt.correct === true ? "Successful" : attempt.correct === false ? "Needs another look" : "Saved"}</Badge>
                          </div>
                          <p className="mt-2 text-xs text-slate-400">{formatTime(attempt.submittedAt)}</p>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">No interactive work has been submitted yet.</p>}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-none">
              <CardHeader><div className="flex items-center gap-2"><Settings2 className="size-4 text-slate-400" /><CardTitle>Change what can happen next</CardTitle></div><CardDescription>Use these controls when you want to steer the next safe step. An activity already in progress is not interrupted.</CardDescription></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => decisionMutation.mutate({ taskId: task.id, action: "CLEAR_CONSTRAINTS" })}>Clear preferences</Button>
                  {state.capabilities.map((item) => (
                    <div key={item.id} className="flex items-center rounded-xl border border-slate-200 bg-white p-1">
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => decisionMutation.mutate({ taskId: task.id, action: "REQUIRE_CAPABILITY", capabilityId: item.id })}>Use {item.title}</Button>
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-600" disabled={busy} onClick={() => decisionMutation.mutate({ taskId: task.id, action: "EXCLUDE_CAPABILITY", capabilityId: item.id })}>Exclude</Button>
                    </div>
                  ))}
                </div>
                {teacherDecisions.length > 0 && <p className="mt-4 text-xs text-slate-400">Last changed {formatTime(teacherDecisions.at(-1).createdAt)}</p>}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
