// src/vistas/VistaConfiguracion.tsx
import React, { useState, useEffect } from "react";
import { Store, HardDrive, FolderOpen, Save, Info, CheckCircle2, MonitorDown, FileSpreadsheet, Lock, Image as ImageIcon, Trash2, AlertTriangle, Laptop, Pencil, X } from "lucide-react";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import { leerProductosExcel } from "../servicios/importadorProductos";
import { useEstadoInventario } from "../estado/estadoInventario";
import { useEstadoTrabajadores } from "../estado/estadoTrabajadores";
import ModalAviso from "../componentes/ui/ModalAviso";
import { cn } from "../utilidades/utils";
import { supabase, obtenerTiendaIdActual } from "../servicios/supabase";

export default function VistaConfiguracion() {
  const { 
    nombreTienda, mensajeTicket, directorioImagenes, teclaCobro, direccionTienda, logoTienda,
    teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago,
    actualizarDatosTienda, setDirectorioImagenes, setTeclaCobro, actualizarDatosPago
  } = useEstadoConfiguracion();

  const { productos, agregarProducto } = useEstadoInventario();
  const { trabajadorActivo } = useEstadoTrabajadores();

  const esDueño = trabajadorActivo?.rol === "DUENO";
  const esSupervisor = trabajadorActivo?.rol === "SUPERVISOR";
  
  // Permiso específico de supervisor
  const puedeEditarTicket = esDueño || (esSupervisor && trabajadorActivo?.permisos?.cambiarInfoTicket);

  const [inputNombre, setInputNombre] = useState(nombreTienda || "");
  const [inputMensaje, setInputMensaje] = useState(mensajeTicket || "");
  const [inputDireccion, setInputDireccion] = useState(direccionTienda || "");
  const [inputLogo, setInputLogo] = useState(logoTienda || "");
  
  const [guardado, setGuardado] = useState(false);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string } | null>(null);
  const [teclaTemporal, setTeclaTemporal] = useState(teclaCobro);
  const [datosPago, setDatosPago] = useState({ teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago });

  // Estados para la gestión de dispositivos
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [miHwid, setMiHwid] = useState<string>("");
  
  // Estados para editar nombre de dispositivos
  const [editandoDispId, setEditandoDispId] = useState<string | null>(null);
  const [nombreDispTemp, setNombreDispTemp] = useState("");

  const esAppEscritorio = typeof window !== 'undefined' && !!window.apiLocal;

  useEffect(() => {
    const cargarDispositivos = async () => {
      if (!esDueño || !navigator.onLine) return;
      
      const tiendaId = await obtenerTiendaIdActual();
      if (!tiendaId) return;

      const { data } = await supabase.from('dispositivos_vinculados').select('*').eq('tienda_id', tiendaId);
      if (data) setDispositivos(data);

      if (window.apiLocal) {
        const hw = await window.apiLocal.obtenerHardwareId();
        setMiHwid(hw);
      }
    };
    cargarDispositivos();
  }, [esDueño]);

  const desvincularEquipo = async (id: string, esMiEquipo: boolean) => {
    if (esMiEquipo) {
      setAviso({ titulo: "Acción no permitida", mensaje: "No puedes eliminar el equipo desde el cual estás conectado actualmente. Inicia sesión en otro dispositivo para eliminar este." });
      return;
    }
    if (!confirm("¿Estás seguro de desvincular este equipo? Tendrá que volver a registrarse y ocupará un espacio en tu límite de sucursal.")) return;
    
    const { error } = await supabase.from('dispositivos_vinculados').delete().eq('id', id);
    if (!error) {
      setDispositivos(prev => prev.filter(d => d.id !== id));
    } else {
      setAviso({ titulo: "Error", mensaje: "No se pudo desvincular el equipo. Verifica tu conexión a internet." });
    }
  };

  const guardarNombreEquipo = async (id: string, hardwareId: string) => {
    if (!nombreDispTemp.trim()) return;
    const { error } = await supabase.from('dispositivos_vinculados').update({ nombre_dispositivo: nombreDispTemp }).eq('id', id);
    
    if (!error) {
      setDispositivos(prev => prev.map(d => d.id === id ? { ...d, nombre_dispositivo: nombreDispTemp } : d));
      // Si estamos cambiando el nombre del equipo actual, lo guardamos localmente para el Login
      if (hardwareId === miHwid) {
        localStorage.setItem('nombre_dispositivo_local', nombreDispTemp);
      }
    } else {
      setAviso({ titulo: "Error", mensaje: "No se pudo actualizar el nombre del equipo." });
    }
    setEditandoDispId(null);
  };

  const manejarGuardarGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEditarTicket && !esDueño) return;
    actualizarDatosTienda(inputNombre, inputMensaje, inputDireccion, inputLogo);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  const manejarLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!esDueño) return;
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onloadend = () => {
      setInputLogo(lector.result as string);
    };
    lector.readAsDataURL(archivo);
  };

  const seleccionarCarpeta = async () => {
    if (!esDueño) return;
    if (!('showDirectoryPicker' in window)) {
      setAviso({ titulo: "Carpetas locales no disponibles", mensaje: "Esta función requiere la aplicación de escritorio nativa para Windows." });
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
      console.error("Error al importar Excel:", error);
      setAviso({ titulo: "No se pudo leer el archivo", mensaje: "Verifica que sea un Excel válido y que incluya columnas de nombre y precio." });
    } finally {
      setImportando(false);
    }
  };

  const capturarTeclaCobro = async (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (!esDueño) return;
    evento.preventDefault();
    const tecla = evento.key.length === 1 ? evento.key.toUpperCase() : evento.key;
    setTeclaTemporal(tecla);
    await setTeclaCobro(tecla);
  };

  const capturarTeclaPago = async (campo: "teclaEfectivo" | "teclaTarjeta" | "teclaTransferencia", evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (!esDueño) return;
    evento.preventDefault();
    const tecla = evento.key.length === 1 ? evento.key.toUpperCase() : evento.key;
    const nuevosDatos = { ...datosPago, [campo]: tecla };
    setDatosPago(nuevosDatos);
    await actualizarDatosPago(nuevosDatos);
  };

  const actualizarDatoPago = (campo: "bancoTransferencia" | "titularTransferencia" | "cuentaTransferencia" | "mensajePago", valor: string) => {
    if (!esDueño) return;
    setDatosPago((actual) => ({ ...actual, [campo]: valor }));
  };

  const descargarInstalador = () => {
    setAviso({ titulo: "Descarga iniciada", mensaje: "El archivo instalador (.exe) comenzará a descargarse. Ejecútalo en tu PC para instalar el sistema seguro." });
  };

  return (
    <div className="w-full h-full flex flex-col p-6 overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
      <ModalAviso abierto={Boolean(aviso)} titulo={aviso?.titulo ?? "Aviso"} mensaje={aviso?.mensaje ?? ""} tipo={aviso?.titulo === "Importación completada" ? "exito" : "advertencia"} alCerrar={() => setAviso(null)} />
      
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Configuración del Sistema
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ajusta las preferencias locales, almacenamiento y opciones de venta.
          </p>
        </div>
      </div>

      {!esDueño && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800/30 flex items-center gap-3 text-amber-800 dark:text-amber-400">
          <Lock size={20} className="shrink-0" />
          <p className="text-sm font-bold">Modo de vista para Supervisor. Solo el Dueño puede modificar la configuración general (A excepción de permisos concedidos).</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-4 transition-all", !puedeEditarTicket && !esDueño ? "opacity-75 border-slate-200 dark:border-slate-800 pointer-events-none" : "border-slate-200/50 dark:border-white/10")}>
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
            <Store size={20} className="text-emerald-600 dark:text-emerald-400" />
            Datos de la Tienda (Visible en Ticket)
          </h2>
          
          <form onSubmit={manejarGuardarGeneral} className="flex flex-col gap-4">
            
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
                  Considera que el logo se imprimirá en cada ticket; un diseño con mucho relleno negro gastará excesiva tinta térmica.
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
                {guardado ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Save size={16} />}
                {guardado ? "Guardado" : "Guardar Cambios"}
              </button>
            )}
          </form>
        </div>

        <div className="efecto-cristal p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
            <MonitorDown size={20} className="text-indigo-600 dark:text-indigo-400" />
            Seguridad y Aplicación Nativa
          </h2>
          
          <div className="mt-auto flex flex-col items-start gap-4">
            {esAppEscritorio ? (
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30 w-full">
                <Lock size={24} className="shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span>Sistema Encriptado Activo</span>
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-500 mt-1">Estás utilizando la versión de Windows. Tu inventario y configuraciones están resguardados localmente con seguridad de grado militar.</span>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Para máxima seguridad contra robo de inventario y manipulación, te recomendamos descargar la versión nativa para Windows. 
                  Cuenta con un baúl encriptado que bloquea el acceso externo a tus datos y permite lectura de básculas.
                </p>
                <button onClick={descargarInstalador} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/30 hover:scale-[1.02] w-full justify-center">
                  <MonitorDown size={20} />
                  Descargar Instalador (.exe)
                </button>
              </>
            )}
          </div>
        </div>

        <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-4 transition-all", !esDueño ? "opacity-75 border-slate-200 dark:border-slate-800 pointer-events-none" : "border-slate-200/50 dark:border-white/10")}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">Atajo de cobro</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">Selecciona el campo y presiona una tecla. Se abrirá la ventana de cobro al presionarla.</p>
          <input type="text" readOnly disabled={!esDueño} value={teclaTemporal} onKeyDown={capturarTeclaCobro} onFocus={(evento) => evento.currentTarget.select()} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 disabled:text-slate-500" />
        </div>

        <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-3 transition-all", !esDueño ? "opacity-75 border-slate-200 dark:border-slate-800 pointer-events-none" : "border-slate-200/50 dark:border-white/10")}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">Atajos de métodos de pago</h2>
          <div className="grid grid-cols-3 gap-2">
            {(["teclaEfectivo", "teclaTarjeta", "teclaTransferencia"] as const).map((campo) => (
              <label key={campo} className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {campo === "teclaEfectivo" ? "Efectivo" : campo === "teclaTarjeta" ? "Tarjeta" : "Transferencia"}
                <input readOnly disabled={!esDueño} value={datosPago[campo]} onKeyDown={(evento) => capturarTeclaPago(campo, evento)} onFocus={(evento) => evento.currentTarget.select()} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center font-bold dark:border-white/10 dark:bg-slate-900 disabled:text-slate-500" />
              </label>
            ))}
          </div>
          <h3 className="pt-2 text-sm font-bold text-slate-900 dark:text-slate-100">Datos de transferencia</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["bancoTransferencia", "titularTransferencia", "cuentaTransferencia"] as const).map((campo) => (
              <input key={campo} disabled={!esDueño} value={datosPago[campo]} onChange={(evento) => actualizarDatoPago(campo, evento.target.value)} onBlur={() => actualizarDatosPago(datosPago)} placeholder={campo === "bancoTransferencia" ? "Banco" : campo === "titularTransferencia" ? "Titular (opcional)" : "Número de cuenta"} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 disabled:text-slate-500" />
            ))}
          </div>
          <input disabled={!esDueño} value={datosPago.mensajePago} onChange={(evento) => actualizarDatoPago("mensajePago", evento.target.value)} onBlur={() => actualizarDatosPago(datosPago)} placeholder="Mensaje después del pago" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900 disabled:text-slate-500" />
        </div>

        <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-4 transition-all", !esDueño ? "opacity-75 border-slate-200 dark:border-slate-800 pointer-events-none" : "border-slate-200/50 dark:border-white/10")}>
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-white/10 pb-3">
            <HardDrive size={20} className="text-blue-600 dark:text-blue-400" />
            Directorio de Imágenes Físicas
          </h2>
          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl text-xs border border-blue-100 dark:border-blue-900/30">
            <Info size={18} className="shrink-0" />
            <p>Las imágenes de tus productos no se suben a la nube para ahorrar datos. Se guardan en la carpeta que elijas de tu PC.</p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            {esDueño && (
              <button onClick={seleccionarCarpeta} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors text-sm shadow-md shadow-blue-600/20 shrink-0">
                <FolderOpen size={16} /> Elegir Carpeta
              </button>
            )}
            <div className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 overflow-hidden">
              <span className="text-sm font-mono text-slate-600 dark:text-slate-400 truncate block">
                {directorioImagenes ? `.../${directorioImagenes}` : "Ninguna carpeta seleccionada"}
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
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-colors">
              <FileSpreadsheet size={16} />
              {importando ? "Importando..." : "Elegir archivo Excel"}
              <input type="file" accept=".xlsx,.xls" onChange={importarExcel} disabled={importando || !esDueño} className="hidden" />
            </label>
          )}
        </div>

        {/* ================= GESTIÓN DE EQUIPOS (Exclusivo Dueño) ================= */}
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
                  <div key={disp.id} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 flex justify-between items-start">
                    <div className="flex flex-col flex-1 mr-2">
                      <div className="flex items-center gap-2 mb-1">
                        {editandoDispId === disp.id ? (
                          <div className="flex items-center gap-1 w-full max-w-[200px]">
                            <input
                              type="text"
                              autoFocus
                              value={nombreDispTemp}
                              onChange={(e) => setNombreDispTemp(e.target.value)}
                              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-sm w-full text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                            />
                            <button onClick={() => guardarNombreEquipo(disp.id, disp.hardware_id)} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"><CheckCircle2 size={16} /></button>
                            <button onClick={() => setEditandoDispId(null)} className="p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"><X size={16} /></button>
                          </div>
                        ) : (
                          <>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{disp.nombre_dispositivo}</span>
                            <button onClick={() => { setEditandoDispId(disp.id); setNombreDispTemp(disp.nombre_dispositivo); }} className="p-1 text-slate-400 hover:text-emerald-600 transition-colors" title="Renombrar equipo"><Pencil size={14} /></button>
                            {esMiEquipo && <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px] px-2 py-0.5 rounded-full uppercase">Este equipo</span>}
                          </>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-mono">ID: {disp.hardware_id.substring(0, 12)}...</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Último acceso: {new Date(disp.ultimo_acceso).toLocaleDateString('es-MX')}</span>
                    </div>
                    <button 
                      onClick={() => desvincularEquipo(disp.id, esMiEquipo)} 
                      className="p-2 mt-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" 
                      title="Desvincular equipo"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )
              })}
            </div>
            {dispositivos.length === 0 && (
              <p className="text-xs text-slate-500 italic text-center py-4">Cargando equipos o sin conexión a internet...</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}