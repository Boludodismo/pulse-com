import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const effects = vi.hoisted(() => [] as (() => void)[]);
vi.mock("react", () => ({
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => () => void) => effects.push(effect()),
}));
import { useAgendaLongPress, pressedSlotMinute } from "./useAgendaLongPress";

function pointer(type: string, properties = {}) {
  return Object.assign(new Event(type), { pointerId: 1, clientX: 100, clientY: 100, ...properties });
}
const press = (properties = {}) => ({
  isPrimary: true, button: 0, pointerId: 1, clientX: 100, clientY: 100,
  target: { closest: () => null }, ...properties,
}) as any;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("document", new EventTarget());
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => {
  effects.splice(0).forEach(cleanup => cleanup());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("Adicionar agendamento mantendo mouse ou dedo pressionado", () => {
  it.each(["mouse", "touch", "pen"])("abre uma vez após segurar com %s", pointerType => {
    const hook = useAgendaLongPress(), open = vi.fn();
    hook.start(press({ pointerType }), open);
    vi.advanceTimersByTime(549); expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(open).toHaveBeenCalledOnce();
    expect(hook.handled.current).toBe(true);
    document.dispatchEvent(pointer("pointerup"));
    vi.advanceTimersByTime(1000); expect(open).toHaveBeenCalledOnce();
  });
  it.each(["pointerup", "pointercancel", "scroll", "pointerdown"])("cancela ao receber %s", type => {
    const hook = useAgendaLongPress(), open = vi.fn();
    hook.start(press(), open); vi.advanceTimersByTime(200);
    document.dispatchEvent(pointer(type)); vi.advanceTimersByTime(1000);
    expect(open).not.toHaveBeenCalled(); expect(hook.handled.current).toBe(false);
  });
  it("cancela movimento e perda de foco, preservando rolagem e swipe", () => {
    const hook = useAgendaLongPress(), open = vi.fn();
    hook.start(press(), open);
    document.dispatchEvent(pointer("pointermove", { clientY: 112 }));
    vi.advanceTimersByTime(1000); expect(open).not.toHaveBeenCalled();
    hook.start(press(), open); window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(1000); expect(open).not.toHaveBeenCalled();
  });
  it("ignora agendamentos existentes, botões, clique direito e múltiplos dedos", () => {
    const hook = useAgendaLongPress(), open = vi.fn();
    for (const properties of [{ button: 2 }, { isPrimary: false }, { target: { closest: () => ({}) } }]) {
      hook.start(press(properties), open); vi.advanceTimersByTime(1000);
    }
    expect(open).not.toHaveBeenCalled();
  });
  it("limpa o temporizador ao desmontar a agenda", () => {
    const hook = useAgendaLongPress(), open = vi.fn();
    hook.start(press(), open); effects.splice(0).forEach(cleanup => cleanup());
    vi.advanceTimersByTime(1000); expect(open).not.toHaveBeenCalled();
  });
  it("seleciona o quarto de hora pressionado dentro do horário", () => {
    const currentTarget = { getBoundingClientRect: () => ({ top: 100, height: 64 }) };
    expect([100, 116, 132, 148, 164].map(clientY => pressedSlotMinute({ currentTarget, clientY } as any))).toEqual([0, 15, 30, 45, 45]);
  });
});
