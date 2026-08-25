// src/vistas/VistaLogin.tsx
import React, { useState } from "react";
import { useEstadoTrabajadores, type Trabajador } from "../estado/estadoTrabajadores";
import { Store, Shield, Briefcase, ArrowLeft, Lock, Mail, CheckCircle2 } from "lucide-react";
import { cn } from "../utilidades/utils";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";

export default function VistaLogin() {
  const { trabajadores, iniciarSesion } = useEstadoTrabajadores();
  const { nombreTienda, correoDueno } = useEstadoConfiguracion();
  
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Trabajador | null>(null);
  const [pinIngresado, setPinIngresado] = useState("");
  const [errorLogin, setErrorLogin] = useState(false);
  const [recuperacion, setRecuperacion] = useState(false);
  const [correo, setCorreo] = useState(correoDueno);
  const [correoEnviado, setCorreoEnviado] = useState(false);

  const usuariosActivos = trabajadores.filter(t => t.activo);

  const manejarEnvioPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioSeleccionado) return;

    const exito = iniciarSesion(usuarioSeleccionado.id, pinIngresado);
    if (!exito) {
      setErrorLogin(true);
      setPinIngresado("");
      setTimeout(() => setErrorLogin(false), 2000);
    }
  };

  const manejarRegreso = () => {
    setUsuarioSeleccionado(null);
    setPinIngresado("");
    setErrorLogin(false);
  };

  const solicitarRecuperacion = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!correo.trim()) return;
    setCorreoEnviado(true);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-emerald-50/30 dark:bg-slate-950 p-4">
      <div className="mb-8 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
          <Store size={32} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{nombreTienda}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Sistema de Gestión Punto de Venta v1.0</p>
      </div>

      <div className="efecto-cristal w-full max-w-md bg-white/80 dark:bg-slate-900/80 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/50 dark:border-white/10 relative overflow-hidden">
        
        {/* Vista 1: Selección de cuenta */}
        {recuperacion ? (
          <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <button onClick={() => { setRecuperacion(false); setCorreoEnviado(false); }} className="self-start p-2 -ml-2 mb-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft size={20} /></button>
            <Mail size={38} className="mb-3 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Restaurar acceso</h2>
            {correoEnviado ? <p className="mt-3 flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 size={17} /> Solicitud preparada para {correo}.</p> : <form onSubmit={solicitarRecuperacion} className="mt-4 space-y-3"><input type="email" required value={correo} onChange={(evento) => setCorreo(evento.target.value)} placeholder="Correo del dueño" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-slate-900" /><button className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white">Enviar enlace</button><p className="text-xs text-slate-500">El envío se conectará a Supabase Auth cuando se configure el proyecto.</p></form>}
          </div>
        ) : !usuarioSeleccionado ? (
          <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Selecciona tu cuenta</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Elige el perfil con el que deseas ingresar</p>
            
            <div className="flex flex-col gap-3">
              {usuariosActivos.map((usuario) => (
                <button
                  key={usuario.id}
                  onClick={() => setUsuarioSeleccionado(usuario)}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all text-left group"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-sm transition-transform group-hover:scale-105",
                    usuario.rol === "DUEÑO" ? "bg-purple-500" : "bg-blue-500"
                  )}>
                    {usuario.nombre.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{usuario.nombre}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                      {usuario.rol === "DUEÑO" ? <Shield size={12} className="text-purple-500" /> : <Briefcase size={12} className="text-blue-500" />}
                      <span className={cn(usuario.rol === "DUEÑO" ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400")}>
                        {usuario.rol === "DUEÑO" ? "Dueño" : "Trabajador"}
                      </span>
                    </div>
                  </div>
                  <div className="text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors">
                    <ArrowLeft size={20} className="rotate-180" />
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setRecuperacion(true)} className="mt-5 text-center text-xs font-semibold text-emerald-600 hover:underline">¿Olvidaste tu PIN?</button>
          </div>
        ) : (
          /* Vista 2: Ingreso de PIN */
          <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <button onClick={manejarRegreso} className="self-start p-2 -ml-2 mb-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft size={20} />
            </button>
            
            <div className="flex flex-col items-center text-center mb-6">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-white text-2xl shadow-md mb-3",
                usuarioSeleccionado.rol === "DUEÑO" ? "bg-purple-500" : "bg-blue-500"
              )}>
                {usuarioSeleccionado.nombre.substring(0, 2).toUpperCase()}
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{usuarioSeleccionado.nombre}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Ingresa tu PIN de seguridad</p>
            </div>

            <form onSubmit={manejarEnvioPin} className="flex flex-col gap-4">
              <div className="relative flex items-center justify-center">
                <Lock className="absolute left-4 text-slate-400" size={20} />
                <input
                  type="password"
                  autoFocus
                  required
                  value={pinIngresado}
                  onChange={(e) => { setPinIngresado(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setErrorLogin(false); }}
                  className={cn(
                    "w-full text-center tracking-[0.5em] text-2xl font-mono bg-slate-50 dark:bg-slate-900 border rounded-2xl py-4 outline-none focus:ring-2 transition-colors text-slate-900 dark:text-slate-100",
                    errorLogin 
                      ? "border-red-500 focus:ring-red-500 text-red-600 animate-in shake" 
                      : "border-slate-200 dark:border-white/10 focus:ring-emerald-500"
                  )}
                  placeholder="••••"
                  maxLength={6}
                  pattern="[A-Za-z]{2}[0-9]{4}"
                />
              </div>
              
              {errorLogin && (
                <p className="text-red-500 text-sm text-center font-medium animate-in fade-in">PIN incorrecto. Inténtalo de nuevo.</p>
              )}

              <button type="submit" className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]">
                Ingresar al Sistema
              </button>
            </form>
          </div>
        )}
      </div>
      
      <p className="mt-8 text-xs text-slate-400 dark:text-slate-500 font-medium">
        &copy; {new Date().getFullYear()} Mi Tienda - Todos los derechos reservados.
      </p>
    </div>
  );
}