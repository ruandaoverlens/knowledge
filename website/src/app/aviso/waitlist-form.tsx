"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field";

interface FieldErrors {
  name?: string;
  email?: string;
  phone?: string;
  form?: string;
}

function focusField(id: string) {
  document.getElementById(id)?.focus();
}

export function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [site, setSite] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const clearError = (field: keyof FieldErrors) =>
    setErrors((p) => (p[field] || p.form ? { ...p, [field]: undefined, form: undefined } : p));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const next: FieldErrors = {};
    if (!name.trim()) next.name = "Preencha seu nome.";
    if (!email.trim()) next.email = "Preencha seu e-mail.";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      next.email = "Informe um e-mail válido.";
    setErrors(next);
    if (next.name) return focusField("waitlist-name");
    if (next.email) return focusField("waitlist-email");

    setSubmitting(true);
    try {
      const res = await fetch("/api/lista-de-espera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, site }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        fieldErrors?: FieldErrors;
      };
      if (res.ok) {
        setDone(true);
        return;
      }
      if (data.fieldErrors) {
        setErrors(data.fieldErrors);
        if (data.fieldErrors.name) focusField("waitlist-name");
        else if (data.fieldErrors.email) focusField("waitlist-email");
        else if (data.fieldErrors.phone) focusField("waitlist-phone");
      } else {
        setErrors({ form: data.error ?? "Não conseguimos registrar agora. Tente de novo." });
      }
    } catch {
      setErrors({ form: "Sem conexão. Confira sua internet e tente de novo." });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        role="status"
        className="rounded-lg border border-surface-800 bg-surface-950 p-6 text-center space-y-2"
      >
        <p className="text-sm font-medium text-foreground">Seu nome está na lista.</p>
        <p className="text-sm text-muted-foreground">
          Quando o evento tiver data, o convite chega no e-mail que você deixou aqui.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <fieldset disabled={submitting} className="space-y-4">
        <legend className="sr-only">Lista de espera do evento</legend>

        <div className="space-y-1.5">
          <Label htmlFor="waitlist-name">Nome</Label>
          <Input
            id="waitlist-name"
            type="text"
            size="sm"
            placeholder="Seu nome"
            value={name}
            onChange={(e) => { setName(e.target.value); clearError("name"); }}
            autoComplete="name"
            maxLength={200}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "waitlist-name-error" : undefined}
          />
          {errors.name && (
            <FieldError id="waitlist-name-error" className="text-xs">{errors.name}</FieldError>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="waitlist-email">E-mail</Label>
          <Input
            id="waitlist-email"
            type="email"
            size="sm"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
            autoComplete="email"
            maxLength={254}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "waitlist-email-error" : undefined}
          />
          {errors.email && (
            <FieldError id="waitlist-email-error" className="text-xs">{errors.email}</FieldError>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="waitlist-phone">
            WhatsApp <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="waitlist-phone"
            type="tel"
            size="sm"
            placeholder="(11) 91234-5678"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); clearError("phone"); }}
            autoComplete="tel"
            inputMode="tel"
            maxLength={40}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? "waitlist-phone-error" : undefined}
          />
          {errors.phone && (
            <FieldError id="waitlist-phone-error" className="text-xs">{errors.phone}</FieldError>
          )}
        </div>

        {/* Honeypot: invisível para pessoas, preenchido por robôs. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="waitlist-site">Site</label>
          <input
            id="waitlist-site"
            name="site"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={site}
            onChange={(e) => setSite(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full" loading={submitting} loadingText="Enviando…">
          Entrar na lista de espera
        </Button>
      </fieldset>

      {errors.form && (
        <FieldError className="pl-0 text-center">{errors.form}</FieldError>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Usamos seu contato para falar com você sobre o evento e as novidades da Overlens.
      </p>
    </form>
  );
}
