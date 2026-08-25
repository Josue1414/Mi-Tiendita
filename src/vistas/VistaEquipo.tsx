// src/vistas/VistaEquipo.tsx
import React, { useState } from "react";
import { useEstadoTrabajadores, type RolTrabajador } from "../estado/estadoTrabajadores";
import { Users, UserPlus, Shield, Briefcase, DollarSign, TrendingUp, Power, CalendarDays, ChevronDown, ShieldCheck } from "lucide-react";
import { cn } from "../utilidades/utils";
import { useEstadoVentas } from "../estado/estadoVentas";

export default function VistaEquipo() {
  const { trabajadores, agregarTrabajador, actualizarTrabajador, toggleActivo, trabajadorActivo } = useEstadoTrabajadores();
  const { ventas } = useEstadoVentas();
  
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<RolTrabajador>("TRABAJADOR");
  const [pin, setPin] = useState("");
  const [tarjetaAbierta, setTarjetaAbierta] = useState<string | null>(null);

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
    });

    setNombre("");
    setPin("");
    setRol("TRABAJADOR");
  };

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
            Administra los accesos y revisa el rendimiento de tus trabajadores.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {trabajadores.map((trabajador) => (
            <div 
              key={trabajador.id} 
              className={cn(
                "efecto-cristal p-5 rounded-2xl flex flex-col gap-4 border transition-opacity",
                trabajador.activo ? "border-slate-200/50 dark:border-white/10" : "opacity-60 border-slate-200 dark:border-slate-800"
              )}
            >
              <div role="button" tabIndex={0} onClick={() => setTarjetaAbierta((actual) => actual === trabajador.id ? null : trabajador.id)} onKeyDown={(evento) => { if (evento.key === "Enter" || evento.key === " ") setTarjetaAbierta((actual) => actual === trabajador.id ? null : trabajador.id); }} className="flex w-full cursor-pointer justify-between items-start text-left">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                    trabajador.rol === "DUEÑO" ? "bg-purple-500" : "bg-blue-500",
                    !trabajador.activo && "grayscale"
                  )}>
                    {trabajador.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 leading-none">{trabajador.nombre}</h3>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 font-medium">
                      {trabajador.rol === "DUEÑO" ? <Shield size={12} className="text-purple-500" /> : <Briefcase size={12} className="text-blue-500" />}
                      {trabajador.rol}
                    </div>
                  </div>
                </div>
                
                {/* Evitar que el dueño en sesión se desactive a sí mismo */}
                {trabajadorActivo?.id !== trabajador.id && (
                  <button 
                    onClick={() => toggleActivo(trabajador.id)}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      trabajador.activo 
                        ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400" 
                        : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
                    )}
                    title={trabajador.activo ? "Desactivar acceso" : "Reactivar acceso"}
                  >
                    <Power size={16} />
                  </button>
                )}
                <ChevronDown size={18} className={cn("text-slate-400 transition-transform", tarjetaAbierta === trabajador.id && "rotate-180")} />
              </div>
              {tarjetaAbierta === trabajador.id && (
                <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-white/5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="text-slate-500">PIN visible para dueño
                      <input readOnly={trabajadorActivo?.rol !== "DUEÑO"} defaultValue={trabajadorActivo?.rol === "DUEÑO" ? trabajador.pin : "••••••"} maxLength={6} pattern="[A-Za-z]{2}[0-9]{4}" onBlur={(evento) => { const nuevoPin = evento.target.value.toUpperCase(); if (trabajadorActivo?.rol === "DUEÑO" && /^[A-Z]{2}\d{4}$/.test(nuevoPin) && nuevoPin !== trabajador.pin) actualizarTrabajador({ ...trabajador, pin: nuevoPin }); else evento.target.value = trabajador.pin; }} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono font-bold dark:border-white/10 dark:bg-slate-900" />
                    </label>
                    <label className="text-slate-500">Horario
                      <input defaultValue={trabajador.horario || "09:00 - 18:00"} onBlur={(evento) => actualizarTrabajador({ ...trabajador, horario: evento.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-white/10 dark:bg-slate-900" />
                    </label>
                  </div>
                  <div>
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500"><CalendarDays size={14} /> Días de descanso</p>
                    <div className="grid grid-cols-7 gap-1">
                      {["D", "L", "M", "X", "J", "V", "S"].map((dia, indice) => {
                        const activo = (trabajador.diasDescanso || []).includes(indice);
                        return <button key={dia} onClick={() => actualizarTrabajador({ ...trabajador, diasDescanso: activo ? (trabajador.diasDescanso || []).filter((actual) => actual !== indice) : [...(trabajador.diasDescanso || []), indice] })} className={cn("rounded-md py-1 text-[10px] font-bold", activo ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "bg-slate-100 text-slate-500 dark:bg-slate-800")}>{dia}</button>;
                      })}
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2 text-xs dark:bg-amber-950/20">
                    <span className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300"><ShieldCheck size={13} /> Ventas con autorización</span>
                    <span className="text-slate-600 dark:text-slate-300">{ventas.filter((venta) => venta.trabajador === trabajador.nombre && venta.articulos.some((articulo) => articulo.autorizacion_confirmada)).length} ventas registradas</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-2 pt-4 border-t border-slate-100 dark:border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1 font-bold">
                    <TrendingUp size={12} /> Ventas
                  </span>
                  <span className="text-lg font-bold text-slate-700 dark:text-slate-300">{trabajador.ventasRealizadas}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1 font-bold">
                    <DollarSign size={12} /> Ingresos
                  </span>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${trabajador.ingresosGenerados.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Columna Derecha: Formulario de Registro */}
      <div className="w-full lg:w-[320px] shrink-0">
        <div className="efecto-cristal rounded-2xl p-5 border border-slate-200/50 dark:border-white/10 sticky top-0">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-slate-900 dark:text-slate-100">
            <UserPlus size={20} className="text-emerald-600 dark:text-emerald-400" />
            Nuevo Trabajador
          </h2>

          <form onSubmit={manejarGuardado} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo *</label>
              <input 
                type="text" 
                required 
                value={nombre} 
                onChange={(e) => setNombre(e.target.value)} 
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm" 
                placeholder="Ej: Juan Pérez" 
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Rol en el sistema</label>
              <select 
                value={rol} 
                onChange={(e) => setRol(e.target.value as RolTrabajador)} 
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm"
              >
                <option value="TRABAJADOR">Trabajador (Solo ventas)</option>
                <option value="DUEÑO">Dueño (Acceso total)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">PIN de Acceso (Min. 4 dígitos) *</label>
                <input 
                type="password" 
                required 
                minLength={6}
                maxLength={6}
                pattern="[A-Za-z]{2}[0-9]{4}"
                value={pin} 
                onChange={(e) => setPin(e.target.value)} 
                className="w-full text-center font-mono tracking-widest text-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100" 
                placeholder="AB1234" 
              />
              <p className="text-[10px] text-slate-500 mt-1 text-center">Este código se usará para iniciar sesión.</p>
            </div>

            <button type="submit" disabled={trabajadores.length >= 4} className="w-full mt-2 flex justify-center items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all shadow-md shadow-emerald-600/30 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50">
              Registrar
            </button>
            {trabajadores.length >= 4 && <p className="text-center text-xs font-semibold text-amber-600">Límite máximo de 4 trabajadores alcanzado.</p>}
          </form>
        </div>
      </div>
    </div>
  );
}