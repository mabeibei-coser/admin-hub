export const A100_PILOT = Object.freeze({
  logicalKey: "bananarouter.resume_text.primary",
  projectId: "A100",
  provider: "bananarouter",
  capability: "resume_text",
  role: "primary" as const,
  endpoint: "https://api.bananarouter.com",
  model: "gemini-3.1-flash-lite",
  protocol: "gemini-native",
});

export function isA100PilotLogicalKey(value: string): boolean {
  return value === A100_PILOT.logicalKey;
}

export function isA100PilotConfiguration(input: {
  logicalKey: string;
  provider: string;
  capability: string;
  endpoint: string;
  model: string;
  protocol: string;
}): boolean {
  return (
    input.logicalKey === A100_PILOT.logicalKey &&
    input.provider === A100_PILOT.provider &&
    input.capability === A100_PILOT.capability &&
    input.endpoint === A100_PILOT.endpoint &&
    input.model === A100_PILOT.model &&
    input.protocol === A100_PILOT.protocol
  );
}
