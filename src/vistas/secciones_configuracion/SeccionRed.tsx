import { useState, useEffect } from "react";
import { MonitorDown, CheckCircle2, Lock, Network, Server, Smartphone, AlertTriangle, Wifi, WifiOff, Laptop, Pencil, X, Trash2 } from "lucide-react";
import { useEstadoTrabajadores } from "../../estado/estadoTrabajadores";
import { useEstadoRed } from "../../estado/estadoRed";
import { supabase, obtenerTiendaIdActual } from "../../servicios/supabase";
import { establecerRolCerebro } from "../../servicios/cerebroTienda";
import { cn } from "../../utilidades/utils";
import ModalConfirmacionDesvincularEquipo from "../../componentes/ui/ModalConfirmacionDesvincularEquipo";
import type { PropsSeccionConfig } from "../VistaConfiguracion";

interface Dispositivo {
  id: string; hardware_id: string; nombre_dispositivo: string; ultimo_acceso: string; tienda_id: string; es_cerebro?: boolean;
}

interface NavegadorExtendido {
  apiLocal?: { obtenerIpLocal?: () => Promise<string>; obtenerHardwareId?: () => Promise<string>; };
}

export default function SeccionRed({ setAviso }: PropsSeccionConfig) {
  const { trabajadorActivo } = useEstadoTrabajadores();
  const { esMaestro, ipMaestro, conectadoLAN, setEsMaestro, setIpMaestro } = useEstadoRed();

  const esDueño = trabajadorActivo?.rol === "DUENO";
  const win = window as unknown as NavegadorExtendido;
  const esAppEscritorio = typeof window !== 'undefined' && !!win.apiLocal;
  const suscripcionActiva = true;

  const [ipLocalPC, setIpLocalPC] = useState("");
  const [inputIpConexion, setInputIpConexion] = useState(ipMaestro);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [miHwid, setMiHwid] = useState<string>("");
  const [cerebroActual, setCerebroActual] = useState<Dispositivo | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [editandoDispId, setEditandoDispId] = useState<string | null>(null);
  const [nombreDispTemp, setNombreDispTemp] = useState("");
  const [cambiandoRolCerebro, setCambiandoRolCerebro] = useState(false);
  const [confirmacionDesvincular, setConfirmacionDesvincular] = useState<{ abierto: boolean; equipo: Dispositivo | null }>({ abierto: false, equipo: null });

  useEffect(() => {
    if (esMaestro && esAppEscritorio && win.apiLocal?.obtenerIpLocal) {
      win.apiLocal.obtenerIpLocal().then(setIpLocalPC);
    }
  }, [esMaestro, esAppEscritorio, win.apiLocal]);

  useEffect(() => {
    const cargarDispositivos = async () => {
      if (!esDueño || !navigator.onLine) return;
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId) return;

      const { data } = await supabase.from('dispositivos_vinculados').select('*').eq('tienda_id', tiendaId);
      if (data) {
        const listado = data as Dispositivo[];
        setDispositivos(listado);
        const cerebros = listado.filter((d) => d.es_cerebro);
        if (cerebros.length > 1) {
          setAviso({ titulo: "Conflicto de PC cerebro", mensaje: "Hay más de una PC marcada como cerebro. Elige una sola para evitar duplicados." });
        } else if (cerebros.length === 1) {
          setCerebroActual(cerebros[0]);
        } else {
          setCerebroActual(null);
        }
      }

      if (esAppEscritorio && win.apiLocal?.obtenerHardwareId) {
        const hw = await win.apiLocal.obtenerHardwareId();
        setMiHwid(hw);
      } else {
        let webHwId = localStorage.getItem('web_hardware_id');
        if (!webHwId) {
          webHwId = "web-" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
          localStorage.setItem('web_hardware_id', webHwId);
        }
        setMiHwid(webHwId);
      }
    };
    cargarDispositivos();

    const tiendaActual = localStorage.getItem('tienda_id');
    if (!tiendaActual || !esDueño || !navigator.onLine) return;
    const canalDispositivos = supabase.channel(`dispositivos-${tiendaActual}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispositivos_vinculados', filter: `tienda_id=eq.${tiendaActual}` }, () => {
        cargarDispositivos();
      }).subscribe();
    return () => { supabase.removeChannel(canalDispositivos); };
  }, [esDueño, esAppEscritorio, win.apiLocal, setAviso]);

  const cambiarRolCerebro = async (nuevoRol: boolean) => {
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

  const abrirDesvinculacion = (equipo: Dispositivo, esMiEquipo: boolean) => {
    if (esMiEquipo) {
      setAviso({ titulo: "Acción no permitida", mensaje: "No puedes eliminar el equipo actual." });
      return;
    }
    setConfirmacionDesvincular({ abierto: true, equipo });
  };

  const desvincularEquipo = async (id: string, esMiEquipo: boolean, nuevoCerebroId?: string) => {
    if (esMiEquipo) return;
    try {
      if (confirmacionDesvincular.equipo?.es_cerebro && nuevoCerebroId) {
        await supabase.from('dispositivos_vinculados').update({ es_cerebro: true }).eq('id', nuevoCerebroId);
      }
      await supabase.from('dispositivos_vinculados').delete().eq('id', id);
      setDispositivos(prev => prev.filter(d => d.id !== id));
      setAviso({ titulo: "Equipo desvinculado", mensaje: "El equipo fue eliminado correctamente." });
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : "No se pudo desvincular el equipo.";
      setAviso({ titulo: "Error", mensaje });
    } finally {
      setConfirmacionDesvincular({ abierto: false, equipo: null });
    }
  };

  const guardarNombreEquipo = async (id: string, hardwareId: string) => {
    if (!nombreDispTemp.trim()) return;
    const { error } = await supabase.from('dispositivos_vinculados').update({ nombre_dispositivo: nombreDispTemp }).eq('id', id);
    if (!error) {
      setDispositivos(prev => prev.map(d => d.id === id ? { ...d, nombre_dispositivo: nombreDispTemp } : d));
      if (hardwareId === miHwid) localStorage.setItem('nombre_dispositivo_local', nombreDispTemp);
    } else {
      setAviso({ titulo: "Error", mensaje: "No se pudo actualizar el nombre del equipo." });
    }
    setEditandoDispId(null);
  };

  const copiarEnlaceLocal = async () => {
    if (!ipLocalPC) return setAviso({ titulo: "Sin enlace local", mensaje: "Primero habilita una dirección IP local." });
    const enlace = `${window.location.protocol || "http:"}//${ipLocalPC}${window.location.port ? `:${window.location.port}` : ""}/?cliente=true`;
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setAviso({ titulo: "Enlace copiado", mensaje: enlace });
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      setAviso({ titulo: "Error", mensaje: `Copia manualmente este enlace: ${enlace}` });
    }
  };

  return (
    <>
      <ModalConfirmacionDesvincularEquipo
        abierto={confirmacionDesvincular.abierto} 
        equipo={confirmacionDesvincular.equipo} 
        
        dispositivos={dispositivos.filter(d => !d.hardware_id.startsWith("web-"))}
        alCerrar={() => setConfirmacionDesvincular({ abierto: false, equipo: null })}
        alConfirmar={async (nuevoCerebroId?: string) => {
          if (!confirmacionDesvincular.equipo) return;
          await desvincularEquipo(confirmacionDesvincular.equipo.id, confirmacionDesvincular.equipo.hardware_id === miHwid, nuevoCerebroId);
        }}
      />
      <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4 lg:col-span-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <MonitorDown size={20} className="text-indigo-600 dark:text-indigo-400" /> Seguridad y Aplicación Nativa
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
              <button onClick={() => setAviso({ titulo: "Descarga", mensaje: "Iniciando descarga..." })} type="button" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/30 w-full sm:w-auto justify-center">
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
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Convierte esta PC en el "Cerebro" y conecta tus otros dispositivos.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <span className="block text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Cerebro registrado</span>
              <span className="mt-1 block text-sm font-bold text-slate-900 dark:text-slate-100">{cerebroActual ? `${cerebroActual.nombre_dispositivo} (${cerebroActual.hardware_id.substring(0, 12)}...)` : "Sin cerebro"}</span>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Estado LAN</span>
              <span className="mt-1 block text-sm font-bold text-slate-900 dark:text-slate-100">{conectadoLAN ? "Conectado" : "Sin conexión LAN"}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={cn("p-5 rounded-2xl border transition-all flex flex-col items-center text-center", esMaestro ? "border-indigo-500 bg-white dark:bg-slate-900 shadow-md ring-4 ring-indigo-500/20" : "border-slate-200 bg-slate-50/50")}>
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3"><Server size={24} /></div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Cerebro del Negocio (Servidor)</h3>
              {!esAppEscritorio ? (
                <span className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">Requiere app de Windows (.exe)</span>
              ) : (
                <button onClick={() => cambiarRolCerebro(true)} disabled={esMaestro || cambiandoRolCerebro} className="w-full py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                  {esMaestro ? "Esta PC es el Cerebro" : cambiandoRolCerebro ? "Validando..." : "Convertir en Cerebro"}
                </button>
              )}
              {esMaestro && ipLocalPC && (
                <div className="mt-4 w-full bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                  {ipLocalPC === "127.0.0.1" ? (
                    <div className="mt-2 text-xs font-bold text-red-600 flex flex-col items-center gap-1 bg-red-100/50 p-2 rounded-lg"><AlertTriangle size={16} /><span>Conéctate a Wi-Fi local.</span></div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="text-xl font-mono font-bold text-indigo-700 select-all">{ipLocalPC}</span>
                      <button onClick={copiarEnlaceLocal} className="rounded-lg border border-indigo-300 px-3 py-1 text-[10px] font-black text-indigo-700 hover:bg-indigo-100">{copiado ? "Copiado" : "Copiar Enlace"}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={cn("p-5 rounded-2xl border transition-all flex flex-col items-center text-center", !esMaestro ? "border-emerald-500 bg-white dark:bg-slate-900 shadow-md ring-4 ring-emerald-500/20" : "border-slate-200 bg-slate-50/50")}>
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3"><Smartphone size={24} /></div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Equipo Conectado (Cliente)</h3>
              {esMaestro ? (
                <button onClick={() => cambiarRolCerebro(false)} disabled={cambiandoRolCerebro} className="w-full py-2.5 rounded-xl text-sm font-bold border border-slate-300 hover:bg-slate-50 disabled:opacity-50">Liberar cerebro</button>
              ) : (
                <div className="w-full flex flex-col gap-2">
                  <input type="text" value={inputIpConexion} onChange={(e) => setInputIpConexion(e.target.value)} placeholder="Ej: 192.168.1.75" className="w-full text-center font-mono bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500" />
                  <button onClick={() => { setIpMaestro(inputIpConexion); window.location.reload(); }} className="w-full py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700">Conectar</button>
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
            <Laptop size={20} className="text-blue-600 dark:text-blue-400" /> Equipos Vinculados ({dispositivos.length}/5 permitidos)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dispositivos.map(disp => {
              const esMiEquipo = disp.hardware_id === miHwid;
              return (
                <div key={disp.id} className={cn("p-4 rounded-xl border flex justify-between items-start", esMiEquipo ? "border-emerald-400 bg-emerald-50/30 shadow-sm" : "border-slate-200 bg-white/50")}>
                  <div className="flex flex-col flex-1 mr-2">
                    <div className="flex items-center gap-2 mb-1">
                      {editandoDispId === disp.id ? (
                        <div className="flex items-center gap-1 w-full max-w-[200px]">
                          <input type="text" autoFocus value={nombreDispTemp} onChange={(e) => setNombreDispTemp(e.target.value)} className="border border-slate-300 rounded px-2 py-0.5 text-sm w-full outline-none focus:border-emerald-500" />
                          <button onClick={() => guardarNombreEquipo(disp.id, disp.hardware_id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><CheckCircle2 size={16} /></button>
                          <button onClick={() => setEditandoDispId(null)} className="p-1 text-slate-400 hover:bg-slate-50 rounded"><X size={16} /></button>
                        </div>
                      ) : (
                        <>
                          <span className={cn("font-bold", esMiEquipo ? "text-emerald-800" : "text-slate-800")}>{disp.nombre_dispositivo}</span>
                          <button onClick={() => { setEditandoDispId(disp.id); setNombreDispTemp(disp.nombre_dispositivo); }} className="p-1 text-slate-400 hover:text-emerald-600"><Pencil size={14} /></button>
                          {esMiEquipo && <span className="flex items-center gap-1 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider shadow-sm"><MonitorDown size={10} /> Este equipo</span>}
                          {disp.es_cerebro && <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Cerebro</span>}
                        </>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-mono">ID: {disp.hardware_id.substring(0, 12)}...</span>
                  </div>
                  <button onClick={() => abrirDesvinculacion(disp, esMiEquipo)} className="p-2 mt-1 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}