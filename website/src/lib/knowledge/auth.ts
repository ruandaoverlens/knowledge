import { timingSafeEqual } from "crypto";

/**
 * Porta da API de leitura da base (docs/adr/0007). Quem lê de fora (o Growth System) manda
 * `Authorization: Bearer <KNOWLEDGE_API_TOKEN>`. O valor mora só no Infisical, nos dois projetos.
 * Sem o segredo configurado, a API fica fechada: nunca abre por omissão.
 */
export function knowledgeAuthorized(request: Request): boolean {
  const expected = process.env.KNOWLEDGE_API_TOKEN ?? "";
  if (expected.length < 32) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  const given = Buffer.from(match[1].trim());
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
}
