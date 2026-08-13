export const PROTOCOL = "foundry-component";
export const PROTOCOL_VERSION = "0.1";

export const FOUNDRY_TO_COMPONENT = new Set([
  "FOUNDRY_INIT",
  "FOUNDRY_PAUSE",
  "FOUNDRY_RESUME",
  "FOUNDRY_RESET",
  "FOUNDRY_RESTORE"
]);

export const COMPONENT_TO_FOUNDRY = new Set([
  "COMPONENT_READY",
  "COMPONENT_INITIALIZED",
  "LEARNING_EVENT",
  "ATTEMPT_SUBMITTED",
  "STATE_CHANGED",
  "COMPONENT_COMPLETED",
  "COMPONENT_ERROR"
]);

export function makeMessage({ runtimeSessionId, type, payload = {} }) {
  return {
    protocol: PROTOCOL,
    protocolVersion: PROTOCOL_VERSION,
    messageId: crypto.randomUUID(),
    runtimeSessionId,
    type,
    timestamp: new Date().toISOString(),
    payload
  };
}

export function isFoundryMessage(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    value.protocol === PROTOCOL &&
    value.protocolVersion === PROTOCOL_VERSION &&
    typeof value.messageId === "string" &&
    typeof value.runtimeSessionId === "string" &&
    typeof value.type === "string" &&
    typeof value.timestamp === "string" &&
    value.payload && typeof value.payload === "object"
  );
}

export function isComponentMessage(value) {
  return isFoundryMessage(value) && COMPONENT_TO_FOUNDRY.has(value.type);
}
