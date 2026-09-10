import React, { useState, useEffect } from "react";
import { Store, HardDrive, FolderOpen, Save, Info, CheckCircle2, MonitorDown, FileSpreadsheet, Lock, Image as ImageIcon, Trash2, AlertTriangle, Laptop, Pencil, X, Network, Server, Smartphone, Wifi, WifiOff, Sun, Moon, Palette, Scale } from "lucide-react";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { leerProductosExcel } from "../servicios/importadorProductos";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import { useEstadoRed } from "../estado/estadoRed";
import ModalAviso from "../componentes/ui/ModalAviso";
import ModalConfirmacionDesvincularEquipo from "../componentes/ui/ModalConfirmacionDesvincularEquipo";
import { cn } from "../utilidades/utils";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";
import { establecerRolCerebro } from "../servicios/cerebroTienda";
import { guardarTemaVisual, obtenerTemaVisual, TEMAS_VISUALES, type TemaVisual } from "../utilidades/temas";

interface Dispositivo {
  id: string;
  hardware_id: string;
  nombre_dispositivo: string;
  ultimo_acceso: string;
  tienda_id: string;
  es_cerebro?: boolean;
}

interface DirectorioHandle {
  name: string;
  kind: string;
}

interface NavegadorExtendido {
  apiLocal?: {
    obtenerIpLocal?: () => Promise<string>;
    obtenerHardwareId?: () => Promise<string>;
    seleccionarCarpeta?: () => Promise<string>;
  };
  showDirectoryPicker?: (options?: { mode: string }) => Promise<DirectorioHandle>;
}

