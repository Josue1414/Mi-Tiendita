import { useState, useEffect } from "react";
import { CheckCircle2, Sun, Moon, Palette, Scale, ScanBarcode, Save, Plus, Printer } from "lucide-react";
import { useEstadoConfiguracion } from "../../estado/estadoConfiguracion";
import { cn } from "../../utilidades/utils";
import { guardarTemaVisual, obtenerTemaVisual, TEMAS_VISUALES, type TemaVisual } from "../../utilidades/temas";
import { obtenerModelosEscaner, agregarModeloEscaner, DRIVERS_ESCANER, PUERTOS_ESCANER, TIPOS_ESCANER, type EscanerModelo, type DriverEscaner, type TipoEscaner } from "../../servicios/escaner";
import { obtenerModelosImpresora, agregarModeloImpresora, PUERTOS_IMPRESORA, TAMANIOS_ETIQUETA, type ImpresoraModelo, type PuertoImpresora, type TamanioEtiqueta } from "../../servicios/impresoraEtiquetas";
import { obtenerModelosBascula, agregarModeloBascula, PUERTOS_BASCULA, BAUD_RATES_BASCULA, FORMATOS_BASCULA, UNIDADES_BASCULA, type BasculaModeloConfig, type PuertoBascula, type BaudRateBascula, type FormatoBascula, type UnidadBascula } from "../../servicios/bascula";
import ModalPrompt from "../../componentes/ui/ModalPrompt";
import type { PropsSeccionConfig } from "../VistaConfiguracion";

