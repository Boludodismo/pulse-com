import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionImageSource } from "./sessionImageSource";

afterEach(() => vi.unstubAllGlobals());
describe("session reference image source", () => {
  it("uses the same-origin image endpoint without losing the key or access token", () => {
    vi.stubGlobal("window", { location: { origin: "https://crm.tatuei.com" } });
    expect(sessionImageSource("https://crm.tatuei.com/api/storage?key=procedures%2F1%2Ffoto%20cliente.png&token=test-token"))
      .toBe("/api/storage-inline?key=procedures%2F1%2Ffoto%20cliente.png&token=test-token");
    expect(sessionImageSource("/api/storage?key=procedures%2F1%2Fa.png&token=test-token"))
      .toBe("/api/storage-inline?key=procedures%2F1%2Fa.png&token=test-token");
  });
  it("preserves external images, inline previews and incomplete URLs", () => {
    vi.stubGlobal("window", { location: { origin: "https://crm.tatuei.com" } });
    for (const value of ["https://example.com/api/storage?key=other&token=external", "data:image/png;base64,dGVzdA==", "/api/storage?key=missing-token"])
      expect(sessionImageSource(value)).toBe(value);
    expect(sessionImageSource(undefined)).toBeNull();
  });
});
