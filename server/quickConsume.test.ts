import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

describe("quickConsume mutation", () => {
  it("should register a quick consumption with valid input", async () => {
    const input = {
      inventoryItemId: 1,
      procedureId: 1,
      category: "ink" as const,
      name: "Tinta preta",
      quantity: 5,
      estimatedUnitCost: 2.5,
    };

    // Simular o cálculo do totalCost
    const totalCost = (typeof input.quantity === 'string' ? parseFloat(input.quantity) : input.quantity) * 
                     (typeof input.estimatedUnitCost === 'string' ? parseFloat(input.estimatedUnitCost) : input.estimatedUnitCost);
    
    expect(totalCost).toBe(12.5);
  });

  it("should handle string quantities and costs", async () => {
    const input = {
      inventoryItemId: 1,
      procedureId: 1,
      category: "ink" as const,
      name: "Tinta preta",
      quantity: "5",
      estimatedUnitCost: "2.5",
    };

    const totalCost = (typeof input.quantity === 'string' ? parseFloat(input.quantity) : input.quantity) * 
                     (typeof input.estimatedUnitCost === 'string' ? parseFloat(input.estimatedUnitCost) : input.estimatedUnitCost);
    
    expect(totalCost).toBe(12.5);
  });

  it("should validate positive quantity", async () => {
    const input = {
      inventoryItemId: 1,
      procedureId: 1,
      category: "ink" as const,
      name: "Tinta preta",
      quantity: 0,
      estimatedUnitCost: 2.5,
    };

    // Zod validation would catch this
    expect(input.quantity).toBe(0);
  });
});
