import { z } from "zod";
// bcrypt processes at most 72 UTF-8 bytes. Reject rather than silently truncate.
export const passwordPolicy = z
  .string()
  .min(15, "Use pelo menos 15 caracteres.")
  .max(72, "Use no máximo 72 bytes.")
  .refine(
    value => new TextEncoder().encode(value).length <= 72,
    "A senha ultrapassa 72 bytes; reduza caracteres acentuados ou o comprimento."
  );
