import { useEffect, useState } from "react";
import { LearnerWorkspace } from "./LearnerWorkspace.jsx";
import { TeacherWorkspace } from "./TeacherWorkspace.jsx";

function parseRoute() {
  const [surface = "teacher", id] = window.location.hash.replace(/^#/, "").split("/");
  return { surface, id };
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

export default function App() {
  const route = useHashRoute();
  const studentId = route.id || "alice";

  return (
    <div className="app-shell">
      <header className="global-nav">
        <a className="brand" href="#teacher">Learning Foundry <span>MVP</span></a>
        <nav>
          <a className={route.surface !== "student" ? "active" : ""} href="#teacher">Teacher</a>
          <a className={route.surface === "student" && studentId === "alice" ? "active" : ""} href="#student/alice">Alice</a>
          <a className={route.surface === "student" && studentId === "bob" ? "active" : ""} href="#student/bob">Bob</a>
          <a className={route.surface === "student" && studentId === "charlie" ? "active" : ""} href="#student/charlie">Charlie</a>
        </nav>
      </header>

      <main className="app-content">
        {route.surface === "student"
          ? <LearnerWorkspace studentId={studentId} />
          : <TeacherWorkspace selectedStudentId={route.id || "alice"} />}
      </main>
    </div>
  );
}