export default function SeccionHardware({ setAviso }: PropsSeccionConfig) {
  const {
    basculaModelo, basculaPuerto, basculaBaudRate, basculaFormato, basculaUnidad,
    escanerModelo, escanerFabricante, escanerDriver, escanerTipo, escanerPuerto, escanerDetectado, escanerMensaje,
    actualizarDatosBascula, actualizarDatosEscaner
  } = useEstadoConfiguracion();

  // Estados
  const [temaVisual, setTemaVisual] = useState<TemaVisual>(() => obtenerTemaVisual());
  
  const [modelosBascula, setModelosBascula] = useState<BasculaModeloConfig[]>([]);
  const [formBascula, setFormBascula] = useState({
    modelo: basculaModelo, puerto: basculaPuerto as PuertoBascula, baudRate: basculaBaudRate as BaudRateBascula,
    formato: basculaFormato as FormatoBascula, unidad: basculaUnidad as UnidadBascula, detectado: false, mensaje: ""
  });

  const [modelosDisponibles, setModelosDisponibles] = useState<EscanerModelo[]>([]);
  const [formEscaner, setFormEscaner] = useState({
    modelo: escanerModelo, fabricante: escanerFabricante, driver: escanerDriver,
    tipo: escanerTipo, puerto: escanerPuerto, detectado: escanerDetectado, mensaje: escanerMensaje
  });

  const [modelosImpresora, setModelosImpresora] = useState<ImpresoraModelo[]>([]);
  const [formImpresora, setFormImpresora] = useState({
    modelo: "", fabricante: "", puerto: "USB" as PuertoImpresora, tamanio: "100x150mm" as TamanioEtiqueta, detectado: false, mensaje: ""
  });

  const [promptConfig, setPromptConfig] = useState<{ abierto: boolean; tipo: "escaner" | "impresora" | "bascula"; titulo: string; mensaje: string; placeholder: string }>({
    abierto: false, tipo: "escaner", titulo: "", mensaje: "", placeholder: ""
  });

  useEffect(() => {
    // Cargar modelos iniciales
    setModelosDisponibles(obtenerModelosEscaner());
    const impresoras = obtenerModelosImpresora();
    setModelosImpresora(impresoras);
    if (impresoras.length > 0) {
      setFormImpresora(prev => ({ ...prev, modelo: impresoras[0].modelo, fabricante: impresoras[0].fabricante, puerto: impresoras[0].puerto, tamanio: impresoras[0].tamanio }));
    }
    const basculas = obtenerModelosBascula();
    setModelosBascula(basculas);
  }, []);

  const cambiarTemaVisual = (tema: TemaVisual) => {
    setTemaVisual(tema);
    guardarTemaVisual(tema);
    document.documentElement.classList.toggle("dark", tema === "oscuro" || tema === "grafito");
  };

  // Funciones de detección REAL mediante Web API
  const detectarBascula = async () => {
    try {
      if (!("serial" in navigator)) throw new Error("Tu navegador no soporta la conexión Serial.");
      
      // Esto fuerza la ventana emergente del sistema para elegir el puerto USB/COM
      await (navigator as any).serial.requestPort();
      
      setFormBascula(prev => ({ ...prev, detectado: true, mensaje: "Báscula detectada y conectada por puerto Serial/USB." }));
    } catch (error) {
      setFormBascula(prev => ({ ...prev, detectado: false, mensaje: "No se detectó ninguna báscula o se canceló la conexión." }));
    }
  };

  const detectarEscaner = async () => {
    try {
      if (!("usb" in navigator)) throw new Error("Tu navegador no soporta la conexión USB nativa.");
      
      // Fuerza la ventana emergente para elegir el escáner USB
      await (navigator as any).usb.requestDevice({ filters: [] });
      
      const escanerActualizado = { ...formEscaner, detectado: true, mensaje: "Escáner detectado correctamente." };
      setFormEscaner(escanerActualizado);
      actualizarDatosEscaner(escanerActualizado.modelo, escanerActualizado.fabricante, escanerActualizado.driver as DriverEscaner, escanerActualizado.tipo as TipoEscaner, escanerActualizado.puerto, true, escanerActualizado.mensaje);
    } catch (error) {
      const escanerActualizado = { ...formEscaner, detectado: false, mensaje: "No se seleccionó ningún escáner." };
      setFormEscaner(escanerActualizado);
      actualizarDatosEscaner(escanerActualizado.modelo, escanerActualizado.fabricante, escanerActualizado.driver as DriverEscaner, escanerActualizado.tipo as TipoEscaner, escanerActualizado.puerto, false, escanerActualizado.mensaje);
    }
  };

  const detectarImpresora = async () => {
    try {
      if (!("usb" in navigator)) throw new Error("Tu navegador no soporta la conexión USB nativa.");
      
      await (navigator as any).usb.requestDevice({ filters: [] });
      
      setFormImpresora(prev => ({ ...prev, detectado: true, mensaje: "Impresora de etiquetas conectada correctamente." }));
    } catch (error) {
      setFormImpresora(prev => ({ ...prev, detectado: false, mensaje: "No se detectó ninguna impresora." }));
    }
  };

  // Procesador unificado del ModalPrompt
  const procesarNuevoModelo = (nombreNuevo: string) => {
    const id = nombreNuevo.toLowerCase().replace(/\s+/g, '-');
    
    if (promptConfig.tipo === "escaner") {
      const nuevoModelo: EscanerModelo = { id, modelo: nombreNuevo, fabricante: formEscaner.fabricante, driver: formEscaner.driver as DriverEscaner, tipo: formEscaner.tipo as TipoEscaner, puerto: formEscaner.puerto, descripcion: "Modelo agregado manualmente" };
      agregarModeloEscaner(nuevoModelo);
      setModelosDisponibles(obtenerModelosEscaner());
      setFormEscaner(prev => ({ ...prev, modelo: nombreNuevo }));
    } else if (promptConfig.tipo === "impresora") {
      const nuevoModelo: ImpresoraModelo = { id, modelo: nombreNuevo, fabricante: formImpresora.fabricante || "Genérico", puerto: formImpresora.puerto, tamanio: formImpresora.tamanio, descripcion: "Impresora agregada manualmente" };
      agregarModeloImpresora(nuevoModelo);
      setModelosImpresora(obtenerModelosImpresora());
      setFormImpresora(prev => ({ ...prev, modelo: nombreNuevo }));
    } else if (promptConfig.tipo === "bascula") {
      const nuevoModelo: BasculaModeloConfig = { id, modelo: nombreNuevo, puerto: formBascula.puerto, baudRate: formBascula.baudRate, formato: formBascula.formato, unidad: formBascula.unidad };
      agregarModeloBascula(nuevoModelo);
      setModelosBascula(obtenerModelosBascula());
      setFormBascula(prev => ({ ...prev, modelo: nombreNuevo }));
    }
    
    setPromptConfig(prev => ({ ...prev, abierto: false }));
    setAviso({ titulo: "Modelo guardado", mensaje: `El modelo ${nombreNuevo} se ha agregado a tu lista local.` });
  };

  return (
    <>
      <ModalPrompt
        abierto={promptConfig.abierto}
        titulo={promptConfig.titulo}
        mensaje={promptConfig.mensaje}
        placeholder={promptConfig.placeholder}
        alCerrar={() => setPromptConfig(prev => ({ ...prev, abierto: false }))}
        alConfirmar={procesarNuevoModelo}
      />

      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white/50 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100"><Palette size={20} className="text-emerald-600 dark:text-emerald-400" /> Apariencia de la aplicación</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Elige el mismo lenguaje visual disponible en la pantalla cliente.</p>
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

      {/* SECCIÓN: BÁSCULA */}
      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white/50 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between text-lg font-bold text-slate-900 dark:text-slate-100">
            <span className="flex items-center gap-2"><Scale size={20} className="text-emerald-600 dark:text-emerald-400" />Báscula y peso</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-white/10 dark:text-slate-400 group-open:bg-emerald-100 group-open:text-emerald-700 transition-colors">Expandir</span>
          </summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Modelo</span>
              <select value={formBascula.modelo} onChange={(e) => {
                const elegido = modelosBascula.find((item) => item.modelo === e.target.value) ?? modelosBascula[0];
                setFormBascula({ ...formBascula, modelo: elegido.modelo, puerto: elegido.puerto, baudRate: elegido.baudRate, formato: elegido.formato, unidad: elegido.unidad, detectado: false, mensaje: `Modelo ${elegido.modelo} seleccionado. Haz clic en detectar.` });
              }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {modelosBascula.map((item) => <option key={item.id}>{item.modelo}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Puerto</span>
              <select value={formBascula.puerto} onChange={(e) => setFormBascula({ ...formBascula, puerto: e.target.value as PuertoBascula })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {PUERTOS_BASCULA.map((puerto) => <option key={puerto}>{puerto}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Baud Rate</span>
              <select value={formBascula.baudRate} onChange={(e) => setFormBascula({ ...formBascula, baudRate: e.target.value as BaudRateBascula })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {BAUD_RATES_BASCULA.map((br) => <option key={br}>{br}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Formato</span>
              <select value={formBascula.formato} onChange={(e) => setFormBascula({ ...formBascula, formato: e.target.value as FormatoBascula })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {FORMATOS_BASCULA.map((fmt) => <option key={fmt}>{fmt}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Unidad</span>
              <select value={formBascula.unidad} onChange={(e) => setFormBascula({ ...formBascula, unidad: e.target.value as UnidadBascula })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {UNIDADES_BASCULA.map((uni) => <option key={uni}>{uni}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={detectarBascula} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
              <Scale size={16} />Detectar báscula
            </button>
            <button type="button" onClick={() => {
              actualizarDatosBascula(formBascula.modelo, formBascula.puerto, formBascula.baudRate, formBascula.formato, formBascula.unidad);
              setAviso({ titulo: "Báscula Guardada", mensaje: `La configuración para ${formBascula.modelo} fue guardada exitosamente.` });
            }} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700 transition-colors">
              <Save size={16} />Guardar báscula
            </button>
            <button type="button" onClick={() => setPromptConfig({ abierto: true, tipo: "bascula", titulo: "Nueva Báscula", mensaje: "Ingresa el nombre del nuevo modelo de báscula:", placeholder: "Ej: Torrey L-EQ" })} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
              <Plus size={16} />Crear nuevo modelo
            </button>
            <span className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider", formBascula.detectado ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>{formBascula.detectado ? "Detectada" : "No detectada"}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{formBascula.mensaje}</span>
          </div>
        </details>
      </section>

      {/* SECCIÓN: ESCÁNER */}
      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white/50 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between text-lg font-bold text-slate-900 dark:text-slate-100">
            <span className="flex items-center gap-2"><ScanBarcode size={20} className="text-emerald-600 dark:text-emerald-400" />Escáneres de códigos de barras</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-white/10 dark:text-slate-400 group-open:bg-emerald-100 group-open:text-emerald-700 transition-colors">Expandir</span>
          </summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <label className="flex flex-col gap-1 xl:col-span-2">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Modelo</span>
              <select value={formEscaner.modelo} onChange={(e) => {
                const elegido = modelosDisponibles.find((item) => item.modelo === e.target.value) ?? modelosDisponibles[0];
                const siguiente = { ...elegido, detectado: false, mensaje: `Modelo ${elegido.modelo} seleccionado. Haz clic en detectar.` };
                setFormEscaner({ ...formEscaner, ...siguiente });
                actualizarDatosEscaner(siguiente.modelo, siguiente.fabricante, siguiente.driver, siguiente.tipo, siguiente.puerto, false, siguiente.mensaje);
              }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {modelosDisponibles.map((item) => <option key={item.id}>{item.modelo}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Fabricante</span>
              <select value={formEscaner.fabricante} onChange={(e) => setFormEscaner({ ...formEscaner, fabricante: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {Array.from(new Set(modelosDisponibles.map((item) => item.fabricante))).map((fabricante) => <option key={fabricante}>{fabricante}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Driver</span>
              <select value={formEscaner.driver} onChange={(e) => setFormEscaner({ ...formEscaner, driver: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {DRIVERS_ESCANER.map((driver) => <option key={driver}>{driver}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipo</span>
              <select value={formEscaner.tipo} onChange={(e) => setFormEscaner({ ...formEscaner, tipo: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {TIPOS_ESCANER.map((tipo) => <option key={tipo}>{tipo}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Puerto</span>
              <select value={formEscaner.puerto} onChange={(e) => setFormEscaner({ ...formEscaner, puerto: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {PUERTOS_ESCANER.map((puerto) => <option key={puerto}>{puerto}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={detectarEscaner} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
              <ScanBarcode size={16} />Detectar escáner
            </button>
            <button type="button" onClick={() => actualizarDatosEscaner(formEscaner.modelo, formEscaner.fabricante, formEscaner.driver, formEscaner.tipo, formEscaner.puerto, formEscaner.detectado, formEscaner.mensaje || "Escáner configurado manualmente.")} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700 transition-colors">
              <Save size={16} />Guardar escáner
            </button>
            <button type="button" onClick={() => setPromptConfig({ abierto: true, tipo: "escaner", titulo: "Nuevo Escáner", mensaje: "Ingresa el nombre del nuevo modelo de escáner:", placeholder: "Ej: Zebra Symbol" })} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
              <Plus size={16} />Crear nuevo modelo
            </button>
            <span className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider", formEscaner.detectado ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>{formEscaner.detectado ? "Detectado" : "No detectado"}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{formEscaner.mensaje}</span>
          </div>
        </details>
      </section>

      {/* SECCIÓN: IMPRESORA */}
      <section className="mb-6 rounded-2xl border border-slate-200/60 bg-white/50 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center justify-between text-lg font-bold text-slate-900 dark:text-slate-100">
            <span className="flex items-center gap-2"><Printer size={20} className="text-emerald-600 dark:text-emerald-400" />Impresora de Etiquetas</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-white/10 dark:text-slate-400 group-open:bg-emerald-100 group-open:text-emerald-700 transition-colors">Expandir</span>
          </summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <label className="flex flex-col gap-1 xl:col-span-2">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Modelo</span>
              <select value={formImpresora.modelo} onChange={(e) => {
                const elegido = modelosImpresora.find((item) => item.modelo === e.target.value) ?? modelosImpresora[0];
                setFormImpresora({ ...formImpresora, modelo: elegido.modelo, fabricante: elegido.fabricante, puerto: elegido.puerto, tamanio: elegido.tamanio, detectado: false, mensaje: `Modelo ${elegido.modelo} seleccionado. Haz clic en detectar.` });
              }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {modelosImpresora.map((item) => <option key={item.id}>{item.modelo}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Fabricante</span>
              <select value={formImpresora.fabricante} onChange={(e) => setFormImpresora({ ...formImpresora, fabricante: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {Array.from(new Set(modelosImpresora.map((item) => item.fabricante))).map((fabricante) => <option key={fabricante}>{fabricante}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Puerto</span>
              <select value={formImpresora.puerto} onChange={(e) => setFormImpresora({ ...formImpresora, puerto: e.target.value as PuertoImpresora })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {PUERTOS_IMPRESORA.map((puerto) => <option key={puerto}>{puerto}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Tamaño</span>
              <select value={formImpresora.tamanio} onChange={(e) => setFormImpresora({ ...formImpresora, tamanio: e.target.value as TamanioEtiqueta })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                {TAMANIOS_ETIQUETA.map((tam) => <option key={tam}>{tam}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={detectarImpresora} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
              <Printer size={16} />Detectar impresora
            </button>
            <button 
              type="button" 
              onClick={() => {
                localStorage.setItem('config_tamanio_impresora', formImpresora.tamanio);
                setAviso({ titulo: "Impresora Guardada", mensaje: `La impresora ${formImpresora.modelo} con tamaño ${formImpresora.tamanio} fue guardada exitosamente.` });
              }} 
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700 transition-colors"
            >
              <Save size={16} />Guardar impresora
            </button>
            <button type="button" onClick={() => setPromptConfig({ abierto: true, tipo: "impresora", titulo: "Nueva Impresora", mensaje: "Ingresa el nombre del nuevo modelo de impresora:", placeholder: "Ej: Xprinter XP-420" })} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
              <Plus size={16} />Crear nuevo modelo
            </button>
            <span className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider", formImpresora.detectado ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>{formImpresora.detectado ? "Detectada" : "No detectada"}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{formImpresora.mensaje}</span>
          </div>
        </details>
      </section>
    </>
  );
}