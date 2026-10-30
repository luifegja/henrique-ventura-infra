"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Notice } from "@/components/ui/badge";
import { prefersReducedMotion } from "@/lib/motion";

const schema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});
type FormValues = z.infer<typeof schema>;

/** Códigos de lib/auth/auth.ts (LoginRecusado), vindos do signInChatwoot. */
const MOTIVO: Record<string, string> = {
  credenciais: "E-mail ou senha incorretos.",
  sem_conta: "Este usuário não tem acesso à conta Henrique Ventura no Chatwoot.",
  mfa: "Este usuário usa verificação em duas etapas, que o painel ainda não aceita.",
  sem_token: "O Chatwoot não liberou o acesso por API para este usuário.",
  indisponivel: "O Chatwoot não respondeu. Tente de novo em instantes.",
};

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  /** Senha errada: o formulário balança como quem diz "não" (M20). Só no erro de credencial. */
  const shake = () => {
    if (prefersReducedMotion()) return;
    formRef.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-7px)", offset: 0.18 },
        { transform: "translateX(6px)", offset: 0.4 },
        { transform: "translateX(-4px)", offset: 0.6 },
        { transform: "translateX(2px)", offset: 0.8 },
        { transform: "translateX(0)" },
      ],
      { duration: 320, easing: "ease-out" },
    );
  };
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const res = await signIn("credentials", { ...values, redirect: false });
      if (!res || res.error) {
        setServerError(MOTIVO[res?.code ?? ""] ?? MOTIVO.credenciais!);
        shake();
        return;
      }
      router.push("/leads");
      router.refresh();
    } catch {
      setServerError("Não foi possível entrar. Tente de novo.");
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        <FieldError>{errors.email?.message}</FieldError>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        <FieldError>{errors.password?.message}</FieldError>
      </div>
      {serverError ? <Notice tone="danger">{serverError}</Notice> : null}
      <Button type="submit" variant="primary" size="lg" className="w-full" pending={isSubmitting}>
        Entrar
      </Button>
      <p className="text-center text-xs text-ink-muted">Esqueceu a senha? Use o “Esqueci a senha” do Chatwoot ou peça ao administrador.</p>
    </form>
  );
}
