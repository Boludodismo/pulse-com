import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const here = path.dirname(fileURLToPath(import.meta.url));
const dom = new JSDOM('<div id="root"></div>', {
  url: "https://crm.example.test/autorizacao/" + "a".repeat(64),
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Image: dom.window.Image,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const { createRoot } = await import("react-dom/client");
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6WlAAAAAASUVORK5CYII=";
const canvasContext = {
  clearRect() {},
  drawImage() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {},
};
window.HTMLCanvasElement.prototype.getContext = () => canvasContext;
window.HTMLCanvasElement.prototype.toDataURL = () => png;
window.HTMLCanvasElement.prototype.setPointerCapture = () => {};
window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
  left: 0,
  top: 0,
  width: 600,
  height: 160,
});
const ui = `import React from 'react';export const Button=({children,variant,asChild,size,...props})=>React.createElement('button',props,children);export const Input=props=>React.createElement('input',props);export const Label=props=>React.createElement('label',props);export const Checkbox=({checked,onCheckedChange,...props})=>React.createElement('input',{...props,type:'checkbox',checked,onChange:e=>onCheckedChange(e.target.checked)});export const Card=({children,...props})=>React.createElement('div',props,children);export const CardHeader=Card,CardContent=Card,CardTitle=Card;`;
const mocks = {
  wouter: `export const useRoute=()=>[true,{token:'${"a".repeat(64)}'}];`,
  "@/lib/trpc": `export const trpc={minorConsent:{publicGet:{useQuery:()=>({data:globalThis.fixture,isLoading:false,refetch:async()=>{globalThis.fixture.anamneseCompleted=true;}})},publicUpload:{useMutation:()=>({mutateAsync:async x=>{globalThis.uploads.push(x);return {uploaded:true};}})},prepare:{useMutation:()=>({isPending:false,mutateAsync:async x=>{globalThis.preparations.push(x);return {name:'original.pdf',mime:'application/pdf',data:'JVBERi0='};}})},submit:{useMutation:()=>({mutateAsync:x=>{globalThis.submissions.push(x);return new Promise(resolve=>{globalThis.completeSubmission=resolve;});}})}}};`,
  "@/components/MinorConsentPanel": `export const consentFileInput=async file=>({name:file.name,data:'JVBERi0='});export const downloadConsentFile=x=>globalThis.downloads.push(x);`,
  sonner: `export const toast={error:x=>globalThis.errors.push(x),success:()=>{}};`,
};
const output = path.join(here, ".compiled-minor-consent.mjs");
await build({
  entryPoints: [
    path.resolve(here, "../../client/src/pages/PublicMinorConsent.tsx"),
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
        b.onResolve({ filter: /^(@\/|wouter|sonner|@shared)/ }, args => {
          if (args.path === "@shared/minorConsent")
            return { path: path.resolve(here, "../../shared/minorConsent.ts") };
          return { path: args.path, namespace: "mock" };
        });
        b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({
          contents: mocks[args.path] || ui,
          loader: "js",
        }));
      },
    },
  ],
});
const Page = (await import(output)).default;
await rm(output);
function input(label) {
  const l = [...document.querySelectorAll("label")].find(
    e => e.textContent.trim() === label
  );
  assert(l, `Missing field ${label}`);
  return l.parentElement.querySelector("input,select");
}
async function value(label, v) {
  await act(async () => {
    const el = input(label);
    const p =
      el.tagName === "SELECT"
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(p, "value").set.call(el, v);
    el.dispatchEvent(
      new window.Event(el.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      })
    );
    if (el.tagName !== "SELECT")
      el.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
function button(label) {
  const b = [...document.querySelectorAll("button")].find(x =>
    x.textContent.includes(label)
  );
  assert(b, `Missing button ${label}`);
  return b;
}
async function click(label) {
  await act(async () => button(label).click());
}
async function upload(label) {
  await act(async () => {
    const el = input(label);
    Object.defineProperty(el, "files", {
      value: [
        new window.File(["%PDF-test"], label + ".pdf", {
          type: "application/pdf",
        }),
      ],
      configurable: true,
    });
    el.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
async function draw(index) {
  await act(async () => {
    const el = document.querySelectorAll("canvas")[index];
    for (const [kind, x] of [
      ["pointerdown", 10],
      ["pointermove", 20],
      ["pointerup", 30],
    ])
      el.dispatchEvent(
        new window.MouseEvent(kind, { bubbles: true, clientX: x, clientY: 20 })
      );
  });
}
async function run(mode) {
  globalThis.fixture = {
    received: false,
    id: 11,
    status: "pending",
    template: {
      studioName: "Estúdio Teste",
      professionalName: "Artista Teste",
      address: "Rua de Teste 10, MG",
      contact: "Contato Teste",
      terms:
        "Condições e informações do procedimento.\n\nDados privados e acesso restrito.",
    },
    procedure: {
      description: "Arte de teste",
      bodyRegion: "Braço",
      side: "direito",
      size: "10 cm",
      colors: "Preto",
      plannedDate: "2026-10-17",
    },
    client: {
      name: "Pessoa Menor Teste",
      birthDate: "2010-02-03",
      documentNumber: "52998224725",
      address: "Rua de Teste 10, Curvelo MG",
    },
    anamneseLink: "https://crm.example.test/anamnese/test",
    anamneseCompleted: false,
    files: [],
  };
  globalThis.errors = [];
  globalThis.uploads = [];
  globalThis.submissions = [];
  globalThis.downloads = [];
  globalThis.preparations = [];
  const root = createRoot(document.getElementById("root"));
  await act(async () => root.render(createElement(Page)));
  await value("Sexo para cadastro", "masculino");
  await value("Nome completo do responsável", "Responsável Teste");
  await value("Número do documento do responsável", "16899535009");
  await value("Telefone do responsável", "31999999999");
  await click("Continuar");
  assert(
    document.body.textContent.includes("Anamnese vinculada"),
    errors.join("; ")
  );
  await click("Continuar");
  assert(errors.some(e => e.includes("Anexe o documento")));
  await upload("Documento do menor com identificação e filiação *");
  await upload("Documento do responsável legal *");
  assert.equal(uploads.length, 2);
  await click("Continuar");
  assert(errors.some(e => e.includes("anamnese vinculada")));
  await click("Atualizar status");
  await click("Continuar");
  assert(document.body.textContent.includes("Leitura e assinaturas"));
  await click("Continuar");
  assert(errors.some(e => e.includes("confirmações")));
  for (let i = 0; i < 4; i++)
    await act(async () =>
      document.querySelectorAll("input[type=checkbox]")[i].click()
    );
  await draw(0);
  if (mode === "external") {
    await value("Assinatura do responsável", "external");
    await click("Baixar PDF");
    assert.equal(downloads.length, 1);
    await upload("PDF original assinado pelo responsável *");
  } else await draw(1);
  await click("Continuar");
  assert(
    document.body.textContent.includes("Revise antes de enviar"),
    errors.join("; ")
  );
  await act(async () => {
    button("Enviar autorização e anexos").click();
    button("Enviar autorização e anexos").click();
  });
  assert.equal(submissions.length, 1, "double click must not submit twice");
  assert.equal(submissions[0].submission.signatureMode, mode);
  await act(async () => completeSubmission({ received: true }));
  assert(document.body.textContent.includes("Autorização recebida"));
  await act(async () => root.unmount());
  console.log(
    `PASS: ${mode} identification, files, linked anamnesis, signatures, review and single submission`
  );
}
await run("simple");
await run("external");
