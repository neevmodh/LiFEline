"use client";

// Actions logged with no signal are kept on the phone and sent when it's back online.
// Only self-reported actions are queued: a photo proof needs a connection.
const KEY = "lifeline.pendingActions";

export interface QueuedAction {
  code: string;
  note?: string;
  queuedAt: string;
}

function read(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(items: QueuedAction[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable: nothing can be queued, so the caller shows the error instead.
  }
  window.dispatchEvent(new Event("lifeline:queue"));
}

export function queueAction(code: string, note?: string) {
  write([...read(), { code, note, queuedAt: new Date().toISOString() }]);
}

export function pendingCount(): number {
  return read().length;
}

/** Send queued actions; keeps any that still fail. Returns how many were sent. */
export async function flushQueue(send: (code: string, note?: string) => Promise<unknown>): Promise<number> {
  const items = read();
  if (!items.length) return 0;
  const left: QueuedAction[] = [];
  let sent = 0;
  for (const item of items) {
    try {
      await send(item.code, item.note);
      sent++;
    } catch (e) {
      // Network still down: keep it. Rejected by the server (daily cap, not applicable): drop it.
      if ((e as { status?: number }).status === 0) left.push(item);
    }
  }
  write(left);
  return sent;
}
