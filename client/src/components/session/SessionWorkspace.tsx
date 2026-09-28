import { defaultSessionQuantity } from "@shared/sessionMaterialDefaults";
import { chooseConsumptionSource } from "./materialShortcut";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Layers,
  Package,
  Palette,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  FileText,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Trash2,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useArtistAccess } from "@/hooks/useArtistAccess";
import { toast } from "sonner";
import ConsumeMaterialBatch from "../ConsumeMaterialBatch";
import { FloatingPanel, type Point } from "./FloatingPanel";
import "./session-workspace.css";

type ImageLayer = {
  id: string;
  src: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  kind: string;
};
type Shortcut = {
  materialId: number;
  quantity: string;
  batchId?: number;
  configured: boolean;
};
type View = { x: number; y: number; scale: number; rotation: number };
type Settings = {
  layers: ImageLayer[];
  hidden: string[];
  shortcuts: Shortcut[];
  positions: Record<string, Point>;
  compact: boolean;
  view: View;
  colors: string[];
  opacity: number;
};
const initialView: View = { x: 0, y: 0, scale: 1, rotation: 0 };
const initialSettings: Settings = {
  layers: [],
  hidden: [],
  shortcuts: [],
  positions: {
    rail: { x: 0, y: 80 },
    materials: { x: 76, y: 80 },
    layers: { x: 360, y: 80 },
    palette: { x: 76, y: 400 },
    settings: { x: 80, y: 80 },
    file: { x: 80, y: 0 },
  },
  compact: true,
  view: initialView,
  colors: ["#000000", "#404040", "#808080", "#bfbfbf", "#ffffff"],
  opacity: 0.9,
};
function readSettings(key: string): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(key) || "null");
    if (
      s &&
      Array.isArray(s.layers) &&
      Array.isArray(s.shortcuts) &&
      s.view &&
      s.positions
    )
      return { ...initialSettings, ...s };
  } catch {}
  return initialSettings;
}
const limit = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
function IconButton({
  label,
  children,
  onClick,
  active,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={active ? "selected" : ""}
    >
      {children}
    </button>
  );
}

