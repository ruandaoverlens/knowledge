import { type NextRequest, NextResponse } from "next/server";
import { isClosedHostname } from "@/lib/closed-host-names";

// Comparação por host exato: previews (`*-git-*.vercel.app`), localhost e o
// domínio novo (`tru.overlens.io`) não passam por aqui.

/** Rota pública que todo caminho do host fechado passa a mostrar. */
export const AVISO_PATH = "/aviso";

/** Rota que recebe o formulário da lista de espera. */
export const WAITLIST_API_PATH = "/api/lista-de-espera";

function requestHost(request: NextRequest): string {
  const raw =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  // Pode vir "host:porta" ou uma lista separada por vírgula atrás de proxies.
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

/**
 * No host fechado, devolve a resposta que substitui o app inteiro: a API da
 * lista de espera segue normalmente e qualquer outro caminho é reescrito para
 * o aviso (a URL na barra não muda). Em qualquer outro host devolve `null` e o
 * proxy segue o fluxo de sempre.
 */
export function closedHostResponse(request: NextRequest): NextResponse | null {
  if (!isClosedHostname(requestHost(request))) return null;

  const { pathname } = request.nextUrl;
  if (pathname === WAITLIST_API_PATH) return NextResponse.next();
  // A API do Knowledge (ADR 0007) é chamada pelo servidor do Growth System com
  // token de serviço; continua viva aqui até o KNOWLEDGE_API_URL ir para o
  // domínio novo.
  if (pathname.startsWith("/api/knowledge")) return null;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Acesso encerrado neste endereço." }, { status: 410 });
  }

  const url = request.nextUrl.clone();
  url.pathname = AVISO_PATH;
  url.search = "";
  return NextResponse.rewrite(url);
}
