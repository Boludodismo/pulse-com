import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const here = path.dirname(fileURLToPath(import.meta.url)),
  dom = new JSDOM('<div id="root"></div>', {
    url: "https://crm.example.test/clients/7",
  });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", {
  value: window.navigator,
  configurable: true,
});
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: async text => globalThis.copied.push(text) },
});
window.open = (...args) => globalThis.opened.push(args);
const { createRoot } = await import("react-dom/client");
const ui = `import React from 'react';export const Button=({children,variant,asChild,size,...p})=>React.createElement('button',p,children);export const Input=p=>React.createElement('input',p);export const Textarea=p=>React.createElement('textarea',p);export const Label=p=>React.createElement('label',p);export const Checkbox=({checked,onCheckedChange,...p})=>React.createElement('input',{...p,type:'checkbox',checked,onChange:e=>onCheckedChange(e.target.checked)});export const Card=({children,...p})=>React.createElement('div',p,children);export const CardHeader=Card,CardTitle=Card,CardDescription=Card,CardContent=Card,DialogContent=Card,DialogHeader=Card,DialogTitle=Card,DialogDescription=Card;export const Dialog=({children,open})=>open?React.createElement('div',{role:'dialog'},children):null;`;
const mocks = {
  "@/lib/trpc": `export const trpc={useUtils:()=>globalThis.utils,minorConsent:{list:{useQuery:()=>({data:globalThis.records})},invitation:{useQuery:x=>{globalThis.queryInputs.push(x);return {data:globalThis.active}}},sendInvitation:{useMutation:()=>({isPending:false,mutateAsync:x=>{globalThis.sent.push(x);return new Promise(resolve=>{globalThis.finishSend=resolve;});}})},config:{useQuery:()=>({data:globalThis.config,isLoading:false})},saveTemplate:{useMutation:()=>({isPending:false,mutate:()=>{}})},create:{useMutation:opts=>({isPending:false,mutate:x=>{globalThis.created.push(x);globalThis.records=[{id:11,status:'pending',expires_at:Date.now()+600000,has_invitation:1}];globalThis.active=globalThis.ready;opts.onSuccess({id:11,link:globalThis.ready.link,anamneseLink:globalThis.ready.anamneseLink});}})}}};`,
  sonner: `export const toast={success:x=>globalThis.notices.push(x),error:x=>globalThis.errors.push(x)};`,
  "lucide-react": `import React from 'react';const Icon=p=>React.createElement('svg',p);export const Copy=Icon,FilePlus2=Icon,MessageCircle=Icon,Send=Icon;`,
};
const output = path.join(here, ".compiled-consent-sharing.mjs");
await build({
  entryPoints: [
    path.resolve(here, "../../client/src/components/MinorConsentPanel.tsx"),
  ],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  external: ["react"],
  plugins: [
    {
      name: "mocks",
      setup(b) {
        b.onResolve({ filter: /^(@\/|@shared|sonner|lucide-react)/ }, args =>
          args.path === "@shared/minorConsent"
            ? { path: path.resolve(here, "../../shared/minorConsent.ts") }
            : { path: args.path, namespace: "mock" }
        );
        b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({
          contents: mocks[args.path] || ui,
          loader: "js",
        }));
      },
    },
  ],
});
const { MinorConsentHistory } = await import(output);
await rm(output);
Object.assign(globalThis, {
  records: [],
  active: null,
  created: [],
  queryInputs: [],
  sent: [],
  opened: [],
  copied: [],
  notices: [],
  errors: [],
  invalidations: [],
});
const invalidate = name => ({
  invalidate: async x => globalThis.invalidations.push([name, x]),
});
globalThis.utils = {
  minorConsent: {
    invitation: invalidate("invitation"),
    list: invalidate("list"),
  },
  anamnese: { getRequestsByClientId: invalidate("anamnese") },
  anamnesis: { getByClientId: invalidate("anamnesis") },
};
globalThis.config = {
  artistId: 9,
  artists: [{ id: 9, name: "Artista Teste" }],
  canSaveStudio: false,
  template: {
    studioName: "Estúdio Teste",
    professionalName: "Artista Teste",
    professionalDocument: "",
    contact: "contato@example.test",
    jurisdiction: "Curvelo MG",
    address: "Rua de Teste, 10, Curvelo MG",
    terms: "Condições do procedimento. ".repeat(15),
    logo: "",
  },
};
const a = "https://crm.example.test/autorizacao/" + "a".repeat(64),
  b = "https://crm.example.test/anamnese/" + "b".repeat(64);