export default function SessionWorkspace(props: {
  procedureId: number;
  studioId: number;
  clientId: number;
  artistId?: number;
  title: string;
  elapsed: string;
  running: boolean;
  finished: boolean;
  timerBusy: boolean;
  onTimer: () => void;
  onClose: () => void;
  images: { id: number; imageUrl: string; imageType: string }[];
  originalSrc?: string | null;
  stencilSrc?: string | null;
}) {
  const { procedureId, studioId, clientId, artistId } = props;
  const auth = trpc.auth.me.useQuery();
  // Mount the stateful editor only after identity is known, so preferences cannot cross accounts.
  if (!auth.data) return null;
  return (
    <Workspace
      key={`${auth.data.id}:${studioId}:${procedureId}`}
      {...props}
      storageKey={`tatuei-session-v1:${auth.data.id}:${studioId}:${procedureId}`}
    />
  );
}
function Workspace(
  props: Parameters<typeof SessionWorkspace>[0] & { storageKey: string }
) {
  const { procedureId, clientId, artistId, storageKey } = props;
  const { can, invited } = useArtistAccess();
  const utils = trpc.useUtils();
  const [state, setState] = useState<Settings>(() => readSettings(storageKey));
  const [open, setOpen] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [selected, setSelected] = useState("");
  const [align, setAlign] = useState(false);
  const [configuring, setConfiguring] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("reference");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const pendingKey = `${storageKey}:pending-consumption`;
  const [uncertain, setUncertain] = useState(() => {
    try {
      return !!localStorage.getItem(pendingKey);
    } catch {
      return false;
    }
  });
  const [notice, setNotice] = useState("");
  const [lastConsumption, setLastConsumption] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inventory = trpc.pod.inventory.list.useQuery(
    { artistId },
    { enabled: can("stock") }
  );
  const session = trpc.pod.session.get.useQuery({ procedureId });
  const materials = inventory.data ?? [];
  const artists = trpc.artists.list.useQuery(undefined, {
    enabled: !artistId && !invited,
  });
  const assignArtist = trpc.procedures.update.useMutation({
    onSuccess: async () => {
      await utils.procedures.getById.invalidate({ id: procedureId });
      await utils.pod.session.get.invalidate({ procedureId });
    },
    onError: e => setNotice(e.message),
  });
  const consume = trpc.pod.session.consume.useMutation({ retry: false });
  const revert = trpc.pod.session.revertConsumption.useMutation({
    retry: false,
  });
  const upload = trpc.procedures.uploadImage.useMutation({ retry: false });
  const patch = (values: Partial<Settings>) =>
    setState(s => ({ ...s, ...values }));
  const layerPatch = (id: string, values: Partial<ImageLayer>) =>
    setState(s => ({
      ...s,
      layers: s.layers.map(l => (l.id === id ? { ...l, ...values } : l)),
    }));
  const active = state.layers.find(l => l.id === selected);
  const storageWarning = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        if (!storageWarning.current) {
          storageWarning.current = true;
          toast.error("Não foi possível guardar a organização neste aparelho.");
        }
      }
    }, 250);
    return () => {
      clearTimeout(t);
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {}
    };
  }, [state, storageKey]);
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);
  useEffect(() => {
    setState(s => {
      const sources = [
        ...props.images
          .filter(i => ["reference", "stencil", "other"].includes(i.imageType))
          .map(i => ({
            id: `image-${i.id}`,
            src: i.imageUrl,
            kind: i.imageType,
          })),
        ...(!props.images.some(i => i.imageUrl === props.originalSrc) &&
        props.originalSrc
          ? [{ id: "original", src: props.originalSrc, kind: "reference" }]
          : []),
        ...(!props.images.some(i => i.imageUrl === props.stencilSrc) &&
        props.stencilSrc
          ? [{ id: "stencil", src: props.stencilSrc, kind: "stencil" }]
          : []),
      ];
      const additions = sources
        .filter(
          i => !s.layers.some(l => l.id === i.id) && !s.hidden.includes(i.id)
        )
        .map((i, index) => ({
          ...i,
          name:
            i.kind === "stencil"
              ? "Decalque"
              : i.kind === "reference"
                ? "Referência"
                : "Imagem auxiliar",
          visible: s.layers.length === 0 && index === 0,
          locked: true,
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
        }));
      return additions.length
        ? { ...s, layers: [...s.layers, ...additions] }
        : s;
    });
  }, [props.images, props.originalSrc, props.stencilSrc, state.hidden]);
  useEffect(() => {
    if (!session.data) return;
    setState(s => {
      const additions = session.data.plannedMaterials
        .filter(
          p =>
            p.tenantMaterialId &&
            p.status !== "nao_utilizado" &&
            !s.shortcuts.some(k => k.materialId === p.tenantMaterialId) &&
            !s.hidden.includes(`material-${p.tenantMaterialId}`)
        )
        .map(p => ({
          materialId: p.tenantMaterialId!,
          quantity: defaultSessionQuantity(materials.find(m => m.id === p.tenantMaterialId) ?? {name:p.nameSnapshot,unit:p.unitSnapshot}),
          configured: false,
        }));
      return additions.length
        ? { ...s, shortcuts: [...s.shortcuts, ...additions] }
        : s;
    });
  }, [session.data, materials]);
  const setPosition = (name: string, p: Point) =>
    setState(s => ({ ...s, positions: { ...s.positions, [name]: p } }));
  const panel = (name: string, title: string, content: ReactNode) => (
    <FloatingPanel
      key={name}
      title={title}
      position={state.positions[name] ?? { x: 80, y: 0 }}
      onPosition={p => setPosition(name, p)}
      onClose={() => {
        setOpen(null);
        if (!state.compact) patch({ compact: true });
      }}
      opacity={state.opacity}
    >
      {content}
    </FloatingPanel>
  );
  const toggle = (name: string) => {
    setAlign(false);
    setOpen(o => (o === name ? null : name));
  };
  const refreshStock = async () => {
    await Promise.all([
      utils.pod.session.get.invalidate({ procedureId }),
      utils.pod.inventory.list.invalidate(),
      utils.pod.inventory.batches.invalidate(),
    ]);
  };
  async function useMaterial(shortcut: Shortcut) {
    if (pending.current || props.finished || uncertain) return;
    if (!artistId) {
      setOpen("materials");
      setNotice("Vincule o artista responsável antes de consumir materiais.");
      return;
    }
    try {
      localStorage.setItem(pendingKey, String(Date.now()));
    } catch {
      setNotice(
        "Não foi possível proteger o registro neste aparelho. Use a tela de consumo da sessão."
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      if (!shortcut.configured) {
        const material = materials.find(m => m.id === shortcut.materialId);
        const batches = await utils.pod.inventory.batches.fetch({ tenantMaterialId: shortcut.materialId, artistId });
        const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
        const source = chooseConsumptionSource(Number(material?.currentQuantity ?? 0), Number(shortcut.quantity), batches, today, material?.expiresAt);
        if (!source.ready) {
          localStorage.removeItem(pendingKey);
          setConfiguring(shortcut.materialId);
          setNotice("Confira o lote e a quantidade deste material. Depois, cada toque registra o uso.");
          return;
        }
        shortcut = { ...shortcut, configured: true, batchId: source.batchId };
        const readyShortcut = shortcut;
        setState(s => ({ ...s, shortcuts: s.shortcuts.map(k => k.materialId === readyShortcut.materialId ? readyShortcut : k) }));
      }
      const planned = session.data?.plannedMaterials.find(
        p =>
          p.tenantMaterialId === shortcut.materialId && p.status === "planejado"
      );
      const result = await consume.mutateAsync({
        procedureId,
        tenantMaterialId: shortcut.materialId,
        quantity: shortcut.quantity,
        batchId: shortcut.batchId,
        plannedMaterialId: planned?.id,
      });
      localStorage.removeItem(pendingKey);
      setLastConsumption(result.id);
      setNotice(
        `${shortcut.quantity} ${materials.find(m => m.id === shortcut.materialId)?.unit ?? ""} registrado`
      );
      await refreshStock();
    } catch (error) {
      const code = (error as { data?: { code?: string } })?.data?.code;
      if (!code || ["INTERNAL_SERVER_ERROR", "TIMEOUT"].includes(code)) {
        setUncertain(true);
        setNotice(
          "Resultado do envio incerto. Confira o histórico antes de registrar novamente."
        );
      } else {
        localStorage.removeItem(pendingKey);
        setNotice(
          error instanceof Error ? error.message : "Não foi possível registrar."
        );
      }
      await refreshStock();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function undo(id: number) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      await revert.mutateAsync({
        consumptionId: id,
        reason: "Correção no Modo Sessão",
      });
      setLastConsumption(null);
      setNotice("Consumo revertido e saldo restaurado.");
      await refreshStock();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao reverter");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function addImage(file: File) {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 16 * 1024 * 1024
    ) {
      toast.error("Use PNG, JPEG ou WebP de até 16 MB.");
      return;
    }
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = () =>
          reject(
            new Error(
              r.error?.message || "Não foi possível ler o arquivo selecionado."
            )
          );
        r.readAsDataURL(file);
      });
      const result = await upload.mutateAsync({
        procedureId,
        imageBase64: base64,
        mimeType: file.type,
        imageType:
          kind === "stencil"
            ? "stencil"
            : kind === "reference"
              ? "reference"
              : "other",
      });
      const layer: ImageLayer = {
        id: `image-${result.id}`,
        src: result.imageUrl,
        name: file.name,
        kind,
        visible: true,
        locked: false,
        opacity: kind === "stencil" ? 0.45 : 1,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
      };
      setState(s => ({
        ...s,
        layers: [...s.layers.filter(l => l.id !== layer.id), layer],
      }));
      setSelected(layer.id);
      await utils.procedures.getById.invalidate({ id: procedureId });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao salvar imagem");
    }
  }
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{
    points: Point[];
    view: View;
    layer?: ImageLayer;
  } | null>(null);
  const baseline = () => {
    gesture.current = {
      points: Array.from(pointers.current.values()),
      view: stateRef.current.view,
      layer: align
        ? stateRef.current.layers.find(l => l.id === selected)
        : undefined,
    };
  };
  const canMove = align ? !!active && !active.locked : !locked;
  const surfaceDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canMove || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    baseline();
  };
  const surfaceMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !canMove) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const base = gesture.current,
      pts = Array.from(pointers.current.values());
    if (!base || base.points.length !== pts.length) return;
    const a = base.points,
      b = pts;
    const cx = (p: Point[]) => p.reduce((n, v) => n + v.x, 0) / p.length;
    const cy = (p: Point[]) => p.reduce((n, v) => n + v.y, 0) / p.length;
    let dx = cx(b) - cx(a),
      dy = cy(b) - cy(a),
      ratio = 1,
      angle = 0;
    if (a.length === 2) {
      const dist = (p: Point[]) => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      ratio = dist(b) / Math.max(1, dist(a));
      const rad = (p: Point[]) => Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
      angle = ((rad(b) - rad(a)) * 180) / Math.PI;
    }
    if (base.layer) {
      const r = (-base.view.rotation * Math.PI) / 180;
      layerPatch(base.layer.id, {
        x:
          base.layer.x +
          (dx * Math.cos(r) - dy * Math.sin(r)) / base.view.scale,
        y:
          base.layer.y +
          (dx * Math.sin(r) + dy * Math.cos(r)) / base.view.scale,
        scale: limit(base.layer.scale * ratio, 0.1, 10),
        rotation: base.layer.rotation + angle,
      });
    } else
      patch({
        view: {
          x: base.view.x + dx,
          y: base.view.y + dy,
          scale: limit(base.view.scale * ratio, 0.2, 10),
          rotation: base.view.rotation + angle,
        },
      });
  };
  const surfaceUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    baseline();
  };
  const zoom = (factor: number) => {
    patch({
        view: {
          ...state.view,
          scale: limit(state.view.scale * factor, 0.2, 10),
        },
      });
  };
  const materialContent = (
    <div className="session-stack">
      <p className="session-muted">
        Toque no material para dar saída. Use os ajustes para mudar a quantidade ou o lote.
      </p>
      {!artistId && (
        <div className="session-stack">
          <p>Vincule o artista responsável para usar o estoque nesta sessão.</p>
          {!invited && (
            <select
              aria-label="Artista responsável pela sessão"
              value=""
              disabled={assignArtist.isPending || props.finished}
              onChange={e => {
                const artist = artists.data?.find(
                  a => a.id === Number(e.target.value)
                );
                if (artist)
                  assignArtist.mutate({
                    id: procedureId,
                    artistId: artist.id,
                    artistName: artist.name,
                  });
              }}
            >
              <option value="">Selecionar artista…</option>
              {artists.data?.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {invited && <p>Peça ao gestor para vincular seu cadastro.</p>}
        </div>
      )}
      {uncertain && (
        <div role="alert">
          <p>Confira o histórico atualizado antes de repetir o consumo.</p>
          <button
            disabled={session.isFetching}
            onClick={() => {
              localStorage.removeItem(pendingKey);
              setUncertain(false);
              setNotice("");
            }}
          >
            Já conferi o histórico
          </button>
        </div>
      )}
      {inventory.error && (
        <p role="alert" className="session-error">
          {inventory.error.message}
        </p>
      )}
      {state.shortcuts.map(shortcut => {
        const m = materials.find(m => m.id === shortcut.materialId);
        if (!m) return null;
        const used = (session.data?.consumptions ?? [])
          .filter(c => c.tenantMaterialId === m.id && c.status === "consumido")
          .reduce((n, c) => n + Number(c.quantity), 0);
        return (
          <div className="session-material" key={m.id}>
            <button
              disabled={
                busy ||
                uncertain ||
                props.finished ||
                !can("stock", true) ||
                Number(m.currentQuantity) < Number(shortcut.quantity)
              }
              onClick={() => void useMaterial(shortcut)}
            >
              <Package size={20} />
              <span>
                {m.name}
                <br />
                <span className="session-muted">
                  {`+${Number(shortcut.quantity).toLocaleString("pt-BR")} ${m.unit} por toque`}{" "}
                  · Usado: {used.toLocaleString("pt-BR")} {m.unit}
                </span>
              </span>
            </button>
            <div className="session-row">
              <span className="session-muted grow">
                {m.ownerArtistId == null ? "Estúdio" : "Artista"} · Saldo{" "}
                {Number(m.currentQuantity).toLocaleString("pt-BR")}
                {Number(m.currentQuantity) < Number(shortcut.quantity) && <strong className="session-error"> · Saldo insuficiente</strong>}
              </span>
              <IconButton
                label={`Configurar ${m.name}`}
                onClick={() => setConfiguring(m.id)}
              >
                <Settings2 size={16} />
              </IconButton>
              <IconButton
                label={`Retirar ${m.name} dos atalhos`}
                onClick={() =>
                  setState(s => ({
                    ...s,
                    shortcuts: s.shortcuts.filter(k => k.materialId !== m.id),
                    hidden: [...s.hidden, `material-${m.id}`],
                  }))
                }
              >
                <Trash2 size={16} />
              </IconButton>
            </div>
          </div>
        );
      })}
      <label>
        Adicionar material
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar no estoque"
        />
      </label>
      <select
        aria-label="Adicionar material do estoque"
        value=""
        onChange={e => {
          const id = Number(e.target.value);
          if (!id) return;
          setState(s => ({
            ...s,
            shortcuts: [
              ...s.shortcuts,
              { materialId: id, quantity: defaultSessionQuantity(materials.find(m => m.id === id)), configured: false },
            ],
            hidden: s.hidden.filter(k => k !== `material-${id}`),
          }));
        }}
      >
        <option value="">Selecionar material…</option>
        {materials
          .filter(
            m =>
              !state.shortcuts.some(k => k.materialId === m.id) &&
              m.name.toLowerCase().includes(search.toLowerCase())
          )
          .map(m => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.ownerArtistId == null ? "Estúdio" : "Artista"} ·{" "}
              {m.unit}
            </option>
          ))}
      </select>
      <details>
        <summary>Histórico de consumo</summary>
        {session.data?.consumptions.map(c => (
          <div key={c.id} className="session-material">
            {c.nameSnapshot} · {c.quantity} {c.unitSnapshot}
            <p className="session-muted">
              Lote: {c.lotSnapshot || "Sem lote"} · {c.status}
            </p>
            {c.status === "consumido" && !props.finished && (
              <button disabled={busy} onClick={() => void undo(c.id)}>
                Desfazer
              </button>
            )}
          </div>
        ))}
      </details>
    </div>
  );
  const layerContent = (
    <div className="session-stack">
      {[...state.layers].reverse().map(l => (
        <div
          key={l.id}
          className={`session-layer-row ${selected === l.id ? "selected" : ""}`}
        >
          <div className="session-row">
            <IconButton
              label={`${l.visible ? "Ocultar" : "Mostrar"} ${l.name}`}
              onClick={() => layerPatch(l.id, { visible: !l.visible })}
            >
              {l.visible ? <Eye size={17} /> : <EyeOff size={17} />}
            </IconButton>
            <button
              className="grow"
              onClick={() => {
                setSelected(l.id);
                setAlign(false);
              }}
            >
              <img src={l.src} alt="" />
              <span>{l.name}</span>
            </button>
            <IconButton
              label={`${l.locked ? "Desbloquear" : "Bloquear"} ${l.name}`}
              onClick={() => layerPatch(l.id, { locked: !l.locked })}
            >
              {l.locked ? <Lock size={16} /> : <Unlock size={16} />}
            </IconButton>
          </div>
        </div>
      ))}
      {active && (
        <>
          <label>
            Nome da camada
            <input
              value={active.name}
              maxLength={100}
              onChange={e => layerPatch(active.id, { name: e.target.value })}
            />
          </label>
          <label>
            Opacidade: {Math.round(active.opacity * 100)}%
            <input
              aria-label="Opacidade da camada"
              type="range"
              min="0"
              max="1"
              step=".01"
              value={active.opacity}
              onChange={e =>
                layerPatch(active.id, { opacity: Number(e.target.value) })
              }
            />
          </label>
          <div className="session-row">
            <button
              disabled={active.locked}
              className={align ? "selected" : ""}
              onClick={() => {
                setAlign(v => !v);
                pointers.current.clear();
              }}
            >
              Alinhar camada
            </button>
            {[1, -1].map(d => (
              <IconButton
                key={d}
                label={d === 1 ? "Subir camada" : "Descer camada"}
                onClick={() =>
                  setState(s => {
                    const layers = [...s.layers],
                      i = layers.findIndex(l => l.id === active.id),
                      j = i + d;
                    if (j >= 0 && j < layers.length)
                      [layers[i], layers[j]] = [layers[j], layers[i]];
                    return { ...s, layers };
                  })
                }
              >
                {d === 1 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </IconButton>
            ))}
          </div>
          {align && (
            <>
              <p className="session-muted">
                Arraste a imagem; use dois dedos para escala e rotação.
              </p>
              <label>
                Escala
                <input
                  type="range"
                  min=".1"
                  max="3"
                  step=".01"
                  value={active.scale}
                  onChange={e =>
                    layerPatch(active.id, { scale: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Rotação
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={active.rotation}
                  onChange={e =>
                    layerPatch(active.id, { rotation: Number(e.target.value) })
                  }
                />
              </label>
            </>
          )}
          <div className="session-row">
            <button
              onClick={() =>
                setState(s => ({
                  ...s,
                  layers: [
                    ...s.layers,
                    {
                      ...active,
                      id: `copy-${crypto.randomUUID()}`,
                      name: `${active.name} cópia`,
                    },
                  ],
                }))
              }
            >
              Duplicar
            </button>
            <button
              onClick={() => {
                setState(s => ({
                  ...s,
                  layers: s.layers.filter(l => l.id !== active.id),
                  hidden: [...s.hidden, active.id],
                }));
                setSelected("");
              }}
            >
              Retirar camada
            </button>
          </div>
        </>
      )}
      <label>
        Tipo de imagem
        <select value={kind} onChange={e => setKind(e.target.value)}>
          <option value="reference">Referência</option>
          <option value="contrast">Contraste</option>
          <option value="stencil">Decalque transparente</option>
          <option value="palette">Paleta</option>
        </select>
      </label>
      <label className="session-upload">
        {upload.isPending ? "Salvando imagem…" : "+ Adicionar camada"}
        <input
          aria-label="Adicionar imagem à sessão"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={upload.isPending}
          onChange={e => {
            const f = e.target.files?.[0];
            const input = e.currentTarget;
            if (f)
              void addImage(f).finally(() => {
                input.value = "";
              });
          }}
        />
      </label>
      <p className="session-muted">
        Arquivos ficam na sessão. Organização e alinhamento ficam salvos neste
        aparelho. Retirar uma camada preserva o arquivo original.
      </p>
      <button
        onClick={() =>
          patch({ hidden: state.hidden.filter(k => k.startsWith("material-")) })
        }
      >
        Restaurar imagens retiradas
      </button>
    </div>
  );
  const paletteContent = (
    <div className="session-stack">
      <div className="session-palette">
        {state.colors.map((c, i) => (
          <button
            key={`${c}-${i}`}
            style={{ background: c }}
            title={`Remover cor ${c}`}
            aria-label={`Remover cor ${c}`}
            onClick={() =>
              patch({ colors: state.colors.filter((_, j) => j !== i) })
            }
          />
        ))}
      </div>
      <label>
        Adicionar cor
        <input
          aria-label="Nova cor"
          type="color"
          defaultValue="#f97316"
          onBlur={e => {
            if (!state.colors.includes(e.target.value))
              patch({ colors: [...state.colors, e.target.value] });
          }}
        />
      </label>
      {state.layers
        .filter(l => l.kind === "palette")
        .map(l => (
          <img key={l.id} src={l.src} alt={l.name} />
        ))}
      <p className="session-muted">
        Toque numa amostra para retirar. As cores não alteram o consumo.
      </p>
      <button
        onClick={() => {
          setKind("palette");
          setOpen("layers");
        }}
      >
        Enviar imagem de paleta
      </button>
    </div>
  );
  return createPortal(
    <div
      ref={root}
      className="session-workspace"
      role="region"
      aria-label="Modo Sessão"
    >
      <header className="session-topbar">
        <IconButton label="Voltar à sessão" onClick={props.onClose}>
          <ArrowLeft size={20} />
        </IconButton>
        <div className="session-title">
          <small>tatuei.com · Modo Sessão</small>
          {props.title}
        </div>
        <button
          onClick={() => toggle("file")}
          title="Ficha e prontuário do cliente"
        >
          <FileText size={19} />
          <span className="wide-label">Ficha do cliente</span>
        </button>
        <span className="session-time">{props.elapsed}</span>
        <IconButton
          label={props.running ? "Pausar sessão" : "Iniciar ou retomar sessão"}
          disabled={props.finished || props.timerBusy}
          onClick={props.onTimer}
        >
          {props.running ? <Pause size={18} /> : <Play size={18} />}
        </IconButton>
        <IconButton
          label="Tela cheia do dispositivo"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else if (document.documentElement.requestFullscreen)
              void document.documentElement
                .requestFullscreen()
                .catch(() =>
                  toast.info("Modo expandido ativo neste navegador.")
                );
            else toast.info("Modo expandido ativo neste navegador.");
          }}
        >
          <Maximize2 size={18} />
        </IconButton>
      </header>
      <div
        className="session-surface"
        onPointerDown={surfaceDown}
        onPointerMove={surfaceMove}
        onPointerUp={surfaceUp}
        onPointerCancel={surfaceUp}
        onWheel={e => {
          if (!locked && !align) zoom(e.deltaY > 0 ? 0.92 : 1.08);
        }}
      >
        <div
          className="session-transform"
          style={{
            transform: `translate(${state.view.x}px,${state.view.y}px) rotate(${state.view.rotation}deg) scale(${state.view.scale})`,
          }}
        >
          {state.layers
            .filter(l => l.visible && l.kind !== "palette")
            .map(l => (
              <div
                key={l.id}
                className="session-layer"
                style={{
                  opacity: l.opacity,
                  transform: `translate(${l.x}px,${l.y}px) rotate(${l.rotation}deg) scale(${l.scale})`,
                }}
              >
                <img src={l.src} alt={l.name} draggable={false} />
              </div>
            ))}
        </div>
        {!state.layers.some(l => l.visible && l.kind !== "palette") && (
          <div className="session-empty">
            Abra Camadas para adicionar
            <br />
            ou mostrar uma referência.
          </div>
        )}
      </div>
      <div className="session-view-tools" role="toolbar" aria-label="Enquadramento da referência">
        <IconButton label="Diminuir zoom" onClick={() => zoom(1 / 1.2)}><ZoomOut size={19} /></IconButton>
        <output aria-label="Zoom da referência">{Math.round(state.view.scale * 100)}%</output>
        <IconButton label="Aumentar zoom" onClick={() => zoom(1.2)}><ZoomIn size={19} /></IconButton>
        <IconButton label="Girar 15 graus à esquerda" onClick={() => patch({view:{...state.view,rotation:state.view.rotation-15}})}><RotateCcw size={19} /></IconButton>
        <IconButton label="Girar 15 graus à direita" onClick={() => patch({view:{...state.view,rotation:state.view.rotation+15}})}><RotateCw size={19} /></IconButton>
        <IconButton label="Restaurar enquadramento" onClick={() => patch({view:initialView})}><Minimize2 size={19} /></IconButton>
      </div>
      <div className="session-panels">
        <FloatingPanel
          title="Ferramentas"
          narrow
          position={state.positions.rail}
          onPosition={p => setPosition("rail", p)}
          opacity={state.opacity}
        >
          <IconButton
            label={state.compact ? "Expandir painéis" : "Recolher painéis"}
            onClick={() => {
              patch({ compact: !state.compact });
              setOpen(null);
            }}
          >
            {state.compact ? (
              <PanelLeftOpen size={20} />
            ) : (
              <PanelLeftClose size={20} />
            )}
          </IconButton>
          <IconButton
            label="Materiais"
            active={open === "materials"}
            onClick={() => toggle("materials")}
          >
            <Package size={20} />
          </IconButton>
          <IconButton
            label="Camadas"
            active={open === "layers"}
            onClick={() => toggle("layers")}
          >
            <Layers size={20} />
          </IconButton>
          <IconButton
            label="Paleta"
            active={open === "palette"}
            onClick={() => toggle("palette")}
          >
            <Palette size={20} />
          </IconButton>
          <IconButton
            label={
              locked ? "Liberar gestos na imagem" : "Bloquear gestos na imagem"
            }
            active={locked}
            onClick={() => {
              setLocked(v => !v);
              setAlign(false);
              pointers.current.clear();
            }}
          >
            {locked ? <Lock size={19} /> : <Unlock size={19} />}
          </IconButton>
          <IconButton
            label="Ajustar à tela"
            onClick={() => patch({ view: initialView })}
          >
            <Minimize2 size={19} />
          </IconButton>
          <IconButton
            label="Opções de visualização"
            onClick={() => toggle("settings")}
          >
            <Settings2 size={19} />
          </IconButton>
          {state.compact &&
            state.shortcuts.slice(0, 4).map(k => {
              const m = materials.find(m => m.id === k.materialId);
              return m ? (
                <button
                  key={m.id}
                  title={`${m.name}: ${k.quantity} ${m.unit}`}
                  aria-label={`Consumir ${m.name}`}
                  disabled={
                    busy || uncertain || props.finished || !can("stock", true)
                  }
                  onClick={() => void useMaterial(k)}
                  style={{ flexDirection: "column", fontSize: 10 }}
                >
                  <Package size={16} />
                  {m.name.slice(0, 7)}
                  <span>+{Number(k.quantity).toLocaleString("pt-BR")}</span>
                </button>
              ) : null;
            })}
        </FloatingPanel>
        {(open === "materials" || (!state.compact && open === null)) &&
          panel("materials", "Materiais", materialContent)}
        {(open === "layers" || (!state.compact && open === null)) &&
          panel("layers", "Camadas", layerContent)}
        {(open === "palette" || (!state.compact && open === null)) &&
          panel("palette", "Paleta", paletteContent)}
        {open === "settings" &&
          panel(
            "settings",
            "Visualização",
            <div className="session-stack">
              <label>
                Opacidade dos menus
                <input
                  type="range"
                  min=".35"
                  max="1"
                  step=".05"
                  value={state.opacity}
                  onChange={e => patch({ opacity: Number(e.target.value) })}
                />
              </label>
              <button
                onClick={() =>
                  patch({ positions: initialSettings.positions, compact: true })
                }
              >
                Restaurar organização
              </button>
              <p className="session-muted">
                Sair deste modo não pausa nem encerra a sessão.
              </p>
            </div>
          )}
        {open === "file" &&
          panel(
            "file",
            "Ficha do cliente",
            <ClientSheet clientId={clientId} />
          )}
      </div>
      {notice && (
        <div
          role="status"
          style={{
            position: "absolute",
            bottom: "max(12px, env(safe-area-inset-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "85%",
            background: "#18181bf5",
            padding: 10,
            borderRadius: 12,
            fontSize: 12,
            zIndex: 6,
          }}
        >
          {notice}
          {lastConsumption && (
            <button disabled={busy} onClick={() => void undo(lastConsumption)}>
              Desfazer
            </button>
          )}
          <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {configuring && materials.find(m => m.id === configuring) && (
        <ConsumeMaterialBatch
          material={materials.find(m => m.id === configuring)!}
          artistId={artistId}
          initialQuantity={
            state.shortcuts.find(k => k.materialId === configuring)?.quantity ??
            "1"
          }
          busy={false}
          confirmLabel="Salvar atalho sem consumir"
          onClose={() => setConfiguring(null)}
          onConfirm={(quantity, batchId) => {
            if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
              toast.error("Informe uma quantidade maior que zero.");
              return;
            }
            setState(s => ({
              ...s,
              shortcuts: s.shortcuts.map(k =>
                k.materialId === configuring
                  ? { ...k, quantity, batchId, configured: true }
                  : k
              ),
            }));
            setConfiguring(null);
            setNotice(
              "Atalho preparado. Toque no material para registrar o consumo."
            );
          }}
        />
      )}
    </div>,
    document.body
  );
}
function ClientSheet({ clientId }: { clientId: number }) {
  const { can } = useArtistAccess();
  const client = trpc.clients.getById.useQuery({ id: clientId });
  const records = trpc.anamnesis.getByClientId.useQuery(
    { clientId },
    { enabled: can("anamnesis") }
  );
  return (
    <div className="session-stack">
      {client.isLoading && <p>Carregando ficha…</p>}
      {client.error && <p role="alert">{client.error.message}</p>}
      <strong>{client.data?.name}</strong>
      <p>{client.data?.phone}</p>
      {records.error && <p role="alert">{records.error.message}</p>}
      {can("anamnesis") && (
        <>
          <strong>Anamnese registrada</strong>
          {records.data?.length === 0 && (
            <p>
              Nenhuma ficha tradicional registrada. Consulte também o prontuário
              completo.
            </p>
          )}
          {records.data?.map(r => (
            <div key={r.id} className="session-material">
              <p>
                Alergias:{" "}
                {r.hasAllergies
                  ? r.allergiesDetails || "Registradas"
                  : "Não informadas"}
              </p>
              <p>
                Condições:{" "}
                {r.hasDiseases
                  ? r.diseasesDetails || "Registradas"
                  : "Não informadas"}
              </p>
              <p>
                Medicamentos:{" "}
                {r.usesMedication
                  ? r.medicationDetails || "Registrados"
                  : "Não informados"}
              </p>
            </div>
          ))}
        </>
      )}
      <a
        href={`/clients/${clientId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="selected"
        style={{ padding: 12, borderRadius: 8 }}
      >
        Abrir prontuário completo em outra aba
      </a>
      <p className="session-muted">
        Inclui histórico, formulários e observações conforme suas permissões. O
        cronômetro continua ativo.
      </p>
    </div>
  );
}
