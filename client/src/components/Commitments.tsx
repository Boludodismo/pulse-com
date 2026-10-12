import { useLongPressDrag } from "./VisualMove";
import { CalendarConnections } from "./CalendarConnections";
import { ACCOUNT_TEMPLATES } from "../../../shared/commitmentTemplates";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { addDays, nationalHolidays } from "../../../shared/commitments";
const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const categories = {
  fixed: "Conta fixa",
  variable: "Conta variável",
  payroll: "Pagamento de colaborador",
  reminder: "Lembrete",
};
const download = (name: string, data: string, type: string) => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function Attachment({ id, name }: { id: number; name: string }) {
  const utils = trpc.useUtils();
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    if (!/\.(png|jpe?g)$/i.test(name)) return;
    utils.commitments.attachment.fetch({ id }).then(file => {
      if (mounted && file.mime.startsWith("image/"))
        setPreview(`data:${file.mime};base64,${file.data}`);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [id, name]);
  return (
    <div className="flex flex-col gap-1 max-w-36">
      {preview && <img src={preview} alt={`Prévia de ${name}`} className="w-24 h-20 rounded border object-cover" />}
    <Button
      variant="outline"
      className="h-auto whitespace-normal"
      onClick={async () => {
        try {
          const file = await utils.commitments.attachment.fetch({ id });
          const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
          const url = URL.createObjectURL(
            new Blob([bytes], { type: file.mime })
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
          toast.error("Não foi possível abrir o anexo.");
        }
      }}
    >
      {name}
    </Button>
    </div>
  );
}
function PendingImagePreview({ file }: { file: File }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return src ? <img src={src} alt={`Prévia de ${file.name}`} className="w-24 h-20 rounded border object-cover" /> : null;
}
export function CommitmentDetail({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils(),
    query = trpc.commitments.detail.useQuery({ id });
  const [date, setDate] = useState(day(new Date())),
    [time, setTime] = useState("16:00");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingAction, setPendingAction] = useState<"snooze" | "reschedule" | null>(null);
  const [saving, setSaving] = useState(false);
  const resetDraft = () => {
    setDate(day(new Date()));
    setTime("16:00");
    setPendingFiles([]);
    setPendingAction(null);
  };
  const refresh = () => {
    utils.commitments.list.invalidate();
    utils.commitments.detail.invalidate();
  };
  const action = trpc.commitments.action.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Compromisso atualizado.");
    },
    onError: e => toast.error(e.message),
  });
  const stop = trpc.commitments.stop.useMutation({
    onSuccess: () => {
      refresh();
      onClose();
      toast.success("Série encerrada.");
    },
    onError: e => toast.error(e.message),
  });
  const attach = trpc.commitments.attach.useMutation({
    onSuccess: () => utils.commitments.detail.invalidate(),
    onError: e => toast.error(e.message),
  });
  const o = query.data;
  const { user } = useAuth();
  const upload = async (files: File[]) => {
    for (const f of files) {
      if (f.size > 2 * 1024 * 1024) {
        toast.error(`${f.name}: limite de 2 MB.`);
        continue;
      }
      if (!["image/png", "image/jpeg", "application/pdf"].includes(f.type)) {
        toast.error("Use PNG, JPG ou PDF.");
        continue;
      }
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      await attach.mutateAsync({
        seriesId: o.seriesId,
        name: f.name,
        mime: f.type as any,
        data,
      });
    }
  };
  const saveDraft = async () => {
    if (!o || saving) return;
    setSaving(true);
    try {
      if (pendingAction) await action.mutateAsync({
        id, revision: o.revision, action: pendingAction, date, time,
      });
      if (pendingFiles.length) await upload(pendingFiles);
      resetDraft();
      await utils.commitments.detail.invalidate();
      toast.success("Alterações salvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto min-w-0">
        <DialogHeader>
          <DialogTitle className="break-words">
            {o?.title || "Compromisso"}
          </DialogTitle>
        </DialogHeader>
        {query.error ? (
          <p role="alert">Compromisso indisponível para esta conta.</p>
        ) : o ? (
          <div className="space-y-4 [overflow-wrap:anywhere]">
            <p>
              {categories[o.category as keyof typeof categories]} ·{" "}
              {o.calendarName}
            </p>
            <p>
              Data: {o.effectiveDate.split("-").reverse().join("/")} ·{" "}
              {o.status === "paid"
                ? o.category === "reminder"
                  ? "Concluído"
                  : "Pago"
                : "Pendente"}
            </p>
            {o.snoozeUntil && (
              <p className="text-sm">Próximo aviso: {o.snoozeUntil}</p>
            )}
            {o.originalDate !== o.effectiveDate && (
              <p className="text-sm">
                Data original: {o.originalDate.split("-").reverse().join("/")}
              </p>
            )}
            {o.amount != null && (
              <p>
                {(o.amount / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </p>
            )}
            <p className="whitespace-pre-wrap">{o.notes}</p>
            {o.status === "pending" && (
              <>
                <Button
                  className="w-full h-auto whitespace-normal"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate({ id, revision: o.revision, action: "paid" })
                  }
                >
                  {o.category === "reminder"
                    ? "Marcar como concluído"
                    : "Marcar como pago"}
                </Button>
                <p className="text-sm">
                  A confirmação encerra os avisos desta ocorrência. Não registra
                  uma transação bancária.
                </p>
                <label className="block">
                  Nova data
                  <Input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </label>
                <label className="block">
                  Horário do próximo aviso
                  <Input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["snooze", "reschedule"] as const).map(a => (
                    <Button
                      key={a}
                      variant={pendingAction === a ? "default" : "outline"}
                      disabled={saving}
                      className="h-auto whitespace-normal"
                      onClick={() => setPendingAction(a)}
                    >
                      {a === "snooze"
                        ? "Lembrar mais tarde"
                        : "Reagendar ocorrência"}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Os avisos anteriores serão pausados. Será enviado um novo
                  aviso na data e horário escolhidos.
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {o.attachments.map((a: any) => (
                <Attachment key={a.id} {...a} />
              ))}
            </div>
            {user?.id === o.ownerId && (
              <>
                <label className="block">
                  Anexar boleto ou contrato (PNG, JPG ou PDF, até 2 MB; cinco
                  por série)
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    multiple
                    disabled={saving}
                    onChange={e => {
                      setPendingFiles(current => [...current, ...Array.from(e.target.files || [])]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-3" aria-label="Anexos pendentes">
                    {pendingFiles.map((file, index) => (
                      <div key={index} className="flex flex-col gap-1 max-w-32">
                        {file.type.startsWith("image/") ? <PendingImagePreview file={file} /> : <span className="text-xs border rounded p-2">{file.name} (PDF)</span>}
                        <span className="text-xs break-all">{file.name}</span>
                        <Button type="button" variant="outline" size="sm" onClick={() => setPendingFiles(current => current.filter((_, i) => i !== index))}>Remover</Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-sm">
                  Os anexos serão compartilhados pelas ocorrências desta série após salvar.
                </p>
                <Button
                  variant="outline"
                  className="h-auto whitespace-normal"
                  disabled={stop.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        "Encerrar a série e interromper todos os próximos avisos?"
                      )
                    )
                      stop.mutate({ seriesId: o.seriesId });
                  }}
                >
                  Encerrar recorrência
                </Button>
              </>
            )}
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button type="button" disabled={saving || (!pendingAction && pendingFiles.length === 0)} onClick={() => void saveDraft()}>{saving ? "Salvando…" : "Salvar"}</Button>
              <Button type="button" variant="outline" disabled={saving} onClick={resetDraft}>Desfazer alterações</Button>
              <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button>
            </div>
            {o.deliveries.length > 0 && (
              <div className="text-sm">
                <h3>Histórico de avisos</h3>
                {o.deliveries.map((d: any, i: number) => (
                  <p key={i}>
                    {d.createdAt} ·{" "}
                    {d.state === "sent"
                      ? "Enviado"
                      : d.state === "uncertain"
                        ? "Envio não confirmado"
                        : d.state === "cancelled"
                          ? "Cancelado"
                          : "Em processamento"}{" "}
                    {d.error || ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p>Carregando…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function CommitmentStrip({ days }: { days: Date[] }) {
  const { user } = useAuth();
  const from = day(days[0]),
    to = day(days[days.length - 1]);
  const query = trpc.commitments.list.useQuery(
    { from, to },
    { enabled: !!user && true }
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [dragged, setDragged] = useState<any>(null),
    [target, setTarget] = useState<string | null>(null),
    [pendingDay, setPendingDay] = useState<{ o: any; date: string } | null>(
      null
    );
  const utils = trpc.useUtils();
  const moveDay = trpc.commitments.moveDay.useMutation({
    onSuccess: () => {
      utils.commitments.list.invalidate();
      utils.commitments.detail.invalidate();
      setPendingDay(null);
      toast.success("Data do compromisso atualizada.");
    },
    onError: e => toast.error(e.message),
  });
  const dropDay = (o: any, date: string) => {
    if (o.status === "pending" && date !== o.effectiveDate)
      setPendingDay({ o, date });
    setDragged(null);
    setTarget(null);
  };
  const touch = useLongPressDrag<any>(
    (x, y) => {
      const el = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>("[data-commitment-day]");
      return el ? { date: el.dataset.commitmentDay } : null;
    },
    o => setDragged(o),
    t => setTarget(t?.date || null),
    (o, t) => dropDay(o, t.date),
    () => {
      setDragged(null);
      setTarget(null);
    }
  );

  return (
    <div className="shrink-0 border-b bg-background text-foreground">
      <div
        className="grid max-h-36 overflow-y-auto overscroll-contain"
        style={{
          gridTemplateColumns: `38px repeat(${days.length},minmax(0,1fr))`,
        }}
      >
        <div className="text-[10px] p-1">Dia inteiro</div>
        {days.map(d => (
          <div
            key={day(d)}
            data-commitment-day={day(d)}
            className="min-w-0 border-l p-0.5 space-y-1"
            onDragOver={e => {
              if (dragged) {
                e.preventDefault();
                e.stopPropagation();
                setTarget(day(d));
              }
            }}
            onDrop={e => {
              if (dragged) {
                e.preventDefault();
                e.stopPropagation();
                dropDay(dragged, day(d));
              }
            }}
          >
            {nationalHolidays(d.getFullYear())
              .filter(h => h.date === day(d))
              .map(h => (
                <p
                  key={h.date}
                  title={h.name}
                  className="rounded bg-muted p-1 text-xs whitespace-normal [overflow-wrap:anywhere]"
                >
                  {h.name}
                </p>
              ))}
            {query.data
              ?.filter(o => o.effectiveDate === day(d))
              .map(o => (
                <button
                  key={o.id}
                  title={o.title}
                  className="block w-full rounded text-left p-1 text-xs sm:text-sm whitespace-normal [overflow-wrap:anywhere] border-l-4 bg-muted"
                  style={{
                    borderColor: o.status === "paid" ? "#22c55e" : o.color,
                    backgroundColor: o.status === "paid" ? "rgba(34,197,94,0.12)" : undefined,
                  }}
                  draggable={o.status === "pending"}
                  onDragStart={e => {
                    setDragged(o);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", `commitment:${o.id}`);
                  }}
                  onDragEnd={() => {
                    setDragged(null);
                    setTarget(null);
                  }}
                  onTouchStart={e => {
                    if (o.status === "pending") touch.start(e, o);
                  }}
                  onClick={() => {
                    if (!dragged) setSelected(o.id);
                  }}
                >
                  {o.status === "paid" ? "✓ " : ""}
                  {o.title}
                  {o.status === "paid" ? " ✓" : o.category !== "reminder" && o.effectiveDate < day(new Date()) ? " ⚠" : ""}
                </button>
              ))}
          </div>
        ))}
      </div>
      {dragged && target && (
        <div
          role="status"
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] pointer-events-none rounded border bg-background p-3 text-sm"
        >
          {target.split("-").reverse().join("/")} · Dia inteiro
        </div>
      )}
      <Dialog
        open={!!pendingDay}
        onOpenChange={o => {
          if (!o && !moveDay.isPending) setPendingDay(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar nova data</DialogTitle>
          </DialogHeader>
          {pendingDay && (
            <>
              <p className="break-words">{pendingDay.o.title}</p>
              <p>
                De {pendingDay.o.effectiveDate} para {pendingDay.date}
              </p>
              <p className="text-sm">
                Esta ocorrência será movida. A série permanece na regra
                original.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={moveDay.isPending}
                  onClick={() => setPendingDay(null)}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={moveDay.isPending}
                  onClick={() =>
                    moveDay.mutate({
                      id: pendingDay.o.id,
                      revision: pendingDay.o.revision,
                      date: pendingDay.date,
                    })
                  }
                >
                  Confirmar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {query.error && (
        <p className="text-xs px-2" role="alert">
          Não foi possível carregar os compromissos.
        </p>
      )}
      {selected && (
        <CommitmentDetail id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
export function CommitmentsManager({
  date = new Date(),
  initialOpen = false,
}: {
  date?: Date;
  initialOpen?: boolean;
}) {
  const { user } = useAuth(),
    utils = trpc.useUtils();
  const [open, setOpen] = useState(initialOpen),
    [tab, setTab] = useState<"list" | "new" | "settings" | "integrations">(
      "list"
    ),
    [selected, setSelected] = useState<number | null>(null);
  const from = day(date),
    to = addDays(from, 31);
  const list = trpc.commitments.list.useQuery(
    { from, to },
    { enabled: open && !!user }
  );
  const prefs = trpc.commitments.preferences.useQuery(undefined, {
    enabled: open && !!user,
  });
  const savedCalendars = trpc.commitments.calendars.useQuery(undefined, {
    enabled: !!user && true,
  });
  useEffect(() => {
    if (savedCalendars.dataUpdatedAt) utils.calendars.list.invalidate();
  }, [savedCalendars.dataUpdatedAt]);
  const [calendarDraft, setCalendarDraft] = useState({
    name: "",
    color: "#FF9500",
  });
  const saveCalendar = trpc.commitments.saveCalendar.useMutation({
    onSuccess: () => {
      utils.commitments.calendars.invalidate();
      utils.calendars.list.invalidate();
      toast.success("Calendário salvo para sua conta.");
    },
    onError: e => toast.error(e.message),
  });
  const assignees = trpc.commitments.assignees.useQuery(undefined, {
    enabled: open && !!user,
  });
  const [settings, setSettings] = useState<any>(null),
    [holidayDate, setHolidayDate] = useState(from),
    [holidayName, setHolidayName] = useState(""),
    [annual, setAnnual] = useState(true);
  const [form, setForm] = useState<any>({
    title: "",
    category: "fixed",
    calendarId: 0,
    customTimes: false,
    beforeTime: "09:00",
    firstTime: "09:00",
    secondTime: "16:00",
    calendarName: "Compromissos",
    color: "#FF9500",
    amount: "",
    startDate: from,
    endDate: "",
    repeatKind: "monthly",
    repeatInterval: 1,
    shiftBusiness: true,
    notes: "",
    assigneeId: 0,
  });
  useEffect(() => {
    if (prefs.data)
      setSettings({ ...prefs.data, consent: !!prefs.data.consent });
  }, [prefs.data]);
  useEffect(() => {
    const id = Number(
      new URLSearchParams(window.location.search).get("occurrence")
    );
    if (initialOpen && id > 0) setSelected(id);
  }, [initialOpen]);
  const create = trpc.commitments.create.useMutation({
    onSuccess: async result => {
      await utils.commitments.list.invalidate();
      setTab("list");
      toast.success(
        "Compromisso cadastrado. Abra uma ocorrência para adicionar anexos."
      );
      setForm((f: any) => ({ ...f, title: "" }));
    },
    onError: e => toast.error(e.message),
  });
  const save = trpc.commitments.savePreferences.useMutation({
    onSuccess: () => {
      utils.commitments.preferences.invalidate();
      toast.success("Preferências salvas.");
    },
    onError: e => toast.error(e.message),
  });
  const exportCalendar = async (share = false) => {
    try {
      const exportTo = addDays(from, 365);
      const result = await utils.commitments.export.fetch({
        from,
        to: exportTo,
      });
      if (share) {
        const file = new File([result.ics], "compromissos-tatuei.ics", {
          type: "text/calendar",
        });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Compromissos Tatuei",
          });
          return;
        }
      }
      download(
        "compromissos-tatuei.ics",
        result.ics,
        "text/calendar;charset=utf-8"
      );
      toast.success(
        "Arquivo para importar no Apple Calendar ou Google Agenda."
      );
    } catch {
      toast.error("Falha na exportação.");
    }
  };
  if (!user) return null;
  const field = (name: string, label: string, type = "text") => (
    <label className="block">
      {label}
      <Input
        type={type}
        value={form[name]}
        onChange={e => setForm({ ...form, [name]: e.target.value })}
      />
    </label>
  );
  return (
    <>
      <Button
        variant="outline"
        className="h-auto min-h-9 whitespace-normal"
        onClick={() => setOpen(true)}
      >
        Contas e lembretes
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compromissos de dia inteiro</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {(["list", "new", "settings", "integrations"] as const).map(t => (
              <Button
                key={t}
                variant={tab === t ? "default" : "outline"}
                onClick={() => setTab(t)}
              >
                {t === "list"
                  ? "Compromissos"
                  : t === "new"
                    ? "Novo"
                    : t === "settings"
                      ? "WhatsApp e feriados"
                      : "Calendários externos"}
              </Button>
            ))}
          </div>
          {prefs.data && !prefs.data.whatsappReady && (
            <p role="status" className="rounded border p-2 text-sm">
              Os avisos por WhatsApp exigem uma conexão ativa autorizada.
              Nenhuma conexão de produção está disponível no momento.
            </p>
          )}
          {tab === "integrations" && (
            <CalendarConnections calendars={savedCalendars.data || []} />
          )}
          {tab === "list" && (
            <div className="space-y-3">
              <p>
                De {from.split("-").reverse().join("/")} até{" "}
                {to.split("-").reverse().join("/")}
              </p>
              {list.isLoading && <p>Carregando…</p>}
              {list.error && (
                <p role="alert">Não foi possível carregar os compromissos.</p>
              )}
              {list.data?.map(o => (
                <button
                  key={o.id}
                  className="w-full text-left rounded border p-3 [overflow-wrap:anywhere] border-l-4"
                  style={{ borderLeftColor: o.status === "paid" ? "#22c55e" : o.color, backgroundColor: o.status === "paid" ? "rgba(34,197,94,0.12)" : undefined }}
                  onClick={() => setSelected(o.id)}
                >
                  {o.effectiveDate.split("-").reverse().join("/")} · {o.title} ·{" "}
                  {o.status === "pending" && o.category !== "reminder" && o.effectiveDate < day(new Date()) ? "⚠ Atrasado · " : ""}
                  {o.status === "paid"
                    ? o.category === "reminder"
                      ? "Concluído"
                      : "Pago"
                    : "Pendente"}
                </button>
              ))}
              {!list.isLoading && !list.data?.length && (
                <p>Nenhum compromisso neste período.</p>
              )}
              <Button
                variant="outline"
                className="whitespace-normal h-auto"
                onClick={() => void exportCalendar()}
              >
                Exportar para iCloud / Google Agenda
              </Button>
              <Button
                variant="outline"
                className="whitespace-normal h-auto"
                onClick={() => void exportCalendar(true)}
              >
                Compartilhar calendário
              </Button>
              <p className="text-sm">
                Exporta as ocorrências dos próximos 12 meses a partir desta
                data, incluindo os deslocamentos e reagendamentos. Importe o
                arquivo no calendário escolhido; não há sincronização
                automática. A cor é escolhida no calendário de destino. Anexos
                permanecem privados no CRM.
              </p>
            </div>
          )}
          {tab === "new" && (
            <form
              className="space-y-3"
              onSubmit={e => {
                e.preventDefault();
                const amount =
                  form.amount === ""
                    ? null
                    : Math.round(Number(form.amount) * 100);
                create.mutate({
                  ...form,
                  calendarId:
                    Number(form.calendarId) || savedCalendars.data?.[0]?.id,
                  reminderTimes: form.customTimes
                    ? {
                        beforeTime: form.beforeTime,
                        firstTime: form.firstTime,
                        secondTime: form.secondTime,
                      }
                    : undefined,
                  amount,
                  endDate: form.endDate || null,
                  repeatInterval: Number(form.repeatInterval),
                  assigneeId: Number(form.assigneeId) || user.id,
                });
              }}
            >
              <label className="block">
                Modelo de conta
                <select
                  className="block w-full rounded border bg-background p-2"
                  defaultValue=""
                  onChange={e => {
                    const t = ACCOUNT_TEMPLATES.find(
                      t => t.id === e.target.value
                    );
                    if (t)
                      setForm({
                        ...form,
                        title: t.title,
                        category: t.category,
                        repeatKind: t.repeatKind,
                        repeatInterval: 1,
                        notes: t.notes,
                        shiftBusiness: t.category !== "reminder",
                      });
                  }}
                >
                  <option value="">Preenchimento livre</option>
                  {ACCOUNT_TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm">
                Todos os campos podem ser ajustados antes de salvar.
              </p>
              {field("title", "Título")}
              <label className="block">
                Categoria
                <select
                  className="block w-full rounded border bg-background p-2"
                  value={form.category}
                  onChange={e =>
                    setForm({
                      ...form,
                      category: e.target.value,
                      shiftBusiness: e.target.value !== "reminder",
                    })
                  }
                >
                  {Object.entries(categories).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Meu calendário
                <select
                  className="block w-full rounded border bg-background p-2"
                  value={form.calendarId || savedCalendars.data?.[0]?.id || ""}
                  onChange={e =>
                    setForm({ ...form, calendarId: Number(e.target.value) })
                  }
                >
                  {savedCalendars.data?.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <details className="rounded border p-3">
                <summary>Criar ou editar calendário da minha conta</summary>
                <Input
                  aria-label="Nome do calendário"
                  value={calendarDraft.name}
                  onChange={e =>
                    setCalendarDraft({ ...calendarDraft, name: e.target.value })
                  }
                />
                <Input
                  aria-label="Cor do calendário"
                  type="color"
                  value={calendarDraft.color}
                  onChange={e =>
                    setCalendarDraft({
                      ...calendarDraft,
                      color: e.target.value,
                    })
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={!calendarDraft.name || saveCalendar.isPending}
                    onClick={() => saveCalendar.mutate(calendarDraft)}
                  >
                    Criar calendário
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!calendarDraft.name || saveCalendar.isPending}
                    onClick={() =>
                      saveCalendar.mutate({
                        ...calendarDraft,
                        id:
                          Number(form.calendarId) ||
                          savedCalendars.data?.[0]?.id,
                      })
                    }
                  >
                    Atualizar selecionado
                  </Button>
                </div>
              </details>
              {field("amount", "Valor (R$, opcional)", "number")}
              {field("startDate", "Data inicial / vencimento", "date")}
              <label className="block">
                Repete
                <select
                  className="block w-full rounded border bg-background p-2"
                  value={form.repeatKind}
                  onChange={e =>
                    setForm({ ...form, repeatKind: e.target.value })
                  }
                >
                  {Object.entries({
                    none: "Não repete",
                    daily: "Diariamente",
                    weekly: "Semanalmente",
                    monthly: "Mensalmente",
                    yearly: "Anualmente",
                  }).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              {field("repeatInterval", "A cada quantos períodos", "number")}
              {field("endDate", "Termina em (vazio = sem término)", "date")}
              <p className="text-sm">
                Nos meses mais curtos, usa o último dia disponível e preserva o
                dia-base da série.
              </p>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={form.shiftBusiness}
                  onChange={e =>
                    setForm({ ...form, shiftBusiness: e.target.checked })
                  }
                />
                Mover ocorrências para o próximo dia útil
              </label>
              <label className="block">
                Responsável
                <select
                  className="block w-full rounded border bg-background p-2"
                  value={form.assigneeId || user.id}
                  onChange={e =>
                    setForm({ ...form, assigneeId: Number(e.target.value) })
                  }
                >
                  {assignees.data?.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm">
                O responsável e o criador podem acessar este compromisso. Avisos
                dependem da autorização de WhatsApp do responsável.
              </p>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={form.customTimes}
                  onChange={e =>
                    setForm({ ...form, customTimes: e.target.checked })
                  }
                />
                Personalizar os horários dos três avisos desta conta
              </label>
              {form.customTimes && (
                <>
                  {field("beforeTime", "Aviso na véspera", "time")}
                  {field("firstTime", "Primeiro aviso no dia", "time")}
                  {field("secondTime", "Segundo aviso no dia", "time")}
                </>
              )}
              {field("notes", "Notas")}
              <Button
                disabled={
                  create.isPending ||
                  savedCalendars.isLoading ||
                  !!savedCalendars.error
                }
              >
                Cadastrar compromisso
              </Button>
            </form>
          )}
          {tab === "settings" && settings && (
            <form
              className="space-y-3"
              onSubmit={e => {
                e.preventDefault();
                save.mutate(settings);
              }}
            >
              <label className="block">
                Meu WhatsApp
                <Input
                  value={settings.phone || ""}
                  onChange={e =>
                    setSettings({ ...settings, phone: e.target.value })
                  }
                />
              </label>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={settings.consent}
                  onChange={e =>
                    setSettings({ ...settings, consent: e.target.checked })
                  }
                />
                Autorizo receber lembretes dos meus compromissos neste número.
              </label>
              <label className="block">
                Fuso horário
                <Input
                  value={settings.timezone}
                  onChange={e =>
                    setSettings({ ...settings, timezone: e.target.value })
                  }
                />
              </label>
              {[
                ["beforeTime", "Aviso no dia anterior"],
                ["firstTime", "Primeiro aviso no dia"],
                ["secondTime", "Segundo aviso no dia"],
              ].map(([v, label]) => (
                <label key={v} className="block">
                  {label}
                  <Input
                    type="time"
                    value={settings[v]}
                    onChange={e =>
                      setSettings({ ...settings, [v]: e.target.value })
                    }
                  />
                </label>
              ))}
              <p className="text-sm">
                Feriados nacionais são automáticos. Carnaval e Corpus Christi
                não são incluídos como feriados nacionais. Acrescente datas
                locais, se necessário.
              </p>
              <h3>Feriados estaduais e municipais (opcional)</h3>
              {settings.holidays.map((h: any, i: number) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <span>
                    {h.date} · {h.name} {h.annual ? "· anual" : ""}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        holidays: settings.holidays.filter(
                          (_: any, j: number) => j !== i
                        ),
                      })
                    }
                  >
                    Remover
                  </Button>
                </div>
              ))}
              <Input
                aria-label="Data do feriado local"
                type="date"
                value={holidayDate}
                onChange={e => setHolidayDate(e.target.value)}
              />
              <Input
                aria-label="Nome do feriado local"
                placeholder="Nome do feriado"
                value={holidayName}
                onChange={e => setHolidayName(e.target.value)}
              />
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={annual}
                  onChange={e => setAnnual(e.target.checked)}
                />
                Repete anualmente
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (holidayName.trim()) {
                    setSettings({
                      ...settings,
                      holidays: [
                        ...settings.holidays,
                        { date: holidayDate, name: holidayName.trim(), annual },
                      ],
                    });
                    setHolidayName("");
                  }
                }}
              >
                Adicionar feriado
              </Button>
              <p className="text-sm">
                Feriados locais serão considerados nas ocorrências pendentes.
                Compromissos já reagendados mantêm a data escolhida.
              </p>
              <Button disabled={save.isPending}>Salvar preferências</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {selected && (
        <CommitmentDetail id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
