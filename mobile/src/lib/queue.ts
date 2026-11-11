// Actions logged without a connection wait on the phone and are sent when the server is reachable.
// Only instant logs are queued; a photo log needs the network so the photo can be checked for reuse.
import { api, ApiError } from "./api";
import { getItem, setItem } from "./storage";

const KEY = "nidhi.queue";

export interface QueuedLog {
  code: string;
  title: string;
  queued_at: string;
}

export async function readQueue(): Promise<QueuedLog[]> {
  try {
    return JSON.parse((await getItem(KEY)) ?? "[]") as QueuedLog[];
  } catch {
    return [];
  }
}

export async function enqueue(code: string, title: string): Promise<void> {
  const q = await readQueue();
  q.push({ code, title, queued_at: new Date().toISOString() });
  await setItem(KEY, JSON.stringify(q));
}

let flushing = false;

/**
 * Send queued logs in order. A network error stops the pass and keeps the rest for next time;
 * a server refusal (daily limit reached meanwhile, action no longer applies) drops that entry,
 * because sending it again would be refused again. Returns how many were accepted.
 */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    const q = await readQueue();
    while (q.length) {
      try {
        await api.logAction(q[0].code);
        sent++;
      } catch (e) {
        if (e instanceof ApiError && e.status === 0) break;
      }
      q.shift();
      await setItem(KEY, JSON.stringify(q));
    }
  } finally {
    flushing = false;
  }
  return sent;
}
