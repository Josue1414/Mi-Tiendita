// src/vistas/VistaConfiguracion.tsx
import React, { useState } from "react";
import { Lock, Crown, Type } from "lucide-react"; 
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoPlan } from "../estado/estadoPlan"; 
import ModalAviso from "../componentes/ui/ModalAviso";

import SeccionHardware from "./secciones_configuracion/SeccionHardware";
import SeccionRed from "./secciones_configuracion/SeccionRed";
import SeccionAdministracion from "./secciones_configuracion/SeccionAdministracion";

export interface PropsSeccionConfig {
  setAviso: React.Dispatch<React.SetStateAction<{ titulo: string; mensaje: string } | null>>;
}

export default function VistaConfiguracion() {
  const { trabajadorActivo } = useEstadoTrabajadores();
  const planActivo = useEstadoPlan((estado) => estado.planActivo); 
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string } | null>(null);

  // NUEVO: Manejo del estado local para la escala seleccionada
  const [escalaActual, setEscalaActual] = useState(() => localStorage.getItem("escala_ui") || "normal");

  const esDueño = trabajadorActivo?.rol === "DUENO";

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

  // Función para guardar y disparar el evento global de redimensionamiento
  const cambiarEscala = (escala: string) => {
    setEscalaActual(escala);
    localStorage.setItem("escala_ui", escala);
    window.dispatchEvent(new CustomEvent("CAMBIAR_ESCALA_UI", { detail: escala }));
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

      {/* NUEVO: Tarjeta de Apariencia Global */}
      <div className="mb-6 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl">
            <Type size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Tamaño de la Interfaz</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ajusta el tamaño global de las letras y botones de la aplicación.</p>
          </div>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button 
            onClick={() => cambiarEscala("chica")} 
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${escalaActual === "chica" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Chica
          </button>
          <button 
            onClick={() => cambiarEscala("normal")} 
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${escalaActual === "normal" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Normal
          </button>
          <button 
            onClick={() => cambiarEscala("grande")} 
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${escalaActual === "grande" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}
          >
            Grande
          </button>
        </div>
      </div>

      <SeccionHardware setAviso={setAviso} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        <SeccionRed setAviso={setAviso} />
        <SeccionAdministracion setAviso={setAviso} />
      </div>
    </div>
  );
}