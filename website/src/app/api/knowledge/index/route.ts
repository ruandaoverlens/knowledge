import { knowledgeAuthorized, unauthorized } from "@/lib/knowledge/auth";
import { getKnowledgeDocs, isArea, SYSTEMS, toEntry } from "@/lib/knowledge/catalog";

/**
 * GET /api/knowledge/index[?area=vendas|cs|marketing|atendimento]
 *
 * Índice da base inteira (sem o texto). Com `area`, só os documentos marcados para a área no
 * frontmatter (`areas`), com a porta de entrada da área em `home`. Contrato em docs/adr/0007.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!knowledgeAuthorized(request)) return unauthorized();
  const url = new URL(request.url);
  const area = url.searchParams.get("area");
  if (area !== null && !isArea(area)) {
    return Response.json({ error: "unknown_area" }, { status: 400 });
  }

  const all = getKnowledgeDocs().map(toEntry);
  const docs = area ? all.filter((d) => d.areas.includes(area)) : all;
  const home = area ? (all.find((d) => d.areaHome.includes(area))?.id ?? null) : null;

  return Response.json(
    {
      systems: SYSTEMS.map(({ system, route, label }) => ({ system, route, label })),
      area,
      home,
      docs,
    },
    { headers: { "cache-control": "private, max-age=60" } },
  );
}
