export function snapDragMinutes(raw: number, duration: number, step = 5) {
  return Math.max(
    0,
    Math.min(
      Math.floor((1440 - duration) / step) * step,
      Math.round(raw / step) * step
    )
  );
}
export function dragDate(day: string, minutes: number) {
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return `${day} ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}
