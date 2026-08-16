import { useEffect, useState } from "react";
import { LearnerHome } from "./LearnerHome.jsx";
import { LearnerWorkspace } from "./LearnerWorkspace.jsx";
import { TeacherWorkspace } from "./TeacherWorkspace.jsx";

function parseRoute() {
  const [surface = "teacher", studentId = "alice", taskId = null] = window.location.hash.replace(/^#/, "").split("/");
  return { surface, studentId, taskId };
}

function useHashRoute() {
  const [route, setRoute] = useState(parseRoute);
  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return route;
}

function DemoSwitcher({ route }) {
  return (
    <div className="border-b border-slate-200 bg-white/90 px-4 py-2 text-xs text-slate-500 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <a href="#teacher/alice" className="font-semibold text-slate-900">Learning Foundry</a>
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          <span className="px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">Demo</span>
          <a className={`rounded-full px-2.5 py-1 ${route.surface === "teacher" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"}`} href="#teacher/alice">Teacher</a>
          {["alice", "bob", "charlie"].map((id) => (
            <a key={id} className={`rounded-full px-2.5 py-1 capitalize ${(route.surface === "student" || route.surface === "learn") && route.studentId === id ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"}`} href={`#student/${id}`}>{id}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const route = useHashRoute();

  let surface;
  if (route.surface === "student") {
    surface = <LearnerHome studentId={route.studentId} />;
  } else if (route.surface === "learn") {
    surface = <LearnerWorkspace studentId={route.studentId} taskId={route.taskId} />;
  } else {
    surface = <TeacherWorkspace selectedStudentId={route.studentId || "alice"} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <DemoSwitcher route={route} />
      {surface}
    </div>
  );
}
