import { describe, expect, it } from "vitest";
import { completeVisualLayerOrder, moveVisualLayer, validateVisualLayerOrder, visualLayerStack } from "../shared/sessionVisualLayers";

describe("visual layer stack", () => {
  it("keeps existing appearance while listing front to back, including the reference", () => {
    const existing = [{layerKey:"photo",sortOrder:10}];
    const stack = visualLayerStack(completeVisualLayerOrder(existing)).map(layer=>layer.layerKey);
    expect(stack).toEqual(["samples","photo","reference"]);
    expect([...stack].reverse()).toEqual(["reference","photo","samples"]);
    expect(moveVisualLayer(stack,"reference",0)).toEqual(["reference","samples","photo"]);
    expect(existing).toEqual([{layerKey:"photo",sortOrder:10}]);
  });
  it("supports moving both ways and to either edge without losing layers", () => {
    expect(moveVisualLayer(["a","b","c","d"],"a",2)).toEqual(["b","c","a","d"]);
    expect(moveVisualLayer(["a","b","c","d"],"d",1)).toEqual(["a","d","b","c"]);
    expect(moveVisualLayer(["a","b"],"a",99)).toEqual(["b","a"]);
    expect(moveVisualLayer(["a","b"],"b",-1)).toEqual(["b","a"]);
  });
  it("rejects incomplete, duplicate and foreign keys before any write", () => {
    for(const invalid of [["a"],["a","a"],["a","foreign"]]) {
      expect(()=>validateVisualLayerOrder(["a","b"],invalid,["a","b"])).toThrow(/todas/);
    }
  });
  it("rejects a stale order after another window reorders, adds or removes a layer", () => {
    for(const current of [["b","a"],["a","b","c"],["a"]]) {
      expect(()=>validateVisualLayerOrder(current,["b","a"],["a","b"])).toThrow(/mudaram/);
    }
  });
  it("preserves persisted base settings and deterministically orders legacy ties", () => {
    const layers=[{layerKey:"reference",sortOrder:30},{layerKey:"b",sortOrder:10},{layerKey:"a",sortOrder:10},{layerKey:"samples",sortOrder:0}];
    expect(visualLayerStack(completeVisualLayerOrder(layers)).map(l=>l.layerKey)).toEqual(["reference","a","b","samples"]);
    expect(()=>validateVisualLayerOrder(["a","b"],["b","a"],["a","b"])).not.toThrow();
  });
});
