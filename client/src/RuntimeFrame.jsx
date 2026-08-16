import { useEffect, useRef } from "react";
import { api } from "./api.js";

function runtimeMessage(runtimeSessionId, type, payload = {}) {
  return {
    protocol: "foundry-component",
    protocolVersion: "0.1",
    messageId: crypto.randomUUID(),
    runtimeSessionId,
    type,
    timestamp: new Date().toISOString(),
    payload
  };
}

export function RuntimeFrame({ session, capability, onTerminal }) {
  const frameRef = useRef(null);
  const terminalRef = useRef(onTerminal);
  terminalRef.current = onTerminal;

  useEffect(() => {
    async function handleMessage(event) {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const message = event.data;
      if (!message || message.protocol !== "foundry-component" || message.protocolVersion !== "0.1") return;

      if (message.type === "COMPONENT_READY") {
        frame.contentWindow.postMessage(
          runtimeMessage(session.id, "FOUNDRY_INIT", {
            capability: { id: capability.id, version: capability.version },
            parameters: session.parameters,
            initialState: session.stateSnapshot
          }),
          "*"
        );
        return;
      }

      if (message.runtimeSessionId !== session.id) return;
      const result = await api("/api/runtime-messages", {
        method: "POST",
        body: JSON.stringify({ message })
      });

      if (["COMPONENT_COMPLETED", "COMPONENT_ERROR"].includes(message.type)) {
        terminalRef.current?.(result);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [session.id, session.parameters, session.stateSnapshot, capability.id, capability.version]);

  return (
    <iframe
      ref={frameRef}
      id="asset-frame"
      className="asset-frame"
      sandbox="allow-scripts"
      title={capability.title}
      src={capability.runtime.launchUrl}
    />
  );
}
