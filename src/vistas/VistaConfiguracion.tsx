// src/vistas/VistaConfiguracion.tsx
import React, { useState } from "react";
import { Store, HardDrive, Cloud, FolderOpen, Save, Info, CheckCircle2, MonitorDown, FileSpreadsheet } from "lucide-react";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { usePWA } from "../hooks/usePWA";
import { cn } from "../utilidades/utils";
import { leerProductosExcel } from "../servicios/importadorProductos";
import { useEstadoInventario } from "../estado/estadoInventario";
import ModalAviso from "../componentes/ui/ModalAviso";

export default function VistaConfiguracion() {
  const { 
    nombreTienda, mensajeTicket, directorioImagenes, sincronizacionNube, teclaCobro, correoDueno,
    teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago,
    actualizarDatosTienda, setDirectorioImagenes, toggleSincronizacion, setTeclaCobro, actualizarDatosPago, setCorreoDueno
  } = useEstadoConfiguracion();

  // Integración del hook PWA
  const { instalarApp, puedeInstalar, estaInstalada } = usePWA();
  const { productos, agregarProducto } = useEstadoInventario();

  const [inputNombre, setInputNombre] = useState(nombreTienda);
  const [inputMensaje, setInputMensaje] = useState(mensajeTicket);
  const [guardado, setGuardado] = useState(false);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [teclaTemporal, setTeclaTemporal] = useState(teclaCobro);
  const [correoTemporal, setCorreoTemporal] = useState(correoDueno);
  const [datosPago, setDatosPago] = useState({ teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago });

  const manejarGuardarGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    actualizarDatosTienda(inputNombre, inputMensaje);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  const seleccionarCarpeta = async () => {
    if (!('showDirectoryPicker' in window)) {
      setAviso({ titulo: "Carpetas locales no disponibles", mensaje: "Esta función requiere Chrome o Edge y ejecutarse desde localhost. Puedes continuar usando el almacenamiento local del navegador." });
      return;
    }

    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      setDirectorioImagenes(handle.name, handle);
    } catch (error) {
      console.log("Selección de carpeta cancelada o no soportada:", error);
    }
  };

  const importarExcel = async (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    setImportando(true);
    try {
      const nuevos = await leerProductosExcel(archivo, productos);
      for (const producto of nuevos) await agregarProducto(producto);
      setAviso({ titulo: nuevos.length > 0 ? "Importación completada" : "Sin productos nuevos", mensaje: nuevos.length > 0 ? `Se importaron ${nuevos.length} productos correctamente.` : "No se encontraron filas nuevas con nombre y precio en el archivo." });
    } catch (error) {
      console.error("Error al importar Excel:", error);
      setAviso({ titulo: "No se pudo leer el archivo", mensaje: "Verifica que sea un Excel válido y que incluya columnas de nombre y precio." });
    } finally {
      setImportando(false);
    }
  };

  const capturarTeclaCobro = async (evento: React.KeyboardEvent<HTMLInputElement>) => {
    evento.preventDefault();
    const tecla = evento.key.length === 1 ? evento.key.toUpperCase() : evento.key;
    setTeclaTemporal(tecla);
    await setTeclaCobro(tecla);
  };

  const capturarTeclaPago = async (campo: "teclaEfectivo" | "teclaTarjeta" | "teclaTransferencia", evento: React.KeyboardEvent<HTMLInputElement>) => {
    evento.preventDefault();
    const tecla = evento.key.length === 1 ? evento.key.toUpperCase() : evento.key;
    const nuevosDatos = { ...datosPago, [campo]: tecla };
    setDatosPago(nuevosDatos);
    await actualizarDatosPago(nuevosDatos);
  };

  const actualizarDatoPago = (campo: "bancoTransferencia" | "titularTransferencia" | "cuentaTransferencia" | "mensajePago", valor: string) => {
    setDatosPago((actual) => ({ ...actual, [campo]: valor }));
  };

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      <ModalAviso abierto={Boolean(aviso)} titulo={aviso?.titulo ?? "Aviso"} mensaje={aviso?.mensaje ?? ""} tipo={aviso?.titulo === "Importación completada" ? "exito" : "advertencia"} alCerrar={() => setAviso(null)} />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          Configuración del Sistema
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ajusta las preferencias locales, almacenamiento, PWA y conexión a la nube.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        
        {/* Panel General */}
        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
            <Store size={20} className="text-emerald-600 dark:text-emerald-400" />
            Datos de la Tienda
          </h2>
          
          <form onSubmit={manejarGuardarGeneral} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Negocio</label>
              <input 
                type="text" 
                value={inputNombre} 
                onChange={(e) => setInputNombre(e.target.value)} 
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mensaje al pie del ticket</label>
              <textarea 
                value={inputMensaje} 
                onChange={(e) => setInputMensaje(e.target.value)} 
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 text-sm resize-none" 
              />
            </div>
            <button type="submit" className="self-end flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all text-sm">
              {guardado ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Save size={16} />}
              {guardado ? "Guardado" : "Guardar Cambios"}
            </button>
          </form>
        </div>

        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Correo de recuperación</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">Liga el correo del dueño. El envío real del enlace se activará al conectar Supabase Auth.</p>
          <input type="email" value={correoTemporal} onChange={(evento) => setCorreoTemporal(evento.target.value)} onBlur={() => setCorreoDueno(correoTemporal)} placeholder="dueno@ejemplo.com" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" />
        </div>

        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">Atajo de cobro</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">Selecciona el campo y presiona una tecla. Se abrirá la ventana de cobro cuando el ticket tenga productos.</p>
          <input
            type="text"
            readOnly
            value={teclaTemporal}
            onKeyDown={capturarTeclaCobro}
            onFocus={(evento) => evento.currentTarget.select()}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            aria-label="Tecla de cobro"
          />
        </div>

        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">Atajos de métodos de pago</h2>
          <div className="grid grid-cols-3 gap-2">
            {(["teclaEfectivo", "teclaTarjeta", "teclaTransferencia"] as const).map((campo) => (
              <label key={campo} className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {campo === "teclaEfectivo" ? "Efectivo" : campo === "teclaTarjeta" ? "Tarjeta" : "Transferencia"}
                <input readOnly value={datosPago[campo]} onKeyDown={(evento) => capturarTeclaPago(campo, evento)} onFocus={(evento) => evento.currentTarget.select()} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center font-bold dark:border-white/10 dark:bg-slate-900" />
              </label>
            ))}
          </div>
          <h3 className="pt-2 text-sm font-bold text-slate-900 dark:text-slate-100">Datos de transferencia</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["bancoTransferencia", "titularTransferencia", "cuentaTransferencia"] as const).map((campo) => (
              <input key={campo} value={datosPago[campo]} onChange={(evento) => actualizarDatoPago(campo, evento.target.value)} onBlur={() => actualizarDatosPago(datosPago)} placeholder={campo === "bancoTransferencia" ? "Banco" : campo === "titularTransferencia" ? "Titular (opcional)" : "Número de cuenta"} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" />
            ))}
          </div>
          <input value={datosPago.mensajePago} onChange={(evento) => actualizarDatoPago("mensajePago", evento.target.value)} onBlur={() => actualizarDatosPago(datosPago)} placeholder="Mensaje después del pago" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900" />
        </div>

        {/* Instalación PWA */}
        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
            <MonitorDown size={20} className="text-indigo-600 dark:text-indigo-400" />
            Aplicación de Escritorio
          </h2>
          
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Instala "Mi Tienda" en tu computadora para acceder a ella como un programa nativo de Windows, sin barra de direcciones y con su propio icono.
          </p>

          <div className="mt-auto flex flex-col items-start gap-3">
            {estaInstalada ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                <CheckCircle2 size={18} />
                <span>Aplicación instalada correctamente</span>
              </div>
            ) : puedeInstalar ? (
              <button 
                onClick={instalarApp}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/30 hover:scale-[1.02]"
              >
                <MonitorDown size={20} />
                Instalar en Windows
              </button>
            ) : (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs border border-amber-100 dark:border-amber-900/30">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p>La instalación no está disponible. Asegúrate de usar Chrome o Edge, o verifica que la configuración PWA esté activa en Vite.</p>
              </div>
            )}
          </div>
        </div>

        {/* Panel Almacenamiento Local (Offline-First) */}
        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
            <HardDrive size={20} className="text-blue-600 dark:text-blue-400" />
            Almacenamiento Local (Offline)
          </h2>
          
          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl text-xs border border-blue-100 dark:border-blue-900/30">
            <Info size={18} className="shrink-0" />
            <p>Los datos (productos, ventas) se guardan automáticamente en la base de datos interna de tu navegador (IndexedDB) para funcionar sin internet.</p>
          </div>

          <div className="mt-2">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Directorio de Imágenes Físicas</label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Selecciona una carpeta en tu laptop donde se guardarán los archivos pesados (imágenes de productos).
            </p>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={seleccionarCarpeta}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors text-sm shadow-md shadow-blue-600/20 shrink-0"
              >
                <FolderOpen size={16} />
                Elegir Carpeta
              </button>
              
              <div className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 flex items-center gap-2 overflow-hidden">
                <span className="text-sm font-mono text-slate-600 dark:text-slate-400 truncate">
                  {directorioImagenes ? `.../${directorioImagenes}` : "Ninguna carpeta seleccionada"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
            <FileSpreadsheet size={20} className="text-emerald-600 dark:text-emerald-400" />
            Importar productos
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Carga un archivo Excel. Las columnas principales son: nombre, codigo_barras, precio, costo, categoria, stock_actual y stock_minimo.
          </p>
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700">
            <FileSpreadsheet size={16} />
            {importando ? "Importando..." : "Elegir archivo Excel"}
            <input type="file" accept=".xlsx,.xls" onChange={importarExcel} disabled={importando} className="hidden" />
          </label>
        </div>

        {/* Panel Sincronización en la Nube */}
        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4 lg:col-span-2">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-3">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Cloud size={20} className="text-purple-600 dark:text-purple-400" />
              Sincronización en la Nube (Supabase)
            </h2>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {sincronizacionNube ? "Activada" : "Desactivada"}
              </span>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={sincronizacionNube} onChange={toggleSincronizacion} />
                <div className={cn("block w-12 h-6 rounded-full transition-colors", sincronizacionNube ? "bg-purple-500" : "bg-slate-300 dark:bg-slate-700")}></div>
                <div className={cn("dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform", sincronizacionNube ? "transform translate-x-6" : "")}></div>
              </div>
            </label>
          </div>

          <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-4 transition-opacity", !sincronizacionNube && "opacity-40 pointer-events-none")}>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col justify-center items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse mb-1"></span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Estado Conexión</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Esperando credenciales</span>
            </div>
            
            <div className="sm:col-span-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col justify-center gap-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                La sincronización requiere vincular tu proyecto de Supabase. El sistema subirá las ventas y el texto del inventario automáticamente cuando haya internet.
              </p>
              <button disabled className="self-start px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-400 rounded-lg text-xs font-bold cursor-not-allowed">
                Vincular Proyecto (Pronto)
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}