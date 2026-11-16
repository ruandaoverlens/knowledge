import { knowledgeAuthorized, unauthorized } from "@/lib/knowledge/auth";
import { getKnowledgeDoc } from "@/lib/knowledge/catalog";

/**
 * GET /api/knowledge/doc?id=growth/04-operacao-comercial/35-politica-comercial
 *
 * Um documento com o Markdown completo (sem frontmatter, com as tags `<dado />`).
 * Contrato em docs/adr/0007.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!knowledgeAuthorized(request)) return unauthorized();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const doc = getKnowledgeDoc(id);
  if (!doc) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ doc }, { headers: { "cache-control": "private, max-age=60" } });
}
