// src/vistas/secciones_configuracion/SeccionRed.tsx
import { useState, useEffect, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { MonitorDown, CheckCircle2, Lock, Network, Server, Smartphone, AlertTriangle, Wifi, WifiOff, Laptop, Pencil, X, Trash2, QrCode } from "lucide-react";
import QRCode from "react-qr-code";
import { useEstadoTrabajadores } from "../../estado/estadoTrabajadores";
import { useEstadoRed } from "../../estado/estadoRed";
import { useEstadoPlan } from "../../estado/estadoPlan";
import {
  supabase,
  obtenerIdentificadorDispositivo,
  obtenerTiendaIdActual,
  obtenerDispositivosVinculadosCache,
  obtenerDispositivosVinculadosDeNube,
  guardarDispositivosVinculadosCache,
  guardarCambioDispositivoPendiente,
  sincronizarCambiosDispositivosPendientes,
  type DispositivoVinculado
} from "../../servicios/supabase";
import { establecerRolCerebro } from "../../servicios/cerebroTienda";
import { androidLan } from "../../servicios/androidLan";
import { cn } from "../../utilidades/utils";
import ModalConfirmacionDesvincularEquipo from "../../componentes/ui/ModalConfirmacionDesvincularEquipo";
import AyudaContextual from "../../componentes/ui/AyudaContextual";
import type { PropsSeccionConfig } from "../VistaConfiguracion";

const obtenerTipoDispositivo = (hardwareId: string) => {
  if (hardwareId.startsWith("android-")) return "Android";
  if (hardwareId.startsWith("web-")) return "WEB";
  return "PC";
};

const esFalloDeConexion = (error: unknown) => {
  if (error instanceof TypeError) return true;
  if (typeof error !== "object" || error === null || !("message" in error) || typeof error.message !== "string") return false;
  return /network|fetch|offline|timed?\s*out|connection/i.test(error.message);
};

interface NavegadorExtendido {
  apiLocal?: {
    obtenerIpLocal?: () => Promise<string>;
    obtenerHardwareId?: () => Promise<string>;
    obtenerEstadoLAN?: () => Promise<{ activo: boolean; ip: string }>;
  };
}

// URL DEL INSTALADOR DE GOOGLE DRIVE (Descarga directa)
const URL_INSTALADOR_EXE = 'https://github.com/Josue1414/predicamap/releases/download/v1.4.0/Ahorra-Tiempo.MI.TIENDA.Setup.1.4.0.exe';

export default function SeccionRed({ setAviso }: PropsSeccionConfig) {
  const { trabajadorActivo } = useEstadoTrabajadores();
  const {
    esMaestro,
    esRespaldo,
    ipMaestro,
    conectadoLAN,
    servidorLANActivo,
    dispositivosLANConectados,
    setEsMaestro,
    setIpMaestro
  } = useEstadoRed();
  
  const maxDispositivos = useEstadoPlan((estado) => estado.maxDispositivos);

  const esDueño = trabajadorActivo?.rol === "DUENO";
  const win = window as unknown as NavegadorExtendido;
  const esAppEscritorio = typeof window !== 'undefined' && !!win.apiLocal;
  const esAppAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const puedeSerCerebro = esAppEscritorio || esAppAndroid;
  const puertoWebLAN = esAppAndroid ? 4001 : 4000;
  const suscripcionActiva = true;

  const [ipLocalPC, setIpLocalPC] = useState("");
  const [inputIpConexion, setInputIpConexion] = useState(ipMaestro);
  const [dispositivos, setDispositivos] = useState<DispositivoVinculado[]>([]);
  const [miHwid, setMiHwid] = useState<string>("");
  const [cerebroActual, setCerebroActual] = useState<DispositivoVinculado | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [mostrarQRLAN, setMostrarQRLAN] = useState(false);
  const [preparandoQRLAN, setPreparandoQRLAN] = useState(false);
  const [editandoDispId, setEditandoDispId] = useState<string | null>(null);
  const [nombreDispTemp, setNombreDispTemp] = useState("");
  const [cambiandoRolCerebro, setCambiandoRolCerebro] = useState(false);
  const [confirmacionDesvincular, setConfirmacionDesvincular] = useState<{ abierto: boolean; equipo: DispositivoVinculado | null }>({ abierto: false, equipo: null });
  const enlaceWebLAN = useMemo(() => {
    if (!ipLocalPC) return "";
    const url = new URL(`http://${ipLocalPC}:${puertoWebLAN}/`);
    url.searchParams.set("lanHost", ipLocalPC);
    url.searchParams.set("lanPort", String(puertoWebLAN));
    return url.toString();
  }, [ipLocalPC, puertoWebLAN]);
  const enlaceQRLAN = enlaceWebLAN;

  useEffect(() => {
    if (esMaestro && esAppEscritorio && win.apiLocal?.obtenerIpLocal) {
      win.apiLocal.obtenerIpLocal().then(setIpLocalPC);
    } else if (esMaestro && esAppAndroid) {
      androidLan.getServerStatus()
        .then((estado) => setIpLocalPC(estado.ip))
        .catch((error: unknown) => {
          console.error("No se pudo obtener la dirección LAN del Cerebro Android:", error);
          setAviso({ titulo: "Error de red local", mensaje: "No se pudo detectar la dirección IP del servidor Android." });
        });
    }
  }, [esMaestro, esAppEscritorio, esAppAndroid, win.apiLocal, setAviso]);

  useEffect(() => {
    let cancelado = false;
    let canalDispositivos: ReturnType<typeof supabase.channel> | null = null;
    const suscribirDispositivos = (tiendaId: string) => {
      if (canalDispositivos || cancelado || !navigator.onLine || !esDueño) return;
      canalDispositivos = supabase.channel(`dispositivos-${tiendaId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dispositivos_vinculados', filter: `tienda_id=eq.${tiendaId}` }, recargarAlConectar)
        .subscribe();
    };
    const aplicarListado = (listado: DispositivoVinculado[]) => {
      if (cancelado) return;
      setDispositivos(listado);
      const cerebros = listado.filter((dispositivo) => dispositivo.es_cerebro);
      if (cerebros.length > 1) {
        setAviso({ titulo: "Conflicto de PC cerebro", mensaje: "Hay más de una PC marcada como cerebro. Elige una sola para evitar duplicados." });
      } else {
        setCerebroActual(cerebros[0] ?? null);
      }
    };
    const cargarDispositivos = async () => {
      if (!esDueño) return;
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId || cancelado) return;

      aplicarListado(obtenerDispositivosVinculadosCache(tiendaId));
      setMiHwid(await obtenerIdentificadorDispositivo());
      if (!navigator.onLine) return;

      try {
        await sincronizarCambiosDispositivosPendientes(tiendaId);
        aplicarListado(await obtenerDispositivosVinculadosDeNube(tiendaId));
        suscribirDispositivos(tiendaId);
      } catch (error: unknown) {
        console.warn("No se pudo actualizar el listado de equipos desde Supabase; se conserva la copia local:", error);
      }
    };
    function recargarAlConectar() {
      void cargarDispositivos();
    }
    window.addEventListener("online", recargarAlConectar);
    void cargarDispositivos().catch((error: unknown) => {
      console.error("No se pudo preparar el listado de equipos vinculados:", error);
    });
    return () => {
      cancelado = true;
      window.removeEventListener("online", recargarAlConectar);
      if (canalDispositivos) void supabase.removeChannel(canalDispositivos);
    };
  }, [esDueño, esAppEscritorio, win.apiLocal, setAviso]);

  const cambiarRolCerebro = async (nuevoRol: boolean) => {
    if (nuevoRol && dispositivos.length >= maxDispositivos && !dispositivos.find(d => d.hardware_id === miHwid)) {
      setAviso({ titulo: "Límite alcanzado", mensaje: `Tu plan solo permite ${maxDispositivos} dispositivos vinculados.`});
      return;
    }

    setCambiandoRolCerebro(true);
    try {
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId) throw new Error("No se encontró la tienda activa.");
      await establecerRolCerebro(tiendaId, nuevoRol);
      setEsMaestro(nuevoRol);
      window.location.reload();
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : "Verifica tu conexión y vuelve a intentarlo.";
      setAviso({ titulo: "No se pudo cambiar el cerebro", mensaje });
    } finally {
      setCambiandoRolCerebro(false);
    }
  };

  const abrirDesvinculacion = (equipo: DispositivoVinculado, esMiEquipo: boolean) => {
    if (esMiEquipo) {
      setAviso({ titulo: "Acción no permitida", mensaje: "No puedes eliminar el equipo actual." });
      return;
    }
    setConfirmacionDesvincular({ abierto: true, equipo });
  };

  const desvincularEquipo = async (id: string, esMiEquipo: boolean, nuevoCerebroId?: string) => {
    if (esMiEquipo) return;
    try {
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId) throw new Error("No se encontró la tienda activa.");
      const cambiosLocales = [...dispositivos];
      let guardadoSinInternet = !navigator.onLine;
      const guardarCambio = async (cambio: { tipo: "actualizar"; id: string; cambios: Partial<DispositivoVinculado> } | { tipo: "eliminar"; id: string }) => {
        if (!guardadoSinInternet) {
          try {
            const resultado = cambio.tipo === "actualizar"
              ? await supabase.from('dispositivos_vinculados').update(cambio.cambios).eq('id', cambio.id).eq('tienda_id', tiendaId)
              : await supabase.from('dispositivos_vinculados').delete().eq('id', cambio.id).eq('tienda_id', tiendaId);
            if (resultado.error) throw resultado.error;
            return;
          } catch (error: unknown) {
            if (!esFalloDeConexion(error)) throw error;
            guardadoSinInternet = true;
          }
        }
        guardarCambioDispositivoPendiente(tiendaId, cambio);
      };
      if (confirmacionDesvincular.equipo?.es_cerebro && nuevoCerebroId) {
        await guardarCambio({ tipo: "actualizar", id: nuevoCerebroId, cambios: { es_cerebro: true } });
      }
      await guardarCambio({ tipo: "eliminar", id });
      const listado = cambiosLocales
        .map((dispositivo) => dispositivo.id === nuevoCerebroId ? { ...dispositivo, es_cerebro: true } : dispositivo)
        .filter((dispositivo) => dispositivo.id !== id);
      guardarDispositivosVinculadosCache(tiendaId, listado);
      setDispositivos(listado);
      setCerebroActual(listado.find((dispositivo) => dispositivo.es_cerebro) ?? null);
      setAviso({
        titulo: guardadoSinInternet ? "Cambio guardado sin conexión" : "Equipo desvinculado",
        mensaje: guardadoSinInternet ? "El equipo se quitó de la lista. El cambio se aplicará en Supabase cuando vuelva Internet." : "El equipo fue eliminado correctamente."
      });
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : "No se pudo desvincular el equipo.";
      setAviso({ titulo: "Error", mensaje });
    } finally {
      setConfirmacionDesvincular({ abierto: false, equipo: null });
    }
  };

  const guardarNombreEquipo = async (id: string, hardwareId: string) => {
    const nombre = nombreDispTemp.trim();
    if (!nombre) return;
    const tiendaId = await obtenerTiendaIdActual();
    if (!tiendaId) throw new Error("No se encontró la tienda activa.");
    try {
      let guardadoSinInternet = !navigator.onLine;
      if (!guardadoSinInternet) {
        try {
          const { error } = await supabase.from('dispositivos_vinculados')
            .update({ nombre_dispositivo: nombre }).eq('id', id).eq('tienda_id', tiendaId);
          if (error) throw error;
        } catch (error: unknown) {
          if (!esFalloDeConexion(error)) throw error;
          guardadoSinInternet = true;
        }
      }
      if (guardadoSinInternet) {
        guardarCambioDispositivoPendiente(tiendaId, { tipo: "actualizar", id, cambios: { nombre_dispositivo: nombre } });
      }
      const listado = dispositivos.map((dispositivo) =>
        dispositivo.id === id ? { ...dispositivo, nombre_dispositivo: nombre } : dispositivo
      );
      guardarDispositivosVinculadosCache(tiendaId, listado);
      setDispositivos(listado);
      if (hardwareId === miHwid) localStorage.setItem('nombre_dispositivo_local', nombre);
      if (guardadoSinInternet) {
        setAviso({ titulo: "Cambio guardado sin conexión", mensaje: "El nombre se actualizará en Supabase cuando vuelva Internet." });
      }
    } catch (error: unknown) {
      console.error("No se pudo guardar el nombre del dispositivo:", error);
      setAviso({ titulo: "Error", mensaje: "No se pudo actualizar el nombre del equipo." });
    } finally {
      setEditandoDispId(null);
    }
  };

  const copiarEnlaceLocal = async () => {
    if (!ipLocalPC) return setAviso({ titulo: "Sin enlace local", mensaje: "Primero habilita una dirección IP local." });
    const enlace = `http://${ipLocalPC}:${puertoWebLAN}/`;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setAviso({ titulo: "Enlace copiado", mensaje: enlace });
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setAviso({ titulo: "Error", mensaje: `Copia manualmente este enlace: ${enlace}` });
    }
  };

  const abrirQRLAN = async () => {
    setPreparandoQRLAN(true);
    try {
      let ip = ipLocalPC;
      if (esAppAndroid) {
        let estado = await androidLan.getServerStatus();
        if (!estado.activo) estado = await androidLan.startServer();
        if (!estado.activo || !estado.ip || estado.ip === "127.0.0.1") {
          throw new Error("El servidor local no está disponible. Conecta el Cerebro a la misma red Wi-Fi que los demás equipos y vuelve a intentarlo.");
        }
        ip = estado.ip;
      } else if (esAppEscritorio && win.apiLocal?.obtenerEstadoLAN) {
        const estado = await win.apiLocal.obtenerEstadoLAN();
        if (!estado.activo || !estado.ip || estado.ip === "127.0.0.1") {
          throw new Error("El servidor LAN no está activo o no tiene una dirección de red local.");
        }
        ip = estado.ip;
      }
      if (!ip || ip === "127.0.0.1") {
        throw new Error("No se detectó una dirección Wi-Fi local para crear el QR.");
      }
      setIpLocalPC(ip);
      setMostrarQRLAN(true);
    } catch (error: unknown) {
      console.error("No se pudo preparar el QR para entrar por LAN:", error);
      setAviso({
        titulo: "No se pudo preparar el QR LAN",
        mensaje: error instanceof Error ? error.message : "Comprueba que el servidor LAN esté activo y conectado a Wi-Fi."
      });
    } finally {
      setPreparandoQRLAN(false);
    }
  };

  const descargarInstalador = () => {
    setAviso({ titulo: "Iniciando descarga", mensaje: "El instalador se está descargando en tu equipo." });
    
    const link = document.createElement('a');
    link.href = URL_INSTALADOR_EXE;
    link.setAttribute('download', 'MiTienda_Instalador.exe');
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const limiteDispositivosAlcanzado = dispositivos.length >= maxDispositivos;

  const dispositivosFiltradosParaModal = useMemo(() => {
    return dispositivos.filter(d => obtenerTipoDispositivo(d.hardware_id) === "PC");
  }, [dispositivos]);

  return (
    <>
      <ModalConfirmacionDesvincularEquipo
        abierto={confirmacionDesvincular.abierto} 
        equipo={confirmacionDesvincular.equipo} 
        dispositivos={dispositivosFiltradosParaModal}
        alCerrar={() => setConfirmacionDesvincular({ abierto: false, equipo: null })}
        alConfirmar={async (nuevoCerebroId?: string) => {
          if (!confirmacionDesvincular.equipo) return;
          await desvincularEquipo(confirmacionDesvincular.equipo.id, confirmacionDesvincular.equipo.hardware_id === miHwid, nuevoCerebroId);
        }}
      />
      {mostrarQRLAN && enlaceWebLAN && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setMostrarQRLAN(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900" onClick={(evento) => evento.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><QrCode size={20} /> Entrar por LAN</h2>
              <button onClick={() => setMostrarQRLAN(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cerrar"><X size={20} /></button>
            </div>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">Conecta el móvil a la misma Wi-Fi y escanea este código para abrir Mi Tiendita desde el Cerebro.</p>
            <div className="mx-auto mb-4 w-fit rounded-xl border border-slate-200 bg-white p-3">
              <QRCode value={enlaceQRLAN} size={220} />
            </div>
            <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-400">Escanéalo con la cámara o escribe este enlace en el navegador:</p>
            <a href={enlaceWebLAN} className="block break-all rounded-lg bg-slate-100 p-2 font-mono text-xs text-indigo-700 underline dark:bg-slate-800 dark:text-indigo-300">{enlaceWebLAN}</a>
            <p className="mt-3 text-xs text-slate-500">No requiere Internet. Ambos equipos deben estar en la misma Wi-Fi y esa red debe permitir que los dispositivos se comuniquen entre sí.</p>
          </div>
        </div>
      )}
      <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4 lg:col-span-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <MonitorDown size={20} className="text-indigo-600 dark:text-indigo-400" /> Seguridad y Aplicación Nativa
            <AyudaContextual etiqueta="Seguridad y aplicación nativa" texto="Muestra si esta sesión se ejecuta en la aplicación de escritorio y ofrece el instalador para Windows cuando se usa el navegador. La aplicación de escritorio resguarda localmente los datos del negocio." />
          </h2>
          {suscripcionActiva && (
            <span className="flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
              <CheckCircle2 size={14} /> Suscripción Activa
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-col items-start gap-4">
          {esAppEscritorio ? (
            <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30 w-full">
              <Lock size={24} className="shrink-0" />
              <div className="flex flex-col leading-tight">
                <span>Sistema Encriptado Activo</span>
                <span className="text-xs font-medium text-emerald-600 mt-1">Tu inventario y configuraciones están resguardados localmente con seguridad.</span>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">Para máxima seguridad, te recomendamos descargar la versión nativa para Windows.</p>
              <button onClick={descargarInstalador} type="button" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/30 w-full sm:w-auto justify-center">
                <MonitorDown size={20} /> Descargar Instalador (.exe)
              </button>
            </>
          )}
        </div>
      </div>

      {esDueño && (
        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4 lg:col-span-2 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-950/20">
          <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-400 border-b border-indigo-100 dark:border-indigo-900/50 pb-3">
            <Network size={20} /> Sincronización en Red Local (Offline/LAN)
            <AyudaContextual etiqueta="Sincronización en red local" texto="Permite designar una PC con Windows o una APK Android como servidor local y conectar otros dispositivos a la misma red Wi-Fi. Así pueden compartir operaciones dentro de la tienda incluso si Internet se interrumpe." />
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">La red local se inicia automáticamente en el Cerebro. Los demás equipos se conectan al escanear su QR LAN o al indicar su IP.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <span className="block text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Cerebro registrado</span>
              <span className="mt-1 block text-sm font-bold text-slate-900 dark:text-slate-100">{cerebroActual ? `${cerebroActual.nombre_dispositivo} (${cerebroActual.hardware_id.substring(0, 12)}...)` : "Sin cerebro"}</span>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Estado LAN</span>
              <span className="mt-1 block text-sm font-bold text-slate-900 dark:text-slate-100">
                {esMaestro
                  ? servidorLANActivo
                    ? `Servidor activo · ${dispositivosLANConectados} conectado(s)`
                    : "Servidor LAN no activo"
                  : esRespaldo
                    ? conectadoLAN ? "Respaldo sincronizado" : "Respaldo fuera de línea"
                    : conectadoLAN ? "Conectado al Cerebro" : "Sin conexión · usa el QR LAN del Cerebro"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={cn("p-5 rounded-2xl border transition-all flex flex-col items-center text-center", esMaestro ? "border-indigo-500 bg-white dark:bg-slate-900 shadow-md ring-4 ring-indigo-500/20" : "border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/30")}>
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3"><Server size={24} /></div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Cerebro del Negocio (Servidor)</h3>
              {!puedeSerCerebro ? (
                <span className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">Requiere app de Windows (.exe) o APK Android</span>
              ) : (
                <button onClick={() => cambiarRolCerebro(true)} disabled={esMaestro || cambiandoRolCerebro || (!esMaestro && limiteDispositivosAlcanzado && !dispositivos.find(d => d.hardware_id === miHwid))} className="w-full py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                  {esMaestro ? "Este dispositivo es el Cerebro" : cambiandoRolCerebro ? "Validando..." : "Convertir en Cerebro"}
                </button>
              )}
              {esMaestro && (
                <div className="mt-4 w-full bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50 flex flex-col gap-3">
                  
                  {/* NUEVO BOTÓN DE HOTSPOT PARA ANDROID */}
                  {esAppAndroid && (
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700/50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-left">¿Sin internet?</p>
                      <button 
                        onClick={() => androidLan.openHotspotSettings()} 
                        className="w-full flex items-center justify-center gap-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/50 dark:hover:bg-indigo-900/80 dark:text-indigo-300 py-2 px-3 rounded-lg text-xs font-bold transition-colors"
                      >
                        <Wifi size={16} /> Encender Zona Wi-Fi (Hotspot)
                      </button>
                      <p className="text-[10px] text-slate-500 mt-2 leading-tight">Si no tienes un router local, enciende la Zona Wi-Fi y conecta los demás celulares a esta red.</p>
                    </div>
                  )}
                  {esAppEscritorio && (
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700/50">
                      <p className="text-[10px] text-slate-500 leading-tight">Si no hay internet, asegúrate de que todos los equipos estén conectados al mismo módem local por cable o Wi-Fi.</p>
                    </div>
                  )}

                  {ipLocalPC === "127.0.0.1" ? (
                    <div className="mt-2 text-xs font-bold text-red-600 flex flex-col items-center gap-1 bg-red-100/50 p-2 rounded-lg">
                      <AlertTriangle size={16} /><span>Red local inactiva. Enciende el Wi-Fi.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="text-xl font-mono font-bold text-indigo-700 dark:text-indigo-400 select-all">{ipLocalPC}</span>
                      <button onClick={copiarEnlaceLocal} className="rounded-lg border border-indigo-300 dark:border-indigo-700/50 px-3 py-1 text-[10px] font-black text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                        {copiado ? "Copiado" : "Copiar IP de Conexión"}
                      </button>
                      <button onClick={() => void abrirQRLAN()} disabled={preparandoQRLAN} className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60 transition-colors">
                        <QrCode size={15} /> {preparandoQRLAN ? "Verificando servidor..." : "Mostrar QR para los clientes"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={cn("p-5 rounded-2xl border transition-all flex flex-col items-center text-center", !esMaestro ? "border-emerald-500 bg-white dark:bg-slate-900 shadow-md ring-4 ring-emerald-500/20" : "border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/30")}>
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3"><Smartphone size={24} /></div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">{esRespaldo ? "Cerebro de respaldo" : "Equipo Conectado (Cliente)"}</h3>
              {esMaestro ? (
                <button onClick={() => cambiarRolCerebro(false)} disabled={cambiandoRolCerebro} className="w-full py-2.5 rounded-xl text-sm font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50">Liberar cerebro</button>
              ) : (
                <div className="w-full flex flex-col gap-2">
                  <input type="text" disabled={limiteDispositivosAlcanzado && !dispositivos.find(d => d.hardware_id === miHwid)} value={inputIpConexion} onChange={(e) => setInputIpConexion(e.target.value)} placeholder="Ej: 192.168.1.75" className="w-full text-center font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-slate-900 dark:text-slate-100" />
                  
                  <button onClick={() => { 
                      if(limiteDispositivosAlcanzado && !dispositivos.find(d => d.hardware_id === miHwid)) {
                        setAviso({titulo: "Límite alcanzado", mensaje: `Tu plan solo permite ${maxDispositivos} dispositivos.`});
                        return;
                      }
                      setIpMaestro(inputIpConexion); 
                      window.location.reload(); 
                    }} 
                    disabled={limiteDispositivosAlcanzado && !dispositivos.find(d => d.hardware_id === miHwid)}
                    className="w-full py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {limiteDispositivosAlcanzado && !dispositivos.find(d => d.hardware_id === miHwid) ? `Límite Alcanzado (${maxDispositivos})` : "Conectar"}
                  </button>
                  
                  {conectadoLAN ? <span className="flex justify-center gap-1.5 text-xs font-bold text-emerald-600 mt-2"><Wifi size={14}/> Conectado</span> : <span className="flex justify-center gap-1.5 text-xs font-bold text-red-500 mt-2"><WifiOff size={14}/> Sin conexión</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {esDueño && (
        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4 lg:col-span-2">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
            <Laptop size={20} className="text-blue-600 dark:text-blue-400" /> Equipos Vinculados ({dispositivos.length}/{maxDispositivos} permitidos)
            <AyudaContextual etiqueta="Equipos vinculados" texto="Consulta los dispositivos autorizados para esta tienda. Desde aquí puedes reconocerlos, cambiar sus nombres o desvincular equipos que ya no deban tener acceso." />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dispositivos.map(disp => {
              const esMiEquipo = disp.hardware_id === miHwid;
              return (
                <div key={disp.id} className={cn("p-4 rounded-xl border flex justify-between items-start", esMiEquipo ? "border-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/20 shadow-sm" : "border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50")}>
                  <div className="flex flex-col flex-1 mr-2">
                    <div className="flex items-center gap-2 mb-1">
                      {editandoDispId === disp.id ? (
                        <div className="flex items-center gap-1 w-full max-w-[200px]">
                          <input type="text" autoFocus value={nombreDispTemp} onChange={(e) => setNombreDispTemp(e.target.value)} className="border border-slate-300 dark:border-white/10 rounded px-2 py-0.5 text-sm w-full outline-none focus:border-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
                          <button onClick={() => guardarNombreEquipo(disp.id, disp.hardware_id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"><CheckCircle2 size={16} /></button>
                          <button onClick={() => setEditandoDispId(null)} className="p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"><X size={16} /></button>
                        </div>
                      ) : (
                        <>
                          <span className={cn("font-bold", esMiEquipo ? "text-emerald-800 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200")}>{disp.nombre_dispositivo}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{obtenerTipoDispositivo(disp.hardware_id)}</span>
                          <button onClick={() => { setEditandoDispId(disp.id); setNombreDispTemp(disp.nombre_dispositivo); }} className="p-1 text-slate-400 hover:text-emerald-600"><Pencil size={14} /></button>
                          {esMiEquipo && <span className="flex items-center gap-1 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider shadow-sm"><MonitorDown size={10} /> Este equipo</span>}
                          {disp.es_cerebro && <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Cerebro</span>}
                        </>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-mono">ID: {disp.hardware_id.substring(0, 12)}...</span>
                  </div>
                  <button onClick={() => abrirDesvinculacion(disp, esMiEquipo)} className="p-2 mt-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={18} /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}