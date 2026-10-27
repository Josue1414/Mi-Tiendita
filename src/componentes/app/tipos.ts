import type { LucideIcon } from "lucide-react";

export interface ItemMenuApp {
  id: string;
  icono: LucideIcon;
  texto: string;
}

export interface PropsAlertasMenu {
  alertasPorTerminar: number;
  alertasAgotados: number;
  alertasCaducadas: number;
}
