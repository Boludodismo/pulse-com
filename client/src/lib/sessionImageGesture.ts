export type ImageView = { x: number; y: number; scale: number; rotation: number };
type Point = { x: number; y: number };
type Result = { handled: boolean; view?: ImageView; undo?: ImageView; sample?: Point };
type Anchor = { view: ImageView; points: Point[] };
const ignored: Result = { handled: false };
const clampScale = (scale: number) => Math.max(.2, Math.min(5, scale));
const sameView = (a: ImageView, b: ImageView) => a.x === b.x && a.y === b.y && a.scale === b.scale && a.rotation === b.rotation;

/** One transform owner per gesture; releasing a finger rebases the remaining drag. */
export class SessionImageGesture {
  private points = new Map<number, Point>();
  private anchor: Anchor | null = null;
  private before: ImageView | null = null;
  private native: ImageView | null = null;
  mode: "idle" | "sample" | "transform" = "idle";

  get nativeActive() { return this.native !== null; }

  private rebase(view: ImageView) {
    this.anchor = { view: { ...view }, points: [...this.points.values()].slice(0, 2) };
  }

  private finish(view: ImageView): Result {
    const undo = this.before && !sameView(this.before, view) ? this.before : undefined;
    this.before = null;
    this.anchor = null;
    this.mode = "idle";
    return { handled: true, undo };
  }

  pointerDown(id: number, point: Point, view: ImageView, sampler: boolean): Result {
    // If Safari delivered gesturestart first, Pointer Events now own the touch.
    const nativeBefore = this.native;
    this.native = null;
    this.points.set(id, point);
    if (this.points.size === 1 && sampler) {
      this.mode = "sample";
      this.before = null;
      this.anchor = null;
      return { handled: true, sample: point };
    }
    this.mode = "transform";
    this.before ??= { ...(nativeBefore ?? view) };
    this.rebase(view);
    return { handled: true };
  }

  pointerMove(id: number, point: Point, sampler: boolean): Result {
    if (!this.points.has(id)) return ignored;
    this.points.set(id, point);
    if (this.mode === "sample") return { handled: true, sample: sampler ? point : undefined };
    if (this.mode !== "transform" || !this.anchor) return { handled: true };
    const points = [...this.points.values()].slice(0, 2), base = this.anchor;
    if (points.length === 2 && base.points.length === 2) {
      const [a, b] = base.points, [c, d] = points;
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const delta = Math.atan2(d.y - c.y, d.x - c.x) - Math.atan2(b.y - a.y, b.x - a.x);
      return { handled: true, view: {
        ...base.view,
        x: base.view.x + (c.x + d.x - a.x - b.x) / 2,
        y: base.view.y + (c.y + d.y - a.y - b.y) / 2,
        scale: clampScale(base.view.scale * Math.hypot(d.x - c.x, d.y - c.y) / Math.max(1, distance)),
        rotation: base.view.rotation + delta * 180 / Math.PI,
      } };
    }
    if (!sampler && points.length === 1) {
      return { handled: true, view: { ...base.view,
        x: base.view.x + points[0].x - base.points[0].x,
        y: base.view.y + points[0].y - base.points[0].y,
      } };
    }
    return { handled: true };
  }

  pointerEnd(id: number, view: ImageView, sampler: boolean): Result {
    if (!this.points.delete(id)) return ignored;
    if (!this.points.size || (sampler && this.points.size === 1)) {
      // With the eyedropper on, the remaining finger must lift before sampling again.
      return this.finish(view);
    }
    this.rebase(view);
    return { handled: true };
  }

  nativeStart(view: ImageView): Result {
    // Safari emits GestureEvents alongside touch PointerEvents. Never apply both.
    if (this.points.size || this.native) return ignored;
    this.native = { ...view };
    this.mode = "transform";
    return { handled: true };
  }

  nativeChange(scale: number, rotation: number): Result {
    if (!this.native || this.points.size) return ignored;
    if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(rotation)) return ignored;
    return { handled: true, view: { ...this.native,
      scale: clampScale(this.native.scale * scale), rotation: this.native.rotation + rotation,
    } };
  }

  nativeEnd(view: ImageView): Result {
    if (!this.native) return ignored;
    const undo = !sameView(this.native, view) ? this.native : undefined;
    this.native = null;
    this.mode = "idle";
    return { handled: true, undo };
  }
}
