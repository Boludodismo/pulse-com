import type { Connection, ResultSetHeader } from "mysql2/promise";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import {
  automaticMatch,
  type AutomaticPair,
} from "../../shared/clientDuplicates";
import { rows, loadMerge, confirmMerge, consentPlan } from "./service";

export function validateBatchPairs(pairs: AutomaticPair[]) {
  if (!pairs.length || pairs.length > 30)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selecione de 1 a 30 duplicados por vez.",
    });
  const targets = new Set(pairs.map(p => p.targetId)),
    sources = new Set(pairs.map(p => p.sourceId));
  if (sources.size !== pairs.length || pairs.some(p => targets.has(p.sourceId)))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Cada origem precisa ter um único principal e não pode ser principal de outro grupo.",
    });
}
export async function loadBatch(
  c: Connection,
  studioId: number,
  pairs: AutomaticPair[]
) {
  validateBatchPairs(pairs);
  const ordered = [...pairs].sort(
    (a, b) => a.targetId - b.targetId || a.sourceId - b.sourceId
  );
  const plans = [];
  for (const pair of ordered)
    plans.push(await loadMerge(c, studioId, { ...pair, choices: {} }));
  const groups = new Map<number, typeof plans>();
  for (let i = 0; i < ordered.length; i++)
    groups.set(ordered[i].targetId, [
      ...(groups.get(ordered[i].targetId) || []),
      plans[i],
    ]);
  for (const [targetId, group] of Array.from(groups)) {
    const members = Array.from(
      new Map(
        group
          .flatMap(p => p.snapshot.clients)
          .map(client => [Number(client.id), client])
      ).values()
    );
    const compatible = members.every((a, i) =>
      members.slice(i + 1).every(b => automaticMatch(a as any, b as any))
    );
    if (!compatible)
      for (const plan of group)
        plan.preview.blockers.push(
          "Este grupo contém diferenças de identidade ou dados insuficientes. Use a comparação individual."
        );
    const contacts = Array.from(
      new Map(
        group
          .flatMap(p =>
            p.snapshot.relations
              .filter(r => r.table === "integration_contacts")
              .flatMap(r => r.rows)
          )
          .map(r => [r.id, r])
      ).values()
    );
    const consent = consentPlan(
      members,
      contacts,
      targetId,
      members.find(c => Number(c.id) === targetId)?.phone
    );
    for (const plan of group) plan.preview.consent = consent;
  }
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        studioId,
        pairs: ordered,
        hashes: plans.map(p => p.preview.hash),
      })
    )
    .digest("hex");
  return { hash, pairs: ordered, plans };
}
export function batchView(batch: Awaited<ReturnType<typeof loadBatch>>) {
  return {
    hash: batch.hash,
    items: batch.plans.map((p, i) => ({ ...p.preview, ...batch.pairs[i] })),
    count: batch.pairs.length,
  };
}
export async function confirmBatch(
  c: Connection,
  studioId: number,
  actorId: number,
  pairs: AutomaticPair[],
  hash: string
) {
  validateBatchPairs(pairs);
  await c.beginTransaction();
  try {
    await rows(c, "SELECT id FROM studios WHERE id=? FOR UPDATE", [studioId]);
    const previous = await rows(
      c,
      "SELECT id,result_json FROM client_merge_batches WHERE studio_id=? AND preview_hash=?",
      [studioId, hash]
    );
    if (previous.length) {
      await c.commit();
      return {
        ...JSON.parse(previous[0].result_json),
        batchId: previous[0].id,
        repeated: true,
      };
    }
    const batch = await loadBatch(c, studioId, pairs);
    if (batch.hash !== hash)
      throw new TRPCError({
        code: "CONFLICT",
        message: "Os dados mudaram. Atualize e revise a seleção novamente.",
      });
    if (batch.plans.some(p => p.preview.blockers.length))
      throw new TRPCError({
        code: "CONFLICT",
        message: "Existem pendências na seleção. Nenhum cadastro foi unido.",
      });
    const audits = [];
    // All original snapshots were checked and remain locked. Recompute only the changes
    // made by this transaction when multiple sources share the same surviving client.
    for (const pair of batch.pairs) {
      const input = { ...pair, choices: {} };
      const current = await loadMerge(c, studioId, input);
      const result = await confirmMerge(
        c,
        studioId,
        actorId,
        input,
        current.preview.hash,
        false
      );
      audits.push({
        targetId: pair.targetId,
        sourceId: pair.sourceId,
        auditId: Number(result.auditId),
      });
    }
    const result = { count: audits.length, audits };
    const [saved] = await c.execute<ResultSetHeader>(
      "INSERT INTO client_merge_batches(studio_id,actor_id,preview_hash,plan_json,result_json) VALUES(?,?,?,?,?)",
      [
        studioId,
        actorId,
        hash,
        JSON.stringify({
          pairs: batch.pairs,
          hashes: batch.plans.map(p => p.preview.hash),
        }),
        JSON.stringify(result),
      ]
    );
    await c.commit();
    return { ...result, batchId: saved.insertId, repeated: false };
  } catch (error) {
    await c.rollback();
    throw error;
  }
}
