import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

/** Create only from an empty slot. Moving/scrolling remains normal navigation. */
export function useAgendaLongPress() {
  const cleanup = useRef<() => void>(() => {});
  const handled = useRef(false);
  useEffect(() => () => cleanup.current(), []);
  return {
    handled,
    start(event: ReactPointerEvent<HTMLElement>, onHold: () => void) {
      cleanup.current();
      if (!event.isPrimary || event.button !== 0 ||
          (event.target as Element).closest("button,a,input,textarea,select,[role=button],[draggable=true]")) return;
      handled.current = false;
      const { pointerId, clientX, clientY } = event;
      const stop = () => {
        clearTimeout(timer);
        document.removeEventListener("pointermove", move, true);
        document.removeEventListener("pointerup", stop, true);
        document.removeEventListener("pointercancel", stop, true);
        document.removeEventListener("pointerdown", stop, true);
        document.removeEventListener("scroll", stop, true);
        window.removeEventListener("blur", stop);
      };
      const move = (next: PointerEvent) => {
        if (next.pointerId !== pointerId || Math.hypot(next.clientX - clientX, next.clientY - clientY) > 10) stop();
      };
      const timer = setTimeout(() => {
        stop();
        handled.current = true;
        onHold();
      }, 550);
      document.addEventListener("pointermove", move, true);
      document.addEventListener("pointerup", stop, true);
      document.addEventListener("pointercancel", stop, true);
      document.addEventListener("pointerdown", stop, true);
      document.addEventListener("scroll", stop, true);
      window.addEventListener("blur", stop);
      cleanup.current = stop;
    },
  };
}

export function pressedSlotMinute(event: ReactPointerEvent<HTMLElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const fraction = bounds.height > 0 ? (event.clientY - bounds.top) / bounds.height : 0;
  return Math.max(0, Math.min(3, Math.floor(fraction * 4))) * 15;
}