export default function VistaConfiguracion() {
  const {
    nombreTienda, mensajeTicket, directorioImagenes, teclaCobro, direccionTienda, logoTienda,
    teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago,
    basculaModelo, basculaPuerto, basculaBaudRate, basculaFormato, basculaUnidad,
    actualizarDatosTienda, setDirectorioImagenes, setTeclaCobro, actualizarDatosPago, actualizarDatosBascula
  } = useEstadoConfiguracion();

  const { productos, agregarProducto } = useEstadoInventario();
  const { trabajadorActivo } = useEstadoTrabajadores();
  const { esMaestro, ipMaestro, conectadoLAN, setEsMaestro, setIpMaestro } = useEstadoRed();

  const esDueño = trabajadorActivo?.rol === "DUENO";
  const esSupervisor = trabajadorActivo?.rol === "SUPERVISOR";
  const puedeEditarTicket = esDueño || (esSupervisor && trabajadorActivo?.permisos?.cambiarInfoTicket);

  // Estados Locales para Datos de la Tienda
  const [inputNombre, setInputNombre] = useState(nombreTienda || "");
  const [inputMensaje, setInputMensaje] = useState(mensajeTicket || "");
  const [inputDireccion, setInputDireccion] = useState(direccionTienda || "");
  const [inputLogo, setInputLogo] = useState(logoTienda || "");
  const [guardadoTienda, setGuardadoTienda] = useState(false);

  // Estados Locales para Pagos y Atajos (Mejora con Botón de Guardar)
  const [formPago, setFormPago] = useState({
    teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago
  });
  const [cambiosPago, setCambiosPago] = useState(false);
  const [guardadoPago, setGuardadoPago] = useState(false);
  const [teclaTemporal, setTeclaTemporal] = useState(teclaCobro);

  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [confirmacionDesvincular, setConfirmacionDesvincular] = useState<{ abierto: boolean; equipo: Dispositivo | null }>({ abierto: false, equipo: null });

  // Estados de Red Local
  const [ipLocalPC, setIpLocalPC] = useState("");
  const [inputIpConexion, setInputIpConexion] = useState(ipMaestro);

  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [miHwid, setMiHwid] = useState<string>("");
  const [cerebroActual, setCerebroActual] = useState<Dispositivo | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [editandoDispId, setEditandoDispId] = useState<string | null>(null);
  const [nombreDispTemp, setNombreDispTemp] = useState("");
  const [cambiandoRolCerebro, setCambiandoRolCerebro] = useState(false);
  const [temaVisual, setTemaVisual] = useState<TemaVisual>(() => obtenerTemaVisual());

  const win = window as unknown as NavegadorExtendido;
  const esAppEscritorio = typeof window !== 'undefined' && !!win.apiLocal;
  const suscripcionActiva = true;

  const cambiarTemaVisual = (tema: TemaVisual) => {
    setTemaVisual(tema);
    guardarTemaVisual(tema);
    document.documentElement.classList.toggle("dark", tema === "oscuro" || tema === "grafito");
  };

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
      setAviso({
        titulo: "No se pudo cambiar el cerebro",
        mensaje
      });
    } finally {
      setCambiandoRolCerebro(false);
    }
  };

  // Cargar IP Local
  useEffect(() => {
    if (esMaestro && esAppEscritorio && win.apiLocal?.obtenerIpLocal) {
      win.apiLocal.obtenerIpLocal().then(setIpLocalPC);
    }
  }, [esMaestro, esAppEscritorio, win.apiLocal]);

  // Sincronizar estado global de pagos con el formulario local si cambia en la nube
  useEffect(() => {
    if (!cambiosPago) {
      setFormPago({
        teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago
      });
      setTeclaTemporal(teclaCobro);
    }
  }, [teclaCobro, teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago, cambiosPago]);

  // Cargar Dispositivos
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
          setAviso({
            titulo: "Conflicto de PC cerebro",
            mensaje: "Hay más de una PC marcada como cerebro para esta tienda. Elige una sola en la configuración y libera la otra para evitar duplicados en el almacenamiento cifrado."
          });
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
      })
      .subscribe();
    return () => { supabase.removeChannel(canalDispositivos); };
  }, [esDueño, esAppEscritorio, win.apiLocal]);

  const abrirDesvinculacion = (equipo: Dispositivo, esMiEquipo: boolean) => {
    if (esMiEquipo) {
      setAviso({ titulo: "Acción no permitida", mensaje: "No puedes eliminar el equipo desde el cual estás conectado actualmente." });
      return;
    }

    setConfirmacionDesvincular({ abierto: true, equipo });
  };

  const desvincularEquipo = async (id: string, esMiEquipo: boolean, nuevoCerebroId?: string) => {
    if (esMiEquipo) {
      setAviso({ titulo: "Acción no permitida", mensaje: "No puedes eliminar el equipo desde el cual estás conectado actualmente." });
      return;
    }

    const equipo = dispositivos.find((d) => d.id === id);
    if (!equipo) return;

    try {
      if (equipo.es_cerebro && nuevoCerebroId) {
        const { error: errorNuevoCerebro } = await supabase.from('dispositivos_vinculados').update({ es_cerebro: true }).eq('id', nuevoCerebroId);
        if (errorNuevoCerebro) {
          throw new Error("No se pudo transferir el rol de cerebro al equipo seleccionado.");
        }
      }

      const { error } = await supabase.from('dispositivos_vinculados').delete().eq('id', id);
      if (error) throw error;

      setDispositivos(prev => prev.filter(d => d.id !== id));
      setAviso({ titulo: "Equipo desvinculado", mensaje: "El equipo fue eliminado correctamente." });
    } catch (error: any) {
      setAviso({ titulo: "Error", mensaje: error.message || "No se pudo desvincular el equipo." });
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

  const manejarGuardarTienda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEditarTicket && !esDueño) return;
    actualizarDatosTienda(inputNombre, inputMensaje, inputDireccion, inputLogo);
    setGuardadoTienda(true);
    setTimeout(() => setGuardadoTienda(false), 2000);
  };

  const manejarGuardarPagos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!esDueño) return;
    await setTeclaCobro(teclaTemporal);
    await actualizarDatosPago(formPago);
    setCambiosPago(false);
    setGuardadoPago(true);
    setTimeout(() => setGuardadoPago(false), 2000);
  };

  const actualizarDatoPago = (campo: keyof typeof formPago, valor: string) => {
    if (!esDueño) return;
    setFormPago(prev => ({ ...prev, [campo]: valor }));
    setCambiosPago(true);
  };

  const capturarTeclaPago = (campo: "teclaEfectivo" | "teclaTarjeta" | "teclaTransferencia", evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (!esDueño) return;
    evento.preventDefault();
    const tecla = evento.key.length === 1 ? evento.key.toUpperCase() : evento.key;
    actualizarDatoPago(campo, tecla);
  };

  const manejarLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!esDueño) return;
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onloadend = () => setInputLogo(lector.result as string);
    lector.readAsDataURL(archivo);
  };

  const copiarEnlaceLocal = async () => {
    if (!ipLocalPC) {
      setAviso({ titulo: "Sin enlace local", mensaje: "Primero habilita una dirección IP local en esta PC cerebro o usa la aplicación nativa." });
      return;
    }

    const protocolo = window.location.protocol || "http:";
    const puerto = window.location.port || "5173";
    const base = `${protocolo}//${ipLocalPC}${puerto ? `:${puerto}` : ""}`;
    const enlace = `${base}/?cliente=true`;

    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setAviso({ titulo: "Enlace local copiado", mensaje: `${enlace}` });
      setTimeout(() => setCopiado(false), 1800);
    } catch (error) {
      setAviso({ titulo: "No se pudo copiar", mensaje: `Copia manualmente este enlace: ${enlace}` });
    }
  };

  const seleccionarCarpeta = async () => {
    if (!esDueño) return;
    
    if (esAppEscritorio && win.apiLocal?.seleccionarCarpeta) {
      try {
        const rutaFisica = await win.apiLocal.seleccionarCarpeta();
        if (rutaFisica) setDirectorioImagenes(rutaFisica, undefined);
      } catch (error) {
        console.error("Error al seleccionar carpeta en PC:", error);
      }
      return;
    }

    const navegador = window as any;
    if (typeof navegador.showDirectoryPicker === 'function') {
      try {
        const handle = await navegador.showDirectoryPicker({ mode: "readwrite" });
        setDirectorioImagenes(`Carpeta Web: /${handle.name}`, handle);
      } catch (error) {
        console.log("Selección de carpeta web cancelada:", error);
      }
    } else {
      setAviso({ 
        titulo: "Función bloqueada por el navegador", 
        mensaje: "La selección de carpetas locales requiere usar Chrome/Edge y estar en una conexión segura." 
      });
    }
  };

  const importarExcel = async (evento: React.ChangeEvent<HTMLInputElement>) => {
    if (!esDueño) return;
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    setImportando(true);
    try {
      const nuevos = await leerProductosExcel(archivo, productos);
      for (const producto of nuevos) await agregarProducto(producto);
      setAviso({ titulo: nuevos.length > 0 ? "Importación completada" : "Sin productos nuevos", mensaje: nuevos.length > 0 ? `Se importaron ${nuevos.length} productos correctamente.` : "No se encontraron filas nuevas con nombre y precio en el archivo." });
    } catch (error) {
      setAviso({ titulo: "No se pudo leer el archivo", mensaje: "Verifica que sea un Excel válido." });
    } finally {
      setImportando(false);
    }
  };

  const descargarInstalador = () => setAviso({ titulo: "Descarga iniciada", mensaje: "El archivo instalador (.exe) comenzará a descargarse." });

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      <ModalAviso abierto={Boolean(aviso)} titulo={aviso?.titulo ?? "Aviso"} mensaje={aviso?.mensaje ?? ""} tipo={aviso?.titulo === "Importación completada" ? "exito" : "advertencia"} alCerrar={() => setAviso(null)} />
      <ModalConfirmacionDesvincularEquipo
        abierto={confirmacionDesvincular.abierto}
        equipo={confirmacionDesvincular.equipo}
        dispositivos={dispositivos}
        alCerrar={() => setConfirmacionDesvincular({ abierto: false, equipo: null })}
        alConfirmar={async (nuevoCerebroId?: string) => {
          if (!confirmacionDesvincular.equipo) return;
          await desvincularEquipo(confirmacionDesvincular.equipo.id, confirmacionDesvincular.equipo.hardware_id === miHwid, nuevoCerebroId);
        }}
      />
      
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">Configuración del Sistema</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ajusta preferencias locales, red LAN y almacenamiento.</p>
        </div>
      </div>

      {!esDueño && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800/30 flex items-center gap-3 text-amber-800 dark:text-amber-400">
          <Lock size={20} className="shrink-0" />
          <p className="text-sm font-bold">Modo de vista para Supervisor. Solo el Dueño puede modificar la configuración general.</p>
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white/50 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100"><Palette size={20} className="text-emerald-600 dark:text-emerald-400" /> Apariencia de la aplicación</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Elige el mismo lenguaje visual disponible en la pantalla cliente. Se guarda en este dispositivo.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-white/10 dark:text-slate-400">Tema: {temaVisual}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {TEMAS_VISUALES.map((tema) => {
            const seleccionado = temaVisual === tema.id;
            return (
              <button key={tema.id} type="button" onClick={() => cambiarTemaVisual(tema.id)} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition-all", seleccionado ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-900/20" : "border-slate-200 bg-white hover:border-emerald-300 dark:border-white/10 dark:bg-slate-900/60 dark:hover:border-emerald-700")}>
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-inner", tema.muestra)}>{tema.id === "claro" ? <Sun size={16} /> : tema.id === "verde" ? <Palette size={16} /> : <Moon size={16} />}</span>
                <span className="min-w-0"><strong className="block text-sm text-slate-800 dark:text-slate-100">{tema.nombre}</strong><small className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{tema.descripcion}</small></span>
                {seleccionado && <CheckCircle2 size={16} className="ml-auto shrink-0 text-emerald-600 dark:text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white/50 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <details open className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between text-lg font-bold text-slate-900 dark:text-slate-100">
            <span className="flex items-center gap-2"><Scale size={20} className="text-emerald-600 dark:text-emerald-400" />Báscula y peso</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-white/10 dark:text-slate-400">Acordeón</span>
          </summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Modelo</span>
              <select value={basculaModelo} onChange={(e) => actualizarDatosBascula(e.target.value, basculaPuerto, basculaBaudRate, basculaFormato, basculaUnidad)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                <option>Ohaus Valor 2000</option>
                <option>Ohaus Scout Pro</option>
                <option>Ohaus CS Series</option>
                <option>Mettler Toledo PB</option>
                <option>Adam Equipment</option>
                <option>CAS SW-1</option>
                <option>Sartorius</option>
                <option>A&D Weighing</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Puerto</span>
              <select value={basculaPuerto} onChange={(e) => actualizarDatosBascula(basculaModelo, e.target.value, basculaBaudRate, basculaFormato, basculaUnidad)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                <option>USB</option>
                <option>Serial COM</option>
                <option>Bluetooth</option>
                <option>TCP/IP</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Baud</span>
              <select value={basculaBaudRate} onChange={(e) => actualizarDatosBascula(basculaModelo, basculaPuerto, e.target.value, basculaFormato, basculaUnidad)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                <option>9600</option>
                <option>19200</option>
                <option>38400</option>
                <option>57600</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Formato</span>
              <select value={basculaFormato} onChange={(e) => actualizarDatosBascula(basculaModelo, basculaPuerto, basculaBaudRate, e.target.value, basculaUnidad)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                <option>serial</option>
                <option>text</option>
                <option>csv</option>
                <option>scale</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Unidad</span>
              <select value={basculaUnidad} onChange={(e) => actualizarDatosBascula(basculaModelo, basculaPuerto, basculaBaudRate, basculaFormato, e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                <option>kg</option>
                <option>g</option>
                <option>lb</option>
              </select>
            </label>
          </div>
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
            Soporte recomendado: modelos con salida serial/texto tipo <span className="font-mono">kg</span>, <span className="font-mono">0.000</span> y puerto USB virtual COM. Elije el modelo con el mismo protocolo de texto para evitar lecturas vacías.
          </div>
        </details>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        
        {/* --- SEGURIDAD Y APP NATIVA --- */}
        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <MonitorDown size={20} className="text-indigo-600 dark:text-indigo-400" />
              Seguridad y Aplicación Nativa
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
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500 mt-1">Estás utilizando la versión de Windows. Tu inventario y configuraciones están resguardados localmente con seguridad.</span>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Para máxima seguridad contra robo de inventario y manipulación, te recomendamos descargar la versión nativa para Windows. 
                </p>
                <button onClick={descargarInstalador} type="button" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/30 hover:scale-[1.02] w-full sm:w-auto justify-center">
                  <MonitorDown size={20} />
                  Descargar Instalador (.exe)
                </button>
              </>
            )}
          </div>
        </div>

        {/* --- LÓGICA RED LOCAL (LAN) MEJORADA --- */}
        {esDueño && (
          <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4 lg:col-span-2 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-950/20">
            <h2 className="text-lg font-bold flex items-center gap-2 text-indigo-700 dark:text-indigo-400 border-b border-indigo-100 dark:border-indigo-900/50 pb-3">
              <Network size={20} />
              Sincronización en Red Local (Offline/LAN)
            </h2>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Sincroniza tus equipos sin necesidad de internet de forma fácil. 
              <strong> Convierte esta PC en el "Cerebro" (Servidor)</strong> con un solo clic, y conecta tus otros dispositivos ingresando el código de conexión.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <span className="block text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Cerebro registrado</span>
                <span className="mt-1 block text-sm font-bold text-slate-900 dark:text-slate-100">
                  {cerebroActual ? `${cerebroActual.nombre_dispositivo} (${cerebroActual.hardware_id.substring(0, 12)}...)` : "Sin cerebro configurado"}
                </span>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Estado LAN</span>
                <span className="mt-1 block text-sm font-bold text-slate-900 dark:text-slate-100">
                  {conectadoLAN ? "Conectado" : "Sin conexión LAN"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={cn("p-5 rounded-2xl border transition-all flex flex-col items-center text-center", esMaestro ? "border-indigo-500 bg-white dark:bg-slate-900 shadow-md ring-4 ring-indigo-500/20" : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 opacity-70 hover:opacity-100")}>
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                  <Server size={24} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Cerebro del Negocio (Servidor)</h3>
                <p className="text-xs text-slate-500 mb-4 px-2">Activa esto en la PC principal que guardará toda la información físicamente.</p>
                
                {!esAppEscritorio ? (
                  <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-900/50">
                    Requiere usar la aplicación de Windows (.exe)
                  </span>
                ) : (
                  <button 
                    onClick={() => cambiarRolCerebro(true)}
                    disabled={esMaestro || cambiandoRolCerebro}
                    className="w-full py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-100 disabled:text-indigo-400 dark:disabled:bg-indigo-950 dark:disabled:text-indigo-800 transition-colors"
                  >
                    {esMaestro ? "Esta PC es el Cerebro" : cambiandoRolCerebro ? "Validando disponibilidad..." : "Convertir en Cerebro"}
                  </button>
                )}

                {esMaestro && ipLocalPC && (
                  <div className="mt-4 w-full bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                    <span className="block text-[10px] uppercase font-bold text-indigo-500 tracking-wider mb-1">Escribe este código o comparte este enlace local:</span>
                    {ipLocalPC === "127.0.0.1" ? (
                      <div className="mt-2 text-xs font-bold text-red-600 dark:text-red-400 flex flex-col items-center gap-1 bg-red-100/50 dark:bg-red-900/30 p-2 rounded-lg">
                        <AlertTriangle size={16} />
                        <span>Conéctate a una red Wi-Fi o router local para generar un código válido.</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <span className="text-xl font-mono font-bold text-indigo-700 dark:text-indigo-400 select-all">{ipLocalPC}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 break-all">http://{ipLocalPC}:{window.location.port || "5173"}/?cliente=true</span>
                          <button onClick={copiarEnlaceLocal} className="shrink-0 rounded-lg border border-indigo-300 px-3 py-1 text-[10px] font-black text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/40">
                            {copiado ? "Copiado" : "Copiar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className={cn("p-5 rounded-2xl border transition-all flex flex-col items-center text-center", !esMaestro ? "border-emerald-500 bg-white dark:bg-slate-900 shadow-md ring-4 ring-emerald-500/20" : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 opacity-70 hover:opacity-100")}>
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                  <Smartphone size={24} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">Equipo Conectado (Cliente)</h3>
                <p className="text-xs text-slate-500 mb-4 px-2">
                  <strong className="text-emerald-700 dark:text-emerald-400 block mb-1">¿Cómo conectan los trabajadores?</strong>
                  Inicia sesión temporalmente como Dueño en el celular/tablet, guarda el código aquí y cierra sesión. El equipo quedará vinculado.
                </p>
                
                {esMaestro ? (
                  <button onClick={() => cambiarRolCerebro(false)} disabled={cambiandoRolCerebro} className="w-full py-2.5 rounded-xl text-sm font-bold border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                    {cambiandoRolCerebro ? "Guardando cambio..." : "Liberar cerebro y cambiar a Cliente"}
                  </button>
                ) : (
                  <div className="w-full flex flex-col gap-2">
                    <input 
                      type="text" 
                      value={inputIpConexion} 
                      onChange={(e) => setInputIpConexion(e.target.value)} 
                      placeholder="Ej: 192.168.1.75" 
                      className="w-full text-center font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100" 
                    />
                    <button 
                      onClick={() => { setIpMaestro(inputIpConexion); window.location.reload(); }}
                      className="w-full py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      Conectar al Cerebro
                    </button>
                    {conectadoLAN ? (
                      <span className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 mt-2"><Wifi size={14}/> Conectado con éxito</span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5 text-xs font-bold text-red-500 mt-2"><WifiOff size={14}/> Sin conexión</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* GESTIÓN DE EQUIPOS (Exclusivo Dueño) */}
        {esDueño && (
          <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4 lg:col-span-2">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
              <Laptop size={20} className="text-blue-600 dark:text-blue-400" />
              Equipos Vinculados ({dispositivos.length}/5 permitidos)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dispositivos.map(disp => {
                const esMiEquipo = disp.hardware_id === miHwid;
                return (
                  <div key={disp.id} className={cn(
                    "p-4 rounded-xl border flex justify-between items-start transition-all", 
                    esMiEquipo ? "border-emerald-400 bg-emerald-50/30 dark:border-emerald-500/50 dark:bg-emerald-900/10 shadow-sm" : "border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50"
                  )}>
                    <div className="flex flex-col flex-1 mr-2">
                      <div className="flex items-center gap-2 mb-1">
                        {editandoDispId === disp.id ? (
                          <div className="flex items-center gap-1 w-full max-w-[200px]">
                            <input
                              type="text" autoFocus value={nombreDispTemp} onChange={(e) => setNombreDispTemp(e.target.value)}
                              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-sm w-full text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                            />
                            <button onClick={() => guardarNombreEquipo(disp.id, disp.hardware_id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"><CheckCircle2 size={16} /></button>
                            <button onClick={() => setEditandoDispId(null)} className="p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"><X size={16} /></button>
                          </div>
                        ) : (
                          <>
                            <span className={cn("font-bold", esMiEquipo ? "text-emerald-800 dark:text-emerald-300" : "text-slate-800 dark:text-slate-200")}>
                              {disp.nombre_dispositivo}
                            </span>
                            <button onClick={() => { setEditandoDispId(disp.id); setNombreDispTemp(disp.nombre_dispositivo); }} className="p-1 text-slate-400 hover:text-emerald-600 transition-colors" title="Renombrar equipo"><Pencil size={14} /></button>
                            {esMiEquipo && (
                              <span className="flex items-center gap-1 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider shadow-sm">
                                <MonitorDown size={10} /> Este equipo
                              </span>
                            )}
                            {disp.es_cerebro && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Cerebro</span>
                            )}
                          </>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-mono">ID: {disp.hardware_id.substring(0, 12)}...</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Último acceso: {new Date(disp.ultimo_acceso).toLocaleDateString('es-MX')}</span>
                    </div>
                    <button 
                      onClick={() => abrirDesvinculacion(disp, esMiEquipo)} 
                      className="p-2 mt-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Desvincular equipo"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )
              })}
            </div>
            {dispositivos.length === 0 && <p className="text-xs text-slate-500 italic text-center py-4">Cargando equipos o sin conexión a internet...</p>}
          </div>
        )}

        {/* --- DATOS GENERALES TIENDA --- */}
        <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-4 transition-all", !puedeEditarTicket && !esDueño ? "opacity-75 border-slate-200 dark:border-slate-800 pointer-events-none" : "border-slate-200/50 dark:border-white/10")}>
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
            <Store size={20} className="text-emerald-600 dark:text-emerald-400" />
            Datos de la Tienda (Visible en Ticket)
          </h2>
          <form onSubmit={manejarGuardarTienda} className="flex flex-col gap-4">
            <div className="flex gap-4 items-start">
              <div className="w-24 h-24 shrink-0 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden relative flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                {inputLogo ? (
                  <>
                    <img src={inputLogo} alt="Logo" className="w-full h-full object-contain p-1" />
                    {esDueño && (
                      <button type="button" onClick={() => setInputLogo("")} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md shadow hover:bg-red-600 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </>
                ) : (
                  <ImageIcon size={32} className="text-slate-400" />
                )}
              </div>
              <div className="flex flex-col flex-1 gap-2">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Logo de la tienda</label>
                {esDueño && (
                  <label className="cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-center font-medium hover:bg-slate-50 transition-colors w-fit">
                    Subir Imagen
                    <input type="file" accept="image/*" onChange={manejarLogo} className="hidden" />
                  </label>
                )}
                <p className="text-[10px] text-amber-600 dark:text-amber-500 flex gap-1 items-start mt-1">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  Considera que el logo se imprimirá en cada ticket.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Negocio</label>
              <input type="text" disabled={!esDueño} value={inputNombre} onChange={(e) => setInputNombre(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm disabled:text-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección de la Tienda</label>
              <textarea disabled={!esDueño} value={inputDireccion} onChange={(e) => setInputDireccion(e.target.value)} rows={2} placeholder="Calle, Número, Colonia, Ciudad..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm resize-none disabled:text-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mensaje al pie del ticket</label>
              <textarea disabled={!puedeEditarTicket} value={inputMensaje} onChange={(e) => setInputMensaje(e.target.value)} rows={2} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm resize-none disabled:text-slate-500" />
            </div>
            {(esDueño || puedeEditarTicket) && (
              <button type="submit" className="self-end flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all text-sm">
                {guardadoTienda ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Save size={16} />}
                {guardadoTienda ? "Guardado" : "Guardar Cambios"}
              </button>
            )}
          </form>
        </div>

        {/* --- ATAJOS Y MÉTODOS DE PAGO MEJORADO --- */}
        <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-4 transition-all", !esDueño ? "opacity-75 border-slate-200 dark:border-slate-800 pointer-events-none" : "border-slate-200/50 dark:border-white/10")}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">Atajos de teclado y Métodos de pago</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">Selecciona el campo y presiona una tecla para asignar el atajo rápido.</p>
          
          <form onSubmit={manejarGuardarPagos} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex flex-col">
                Cobro General
                <input 
                  type="text" readOnly disabled={!esDueño} 
                  value={teclaTemporal} 
                  onKeyDown={(e) => {
                    e.preventDefault();
                    setTeclaTemporal(e.key.length === 1 ? e.key.toUpperCase() : e.key);
                    setCambiosPago(true);
                  }} 
                  onFocus={(evento) => evento.currentTarget.select()} 
                  className="mt-1 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-2 text-center text-lg font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-300 disabled:text-slate-500" 
                />
              </label>
              {(["teclaEfectivo", "teclaTarjeta", "teclaTransferencia"] as const).map((campo) => (
                <label key={campo} className="text-xs font-medium text-slate-600 dark:text-slate-300 flex flex-col">
                  {campo === "teclaEfectivo" ? "Efectivo" : campo === "teclaTarjeta" ? "Tarjeta" : "Transferencia"}
                  <input 
                    readOnly disabled={!esDueño} 
                    value={formPago[campo]} 
                    onKeyDown={(evento) => capturarTeclaPago(campo, evento)} 
                    onFocus={(evento) => evento.currentTarget.select()} 
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-lg font-bold dark:border-white/10 dark:bg-slate-900 disabled:text-slate-500" 
                  />
                </label>
              ))}
            </div>
            
            <h3 className="pt-2 text-sm font-bold text-slate-900 dark:text-slate-100">Datos de transferencia</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(["bancoTransferencia", "titularTransferencia", "cuentaTransferencia"] as const).map((campo) => (
                <input 
                  key={campo} disabled={!esDueño} 
                  value={formPago[campo]} 
                  onChange={(evento) => actualizarDatoPago(campo, evento.target.value)} 
                  placeholder={campo === "bancoTransferencia" ? "Banco" : campo === "titularTransferencia" ? "Titular (opcional)" : "Número de cuenta"} 
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 disabled:text-slate-500" 
                />
              ))}
            </div>
            <input 
              disabled={!esDueño} 
              value={formPago.mensajePago} 
              onChange={(evento) => actualizarDatoPago("mensajePago", evento.target.value)} 
              placeholder="Mensaje después del pago" 
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 disabled:text-slate-500" 
            />

            {esDueño && cambiosPago && (
              <button type="submit" className="self-end mt-2 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-emerald-600/30 text-sm">
                {guardadoPago ? <CheckCircle2 size={16} /> : <Save size={16} />}
                {guardadoPago ? "Guardado" : "Guardar Cambios"}
              </button>
            )}
          </form>
        </div>

        {/* --- ALMACENAMIENTO E IMPORTACIÓN --- */}
        <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-4 transition-all", !esDueño ? "opacity-75 border-slate-200 dark:border-slate-800 pointer-events-none" : "border-slate-200/50 dark:border-white/10")}>
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
            <HardDrive size={20} className="text-blue-600 dark:text-blue-400" />
            Directorio de Imágenes Físicas
          </h2>
          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl text-xs border border-blue-100 dark:border-blue-900/30">
            <Info size={18} className="shrink-0" />
            <p>Las imágenes de tus productos no se suben a la nube para ahorrar datos. Se guardan en la carpeta que elijas de tu PC o navegador.</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
            {esDueño && (
              <button onClick={seleccionarCarpeta} type="button" className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors text-sm shadow-md shadow-blue-600/20 shrink-0">
                <FolderOpen size={16} /> Elegir Carpeta
              </button>
            )}
            <div className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 overflow-hidden w-full">
              <span className="text-sm font-mono text-slate-600 dark:text-slate-400 truncate block">
                {directorioImagenes ? directorioImagenes : "Ninguna carpeta seleccionada"}
              </span>
            </div>
          </div>
        </div>

        <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-4 transition-all", !esDueño ? "opacity-75 border-slate-200 dark:border-slate-800 pointer-events-none" : "border-slate-200/50 dark:border-white/10")}>
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
            <FileSpreadsheet size={20} className="text-emerald-600 dark:text-emerald-400" />
            Importar productos
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Carga un archivo Excel. Las columnas requeridas son: nombre, codigo_barras y precio. Opcionales: costo, categoria, stock_actual, etc.
          </p>
          {esDueño && (
            importando ? (
              <div className="w-full mt-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-medium mb-2">
                  <span>Procesando e importando productos...</span>
                  <span className="text-emerald-600 dark:text-emerald-400 animate-pulse">Por favor espera</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden relative">
                  <div className="bg-emerald-500 h-2 rounded-full w-full animate-pulse origin-left"></div>
                </div>
              </div>
            ) : (
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
                <FileSpreadsheet size={16} />
                Elegir archivo Excel
                <input type="file" accept=".xlsx,.xls" onChange={importarExcel} disabled={!esDueño} className="hidden" />
              </label>
            )
          )}
        </div>

      </div>
    </div>
  );
}