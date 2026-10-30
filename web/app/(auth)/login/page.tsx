import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { Wordmark } from "@/components/brand/wordmark";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Lombada: o painel de marca */}
      <aside className="hidden flex-col justify-between bg-spine p-10 text-spine-ink lg:flex">
        <Wordmark className="text-xl text-spine-ink" />
        <div>
          <p className="eyebrow mb-3 text-spine-ink/60">Atendimento comercial</p>
          <h1 className="max-w-[16ch] text-[34px] leading-[1.1] text-spine-ink">
            Do primeiro contato no WhatsApp ao contrato assinado.
          </h1>
          <p className="mt-4 max-w-[40ch] text-sm text-spine-ink/70">
            Quadro de leads pela cadência comercial, conversas do WhatsApp e respostas da
            equipe — tudo em um lugar.
          </p>
        </div>
        <span />
      </aside>

      <main className="grid place-items-center p-8">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 lg:hidden">
            <Wordmark className="text-xl" />
          </div>
          <p className="eyebrow">Mesmo e-mail e senha do Chatwoot</p>
          <h2 className="mb-6 mt-2 text-xl">Entrar no painel</h2>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
