import React, { useState } from "react";
import { Lock, Crown } from "lucide-react"; // <-- Importamos Crown para el badge del plan
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoPlan } from "../estado/estadoPlan"; // <-- IMPORTAMOS EL PLAN
import ModalAviso from "../componentes/ui/ModalAviso";

import SeccionHardware from "./secciones_configuracion/SeccionHardware";
import SeccionRed from "./secciones_configuracion/SeccionRed";
import SeccionAdministracion from "./secciones_configuracion/SeccionAdministracion";

export interface PropsSeccionConfig {
  setAviso: React.Dispatch<React.SetStateAction<{ titulo: string; mensaje: string } | null>>;
}

export default function VistaConfiguracion() {
  const { trabajadorActivo } = useEstadoTrabajadores();
  // <-- EXTRAEMOS EL PLAN ACTIVO -->
  const planActivo = useEstadoPlan((estado) => estado.planActivo); 
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string } | null>(null);

  const esDueño = trabajadorActivo?.rol === "DUENO";

  // <-- FUNCIÓN PARA DARLE ESTILO AL BADGE DEL PLAN -->
  const obtenerEstiloPlan = () => {
    switch(planActivo) {
      case 'PLUS':
        return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50";
      case 'ESTANDAR':
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50";
      case 'BASICO':
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      <ModalAviso 
        abierto={Boolean(aviso)} 
        titulo={aviso?.titulo ?? "Aviso"} 
        mensaje={aviso?.mensaje ?? ""} 
        tipo={aviso?.titulo === "Importación completada" ? "exito" : "advertencia"} 
        alCerrar={() => setAviso(null)} 
      />
      
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">Configuración del Sistema</h1>
            
            {/* <-- BADGE DEL PLAN ACTIVO --> */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${obtenerEstiloPlan()}`}>
              <Crown size={14} />
              PLAN {planActivo}
            </div>
          </div>
          
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ajusta preferencias locales, red LAN y almacenamiento.</p>
        </div>
      </div>

      {!esDueño && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800/30 flex items-center gap-3 text-amber-800 dark:text-amber-400">
          <Lock size={20} className="shrink-0" />
          <p className="text-sm font-bold">Modo de vista para Supervisor. Solo el Dueño puede modificar la configuración general.</p>
        </div>
      )}

      <SeccionHardware setAviso={setAviso} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        <SeccionRed setAviso={setAviso} />
        <SeccionAdministracion setAviso={setAviso} />
      </div>
    </div>
  );
}