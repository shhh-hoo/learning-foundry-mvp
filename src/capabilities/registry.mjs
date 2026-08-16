export const CAPABILITIES = [
  {
    id: "ratio-explorer",
    version: "1.0.0",
    title: "Ratio Explorer",
    purpose: "A visual interactive activity for understanding what ratios and proportional relationships mean by observing how two quantities change together.",
    tags: ["conceptual", "ratio"],
    availability: "AVAILABLE",
    runtime: { type: "web", launchUrl: "/component-assets/ratio-explorer/component.html", protocolVersion: "0.1" }
  },
  {
    id: "calculation-trainer",
    version: "1.0.0",
    title: "Calculation Trainer",
    purpose: "A numerical practice activity for independently solving proportional-reasoning calculation questions.",
    tags: ["procedural", "ratio"],
    availability: "AVAILABLE",
    runtime: { type: "web", launchUrl: "/component-assets/calculation-trainer/component.html", protocolVersion: "0.1" }
  }
];

export function listAvailableCapabilities() {
  return CAPABILITIES.filter((item) => item.availability === "AVAILABLE");
}

export function getCapability(id, version) {
  return CAPABILITIES.find((item) => item.id === id && (!version || item.version === version)) ?? null;
}
