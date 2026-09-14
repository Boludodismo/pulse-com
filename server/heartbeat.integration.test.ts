import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const project = resolve(import.meta.dirname, "..");

describe("processamento periódico de integração", () => {
  it("expõe um callback autenticado e não inicia timers no processo", () => {
    const scheduler = readFileSync(resolve(project, "server/scheduler.ts"), "utf8");
    const server = readFileSync(resolve(project, "server/_core/index.ts"), "utf8");

    expect(scheduler).not.toContain("setInterval(");
    expect(server).toContain('app.post("/api/scheduled/botconversa-jobs"');
    expect(server).toContain("user.isCron");
    expect(server).toContain("getIntegrationScheduleByTaskUid(user.taskUid)");
  });
});
