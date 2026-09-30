// src/vistas/VistaLogin.tsx
import React, { useState, useEffect } from "react";
import { useEstadoTrabajadores, type Trabajador } from "../estado/estadoTrabajadores";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { useEstadoAsistencias } from "../estado/estadoAsistencias";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoPlan } from "../estado/estadoPlan"; 
import { Store, Shield, ShieldCheck, Briefcase, ArrowLeft, Lock, UserCircle, Globe, WifiOff, Eye, EyeOff, LogOut, Laptop, Crown } from "lucide-react"; 
import { cn } from "../utilidades/utils";
import { supabase, registrarDispositivoActual } from "../servicios/supabase";
import VistaRecuperacionPassword from "./VistaRecuperacionPassword";
import ModalAviso from "../componentes/ui/ModalAviso"; 

const CLAVE_EMAIL_SAAS = "mi_tienda_remember_email";
const MOSTRAR_RECORDATORIO_HOY = true;

const evaluarEstadoSuscripcion = (fechaString: string | null) => {
  if (!fechaString) return "VENCIDO";
  const partes = fechaString.split('T')[0].split('-');
  if (partes.length !== 3) return "VIGENTE"; 
  
  const [year, month, day] = partes.map(Number);
  const vencimiento = new Date(year, month - 1, day);
  
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (hoy.getTime() > vencimiento.getTime()) return "VENCIDO";
  if (hoy.getTime() === vencimiento.getTime()) return "HOY";
  return "VIGENTE";
};

// NUEVA FUNCIÓN: Purga todos los datos en caché excepto la identificación de hardware
const limpiarCachesLocales = async () => {
  const hwid = localStorage.getItem('web_hardware_id');
  const nombrePC = localStorage.getItem('nombre_dispositivo_local');
  const emailSaaS = localStorage.getItem(CLAVE_EMAIL_SAAS);
  
  localStorage.clear();
  
  if (hwid) localStorage.setItem('web_hardware_id', hwid);
  if (nombrePC) localStorage.setItem('nombre_dispositivo_local', nombrePC);
  if (emailSaaS) localStorage.setItem(CLAVE_EMAIL_SAAS, emailSaaS);

  try {
    const { limpiarBaseDatosLocal } = await import('../servicios/baseDatosLocal');
    await limpiarBaseDatosLocal();
  } catch (e) {
    console.error("Error al limpiar IndexedDB", e);
  }
};

