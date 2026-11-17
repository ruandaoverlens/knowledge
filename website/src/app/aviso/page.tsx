import type { Metadata } from "next";
import { HeadingTitle } from "@/components/ui/heading";
import { ThemeToggle } from "@/components/theme-toggle";
import { WaitlistForm } from "./waitlist-form";

export const metadata: Metadata = {
  title: "O Brand System mudou",
  description:
    "O Brand System da Overlens mudou e o acesso está fechado. Entre na lista de espera do evento sobre as novidades.",
};

/**
 * Aviso mostrado em todo caminho de overlens-os.vercel.app (ADR 0008).
 * O proxy reescreve o host antigo para cá; não há login nesta tela.
 */
export default function AvisoPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative min-h-screen flex items-center justify-center bg-background px-4 py-16 outline-none"
    >
      <ThemeToggle className="absolute top-3 right-3" />
      <div className="max-w-md w-full space-y-8">
        <div className="space-y-4 text-center">
          <p className="text-xs uppercase tracking-widest text-surface-400">Overlens</p>
          <HeadingTitle as="h1" size="lg" className="text-center text-balance">
            O Brand System da Overlens mudou
          </HeadingTitle>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Por muito tempo, este endereço abriu o Brand System da Overlens para quem quisesse
              estudar como a marca foi construída. A marca mudou, o sistema foi reescrito e o
              acesso agora é fechado.
            </p>
            <p>
              Vamos apresentar tudo o que mudou num evento especial. Deixe seu contato para entrar
              na lista de espera e avisamos você quando tivermos novidades.
            </p>
          </div>
        </div>

        <WaitlistForm />
      </div>
    </main>
  );
}
