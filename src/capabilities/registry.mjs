export const CAPABILITIES = [
  {
    id: "ratio-explorer",
    version: "1.0.0",
    title: "Ratio Explorer",
    purpose: "Interactive conceptual proportional-reasoning task.",
    tags: ["conceptual", "ratio"],
    availability: "AVAILABLE",
    runtime: { type: "web", launchUrl: "/component-assets/ratio-explorer/index.html", protocolVersion: "0.1" }
  },
  {
    id: "calculation-trainer",
    version: "1.0.0",
    title: "Calculation Trainer",
    purpose: "Interactive numerical proportional-reasoning practice.",
    tags: ["procedural", "ratio"],
    availability: "AVAILABLE",
    runtime: { type: "web", launchUrl: "/component-assets/calculation-trainer/index.html", protocolVersion: "0.1" }
  }
];

export function listAvailableCapabilities() {
  return CAPABILITIES.filter((item) => item.availability === "AVAILABLE");
}

export function getCapability(id, version) {
  return CAPABILITIES.find((item) => item.id === id && (!version || item.version === version)) ?? null;
}
