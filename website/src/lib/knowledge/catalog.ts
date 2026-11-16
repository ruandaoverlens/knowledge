import {
  getAllBusinessFlat,
  getAllCommunityFlat,
  getAllDocsFlat,
  getAllEstudioFlat,
  getAllGrowthFlat,
  getAllPacoteFlat,
  getAllProductFlat,
  getBusinessSections,
  getCommunitySections,
  getEstudioSections,
  getGrowthSections,
  getPacoteSections,
  getProductSections,
  getSections,
  type DocFile,
  type DocSection,
} from "@/lib/docs";

/**
 * Catálogo da base inteira para leitores de fora do site (docs/adr/0007).
 *
 * O id de um documento é o caminho dele no site, sem a barra inicial
 * (`growth/04-operacao-comercial/35-politica-comercial`). Assim o mesmo texto
 * serve de id na API, de link no site e de link interno dentro dos próprios
 * documentos, que já apontam para `/growth/...`, `/business/...` etc.
 */

export type KnowledgeSystem =
  | "brand_system"
  | "estudio_criativo"
  | "growth_system"
  | "business_doc"
  | "product_system"
  | "community_system"
  | "pacote_cultural";

export const SYSTEMS: {
  system: KnowledgeSystem;
  route: string;
  label: string;
  files: () => DocFile[];
  sections: () => DocSection[];
}[] = [
  { system: "business_doc", route: "business", label: "Business Document", files: getAllBusinessFlat, sections: getBusinessSections },
  { system: "brand_system", route: "docs", label: "Brand System", files: getAllDocsFlat, sections: getSections },
  { system: "growth_system", route: "growth", label: "Growth System", files: getAllGrowthFlat, sections: getGrowthSections },
  { system: "product_system", route: "product", label: "Product System", files: getAllProductFlat, sections: getProductSections },
  { system: "community_system", route: "community", label: "Community System", files: getAllCommunityFlat, sections: getCommunitySections },
  { system: "estudio_criativo", route: "estudio", label: "Content System", files: getAllEstudioFlat, sections: getEstudioSections },
  { system: "pacote_cultural", route: "pacote", label: "Pacote Cultural", files: getAllPacoteFlat, sections: getPacoteSections },
];

/** Título de cada pasta pelo caminho de segmentos (a pasta não tem documento próprio). */
function folderTitles(sections: DocSection[], into = new Map<string, string>()): Map<string, string> {
  for (const s of sections) {
    into.set(s.segments.join("/"), s.title);
    folderTitles(s.children, into);
  }
  return into;
}

export const AREAS = ["vendas", "cs", "marketing", "atendimento"] as const;
export type KnowledgeArea = (typeof AREAS)[number];

export function isArea(value: unknown): value is KnowledgeArea {
  return typeof value === "string" && (AREAS as readonly string[]).includes(value);
}

export interface KnowledgeEntry {
  id: string;
  system: KnowledgeSystem;
  systemLabel: string;
  /** Títulos das pastas, do sistema até o documento (sem o próprio título). */
  trail: string[];
  title: string;
  summary: string;
  topics: string[];
  keywords: string[];
  priority: "high" | "medium" | "low";
  aiWhenToUse: string;
  areas: KnowledgeArea[];
  areaHome: KnowledgeArea[];
  key: string | null;
  version: number | null;
  updated: string | null;
  ack: boolean;
  kind: "politica" | "guia" | "referencia" | null;
  /** Ordem natural da base (sistema, depois pastas e arquivos numerados). */
  order: number;
}

export interface KnowledgeDoc extends KnowledgeEntry {
  /** Markdown sem frontmatter, como está no arquivo (com as tags `<dado />`). */
  content: string;
}

const KEY_RE = /^[a-z0-9][a-z0-9_.:-]{0,79}$/;

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  if (typeof value === "string") return value.split(/[,\s]+/).map((v) => v.trim().toLowerCase()).filter(Boolean);
  return [];
}

function asDate(value: unknown): string | null {
  // gray-matter transforma `2026-11-16` em Date; a API devolve sempre AAAA-MM-DD.
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  return null;
}

/** Títulos das pastas a partir dos segmentos, lidos da própria árvore. */
function trailOf(file: DocFile, titles: Map<string, string>): string[] {
  const out: string[] = [];
  for (let i = 1; i < file.segments.length; i++) {
    const t = titles.get(file.segments.slice(0, i).join("/"));
    if (t) out.push(t);
  }
  return out;
}

let _docs: KnowledgeDoc[] | null = null;

function build(): KnowledgeDoc[] {
  const out: KnowledgeDoc[] = [];
  let order = 0;
  for (const sys of SYSTEMS) {
    const files = sys.files();
    const titles = folderTitles(sys.sections());
    const seen = new Set<string>();
    for (const f of files) {
      const id = `${sys.route}/${f.segments.join("/")}`;
      if (seen.has(id)) continue; // o Content System varre os playbooks duas vezes
      seen.add(id);
      const fm = f.frontmatter ?? {};
      const areas = asList(fm.areas).filter(isArea);
      const key = typeof fm.key === "string" && KEY_RE.test(fm.key) ? fm.key : null;
      const version = Number.isInteger(Number(fm.version)) && Number(fm.version) >= 1 ? Number(fm.version) : null;
      const kind = fm.kind === "politica" || fm.kind === "guia" || fm.kind === "referencia" ? fm.kind : null;
      out.push({
        id,
        system: sys.system,
        systemLabel: sys.label,
        trail: trailOf(f, titles),
        title: fm.title ?? f.title,
        summary: fm.summary ?? "",
        topics: fm.topics ?? [],
        keywords: fm.keywords ?? [],
        priority: fm.priority ?? "medium",
        aiWhenToUse: fm.ai_when_to_use ?? "",
        areas,
        areaHome: asList(fm.area_home).filter(isArea),
        key,
        version,
        updated: asDate(fm.updated),
        // Confirmação de leitura só funciona com chave e versão.
        ack: fm.ack === true && key !== null && version !== null,
        kind,
        order: order++,
        content: f.content,
      });
    }
  }
  return out;
}

export function getKnowledgeDocs(): KnowledgeDoc[] {
  // Em produção a base só muda com deploy; em desenvolvimento, relê a cada chamada.
  if (process.env.NODE_ENV !== "production") return build();
  if (!_docs) _docs = build();
  return _docs;
}

export function toEntry(doc: KnowledgeDoc): KnowledgeEntry {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { content, ...entry } = doc;
  return entry;
}

export function getKnowledgeDoc(id: string): KnowledgeDoc | null {
  const clean = id.replace(/^\/+|\/+$/g, "");
  return getKnowledgeDocs().find((d) => d.id === clean) ?? null;
}
