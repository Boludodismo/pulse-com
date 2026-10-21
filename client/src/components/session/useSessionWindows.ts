import { useCallback, useState } from "react";

export type SessionWindow = "preparation" | "materials" | "ink" | "recipe" | "sample" | "notes" | "finish" | "layerAdd" | "appearance";

// These editors share the existing material/sample draft. Preserve their
// original one-at-a-time workflow; independent tools can stay open together.
const editors: SessionWindow[] = ["ink", "recipe", "sample"];
export function openSessionWindow(windows: SessionWindow[], id: SessionWindow): SessionWindow[] {
  return [...windows.filter(key => key !== id && !(editors.includes(id) && editors.includes(key))), id];
}

export function useSessionWindows() {
  const [windows, setWindows] = useState<SessionWindow[]>([]);
  const [requests, setRequests] = useState<Partial<Record<SessionWindow, number>>>({});
  const open = useCallback((id: SessionWindow) => {
    setWindows(current => openSessionWindow(current, id));
    setRequests(current => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  }, []);
  const close = useCallback((id: SessionWindow) => setWindows(current => current.filter(key => key !== id)), []);
  const closeAll = useCallback(() => setWindows([]), []);
  const focus = useCallback((id: SessionWindow) => setWindows(current => current.includes(id) && current.at(-1) !== id ? [...current.filter(key => key !== id), id] : current), []);
  return { windows, requests, open, close, closeAll, focus, active: windows.at(-1) ?? null };
}
