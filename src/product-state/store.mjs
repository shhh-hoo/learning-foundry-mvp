import { mkdir, readFile, rename, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = process.cwd();
const SEED_PATH = resolve(ROOT, "data/seed.json");
const STATE_PATH = resolve(ROOT, "data/state.json");

function normalizeState(state) {
  state.conversationEvents ??= [];
  state.orchestrationDecisions ??= [];
  state.runtimeSessions ??= [];
  state.attempts ??= [];
  state.learningEvents ??= [];
  state.teacherDecisions ??= [];
  return state;
}

async function ensureStateFile() {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  if (!existsSync(STATE_PATH)) await copyFile(SEED_PATH, STATE_PATH);
}

export async function readState() {
  await ensureStateFile();
  return normalizeState(JSON.parse(await readFile(STATE_PATH, "utf8")));
}

export async function writeState(state) {
  await ensureStateFile();
  const tempPath = `${STATE_PATH}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(normalizeState(state), null, 2)}\n`, "utf8");
  await rename(tempPath, STATE_PATH);
  return state;
}

let mutationQueue = Promise.resolve();

export async function mutateState(mutator) {
  const job = mutationQueue.then(async () => {
    const state = await readState();
    const result = await mutator(state);
    await writeState(state);
    return result;
  });
  mutationQueue = job.catch(() => undefined);
  return job;
}

export async function resetState() {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  await copyFile(SEED_PATH, STATE_PATH);
  return readState();
}
