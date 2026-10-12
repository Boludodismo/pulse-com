import { describe, it, expect } from "vitest";
import {
  commitmentAppearance,
  commitmentToday,
} from "../../../shared/commitmentPresentation";
const occurrence = {
  status: "pending",
  category: "fixed",
  effectiveDate: "2026-10-12",
  color: "#123456",
};
describe("cores e pagamento por ocorrência", () => {
  it("mantém a cor personalizada no vencimento e alerta somente depois", () => {
    expect(commitmentAppearance(occurrence, "2026-10-12")).toMatchObject({
      color: "#123456",
      label: "Pendente",
      overdue: false,
    });
    expect(commitmentAppearance(occurrence, "2026-10-13")).toMatchObject({
      color: "#123456",
      label: "Atrasado",
      marker: "⚠",
      overdue: true,
    });
  });
  it("uma ocorrência paga fica verde sem modificar as demais", () => {
    expect(
      commitmentAppearance({ ...occurrence, status: "paid" }, "2026-10-13")
    ).toMatchObject({ color: "#22c55e", label: "Pago", overdue: false });
    expect(commitmentAppearance(occurrence, "2026-10-13").color).toBe(
      "#123456"
    );
    expect(
      commitmentAppearance(
        { ...occurrence, category: "reminder", status: "paid" },
        "2026-10-13"
      ).label
    ).toBe("Concluído");
  });
  it("usa a virada do dia no fuso configurado", () => {
    expect(
      commitmentToday("America/Sao_Paulo", new Date("2026-10-13T02:59:59Z"))
    ).toBe("2026-10-12");
    expect(
      commitmentToday("America/Sao_Paulo", new Date("2026-10-13T03:00:00Z"))
    ).toBe("2026-10-13");
  });
});
