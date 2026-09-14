export type AppointmentKitItem = {
  tenantMaterialId?: number;
  name: string;
  unit: string;
  quantity: string;
};
export type AppointmentKitDraft = {
  name: string;
  items: AppointmentKitItem[];
  operationKey: string;
};
export const emptyAppointmentKit = (): AppointmentKitDraft => ({
  name: "",
  items: [],
  operationKey: crypto.randomUUID(),
});
export function materialUnitKey(value: string) {
  const unit = value.trim().toLocaleLowerCase("pt-BR");
  if (["un", "unid", "unid.", "unidade", "unidades"].includes(unit))
    return "un";
  return unit;
}
