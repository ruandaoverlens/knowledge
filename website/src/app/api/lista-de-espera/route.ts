import { NextRequest, NextResponse } from "next/server";
import { addToWaitlist, CrmNotConfiguredError } from "@/lib/crm/waitlist";

/**
 * Lista de espera do aviso do Brand System (ADR 0008). Rota pública no host
 * fechado (`overlens-os.vercel.app`); o destino é o CRM do Growth System.
 *
 * Proteções, todas best effort numa função serverless:
 * - honeypot: o campo `site` fica escondido; quem o preenche é robô e recebe
 *   um "ok" sem gravar nada;
 * - limite por IP: 5 envios a cada 10 minutos por instância;
 * - repetição do mesmo e-mail em 10 minutos não chama o CRM de novo (o CRM já
 *   é idempotente por e-mail; isto só poupa chamadas).
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();
const recentEmails = new Map<string, number>();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "desconhecido"
  );
}

function rateLimited(ip: string, now: number): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Telefone brasileiro: 10 ou 11 dígitos, com ou sem o 55 na frente. */
function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits.length === 10 || digits.length === 11 ? digits : null;
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  if (str(body.site, 200)) return NextResponse.json({ ok: true });

  const now = Date.now();
  if (rateLimited(clientIp(req), now)) {
    return NextResponse.json(
      { error: "Muitos envios seguidos. Tente de novo em alguns minutos." },
      { status: 429 },
    );
  }

  const name = str(body.name, 200);
  const email = str(body.email, 254).toLowerCase();
  const phoneRaw = str(body.phone, 40);
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Preencha seu nome.";
  if (!email) fieldErrors.email = "Preencha seu e-mail.";
  else if (!EMAIL_RE.test(email)) fieldErrors.email = "Informe um e-mail válido.";
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) fieldErrors.phone = "Informe o WhatsApp com DDD.";
  if (Object.keys(fieldErrors).length) {
    return NextResponse.json({ error: "Revise os campos.", fieldErrors }, { status: 422 });
  }

  const seen = recentEmails.get(email);
  if (seen && now - seen < WINDOW_MS) return NextResponse.json({ ok: true });

  try {
    await addToWaitlist({ name, email, phone: phone ?? undefined });
  } catch (err) {
    if (err instanceof CrmNotConfiguredError) {
      console.error("[lista-de-espera] CRM não configurado:", err.message);
    } else {
      console.error("[lista-de-espera] falha ao gravar no CRM:", err);
    }
    return NextResponse.json(
      { error: "Não conseguimos registrar agora. Tente de novo em alguns minutos." },
      { status: 503 },
    );
  }

  recentEmails.set(email, now);
  if (recentEmails.size > 5000) recentEmails.clear();
  return NextResponse.json({ ok: true });
}
