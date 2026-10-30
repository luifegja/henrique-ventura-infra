import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Check } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded border text-sm font-medium disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-accent-fill bg-accent-fill text-on-accent-fill hover:bg-accent-fill/90",
        secondary: "border-line bg-surface text-ink hover:border-ink/30 hover:bg-surface-2",
        ghost: "border-transparent bg-transparent text-ink hover:bg-surface-2",
        danger: "border-danger bg-transparent text-danger hover:bg-danger/10",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3",
        lg: "h-10 px-4 text-base",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Em andamento: desabilita e troca o ícone por um anel girando, mantendo o
   * rótulo e a largura — o botão não "pula" enquanto a ação roda.
   */
  pending?: boolean;
  /**
   * Confirmação no próprio botão (M9): verde, com um ✓ que se desenha e
   * "Salvo" (ou o texto passado). Quem usa passa `done={false}` desde o início
   * para o botão já nascer com a largura das duas versões e não pular. Ver
   * `useSavedFlash`.
   */
  done?: boolean | string;
}

export function Button({ className, variant, size, asChild = false, pending = false, done, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  if (asChild) return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props}>{children}</Comp>;
  if (done !== undefined) {
    const on = Boolean(done) && !pending;
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          on && "border-state-won bg-state-won text-surface hover:bg-state-won disabled:opacity-100",
          className,
        )}
        disabled={disabled || pending || on}
        aria-busy={pending || undefined}
        {...props}
      >
        <span className="grid [&>*]:[grid-area:1/1]">
          <span className={cn("inline-flex items-center justify-center gap-1.5", on && "invisible")}>
            {pending ? <Spinner className="size-3.5" /> : null}
            {children}
          </span>
          <span className={cn("inline-flex items-center justify-center gap-1.5", !on && "invisible")} aria-hidden={!on}>
            <Check className={on ? "draw-check" : undefined} strokeWidth={2.5} aria-hidden />
            {typeof done === "string" ? done : "Salvo"}
          </span>
        </span>
      </Comp>
    );
  }
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending ? <Spinner className="size-3.5" /> : null}
      {children}
    </Comp>
  );
}

export { buttonVariants };

/**
 * Liga o `done` do Button por 1,4 s depois de um salvamento que deu certo:
 * `const [saved, flashSaved] = useSavedFlash();` … `if (res.ok) flashSaved();`
 * … `<Button done={saved}>Salvar</Button>`.
 */
export function useSavedFlash(ms = 1400): [boolean, () => void] {
  const [on, setOn] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  const flash = React.useCallback(() => {
    window.clearTimeout(timer.current);
    setOn(true);
    timer.current = window.setTimeout(() => setOn(false), ms);
  }, [ms]);
  return [on, flash];
}
