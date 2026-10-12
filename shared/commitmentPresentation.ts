export function commitmentToday(
  timezone = "America/Sao_Paulo",
  now = new Date()
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function commitmentAppearance(
  occurrence: {
    status: string;
    category: string;
    effectiveDate: string;
    color: string;
  },
  today: string
) {
  const paid = occurrence.status === "paid";
  const overdue =
    occurrence.status === "pending" && occurrence.effectiveDate < today;
  return {
    color: paid ? "#22c55e" : occurrence.color,
    label: paid
      ? occurrence.category === "reminder"
        ? "Concluído"
        : "Pago"
      : overdue
        ? "Atrasado"
        : "Pendente",
    marker: paid ? "✓" : overdue ? "⚠" : "",
    overdue,
  };
}
