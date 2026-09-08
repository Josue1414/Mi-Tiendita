// src/vistas/VistaEquipo.tsx
import React, { useEffect, useState } from "react";
import { useEstadoTrabajadores, type RolTrabajador } from "../estado/estadoTrabajadores";
import { Users, UserPlus } from "lucide-react";
import TarjetaTrabajador from "../componentes/equipo/TarjetaTrabajador";
import { useEstadoAsistencias } from "../estado/estadoAsistencias";

export default function VistaEquipo() {
  const { trabajadores, trabajadorActivo, agregarTrabajador } = useEstadoTrabajadores();
  const cargarAsistencias = useEstadoAsistencias((estado) => estado.cargarAsistencias);
  
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<RolTrabajador>("TRABAJADOR");
  const [pin, setPin] = useState("");

  useEffect(() => {
    cargarAsistencias();
  }, [cargarAsistencias]);

  const manejarGuardado = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !/^[A-Za-z]{2}\d{4}$/.test(pin)) {
      alert("El PIN debe tener 2 letras y 4 números, por ejemplo: AB1234.");
      return;
    }
    if (trabajadores.length >= 4) return;

    agregarTrabajador({
      id: crypto.randomUUID(),
      nombre,
      rol,
      pin,
      activo: true,
      ventasRealizadas: 0,
      ingresosGenerados: 0,
      fechaIngreso: new Date().toISOString().split("T")[0],
      permisos: {
        editarProductos: false,
        eliminarProductos: false,
        actualizarStockCodigo: false,
        cambiarHorarios: false,
        hacerCancelaciones: rol === "SUPERVISOR",
        cambiarInfoTicket: false,
        cambiarPrecios: false,
        verSalarios: false // <-- Por defecto en falso
      },
      horarioSemanal: {
        tipo: "GENERAL",
        diasTrabajo: [1,2,3,4,5],
        general: { entrada: "09:00", salida: "18:00" },
        especifico: {}
      }
    });

    setNombre("");
    setPin("");
    setRol("TRABAJADOR");
  };

  // REGLA: Si el usuario activo es SUPERVISOR, ocultamos la tarjeta del DUEÑO.
  const trabajadoresVisibles = trabajadores.filter((t) => {
    if (trabajadorActivo?.rol === "SUPERVISOR") {
      return t.rol !== "DUENO";
    }
    return true;
  });

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-6 p-6 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      
      {/* Columna Izquierda: Lista de Equipo */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="mb-2">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Users size={24} />
            </div>
            Gestión de Equipo
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Administra los accesos, horarios, y revisa el rendimiento de tus trabajadores.
          </p>
        </div>

        <div className="flex flex-col gap-4 max-w-3xl">
          {trabajadoresVisibles.map((trabajador) => (
            <TarjetaTrabajador key={trabajador.id} trabajador={trabajador} />
          ))}
        </div>
      </div>

      {/* Columna Derecha: Formulario de Registro */}
      {trabajadorActivo?.rol === "DUENO" && (
        <div className="w-full lg:w-[320px] shrink-0">
          <div className="efecto-cristal rounded-2xl p-5 border border-slate-200/50 dark:border-white/10 sticky top-0">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-100">
              <UserPlus size={20} className="text-emerald-600 dark:text-emerald-400" />
              Nuevo Trabajador
            </h2>

            <form onSubmit={manejarGuardado} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo *</label>
                <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm transition-colors" placeholder="Ej: Juan Pérez" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Rol en el sistema</label>
                <select value={rol} onChange={(e) => setRol(e.target.value as RolTrabajador)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm transition-colors">
                  <option value="TRABAJADOR">Trabajador (Solo ventas)</option>
                  <option value="SUPERVISOR">Supervisor (Admin. con restricciones)</option>
                  <option value="DUENO">Dueño (Acceso total)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">PIN de Acceso (Min. 4 dígitos) *</label>
                <input type="password" required minLength={6} maxLength={6} pattern="[A-Za-z]{2}[0-9]{4}" value={pin} onChange={(e) => setPin(e.target.value)} className="w-full text-center font-mono tracking-widest text-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 transition-colors" placeholder="AB1234" />
                <p className="text-[10px] text-slate-500 mt-1 text-center">Este código se usará para iniciar sesión.</p>
              </div>
              <button type="submit" disabled={trabajadores.length >= 4} className="w-full mt-2 flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all shadow-md shadow-emerald-600/30 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50">
                Registrar
              </button>
              {trabajadores.length >= 4 && <p className="text-center text-xs font-semibold text-amber-600">Límite máximo de 4 trabajadores alcanzado.</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}