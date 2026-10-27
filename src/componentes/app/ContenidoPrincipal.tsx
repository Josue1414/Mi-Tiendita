import type { ComponentType } from "react";
import VistaPanel from "../../vistas/VistaPanel";

interface PropsContenidoPrincipal {
  seccionActual: string;
  componenteActivo: ComponentType;
  estaEnLinea: boolean;
  permiteNube: boolean;
  esMaestro: boolean;
  servidorLANActivo: boolean;
  conectadoLAN: boolean;
  dispositivosLANConectados: number;
}

export default function ContenidoPrincipal({
  seccionActual,
  componenteActivo: ComponenteActivo,
  estaEnLinea,
  permiteNube,
  esMaestro,
  servidorLANActivo,
  conectadoLAN,
  dispositivosLANConectados,
}: PropsContenidoPrincipal) {
  return (
    <main className="flex-1 h-full min-w-0 overflow-hidden flex flex-col p-3 pb-24 sm:p-6 sm:pb-24 lg:pb-6 bg-transparent">
      <div className="efecto-cristal w-full h-full rounded-3xl overflow-hidden relative shadow-sm border border-slate-200/50 dark:border-white/10 flex flex-col">
        {seccionActual === "panel" ? (
          <VistaPanel
            estaEnLinea={estaEnLinea}
            permiteNube={permiteNube}
            esMaestro={esMaestro}
            servidorLANActivo={servidorLANActivo}
            conectadoLAN={conectadoLAN}
            dispositivosLANConectados={dispositivosLANConectados}
          />
        ) : (
          <ComponenteActivo />
        )}
      </div>
    </main>
  );
}