export default function VistaLogin() {
  const { trabajadores, iniciarSesion, cargarTrabajadores } = useEstadoTrabajadores();
  const { nombreTienda, cargarConfiguracion } = useEstadoConfiguracion();
  const { registrarEntrada, cargarAsistencias } = useEstadoAsistencias();
  const { cargarProductos } = useEstadoInventario();
  const { cargarVentas } = useEstadoVentas();
  
  const planActivo = useEstadoPlan((estado) => estado.planActivo);
  
  const [cuentaSaaSLogueada, setCuentaSaaSLogueada] = useState(false);
  const [emailSaaS, setEmailSaaS] = useState("");
  const [passwordSaaS, setPasswordSaaS] = useState("");
  const [cargandoSaaS, setCargandoSaaS] = useState(false);
  const [errorSaaS, setErrorSaaS] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");
  const [modoOfflineInfo, setModoOfflineInfo] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false); 
  const [modoRecuperacion, setModoRecuperacion] = useState(false);

  const [avisoSuscripcion, setAvisoSuscripcion] = useState<{ titulo: string; mensaje: string; tipo: "bloqueo" | "advertencia" } | null>(null);
  const [avisoRecordatorio, setAvisoRecordatorio] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [loginPendiente, setLoginPendiente] = useState<{ id: string, pin: string } | null>(null);

  const [nombrePC, setNombrePC] = useState(localStorage.getItem("nombre_dispositivo_local") || "");
  const [seleccionandoSucursal, setSeleccionandoSucursal] = useState(false);
  const [sucursalesDisponibles, setSucursalesDisponibles] = useState<any[]>([]);

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Trabajador | null>(null);
  const [pinIngresado, setPinIngresado] = useState("");
  const [errorMensaje, setErrorMensaje] = useState("");
  const [mostrarPin, setMostrarPin] = useState(false); 

  const usuariosActivos = trabajadores.filter(t => t.activo);

  useEffect(() => {
    const validarSesionPrevia = async () => {
      if (window.apiLocal && !navigator.onLine) {
        setModoOfflineInfo(true);
        const validacion = (await window.apiLocal.validarSuscripcionOffline()) as { activo: boolean; error?: string; fechaVencimiento?: string };
        if (validacion.activo) {
          setCuentaSaaSLogueada(true);
          useEstadoPlan.getState().cargarPlan('ESTANDAR', 5, 4, true, validacion.fechaVencimiento || null);
        } else {
          setAvisoSuscripcion({ 
            titulo: "Servicio Suspendido", 
            mensaje: "Tu periodo de suscripción ha finalizado. Por favor, realiza tu pago y recuerda mantener este equipo conectado a internet para que el sistema valide tu abono y restablezca el acceso.", 
            tipo: "bloqueo" 
          });
        }
        return;
      }

      if (!window.apiLocal && !navigator.onLine) {
        setModoOfflineInfo(true);
        const fechaLocal = localStorage.getItem('fecha_vencimiento_cache');
        const estado = evaluarEstadoSuscripcion(fechaLocal);
        
        if (estado === "VENCIDO") {
          setAvisoSuscripcion({ 
            titulo: "Servicio Suspendido", 
            mensaje: "Tu periodo de suscripción ha finalizado. Por favor, realiza tu pago y recuerda mantener este equipo conectado a internet para que el sistema valide tu abono y restablezca el acceso.", 
            tipo: "bloqueo" 
          });
          return;
        }
        
        if (fechaLocal) {
          setCuentaSaaSLogueada(true);
          useEstadoPlan.getState().cargarPlan('ESTANDAR', 5, 4, true, fechaLocal);
        }
        return;
      }

      if (navigator.onLine) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const tiendaId = localStorage.getItem("tienda_id");
          if (tiendaId) {
            const { data: tienda, error } = await supabase.from('tiendas').select('id, nombre, max_dispositivos, fecha_vencimiento, plan_id').eq('id', tiendaId).single();
            
            if (tienda && !error) {
              localStorage.setItem('fecha_vencimiento_cache', tienda.fecha_vencimiento);
              const estado = evaluarEstadoSuscripcion(tienda.fecha_vencimiento);

              if (estado === "VENCIDO") {
                await supabase.auth.signOut();
                localStorage.removeItem("tienda_id");
                setAvisoSuscripcion({ 
                  titulo: "Servicio Suspendido", 
                  mensaje: "Tu periodo de suscripción ha finalizado. Por favor, realiza tu pago y asegúrate de mantener tu dispositivo conectado a internet para que el sistema lo valide y restablezca el acceso a tu negocio.", 
                  tipo: "bloqueo" 
                });
                return; 
              }

              const planId = tienda.plan_id || 'ESTANDAR';
              const { data: planData } = await supabase.from('planes').select('*').eq('id', planId).single();
              if (planData) {
                useEstadoPlan.getState().cargarPlan(planData.id, planData.max_dispositivos, planData.max_usuarios, planData.permite_nube, tienda.fecha_vencimiento);
              }
              const registro = await registrarDispositivoActual(tienda);
              setNombrePC(registro.dispositivo.nombre_dispositivo);
              setCuentaSaaSLogueada(true);
            }
          }
        }
      }
    };

    validarSesionPrevia();
  }, []);

  const procesarSeleccionSucursal = async (tienda: any) => {
    setCargandoSaaS(true);
    setErrorSaaS("");

    try {
      localStorage.setItem('fecha_vencimiento_cache', tienda.fecha_vencimiento);
      const estado = evaluarEstadoSuscripcion(tienda.fecha_vencimiento);
      
      if (estado === "VENCIDO") {
        setAvisoSuscripcion({ 
          titulo: "Servicio Suspendido", 
          mensaje: "Tu periodo de suscripción ha finalizado. Por favor, realiza tu pago y asegúrate de mantener tu equipo conectado a internet para que el sistema lo valide y te permita el acceso.", 
          tipo: "bloqueo" 
        });
        setCargandoSaaS(false);
        return;
      }

      // CORREGIDO: Prevención de cruce de datos entre tiendas
      const tiendaAnterior = localStorage.getItem("tienda_id");
      if (tiendaAnterior && tiendaAnterior !== tienda.id) {
        await limpiarCachesLocales();
        localStorage.setItem("tienda_id", tienda.id);
        window.location.reload(); 
        return;
      }

      const planId = tienda.plan_id || 'ESTANDAR';
      const { data: planData } = await supabase.from('planes').select('*').eq('id', planId).single();
      
      if (planData) {
        let hwId = window.apiLocal ? await window.apiLocal.obtenerHardwareId() : (localStorage.getItem('web_hardware_id') || "");
        if (!window.apiLocal && !hwId) {
          hwId = "web-" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
          localStorage.setItem('web_hardware_id', hwId);
        }

        const { data: dispNube } = await supabase.from('dispositivos_vinculados').select('hardware_id').eq('tienda_id', tienda.id);
        const yaVinculado = dispNube?.some(d => d.hardware_id === hwId);

        if (!yaVinculado && (dispNube?.length || 0) >= planData.max_dispositivos) {
          throw new Error(`Límite de ${planData.max_dispositivos} PC(s) alcanzado en "${tienda.nombre}". Libera espacio desvinculando un equipo.`);
        }

        useEstadoPlan.getState().cargarPlan(planData.id, planData.max_dispositivos, planData.max_usuarios, planData.permite_nube, tienda.fecha_vencimiento);
      }

      const registroDispositivo = await registrarDispositivoActual({
        id: tienda.id,
        max_dispositivos: planData?.max_dispositivos || tienda.max_dispositivos, 
        nombre: tienda.nombre
      });
      setNombrePC(registroDispositivo.dispositivo.nombre_dispositivo);

      if (window.apiLocal) await window.apiLocal.sincronizarReloj(tienda.fecha_vencimiento);

      localStorage.setItem("tienda_id", tienda.id);

      await Promise.all([cargarConfiguracion(), cargarTrabajadores(), cargarProductos(), cargarVentas(), cargarAsistencias()]);

      setSeleccionandoSucursal(false);
      setCuentaSaaSLogueada(true);

    } catch (err: any) {
      setErrorSaaS(err.message);
      if (sucursalesDisponibles.length <= 1) await supabase.auth.signOut();
    } finally {
      setCargandoSaaS(false);
    }
  };

  const manejarLoginSaaS = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargandoSaaS(true);
    setErrorSaaS("");
    setMensajeExito("");

    try {
      if (!navigator.onLine) throw new Error("No hay conexión a internet para validar tu cuenta.");

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: emailSaaS, password: passwordSaaS });
      if (authError) throw authError;

      localStorage.setItem(CLAVE_EMAIL_SAAS, emailSaaS);

      const { data: miembrosData, error: miembroError } = await supabase
        .from('miembros_tienda')
        .select('tiendas(id, nombre, fecha_vencimiento, max_dispositivos, plan_id)')
        .eq('usuario_id', authData.user?.id)
        .eq('activo', true);

      if (miembroError || !miembrosData || miembrosData.length === 0) {
        throw new Error("No tienes ninguna tienda vinculada o tu acceso fue revocado.");
      }

      // CORREGIDO: Aplanamos y tipamos como any[] para resolver el error de TypeScript
      const tiendas = miembrosData.map(m => m.tiendas).flat().filter(Boolean) as any[];

      // CORREGIDO: Filtro de tiendas únicas para evitar el bug de duplicidad visual
      const tiendasUnicas = Array.from(new Map(tiendas.map(t => [t.id, t])).values());

      if (tiendasUnicas.length === 1) {
        await procesarSeleccionSucursal(tiendasUnicas[0]);
      } else {
        setSucursalesDisponibles(tiendasUnicas);
        setSeleccionandoSucursal(true);
        setCargandoSaaS(false);
      }
    } catch (err: any) {
      setErrorSaaS(err.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : err.message);
      await supabase.auth.signOut();
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

  const ejecutarLogin = async (id: string, pin: string) => {
    const exito = iniciarSesion(id, pin);
    if (!exito) {
      setErrorMensaje("PIN incorrecto. Inténtalo de nuevo.");
      setPinIngresado("");
      setTimeout(() => setErrorMensaje(""), 2000);
    } else {
      await registrarEntrada(id);
    }
  };

  const manejarEnvioPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioSeleccionado) return;

    const diaHoy = new Date().getDay();
    const diasTrabajo = usuarioSeleccionado.horarioSemanal?.diasTrabajo || [1, 2, 3, 4, 5];
    
    if (usuarioSeleccionado.rol === "TRABAJADOR" && !diasTrabajo.includes(diaHoy)) {
      setErrorMensaje("Hoy es tu día de descanso. Acceso denegado.");
      setPinIngresado("");
      setTimeout(() => setErrorMensaje(""), 4000);
      return;
    }

    const fechaGuardada = useEstadoPlan.getState().fechaVencimiento || localStorage.getItem('fecha_vencimiento_cache');
    const estadoSuscripcion = evaluarEstadoSuscripcion(fechaGuardada);

    if (MOSTRAR_RECORDATORIO_HOY && estadoSuscripcion === "HOY" && (usuarioSeleccionado.rol === "DUENO" || usuarioSeleccionado.rol === "SUPERVISOR")) {
      setAvisoRecordatorio({ 
        titulo: "Tu fecha de corte es hoy", 
        mensaje: "Recuerda que tu periodo de suscripción vence hoy. Tienes servicio normal durante todo el día, pero te sugerimos realizar tu abono para evitar interrupciones mañana.\n\nSi ya realizaste el pago, haz caso omiso de este mensaje, pero recuerda mantener esta computadora conectada a internet en estos días para que el sistema valide el pago y restablezca tu suscripción automáticamente." 
      });
      setLoginPendiente({ id: usuarioSeleccionado.id, pin: pinIngresado });
      return; 
    }

    await ejecutarLogin(usuarioSeleccionado.id, pinIngresado);
  };

  const confirmarRecordatorio = async () => {
    setAvisoRecordatorio(null);
    if (loginPendiente) {
      await ejecutarLogin(loginPendiente.id, loginPendiente.pin);
      setLoginPendiente(null);
    }
  };

  const manejarRegresoPIN = () => {
    setUsuarioSeleccionado(null);
    setPinIngresado("");
    setErrorMensaje("");
    setMostrarPin(false);
  };

  // CORREGIDO: Purga forzada al cerrar sesión
  const manejarRegresoCuenta = async () => {
    if (navigator.onLine) await supabase.auth.signOut();
    await limpiarCachesLocales();
    setCuentaSaaSLogueada(false);
    window.location.reload(); 
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-emerald-50/30 dark:bg-slate-950 p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-gradient-to-b from-emerald-600/10 to-transparent -z-10 pointer-events-none"></div>

      {/* MODALES FLOTANTES DE SUSCRIPCIÓN */}
      <ModalAviso 
        abierto={Boolean(avisoSuscripcion)} 
        titulo={avisoSuscripcion?.titulo ?? ""} 
        mensaje={avisoSuscripcion?.mensaje ?? ""} 
        tipo={avisoSuscripcion?.tipo ?? "advertencia"} 
        alCerrar={() => setAvisoSuscripcion(null)} 
      />
      <ModalAviso 
        abierto={Boolean(avisoRecordatorio)} 
        titulo={avisoRecordatorio?.titulo ?? ""} 
        mensaje={avisoRecordatorio?.mensaje ?? ""} 
        tipo="recordatorio" 
        alCerrar={confirmarRecordatorio} 
      />

      {nombrePC && window.apiLocal && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-white/10 backdrop-blur-md z-20 shadow-sm transition-all hover:bg-white dark:hover:bg-slate-900">
          <Laptop size={12} className="text-emerald-600 dark:text-emerald-500" />
          {nombrePC}
        </div>
      )}

      <div className="mb-8 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 z-10">
        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-600/30">
          {cuentaSaaSLogueada ? <Store size={32} /> : <Globe size={32} />}
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight text-center flex items-center justify-center gap-3">
            {cuentaSaaSLogueada ? nombreTienda : "Bienvenido a Mi Tienda"}
          </h1>
          {cuentaSaaSLogueada && planActivo && (
            <span className={cn("flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full border", 
              planActivo === 'PLUS' ? "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/50" :
              planActivo === 'ESTANDAR' ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50" :
              "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            )}>
              <Crown size={12} /> PLAN {planActivo}
            </span>
          )}
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 text-center font-medium px-4">
          {cuentaSaaSLogueada ? "Selecciona tu usuario de caja" : seleccionandoSucursal ? "Elige a qué negocio deseas acceder" : "Inicia sesión en tu cuenta para acceder a tu sucursal."}
        </p>
      </div>

      <div className="efecto-cristal w-full max-w-md bg-white/90 dark:bg-slate-900/90 rounded-[2rem] p-6 md:p-8 shadow-2xl border border-slate-200/50 dark:border-white/10 relative overflow-hidden z-10">
        
        {!cuentaSaaSLogueada ? (
          seleccionandoSucursal ? (
            <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
              <button onClick={() => { setSeleccionandoSucursal(false); supabase.auth.signOut(); }} className="self-start p-2 -ml-2 mb-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <ArrowLeft size={20} />
              </button>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <Store className="text-emerald-600" /> Selecciona tu Sucursal
              </h2>

              {errorSaaS && (
                <p className="text-red-500 text-xs font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 mb-4">
                  {errorSaaS}
                </p>
              )}

              <div className="flex flex-col gap-3">
                {sucursalesDisponibles.map((sucursal) => (
                  <button 
                    key={sucursal.id} 
                    onClick={() => procesarSeleccionSucursal(sucursal)} 
                    disabled={cargandoSaaS}
                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all text-left group bg-white dark:bg-slate-900 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 dark:text-white text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{sucursal.nombre}</span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                        PLAN {sucursal.plan_id || 'ESTANDAR'}
                      </span>
                    </div>
                    <ArrowLeft size={20} className="text-slate-300 group-hover:text-emerald-500 transition-colors rotate-180" />
                  </button>
                ))}
              </div>
            </div>
          ) : modoRecuperacion ? (
            <VistaRecuperacionPassword
              emailSaaS={emailSaaS}
              setEmailSaaS={setEmailSaaS}
              errorSaaS={errorSaaS}
              mensajeExito={mensajeExito}
              cargandoSaaS={cargandoSaaS}
              modoOfflineInfo={modoOfflineInfo}
              onRecuperar={manejarRecuperacion}
              onVolver={() => { setModoRecuperacion(false); setErrorSaaS(""); setMensajeExito(""); }}
            />
          ) : (
            <div className="flex flex-col animate-in fade-in slide-in-from-left-4 duration-300">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2"><UserCircle className="text-emerald-600" /> Cuenta Admin</span>
                {modoOfflineInfo && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md"><WifiOff size={12} /> Offline</span>}
              </h2>
              
              <form onSubmit={manejarLoginSaaS} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Correo Electrónico</label>
                  <input type="email" required autoFocus autoComplete="username" value={emailSaaS} onChange={(e) => setEmailSaaS(e.target.value)} disabled={modoOfflineInfo} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all disabled:opacity-50" placeholder="admin@mitienda.com" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">Contraseña</label>
                  <div className="relative">
                    <input 
                      type={mostrarPassword ? "text" : "password"} 
                      required 
                      autoComplete="new-password"
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
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-inner transition-transform group-hover:scale-105", usuario.rol === "DUENO" ? "bg-purple-500" : usuario.rol === "SUPERVISOR" ? "bg-indigo-500" : "bg-blue-500")}>
                    {usuario.nombre.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{usuario.nombre}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                      {usuario.rol === "DUENO" ? <Shield size={12} className="text-purple-500" /> : usuario.rol === "SUPERVISOR" ? <ShieldCheck size={12} className="text-indigo-500" /> : <Briefcase size={12} className="text-blue-500" />}
                      <span className={cn(usuario.rol === "DUENO" ? "text-purple-600 dark:text-purple-400" : usuario.rol === "SUPERVISOR" ? "text-indigo-600 dark:text-indigo-400" : "text-blue-600 dark:text-blue-400")}>
                        {usuario.rol === "DUENO" ? "Dueño" : usuario.rol === "SUPERVISOR" ? "Supervisor" : "Trabajador"}
                      </span>
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
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-white text-2xl shadow-lg mb-4 ring-4 ring-white dark:ring-slate-900", usuarioSeleccionado.rol === "DUENO" ? "bg-purple-500" : usuarioSeleccionado.rol === "SUPERVISOR" ? "bg-indigo-500" : "bg-blue-500")}>
                {usuarioSeleccionado.nombre.substring(0, 2).toUpperCase()}
              </div>
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
                  onChange={(e) => { setPinIngresado(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setErrorMensaje(""); }} 
                  className={cn("w-full text-center tracking-[0.5em] text-2xl font-mono bg-slate-50 dark:bg-slate-950 border-2 rounded-2xl py-4 pr-12 outline-none focus:ring-4 transition-all text-slate-900 dark:text-slate-100 placeholder:tracking-normal", errorMensaje ? "border-red-500 focus:ring-red-500/20 text-red-600 animate-in shake bg-red-50/50 dark:bg-red-900/10" : "border-slate-200 dark:border-white/10 focus:border-emerald-500 focus:ring-emerald-500/20")} 
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
              {errorMensaje && <p className="text-red-500 text-sm text-center font-medium animate-in fade-in">{errorMensaje}</p>}
              <button type="submit" className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]">Ingresar al Sistema</button>
            </form>
          </div>
        )}
      </div>
      <p className="mt-8 text-xs text-slate-400 dark:text-slate-500 font-medium z-10 text-center">&copy; {new Date().getFullYear()} Mi Tienda Software. <br className="sm:hidden" /> Todos los derechos reservados.</p>
    </div>
  );
}