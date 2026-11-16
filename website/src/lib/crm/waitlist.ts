import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Entrada de lead no CRM do Growth System (outro projeto Supabase), usada pela
 * lista de espera do aviso do Brand System. ADR 0008.
 *
 * O CRM não tem endpoint HTTP de entrada: a porta oficial são as RPCs
 * `public.crm_intake_commit` (grava o contato pela fonte manual,
 * `staging.manual_entries`, e normaliza para o núcleo) e
 * `public.crm_list_import_rows` (põe o contato numa lista estática). As duas
 * são SECURITY DEFINER e só aceitam `service_role`. Nunca escrevemos direto
 * em `core.*`.
 *
 * Variáveis de ambiente (Infisical, projeto overlens-os):
 * - CRM_SUPABASE_URL: URL do projeto Supabase do CRM.
 * - CRM_SUPABASE_SERVICE_ROLE_KEY: chave service_role do CRM.
 * - CRM_INTAKE_ACTOR: e-mail que assina o cadastro no CRM. Precisa ser o dono
 *   da lista de espera ou ter escopo de vendas "all".
 * - CRM_WAITLIST_LIST_ID: id da lista estática da lista de espera no CRM.
 *   Opcional: sem ela o lead entra no CRM, mas não na lista.
 */

export interface WaitlistEntry {
  name: string;
  email: string;
  phone?: string;
}

export class CrmNotConfiguredError extends Error {}

const ORIGIN = "Aviso do Brand System (overlens-os.vercel.app)";

let client: SupabaseClient | null = null;

function crmClient(): SupabaseClient {
  const url = process.env.CRM_SUPABASE_URL;
  const key = process.env.CRM_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new CrmNotConfiguredError("CRM sem URL ou chave.");
  client ??= createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

function actor(): string {
  const value = process.env.CRM_INTAKE_ACTOR?.trim().toLowerCase();
  if (!value) throw new CrmNotConfiguredError("CRM sem CRM_INTAKE_ACTOR.");
  return value;
}

/**
 * Grava o contato no CRM e o coloca na lista de espera.
 *
 * Idempotente por e-mail dos dois lados: o intake reconhece a pessoa pelo
 * identificador (status `igual`/`completa` em vez de `novo`) e a lista faz
 * upsert por (lista, tipo de identificador, identificador).
 */
export async function addToWaitlist(entry: WaitlistEntry): Promise<void> {
  const supabase = crmClient();
  const p_actor = actor();
  const row = {
    name: entry.name,
    email: entry.email,
    ...(entry.phone ? { phone: entry.phone } : {}),
  };

  const intake = await supabase.rpc("crm_intake_commit", {
    p_batch_id: randomUUID(),
    p_entity: "person",
    p_rows: [{ ...row, notes: "Lista de espera do evento sobre o novo Brand System." }],
    p_actor,
    p_door: "formulario",
    p_origin: ORIGIN,
    p_file: null,
  });
  if (intake.error) throw new Error(`crm_intake_commit: ${intake.error.message}`);

  // `conflito` (e-mail e telefone de pessoas diferentes) e `invalido` não
  // gravam lead; a pessoa ainda entra na lista, e o conflito fica no log para
  // o time de vendas resolver no CRM.
  const status = (intake.data as { rows?: { status?: string }[] } | null)?.rows?.[0]?.status;
  if (status === "conflito" || status === "invalido") {
    console.warn(`[lista-de-espera] intake do CRM devolveu "${status}"`);
  }

  const listId = process.env.CRM_WAITLIST_LIST_ID;
  if (!listId) {
    console.warn("[lista-de-espera] CRM_WAITLIST_LIST_ID ausente: lead gravado sem lista.");
    return;
  }

  const list = await supabase.rpc("crm_list_import_rows", {
    p_list_id: listId,
    p_rows: [row],
    // A RPC só aceita csv/paste/list/filter/crm; "paste" é a porta mais
    // próxima de um formulário de uma linha.
    p_kind: "paste",
    p_label: ORIGIN,
    p_meta: { source: "overlens-os.vercel.app/aviso" },
    p_actor,
  });
  if (list.error) throw new Error(`crm_list_import_rows: ${list.error.message}`);
}
