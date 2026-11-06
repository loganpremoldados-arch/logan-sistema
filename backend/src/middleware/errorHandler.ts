import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({
      error: `Dados inválidos: ${first?.path.join(".")} — ${first?.message}`,
      details: err.issues,
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Violação de restrição única do Postgres
  if (typeof err === "object" && err && (err as any).code === "23505") {
    return res.status(409).json({ error: "Já existe um registro com essas informações (duplicidade)." });
  }
  if (typeof err === "object" && err && (err as any).code === "23503") {
    return res.status(409).json({ error: "Operação inválida: existem registros vinculados a este item." });
  }
  console.error(err);
  return res.status(500).json({ error: "Erro interno do servidor." });
}
