import React, { useState, useEffect } from "react";
import { useEstadoTrabajadores, type Trabajador } from "../estado/estadoTrabajadores";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { useEstadoAsistencias } from "../estado/estadoAsistencias";
import { Store, Shield, Briefcase, ArrowLeft, Lock, UserCircle, Globe, WifiOff, Eye, EyeOff, LogOut, KeyRound } from "lucide-react";
import { cn } from "../utilidades/utils";
import { supabase } from "../servicios/supabase";

export default function VistaLogin() {
  const { trabajadores, iniciarSesion } = useEstadoTrabajadores();
  const { nombreTienda } = useEstadoConfiguracion();
  const { registrarEntrada } = useEstadoAsistencias();
  
  const [cuentaSaaSLogueada, setCuentaSaaSLogueada] = useState(false);
  const [emailSaaS, setEmailSaaS] = useState("");
  const [passwordSaaS, setPasswordSaaS] = useState("");
  const [cargandoSaaS, setCargandoSaaS] = useState(false);
  const [errorSaaS, setErrorSaaS] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");
  const [modoOfflineInfo, setModoOfflineInfo] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false); 
  const [modoRecuperacion, setModoRecuperacion] = useState(false);

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Trabajador | null>(null);
  const [pinIngresado, setPinIngresado] = useState("");
  const [errorLogin, setErrorLogin] = useState(false);
  const [mostrarPin, setMostrarPin] = useState(false); 

  const usuariosActivos = trabajadores.filter(t => t.activo);

  useEffect(() => {
    const validarSesionPrevia = async () => {
      if (window.apiLocal && !navigator.onLine) {
        setModoOfflineInfo(true);
        const validacion = await window.apiLocal.validarSuscripcionOffline();
        if (validacion.activo) {
          setCuentaSaaSLogueada(true); 
        } else {
          setErrorSaaS(validacion.error || "Sin acceso. Conéctate a internet.");
        }
        return;
      }

      if (navigator.onLine) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setCuentaSaaSLogueada(true);
        }
      }
    };
    validarSesionPrevia();
  }, []);

  const manejarLoginSaaS = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargandoSaaS(true);
    setErrorSaaS("");
    setMensajeExito("");
    
    try {
      if (!navigator.onLine) throw new Error("No hay conexión a internet para validar el pago.");

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailSaaS,
        password: passwordSaaS,
      });
      if (authError) throw authError;

      const { data: miembroData, error: miembroError } = await supabase
        .from('miembros_tienda')
        .select('tiendas(id, fecha_vencimiento, max_dispositivos)')
        .eq('usuario_id', authData.user?.id)
        .single();
      
      if (miembroError || !miembroData) throw new Error("No tienes una tienda vinculada.");

      const tienda = (miembroData.tiendas as any);

      const fechaVencimientoNube = new Date(tienda.fecha_vencimiento).getTime();
      if (new Date().getTime() > fechaVencimientoNube) {
        throw new Error("Tu suscripción ha vencido. Por favor realiza tu pago.");
      }

      if (window.apiLocal) {
        const hwid = await window.apiLocal.obtenerHardwareId();
        
        const { data: dispositivos, error: dispError } = await supabase
          .from('dispositivos_vinculados')
          .select('hardware_id')
          .eq('tienda_id', tienda.id);

        if (!dispError && dispositivos) {
          const yaRegistrado = dispositivos.some(d => d.hardware_id === hwid);
          if (!yaRegistrado) {
            if (dispositivos.length >= tienda.max_dispositivos) {
              throw new Error(`Has alcanzado el límite de ${tienda.max_dispositivos} PC(s) permitidas en tu plan.`);
            } else {
              await supabase.from('dispositivos_vinculados').insert([{
                tienda_id: tienda.id,
                hardware_id: hwid,
                nombre_dispositivo: 'PC Local'
              }]);
            }
          } else {
            await supabase.from('dispositivos_vinculados').update({ ultimo_acceso: new Date().toISOString() })
              .eq('tienda_id', tienda.id).eq('hardware_id', hwid);
          }
        }

        await window.apiLocal.sincronizarReloj(tienda.fecha_vencimiento);
      }

      setCuentaSaaSLogueada(true);

    } catch (err: any) {
      setErrorSaaS(err.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : err.message);
      await supabase.auth.signOut();
    } finally {
      setCargandoSaaS(false);
    }
  };

  const manejarRecuperacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargandoSaaS(true);
    setErrorSaaS("");
    setMensajeExito("");

    try {
      if (!navigator.onLine) throw new Error("No hay conexión a internet para esta acción.");
      
      const { error } = await supabase.auth.resetPasswordForEmail(emailSaaS);
      if (error) throw error;
      
      setMensajeExito("Se ha enviado un correo con las instrucciones para recuperar tu contraseña.");
      setTimeout(() => setModoRecuperacion(false), 4000);
    } catch (err: any) {
      setErrorSaaS(err.message);
    } finally {
      setCargandoSaaS(false);
    }
  };

  const manejarEnvioPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioSeleccionado) return;

    const exito = iniciarSesion(usuarioSeleccionado.id, pinIngresado);
    if (!exito) {
      setErrorLogin(true);
      setPinIngresado("");
      setTimeout(() => setErrorLogin(false), 2000);
    } else {
      await registrarEntrada(usuarioSeleccionado.id);
    }
  };

  const manejarRegresoPIN = () => {
    setUsuarioSeleccionado(null);
    setPinIngresado("");
    setErrorLogin(false);
    setMostrarPin(false);
  };

  const manejarRegresoCuenta = async () => {
    if (navigator.onLine) await supabase.auth.signOut();
    setCuentaSaaSLogueada(false);
    setEmailSaaS("");
    setPasswordSaaS("");
    setModoOfflineInfo(false);
    setMostrarPassword(false);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-emerald-50/30 dark:bg-slate-950 p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-gradient-to-b from-emerald-600/10 to-transparent -z-10 pointer-events-none"></div>

      <div className="mb-8 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 z-10">
        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-600/30">
          {cuentaSaaSLogueada ? <Store size={32} /> : <Globe size={32} />}
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight text-center">
          {cuentaSaaSLogueada ? nombreTienda : "Bienvenido a Mi Tienda"}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center font-medium px-4">
          {cuentaSaaSLogueada ? "Selecciona tu usuario de caja" : "Inicia sesión en tu cuenta para acceder a tu sucursal."}
        </p>
      </div>

      <div className="efecto-cristal w-full max-w-md bg-white/90 dark:bg-slate-900/90 rounded-[2rem] p-6 md:p-8 shadow-2xl border border-slate-200/50 dark:border-white/10 relative overflow-hidden z-10">
        
        {!cuentaSaaSLogueada ? (
          modoRecuperacion ? (
            <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
              <button onClick={() => { setModoRecuperacion(false); setErrorSaaS(""); setMensajeExito(""); }} className="self-start p-2 -ml-2 mb-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <KeyRound className="text-emerald-600" /> Recuperar Contraseña
              </h2>
              <p className="text-xs text-slate-500 mb-6">Ingresa el correo electrónico asociado a tu cuenta y te enviaremos un enlace para restablecerla.</p>
              
              <form onSubmit={manejarRecuperacion} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Correo Electrónico</label>
                  <input type="email" required autoFocus value={emailSaaS} onChange={(e) => setEmailSaaS(e.target.value)} disabled={modoOfflineInfo} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all disabled:opacity-50" placeholder="admin@mitienda.com" />
                </div>

                {errorSaaS && (
                  <p className="text-red-500 text-xs font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                    {errorSaaS}
                  </p>
                )}
                {mensajeExito && (
                  <p className="text-emerald-600 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                    {mensajeExito}
                  </p>
                )}

                <button type="submit" disabled={cargandoSaaS || modoOfflineInfo} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base py-3.5 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 flex justify-center items-center gap-2">
                  {cargandoSaaS ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Enviando...</> : "Enviar Instrucciones"}
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col animate-in fade-in slide-in-from-left-4 duration-300">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2"><UserCircle className="text-emerald-600" /> Cuenta Admin</span>
                {modoOfflineInfo && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md"><WifiOff size={12} /> Offline</span>}
              </h2>
              
              <form onSubmit={manejarLoginSaaS} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Correo Electrónico</label>
                  <input type="email" required autoFocus value={emailSaaS} onChange={(e) => setEmailSaaS(e.target.value)} disabled={modoOfflineInfo} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all disabled:opacity-50" placeholder="admin@mitienda.com" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Contraseña</label>
                  <div className="relative">
                    <input 
                      type={mostrarPassword ? "text" : "password"} 
                      required 
                      value={passwordSaaS} 
                      onChange={(e) => setPasswordSaaS(e.target.value)} 
                      disabled={modoOfflineInfo} 
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all disabled:opacity-50" 
                      placeholder="••••••••" 
                    />
                    <button 
                      type="button"
                      onClick={() => setMostrarPassword(!mostrarPassword)}
                      disabled={modoOfflineInfo}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                    >
                      {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {errorSaaS && (
                  <p className="text-red-500 text-xs font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                    {errorSaaS}
                  </p>
                )}

                <button type="submit" disabled={cargandoSaaS || modoOfflineInfo} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base py-3.5 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 flex justify-center items-center gap-2">
                  {cargandoSaaS ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Conectando...</> : "Iniciar Sesión"}
                </button>

                <div className="text-center mt-4">
                  <button type="button" onClick={() => { setModoRecuperacion(true); setErrorSaaS(""); }} disabled={modoOfflineInfo} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors disabled:opacity-50">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </form>
            </div>
          )
        ) 
        : !usuarioSeleccionado ? (
          <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Selecciona tu usuario</h2>
              <button onClick={manejarRegresoCuenta} className="text-xs font-semibold text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors">
                <LogOut size={14} /> Cerrar Sesión
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              {usuariosActivos.map((usuario) => (
                <button key={usuario.id} onClick={() => setUsuarioSeleccionado(usuario)} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all text-left group bg-white dark:bg-slate-900 shadow-sm">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-inner transition-transform group-hover:scale-105", usuario.rol === "DUEÑO" ? "bg-purple-500" : "bg-blue-500")}>
                    {usuario.nombre.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{usuario.nombre}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                      {usuario.rol === "DUEÑO" ? <Shield size={12} className="text-purple-500" /> : <Briefcase size={12} className="text-blue-500" />}
                      <span className={cn(usuario.rol === "DUEÑO" ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400")}>{usuario.rol === "DUEÑO" ? "Dueño" : "Trabajador"}</span>
                    </div>
                  </div>
                  <div className="text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors">
                    <ArrowLeft size={20} className="rotate-180" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
            <button onClick={manejarRegresoPIN} className="self-start p-2 -ml-2 mb-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><ArrowLeft size={20} /></button>
            <div className="flex flex-col items-center text-center mb-8">
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-white text-2xl shadow-lg mb-4 ring-4 ring-white dark:ring-slate-900", usuarioSeleccionado.rol === "DUEÑO" ? "bg-purple-500" : "bg-blue-500")}>{usuarioSeleccionado.nombre.substring(0, 2).toUpperCase()}</div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{usuarioSeleccionado.nombre}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ingresa tu PIN de seguridad</p>
            </div>
            <form onSubmit={manejarEnvioPin} className="flex flex-col gap-4">
              <div className="relative flex items-center justify-center">
                <Lock className="absolute left-5 text-slate-400" size={20} />
                <input 
                  type={mostrarPin ? "text" : "password"} 
                  autoFocus 
                  required 
                  value={pinIngresado} 
                  onChange={(e) => { setPinIngresado(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setErrorLogin(false); }} 
                  className={cn("w-full text-center tracking-[0.5em] text-2xl font-mono bg-slate-50 dark:bg-slate-950 border-2 rounded-2xl py-4 pr-12 outline-none focus:ring-4 transition-all text-slate-900 dark:text-slate-100 placeholder:tracking-normal", errorLogin ? "border-red-500 focus:ring-red-500/20 text-red-600 animate-in shake bg-red-50/50 dark:bg-red-900/10" : "border-slate-200 dark:border-white/10 focus:border-emerald-500 focus:ring-emerald-500/20")} 
                  placeholder="••••" 
                  maxLength={6} 
                  pattern="[A-Za-z]{2}[0-9]{4}" 
                />
                <button 
                  type="button"
                  onClick={() => setMostrarPin(!mostrarPin)}
                  className="absolute right-5 text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  {mostrarPin ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errorLogin && <p className="text-red-500 text-sm text-center font-medium animate-in fade-in">PIN incorrecto. Inténtalo de nuevo.</p>}
              <button type="submit" className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]">Ingresar al Sistema</button>
            </form>
          </div>
        )}
      </div>
      <p className="mt-8 text-xs text-slate-400 dark:text-slate-500 font-medium z-10 text-center">&copy; {new Date().getFullYear()} Mi Tienda Software. <br className="sm:hidden" /> Todos los derechos reservados.</p>
    </div>
  );
}