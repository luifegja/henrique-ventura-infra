"use client";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/badge";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-xl space-y-3">
      <h1 className="text-lg">Algo deu errado nesta tela</h1>
      <Notice tone="danger">{error.message || "Erro inesperado."}</Notice>
      <Button onClick={reset}>Tentar de novo</Button>
    </div>
  );
}
