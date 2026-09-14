import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("prévia e responsividade", () => {
  it("mantém a transformação JSX automática e o processamento Tailwind no servidor de desenvolvimento", () => {
    const viteBridge = readProjectFile("server/_core/vite.ts");

    expect(viteBridge).toContain('jsx: "automatic"');
    expect(viteBridge).toContain('await import("@tailwindcss/vite")');
    expect(viteBridge).toContain("tailwindModule.default()");
  });

  it("mantém a agenda e o calendário em modo lateral sobreposto até tablets compactos", () => {
    const schedule = readProjectFile("client/src/pages/Schedule.tsx");
    const calendar = readProjectFile("client/src/pages/CalendarPage.tsx");

    expect(schedule).toContain("window.innerWidth >= 1024");
    expect(schedule).toContain("lg:hidden");
    expect(calendar).toContain("window.innerWidth >= 1024");
    expect(calendar).toContain("compactHeaderTitle");
  });

  it("mantém cartões de usuários e valores compactos em smartphones sem truncagem de conteúdo", () => {
    const dashboard = readProjectFile("client/src/pages/Dashboard.tsx");
    const users = readProjectFile("client/src/pages/Users.tsx");

    expect(dashboard).toContain("formatCompactCurrency");
    expect(dashboard).toContain("whitespace-normal break-words");
    expect(users).toContain('space-y-3 sm:hidden');
    expect(users).toContain("Superadministrador");
  });
});
