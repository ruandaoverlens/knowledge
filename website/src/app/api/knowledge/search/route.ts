import { z } from "zod";
import { expandDadoTags } from "@/lib/dado";
import { routeDocs } from "@/lib/ai/router";
import type { DocIndexEntry } from "@/lib/ai/types";
import { knowledgeAuthorized, unauthorized } from "@/lib/knowledge/auth";
import { getKnowledgeDocs, isArea, toEntry } from "@/lib/knowledge/catalog";

/**
 * POST /api/knowledge/search  { q, area?, limit?, maxChars? }
 *
 * Para os agentes do Growth System: escolhe até `limit` documentos que respondem `q` com o mesmo
 * roteador do chat da base (src/lib/ai/router.ts) e devolve o texto pronto para entrar no prompt
 * (tags `<dado />` expandidas em [DEFINIDO], [HIPÓTESE]...). Com `area`, os documentos da área
 * entram no topo do índice, mas a base inteira continua elegível. Contrato em docs/adr/0007.
 */
export const dynamic = "force-dynamic";

const Body = z.object({
  q: z.string().trim().min(3).max(2000),
  area: z.string().optional(),
  limit: z.number().int().min(1).max(5).optional(),
  maxChars: z.number().int().min(500).max(60000).optional(),
});

export async function POST(request: Request) {
  if (!knowledgeAuthorized(request)) return unauthorized();
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const area = body.area && isArea(body.area) ? body.area : null;
  const limit = body.limit ?? 3;
  const maxChars = body.maxChars ?? 12000;

  const docs = getKnowledgeDocs().filter((d) => d.summary);
  const ordered = area
    ? [...docs.filter((d) => d.areas.includes(area)), ...docs.filter((d) => !d.areas.includes(area))]
    : docs;
  // O roteador lê id, prioridade, título e resumo; o campo `system` dele é mais estreito que o
  // catálogo, mas não é usado para decidir.
  const index = ordered.map((d) => ({
    id: d.id,
    title: d.title,
    summary: d.summary,
    topics: d.topics,
    keywords: d.keywords,
    priority: d.priority,
    ai_when_to_use: d.aiWhenToUse,
    segments: d.id.split("/"),
    system: d.system,
  })) as unknown as DocIndexEntry[];

  const ids = (await routeDocs(body.q, index)).slice(0, limit);
  const byId = new Map(docs.map((d) => [d.id, d]));
  const results = ids.flatMap((id) => {
    const d = byId.get(id);
    if (!d) return [];
    const text = expandDadoTags(d.content);
    return [{ ...toEntry(d), content: text.slice(0, maxChars), truncated: text.length > maxChars }];
  });

  return Response.json({ q: body.q, results }, { headers: { "cache-control": "no-store" } });
}
