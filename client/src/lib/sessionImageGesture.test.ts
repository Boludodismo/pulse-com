import { describe, expect, it } from "vitest";
import { SessionImageGesture, type ImageView } from "./sessionImageGesture";

const original: ImageView = { x: 0, y: 0, scale: 1, rotation: 0 };
function session(sampler = false, initial = original) {
  const gesture = new SessionImageGesture();
  let view = { ...initial };
  const undo: ImageView[] = [], samples: { x: number; y: number }[] = [];
  const apply = (result: ReturnType<SessionImageGesture["pointerDown"]>) => {
    if (result.view) view = result.view;
    if (result.undo) undo.push(result.undo);
    if (result.sample) samples.push(result.sample);
    return result;
  };
  return {
    gesture, undo, samples, get view() { return view; },
    down: (id: number, x: number, y: number) => apply(gesture.pointerDown(id, { x, y }, view, sampler)),
    move: (id: number, x: number, y: number) => apply(gesture.pointerMove(id, { x, y }, sampler)),
    end: (id: number) => apply(gesture.pointerEnd(id, view, sampler)),
    nativeStart: () => apply(gesture.nativeStart(view)),
    nativeChange: (scale: number, rotation: number) => apply(gesture.nativeChange(scale, rotation)),
    nativeEnd: () => apply(gesture.nativeEnd(view)),
  };
}

function rotateAndZoom(s: ReturnType<typeof session>) {
  s.down(1, 100, 100);
  s.down(2, 200, 100);
  s.move(2, 100, 300);
  expect(s.view.scale).toBeCloseTo(2);
  expect(s.view.rotation).toBeCloseTo(90);
}

describe("session image gesture release", () => {
  it.each([1, 2])("keeps the final rotation and zoom when finger %s lifts first", first => {
    const s = session();
    rotateAndZoom(s);
    const chosen = { ...s.view }, remaining = first === 1 ? 2 : 1;
    s.end(first);
    // iPhone can send a final move for the finger still touching the glass.
    s.move(remaining, 100, remaining === 1 ? 100 : 300);
    expect(s.view).toEqual(chosen);
    s.end(remaining);
    expect(s.view).toEqual(chosen);
    expect(s.undo).toEqual([original]);
  });

  it("continues a one-finger drag from the chosen transform instead of the pre-pinch view", () => {
    const s = session();
    rotateAndZoom(s);
    const chosen = { ...s.view };
    s.end(2);
    s.move(1, 112, 108);
    expect(s.view).toEqual({ ...chosen, x: chosen.x + 12, y: chosen.y + 8 });
    s.end(1);
    expect(s.undo).toEqual([original]);
  });

  it("records a complete drag-pinch-drag as one undo step", () => {
    const s = session();
    s.down(1, 100, 100); s.move(1, 120, 110);
    s.down(2, 220, 110); s.move(2, 120, 310);
    s.end(2); s.move(1, 125, 110); s.end(1);
    expect(s.view.scale).toBeCloseTo(2);
    expect(s.view.rotation).toBeCloseTo(90);
    expect(s.undo).toEqual([original]);
  });

  it("starts the next gesture from the rotation chosen in the previous gesture", () => {
    const s = session();
    rotateAndZoom(s); s.end(2); s.end(1);
    const chosen = { ...s.view };
    s.down(3, 100, 100); s.down(4, 200, 100); s.move(4, 200, 200);
    s.end(3); s.end(4);
    expect(s.view.rotation).toBeCloseTo(135);
    expect(s.view.scale).toBeCloseTo(2 * Math.SQRT2);
    expect(s.undo).toEqual([original, chosen]);
  });

  it("keeps the transform on cancellation/capture loss and ignores the duplicate release", () => {
    const s = session();
    rotateAndZoom(s);
    const chosen = { ...s.view };
    s.end(2); s.end(1); s.end(1); s.move(1, 0, 0);
    expect(s.view).toEqual(chosen);
    expect(s.undo).toEqual([original]);
  });

  it("rebases when a third touch changes the active pair", () => {
    const s = session();
    rotateAndZoom(s);
    s.down(3, 300, 300);
    const chosen = { ...s.view };
    s.end(1); s.move(2, 100, 300);
    expect(s.view).toEqual(chosen);
    s.end(3); s.end(2);
    expect(s.undo).toEqual([original]);
  });

  it("does not move the image while sampling with one finger", () => {
    const s = session(true);
    s.down(1, 100, 100); s.move(1, 120, 110); s.end(1);
    expect(s.samples).toEqual([{ x: 100, y: 100 }, { x: 120, y: 110 }]);
    expect(s.view).toEqual(original);
    expect(s.undo).toEqual([]);
  });

  it("keeps the eyedropper on but requires a fresh touch after a two-finger transform", () => {
    const s = session(true);
    rotateAndZoom(s);
    const chosen = { ...s.view }, sampled = s.samples.length;
    s.end(2); s.move(1, 120, 110); s.end(1);
    expect(s.view).toEqual(chosen);
    expect(s.samples).toHaveLength(sampled);
    expect(s.undo).toEqual([original]);
    s.down(3, 130, 140);
    expect(s.samples).toHaveLength(sampled + 1);
  });

  it("does not record taps as image history", () => {
    const s = session();
    s.down(1, 100, 100); s.end(1);
    expect(s.undo).toEqual([]);
  });
});

describe("Safari gesture ownership", () => {
  it.each(["before second pointer", "after second pointer"])("ignores native events %s during touchscreen input", order => {
    const s = session();
    s.down(1, 100, 100);
    if (order === "before second pointer") s.nativeStart();
    s.down(2, 200, 100);
    if (order === "after second pointer") s.nativeStart();
    s.move(2, 100, 300);
    const chosen = { ...s.view };
    s.nativeChange(3, 20); s.nativeEnd(); s.end(2);
    s.move(1, 100, 100); s.end(1);
    s.nativeChange(1, 0); s.nativeEnd();
    expect(s.view).toEqual(chosen);
    expect(s.undo).toEqual([original]);
  });

  it("allows Safari trackpad zoom and rotation without active touch pointers", () => {
    const initial = { x: 12, y: 9, scale: 1.5, rotation: 15 };
    const s = session(false, initial);
    s.nativeStart(); s.nativeChange(2, 32); s.nativeEnd(); s.nativeEnd();
    expect(s.view).toEqual({ ...initial, scale: 3, rotation: 47 });
    expect(s.undo).toEqual([initial]);
  });

  it("lets pointers take ownership if Safari starts the native gesture first", () => {
    const s = session();
    s.nativeStart(); rotateAndZoom(s);
    const chosen = { ...s.view };
    s.nativeChange(1, 0); s.end(1); s.end(2); s.nativeEnd();
    expect(s.view).toEqual(chosen);
    expect(s.undo).toEqual([original]);
  });

  it("ignores invalid native transforms and keeps zoom within the existing bounds", () => {
    const s = session();
    s.nativeStart(); s.nativeChange(NaN, 20); s.nativeChange(2, Infinity);
    expect(s.view).toEqual(original);
    s.nativeChange(100, 30); expect(s.view.scale).toBe(5);
    s.nativeChange(.01, 30); expect(s.view.scale).toBe(.2);
  });
});
