import { describe, expect, it } from "vitest";
import { chooseConsumptionSource as choose } from "./materialShortcut";
const today = "2026-09-17";
describe("one-tap material source", () => {
  it("uses legacy stock directly when it is the only source", () => expect(choose(10, 1, [], today)).toEqual({ready:true}));
  it("uses the only eligible batch", () => expect(choose(5, 1, [{id:7,remainingQuantity:"5",expiresAt:today}], today)).toEqual({ready:true,batchId:7}));
  it("requires a choice when multiple sources exist", () => expect(choose(10,1,[{id:7,remainingQuantity:"5"}],today)).toEqual({ready:false}));
  it("does not use expired stock or insufficient stock", () => {
    expect(choose(5,1,[{id:7,remainingQuantity:"5",expiresAt:"2026-09-16"}],today)).toEqual({ready:false});
    expect(choose(0,1,[],today)).toEqual({ready:false});
    expect(choose(5,1,[],today,"2026-09-16")).toEqual({ready:false});
  });
});