globalThis.ready = {
  id: 11,
  link: a,
  anamneseLink: b,
  message: `Olá, Cliente!\nAutorização: ${a}\nAnamnese: ${b}`,
  phone: "31999999999",
  canSend: true,
  reason: null,
  lastDelivery: null,
  expiresAt: Date.now() + 600000,
  anamneseCompleted: false,
  integration: { id: 2, name: "WhatsApp Teste", phoneNumber: "31988888888" },
};
const root = createRoot(document.getElementById("root"));
const render = async () =>
  act(async () =>
    root.render(createElement(MinorConsentHistory, { clientId: 7 }))
  );
const button = label => {
  const x = [...document.querySelectorAll("button")].find(
    x => x.textContent.trim() === label
  );
  assert(x, `Missing ${label}`);
  return x;
};
const click = async label => act(async () => button(label).click());
async function field(label, v) {
  await act(async () => {
    const l = [...document.querySelectorAll("label")].find(
      x => x.textContent.trim() === label
    );
    assert(l, label);
    const el = l.parentElement.querySelector("input");
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set.call(el, v);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
await render();
for (const label of [
  "Gerar links",
  "Copiar links",
  "Enviar pelo WhatsApp",
  "Enviar pelo WhatsApp do sistema",
])
  assert(button(label));
assert(!button("Gerar links").disabled);
assert(button("Copiar links").disabled);
assert(button("Enviar pelo WhatsApp do sistema").disabled);
await click("Gerar links");
assert(document.querySelector("[role=dialog]"));
assert(document.body.textContent.includes("incluída obrigatoriamente"));
await field("Desenho e textos que serão tatuados", "Arte de teste");
await field("Região do corpo", "Braço");
await field("Tamanho aproximado em cm", "10");
await act(async () => {
  [...document.querySelectorAll("label")]
    .find(x => x.textContent.includes("Conferi a admissibilidade"))
    .querySelector("input")
    .click();
});
await click("Gerar link de autorização");
assert.equal(created.length, 1);
assert.equal(created[0].includeAnamnese, true);
assert.equal(document.querySelector("[role=dialog]"), null);
assert.equal(document.querySelectorAll("input[readonly]").length, 2);
await click("Copiar links");
assert(copied[0].includes(a) && copied[0].includes(b));
await click("Enviar pelo WhatsApp");
assert.equal(opened.length, 1);
const url = new URL(opened[0][0]);
assert.equal(url.pathname, "/5531999999999");
assert(
  url.searchParams.get("text").includes(a) &&
    url.searchParams.get("text").includes(b)
);
await act(async () => {
  button("Enviar pelo WhatsApp do sistema").click();
  button("Enviar pelo WhatsApp do sistema").click();
});
assert.deepEqual(sent, [{ id: 11 }]);
await act(async () => finishSend({ queued: true, duplicate: false }));
active = { ...ready, lastDelivery: { id: 42, status: "pendente" } };
await render();
assert(button("Enviar pelo WhatsApp do sistema").disabled);
assert(document.body.textContent.includes("na fila de envio"));
active = { ...ready, canSend: false, reason: "Conexão não cadastrada" };
await render();
assert(button("Enviar pelo WhatsApp do sistema").disabled);
assert(!button("Copiar links").disabled);
assert(document.body.textContent.includes("Conexão não cadastrada"));
active = { ...ready, anamneseCompleted: true };
await render();
assert(invalidations.some(([name]) => name === "anamnese"));
assert(invalidations.some(([name]) => name === "anamnesis"));
active = null;
records = [
  {
    id: 11,
    status: "received",
    submitted_at: "2026-10-17",
    revision: 1,
    backup_revision: 1,
  },
];
await render();
assert(button("Copiar links").disabled);
assert.equal(created.length, 1, "copy/send must not create more forms");
await act(async () => root.unmount());
console.log(
  "PASS: four card actions, mandatory linked anamnese, paired clipboard/manual WhatsApp, direct send without duplication, status/errors and existing anamnese refresh"
);
