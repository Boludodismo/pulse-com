import { describe,expect,it } from "vitest";
import { defaultSessionAppearance,materialSymbol,recordedColor,recipeDisplayColor,sessionAppearanceSchema } from "../shared/sessionAppearance";

describe("session appearance",()=>{
  it("keeps compact defaults and validates safe adjustable limits",()=>{
    expect(defaultSessionAppearance(true).materials.collapsed).toBe(true);
    expect(sessionAppearanceSchema.safeParse(defaultSessionAppearance()).success).toBe(true);
    const p=defaultSessionAppearance();p.layers.size=4;
    expect(sessionAppearanceSchema.safeParse(p).success).toBe(false);
    p.layers.size=1;p.tools.opacity=0;
    expect(sessionAppearanceSchema.safeParse(p).success).toBe(false);
  });
  it.each([
    ["0403RLL","liner"],["1009MGL","magnum"],["Cartucho 7RS","shader"],
    ["Agulha soldada","needle"],["Vaselina Electric Ink","cream"],["Gel transfer Electric Ink","transfer"],
    ["Green Soap","soap"],["Luva nitrílica P","gloves"],["Batoque M","cup"],["Tinta Preto Linha","ink"],
    ["Papel toalha","paper"],["Papel stencil","stencil"],["Filme plástico","film"],
    ["Protetor de máquina","film"],["Máquina rotativa","machine"],["Fonte de alimentação","power"],
    ["Clip cord","cable"],["Pedal","pedal"],["Coletor de agulhas","sharps"],["Caneta para pele","marker"],
    ["Apoio de braço","armrest"],["Material personalizado sem categoria","other"],
  ])("renders the material symbol for %s",(name,symbol)=>expect(materialSymbol({name})).toBe(symbol));
  it("never substitutes guessed pigments or blends reference colors",()=>{
    expect(recordedColor("azul")).toBeUndefined();expect(recordedColor("#12ABef")).toBe("#12ABEF");
    expect(recipeDisplayColor({},[])).toEqual({color:undefined,label:"Cor ainda não registrada"});
    const samples=[{id:"3",hex:"#abcd12"}];
    expect(recipeDisplayColor({sampleId:3},samples)).toEqual({color:"#ABCD12",label:"Cor da amostra de referência"});
    expect(recipeDisplayColor({sampleId:3,result:{hex:"#223344"}},samples)).toEqual({color:"#223344",label:"Resultado registrado"});
  });
});
