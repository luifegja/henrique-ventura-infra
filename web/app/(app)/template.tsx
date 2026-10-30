/**
 * Remonta a cada navegação (ao contrário do layout), então a animação de
 * entrada roda em toda troca de tela: opacidade + 4 px, 180 ms. Não depende
 * da View Transitions API (React 19.0 estável ainda não a expõe).
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-rise">{children}</div>;
}
