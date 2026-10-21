import { useEffect, useRef } from "react";
import { formatAppointmentDateTime } from "../../../shared/appointmentTime";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { snapDragMinutes, dragDate } from "../../../shared/visualDrag";
export function monthTarget(x: number, y: number, date: string) {
  const el = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-agenda-month-day]");
  if (!el) return null;
  const day = el.dataset.agendaMonthDay!;
  return {
    day,
    date: day + date.slice(10),
    hour: Number(date.slice(11, 13)),
    minute: Number(date.slice(14, 16)),
  };
}
export function appointmentTarget(
  x: number,
  y: number,
  duration: number,
  offset = 0
) {
  const el = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-agenda-day]");
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const minutes = snapDragMinutes(
    ((y - rect.top) / Number(el.dataset.slotHeight)) * 60 - offset,
    duration
  );
  return {
    date: dragDate(el.dataset.agendaDay!, minutes),
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
    day: el.dataset.agendaDay!,
  };
}
export function useLongPressDrag<T>(
  resolve: (x: number, y: number, value: T, offset: number) => any,
  onBegin: (value: T) => void,
  onPreview: (target: any) => void,
  onDrop: (value: T, target: any) => void,
  onCancel: () => void = () => {}
) {
  const cleanup = useRef<() => void>(() => {}),
    active = useRef(false),
    latest = useRef({ resolve, onBegin, onPreview, onDrop, onCancel });
  latest.current = { resolve, onBegin, onPreview, onDrop, onCancel };
  useEffect(() => () => cleanup.current(), []);
  return {
    active,
    start: (event: React.TouchEvent, value: T) => {
      if (event.touches.length !== 1) return;
      cleanup.current();
      const touch = event.touches[0],
        sx = touch.clientX,
        sy = touch.clientY;
      let target: any = null;
      const bounds = event.currentTarget.getBoundingClientRect();
      const parent = (event.currentTarget as HTMLElement).closest<HTMLElement>(
        "[data-agenda-day]"
      );
      const offset = parent
        ? Math.max(
            0,
            ((sy - bounds.top) / Number(parent.dataset.slotHeight)) * 60
          )
        : 0;
      const timer = setTimeout(() => {
        active.current = true;
        latest.current.onBegin(value);
        target = latest.current.resolve(sx, sy, value, offset);
        latest.current.onPreview(target);
      }, 450);
      const stop = () => {
        clearTimeout(timer);
        document.removeEventListener("touchmove", move, true);
        document.removeEventListener("touchend", end, true);
        document.removeEventListener("touchcancel", cancel, true);
        active.current = false;
      };
      const move = (e: TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        if (!active.current) {
          if (Math.hypot(t.clientX - sx, t.clientY - sy) > 10) stop();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        target = latest.current.resolve(t.clientX, t.clientY, value, offset);
        latest.current.onPreview(target);
      };
      const end = (e: TouchEvent) => {
        if (active.current) {
          e.preventDefault();
          e.stopPropagation();
          if (target) latest.current.onDrop(value, target);
          else latest.current.onCancel();
          latest.current.onPreview(null);
        }
        stop();
      };
      const cancel = () => {
        latest.current.onCancel();
        latest.current.onPreview(null);
        stop();
      };
      document.addEventListener("touchmove", move, {
        passive: false,
        capture: true,
      });
      document.addEventListener("touchend", end, {
        passive: false,
        capture: true,
      });
      document.addEventListener("touchcancel", cancel, { capture: true });
      cleanup.current = stop;
    },
  };
}
export function MoveConfirmation({
  pending,
  onClose,
  onSaved,
}: {
  pending: { apt: any; date: string; requestId: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const move = trpc.agendaMoves.move.useMutation({
    onSuccess: r => {
      toast.success("Agendamento reagendado.");
      r.warnings.forEach(w => toast.info(w));
      onSaved();
      onClose();
    },
    onError: e => toast.error(e.message),
  });
  return (
    <Dialog
      open={!!pending}
      onOpenChange={open => {
        if (!open && !move.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar novo horário</DialogTitle>
        </DialogHeader>
        {pending && (
          <>
            <p className="break-words">
              {pending.apt.clientName || pending.apt.service}
            </p>
            <p>De {formatAppointmentDateTime(pending.apt.date)}</p>
            <p>Para {formatAppointmentDateTime(pending.date)}</p>
            <p>Duração preservada: {pending.apt.duration} minutos.</p>
            <p>O cliente será avisado pelo WhatsApp sobre a alteração.</p>
            <p className="text-sm">
              O envio também depende de conexão ativa e consentimento do
              cliente.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={move.isPending}
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                disabled={move.isPending}
                onClick={() =>
                  move.mutate({
                    id: pending.apt.id,
                    expectedDate: pending.apt.date,
                    date: pending.date,
                    notify: true,
                    requestId: pending.requestId,
                  })
                }
              >
                Confirmar reagendamento
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function DragIndicator({ date }: { date: string | null }) {
  return date ? (
    <div
      role="status"
      className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] pointer-events-none rounded-lg border bg-background text-foreground px-4 py-2 shadow-xl font-semibold"
    >
      {date.slice(0, 10).split("-").reverse().join("/")} · {date.slice(11, 16)}
    </div>
  ) : null;
}
