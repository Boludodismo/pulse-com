export type SamplingView = { x: number; y: number; scale: number; rotation: number };
export type SampleSource = {
  layerKey: string; layerName: string; imageKey: string | null;
  imageXPct: number; imageYPct: number; width: number; height: number;
};

/** Undo the stage transform, then object-fit: contain, to address original pixels. */
export function imageSamplePoint(
  client: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
  size: { width: number; height: number },
  view: SamplingView,
) {
  if (rect.width <= 0 || rect.height <= 0 || size.width <= 0 || size.height <= 0 || view.scale <= 0) return null;
  const angle = view.rotation * Math.PI / 180;
  const dx = client.x - rect.left - rect.width / 2 - view.x;
  const dy = client.y - rect.top - rect.height / 2 - view.y;
  const x = (dx * Math.cos(angle) + dy * Math.sin(angle)) / view.scale + rect.width / 2;
  const y = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / view.scale + rect.height / 2;
  const fit = Math.min(rect.width / size.width, rect.height / size.height);
  const width = size.width * fit, height = size.height * fit;
  const left = (rect.width - width) / 2, top = (rect.height - height) / 2;
  if (x < left || x >= left + width || y < top || y >= top + height) return null;
  return {
    pixelX: Math.min(size.width - 1, Math.floor((x - left) / fit)),
    pixelY: Math.min(size.height - 1, Math.floor((y - top) / fit)),
    xPct: x / rect.width * 100,
    yPct: y / rect.height * 100,
    imageXPct: (x - left) / width * 100,
    imageYPct: (y - top) / height * 100,
  };
}

/** At an edge, clip the 5x5 neighborhood instead of shifting its center. */
export function samplePixelRegion(x: number, y: number, width: number, height: number) {
  const left = Math.max(0, x - 2), top = Math.max(0, y - 2);
  return { left, top, width: Math.min(width, x + 3) - left, height: Math.min(height, y + 3) - top };
}

/** Read source color, independent of layer opacity; transparent pixels have no color. */
export function averageSamplePixels(rgba: ArrayLike<number>): [number, number, number] | null {
  let red = 0, green = 0, blue = 0, weight = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const alpha = rgba[i + 3];
    red += rgba[i] * alpha; green += rgba[i + 1] * alpha; blue += rgba[i + 2] * alpha; weight += alpha;
  }
  return weight ? [Math.round(red / weight), Math.round(green / weight), Math.round(blue / weight)] : null;
}

export function imageSampleMarker(x: number, y: number, imageWidth: number, imageHeight: number, width: number, height: number) {
  const fit = Math.min(width / imageWidth, height / imageHeight);
  return {
    xPct: ((width - imageWidth * fit) / 2 + x / 100 * imageWidth * fit) / width * 100,
    yPct: ((height - imageHeight * fit) / 2 + y / 100 * imageHeight * fit) / height * 100,
  };
}
