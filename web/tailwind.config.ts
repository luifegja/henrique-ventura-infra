import type { Config } from "tailwindcss";

/**
 * Tokens do painel — decisão em docs/decisoes/2026-08-25-design-do-painel.md.
 * As cores vêm de variáveis CSS (app/globals.css) para o modo escuro trocar só
 * os valores. Raio de 4 px (direção A, 21/09), sombra só no que flutua: bordas fazem o trabalho.
 */
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--ink-muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-soft": "rgb(var(--accent-soft) / <alpha-value>)",
        "on-accent": "rgb(var(--on-accent) / <alpha-value>)",
        "accent-fill": "rgb(var(--accent-fill) / <alpha-value>)",
        "on-accent-fill": "rgb(var(--on-accent-fill) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        "state-ai": "rgb(var(--state-ai) / <alpha-value>)",
        "state-human": "rgb(var(--state-human) / <alpha-value>)",
        "state-won": "rgb(var(--state-won) / <alpha-value>)",
        "state-lost": "rgb(var(--state-lost) / <alpha-value>)",
        "state-abandoned": "rgb(var(--state-abandoned) / <alpha-value>)",
        spine: "rgb(var(--spine) / <alpha-value>)",
        "spine-ink": "rgb(var(--spine-ink) / <alpha-value>)",
        "spine-accent": "rgb(var(--spine-accent) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { DEFAULT: "4px", sm: "3px", md: "4px", lg: "6px" },
      transitionDuration: { 1: "var(--dur-1)", 2: "var(--dur-2)", 3: "var(--dur-3)" },
      transitionTimingFunction: { out: "var(--ease-out)" },
      // `backwards`, nunca `both`: com `both` o transform final (translateY(0)) fica
      // aplicado para sempre, e um ancestral com transform vira o bloco de contenção
      // de todo `position: fixed` dentro dele — o cartão arrastado do Kanban aparecia
      // deslocado pela largura da barra lateral (21/09).
      animation: {
        rise: "rise-in var(--dur-2) var(--ease-out) backwards",
        fade: "fade-in var(--dur-2) var(--ease-out) backwards",
        settle: "settle var(--dur-3) var(--ease-out) backwards",
        shimmer: "shimmer 1.6s linear infinite",
        "toast-in": "toast-in var(--dur-2) var(--ease-out) backwards",
        // 25/09 (docs/decisoes/2026-09-25-movimento-do-painel.md). As de saída usam
        // `forwards` porque o elemento é removido logo depois; nenhuma fica num contêiner.
        lift: "lift 140ms var(--ease-out) backwards",
        "toast-out": "toast-out var(--dur-2) var(--ease-out) forwards",
        collapse: "collapse-rows var(--dur-2) var(--ease-out) forwards",
        expand: "expand-rows var(--dur-2) var(--ease-out) backwards",
        "odo-in-up": "odo-in-up 220ms var(--ease-out) backwards",
        "odo-in-down": "odo-in-down 220ms var(--ease-out) backwards",
        "odo-out-up": "odo-out-up 220ms var(--ease-out) forwards",
        "odo-out-down": "odo-out-down 220ms var(--ease-out) forwards",
        "bubble-in": "bubble-in 200ms var(--ease-out) backwards",
        "dots-wave": "dots-wave 1.2s var(--ease-out) infinite",
        "ping-once": "ping-once 700ms var(--ease-out) forwards",
        // Rodada 2.
        "menu-in": "menu-in 140ms var(--ease-out) backwards",
        "menu-out": "menu-out 100ms var(--ease-out) forwards",
        "glow-once": "glow-once 800ms var(--ease-out) backwards",
      },
      boxShadow: { none: "none" },
      fontSize: {
        xs: ["12px", "16px"],
        sm: ["13px", "18px"],
        base: ["14px", "20px"],
        md: ["16px", "22px"],
        lg: ["20px", "26px"],
        xl: ["26px", "32px"],
      },
    },
  },
  plugins: [],
};

export default config;
