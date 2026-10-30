import { Columns3, MessagesSquare, Smartphone, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Só administradores da conta no Chatwoot veem (quem pareia controla o número). */
  adminOnly?: boolean;
};

/** A ordem é a do dia de trabalho: o quadro, as conversas, o número. */
export const NAV: NavItem[] = [
  { href: "/leads", label: "Leads", icon: Columns3 },
  { href: "/atendimentos", label: "Atendimentos", icon: MessagesSquare },
  { href: "/whatsapp", label: "WhatsApp", icon: Smartphone, adminOnly: true },
];
