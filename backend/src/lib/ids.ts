import { randomUUID } from "crypto";

/** Gera um identificador único (UUID v4) para uso como chave primária. */
export function newId(): string {
  return randomUUID();
}
