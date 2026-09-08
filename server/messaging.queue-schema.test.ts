import { describe, expect, it } from "vitest";
import { messageQueue } from "../drizzle/schema";

describe("message queue schema", () => {
  it("maps the tenant field to the existing physical studio_id column", () => {
    expect(messageQueue.studioId.name).toBe("studio_id");
  });
});
