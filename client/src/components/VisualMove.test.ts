import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const mutate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/trpc", () => ({ trpc: { agendaMoves: { move: { useMutation: () => ({ mutate, isPending: false }) } } } }));
vi.mock("@/components/ui/dialog", () => Object.fromEntries(
  ["Dialog", "DialogContent", "DialogHeader", "DialogTitle"].map(name => [name, ({ children }: any) => children])
));
import { MoveConfirmation } from "./VisualMove";
const props = {
  pending: { apt: { id: 8, date: "2026-10-21 08:00:00", duration: 420, clientName: "Ana" }, date: "2026-10-22 09:30:00", requestId: "d087aacf-1ca0-42fb-940e-6e22965c7a43" },
  onClose: vi.fn(), onSaved: vi.fn(),
};
beforeEach(() => mutate.mockClear());
describe("Confirmação do reagendamento", () => {
  it("mostra datas brasileiras e comunica o aviso automático", () => {
    const html = renderToStaticMarkup(createElement(MoveConfirmation, props));
    expect(html).toContain("De 21/10/2026 às 08:00");
    expect(html).toContain("Para 22/10/2026 às 09:30");
    expect(html).toContain("420 minutos");
    expect(html).toContain("O cliente será avisado pelo WhatsApp");
    expect(html).not.toContain('type="checkbox"');
  });
  it("confirmar inclui o aviso e preserva a data esperada para evitar sobrescrita", () => {
    const find = (element: any): any => {
      if (!element || typeof element !== "object") return undefined;
      if (element.props?.children === "Confirmar reagendamento") return element;
      return [element.props?.children].flat().map(find).find(Boolean);
    };
    const button: ReactElement<any> = find(MoveConfirmation(props));
    expect(button).toBeDefined();
    expect(mutate).not.toHaveBeenCalled();
    button.props.onClick();
    expect(mutate).toHaveBeenCalledWith({ id: 8, expectedDate: props.pending.apt.date, date: props.pending.date, notify: true, requestId: props.pending.requestId });
  });
});
