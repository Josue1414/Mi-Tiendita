import { useState, useEffect } from "react";
import { Store, ImageIcon, Trash2, AlertTriangle, Save, CheckCircle2, HardDrive, Info, FolderOpen, FileSpreadsheet } from "lucide-react";
import { useEstadoConfiguracion } from "../../estado/estadoConfiguracion";
import { useEstadoInventario } from "../../estado/estadoInventario";
import { useEstadoTrabajadores } from "../../estado/estadoTrabajadores";
import { leerProductosExcel } from "../../servicios/importadorProductos";
import { cn } from "../../utilidades/utils";
import type { PropsSeccionConfig } from "../VistaConfiguracion";

interface DirectorioHandle { name: string; kind: string; }
interface NavegadorExtendido { showDirectoryPicker?: (options?: { mode: string }) => Promise<DirectorioHandle>; apiLocal?: { seleccionarCarpeta?: () => Promise<string>; }; }

export default function SeccionAdministracion({ setAviso }: PropsSeccionConfig) {
  const {
    nombreTienda, mensajeTicket, directorioImagenes, teclaCobro, direccionTienda, logoTienda,
    teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago,
    actualizarDatosTienda, setDirectorioImagenes, setTeclaCobro, actualizarDatosPago
  } = useEstadoConfiguracion();

  const { productos, agregarProducto } = useEstadoInventario();
  const { trabajadorActivo } = useEstadoTrabajadores();
  
  const esDueño = trabajadorActivo?.rol === "DUENO";
  const esSupervisor = trabajadorActivo?.rol === "SUPERVISOR";
  const puedeEditarTicket = esDueño || (esSupervisor && trabajadorActivo?.permisos?.cambiarInfoTicket);

  const [inputNombre, setInputNombre] = useState(nombreTienda || "");
  const [inputMensaje, setInputMensaje] = useState(mensajeTicket || "");
  const [inputDireccion, setInputDireccion] = useState(direccionTienda || "");
  const [inputLogo, setInputLogo] = useState(logoTienda || "");
  const [guardadoTienda, setGuardadoTienda] = useState(false);
  const [formPago, setFormPago] = useState({ teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago });
  const [cambiosPago, setCambiosPago] = useState(false);
  const [guardadoPago, setGuardadoPago] = useState(false);
  const [teclaTemporal, setTeclaTemporal] = useState(teclaCobro);
  const [importando, setImportando] = useState(false);

  const win = window as unknown as NavegadorExtendido;
  const esAppEscritorio = typeof window !== 'undefined' && !!win.apiLocal;

  useEffect(() => {
    if (!cambiosPago) {
      setFormPago({ teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago });
      setTeclaTemporal(teclaCobro);
    }
  }, [teclaCobro, teclaEfectivo, teclaTarjeta, teclaTransferencia, bancoTransferencia, titularTransferencia, cuentaTransferencia, mensajePago, cambiosPago]);

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
    actualizarDatoPago(campo, evento.key.length === 1 ? evento.key.toUpperCase() : evento.key);
  };

  const manejarLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!esDueño) return;
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onloadend = () => setInputLogo(lector.result as string);
    lector.readAsDataURL(archivo);
  };

  const seleccionarCarpeta = async () => {
    if (!esDueño) return;
    if (esAppEscritorio && win.apiLocal?.seleccionarCarpeta) {
      try {
        const rutaFisica = await win.apiLocal.seleccionarCarpeta();
        if (rutaFisica) setDirectorioImagenes(rutaFisica, undefined);
      } catch (error) { console.error("Error al seleccionar carpeta:", error); }
      return;
    }
    if (typeof win.showDirectoryPicker === 'function') {
      try {
        const handle = await win.showDirectoryPicker({ mode: "readwrite" });
        setDirectorioImagenes(`Carpeta Web: /${handle.name}`, handle);
      } catch (error) { console.log("Cancelado:", error); }
    } else {
      setAviso({ titulo: "Función bloqueada", mensaje: "Requiere usar Chrome/Edge y conexión segura." });
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
      setAviso({ titulo: nuevos.length > 0 ? "Importación completada" : "Sin productos nuevos", mensaje: nuevos.length > 0 ? `Se importaron ${nuevos.length} productos.` : "Sin filas nuevas." });
    } catch {
      setAviso({ titulo: "Error", mensaje: "Verifica que sea un Excel válido." });
    } finally {
      setImportando(false);
    }
  };

  return (
    <>
      <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-4 transition-all", !puedeEditarTicket && !esDueño ? "opacity-75 border-slate-200 pointer-events-none" : "border-slate-200/50")}>
        <h2 className="text-lg font-bold flex items-center gap-2"><Store size={20} className="text-emerald-600" /> Datos de la Tienda</h2>
        <form onSubmit={manejarGuardarTienda} className="flex flex-col gap-4">
          <div className="flex gap-4 items-start">
            <div className="w-24 h-24 shrink-0 rounded-xl border-2 border-dashed border-slate-300 relative flex items-center justify-center bg-slate-50">
              {inputLogo ? (
                <><img src={inputLogo} alt="Logo" className="w-full h-full object-contain p-1" />
                  {esDueño && <button type="button" onClick={() => setInputLogo("")} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md hover:bg-red-600"><Trash2 size={12} /></button>}
                </>
              ) : <ImageIcon size={32} className="text-slate-400" />}
            </div>
            <div className="flex flex-col flex-1 gap-2">
              <label className="text-xs font-medium">Logo de la tienda</label>
              {esDueño && (
                <label className="cursor-pointer bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-center font-medium hover:bg-slate-50 w-fit">
                  Subir Imagen <input type="file" accept="image/*" onChange={manejarLogo} className="hidden" />
                </label>
              )}
              <p className="text-[10px] text-amber-600 flex gap-1 items-start mt-1"><AlertTriangle size={12} className="shrink-0 mt-0.5" /> Considera que el logo se imprimirá en cada ticket.</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Nombre del Negocio</label>
            <input type="text" disabled={!esDueño} value={inputNombre} onChange={(e) => setInputNombre(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Dirección de la Tienda</label>
            <textarea disabled={!esDueño} value={inputDireccion} onChange={(e) => setInputDireccion(e.target.value)} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Mensaje al pie del ticket</label>
            <textarea disabled={!puedeEditarTicket} value={inputMensaje} onChange={(e) => setInputMensaje(e.target.value)} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none" />
          </div>
          {(esDueño || puedeEditarTicket) && (
            <button type="submit" className="self-end flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm">
              {guardadoTienda ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Save size={16} />} {guardadoTienda ? "Guardado" : "Guardar"}
            </button>
          )}
        </form>
      </div>

      <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-4 transition-all", !esDueño ? "opacity-75 border-slate-200 pointer-events-none" : "border-slate-200/50")}>
        <h2 className="text-lg font-bold border-b border-slate-200 pb-3">Atajos y Métodos de pago</h2>
        <form onSubmit={manejarGuardarPagos} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="text-xs font-bold text-emerald-700 flex flex-col">
              Cobro General
              <input type="text" readOnly disabled={!esDueño} value={teclaTemporal} onKeyDown={(e) => { e.preventDefault(); setTeclaTemporal(e.key.length === 1 ? e.key.toUpperCase() : e.key); setCambiosPago(true); }} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-2 text-center text-lg font-bold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-500" />
            </label>
            {(["teclaEfectivo", "teclaTarjeta", "teclaTransferencia"] as const).map((campo) => (
              <label key={campo} className="text-xs font-medium text-slate-600 flex flex-col">
                {campo === "teclaEfectivo" ? "Efectivo" : campo === "teclaTarjeta" ? "Tarjeta" : "Transferencia"}
                <input readOnly disabled={!esDueño} value={formPago[campo]} onKeyDown={(e) => capturarTeclaPago(campo, e)} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-lg font-bold" />
              </label>
            ))}
          </div>
          <h3 className="pt-2 text-sm font-bold">Datos de transferencia</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["bancoTransferencia", "titularTransferencia", "cuentaTransferencia"] as const).map((campo) => (
              <input key={campo} disabled={!esDueño} value={formPago[campo]} onChange={(e) => actualizarDatoPago(campo, e.target.value)} placeholder={campo} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
            ))}
          </div>
          <input disabled={!esDueño} value={formPago.mensajePago} onChange={(e) => actualizarDatoPago("mensajePago", e.target.value)} placeholder="Mensaje después del pago" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
          {esDueño && cambiosPago && (
            <button type="submit" className="self-end mt-2 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm">
              {guardadoPago ? <CheckCircle2 size={16} /> : <Save size={16} />} {guardadoPago ? "Guardado" : "Guardar Cambios"}
            </button>
          )}
        </form>
      </div>

      <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-4 transition-all", !esDueño ? "opacity-75 border-slate-200 pointer-events-none" : "border-slate-200/50")}>
        <h2 className="text-lg font-bold flex items-center gap-2 border-b border-slate-200 pb-3"><HardDrive size={20} className="text-blue-600" /> Directorio Físico</h2>
        <div className="flex items-start gap-3 p-3 bg-blue-50 text-blue-700 rounded-xl text-xs border border-blue-100"><Info size={18} className="shrink-0" /><p>Las imágenes locales se guardan en la PC/Navegador en lugar de la nube.</p></div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2">
          {esDueño && <button onClick={seleccionarCarpeta} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm"><FolderOpen size={16} /> Elegir Carpeta</button>}
          <div className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 w-full"><span className="text-sm font-mono text-slate-600 truncate block">{directorioImagenes || "Ninguna carpeta seleccionada"}</span></div>
        </div>
      </div>

      <div className={cn("efecto-cristal p-6 rounded-2xl border flex flex-col gap-4 transition-all", !esDueño ? "opacity-75 border-slate-200 pointer-events-none" : "border-slate-200/50")}>
        <h2 className="text-lg font-bold flex items-center gap-2 border-b border-slate-200 pb-3"><FileSpreadsheet size={20} className="text-emerald-600" /> Importar Excel</h2>
        {esDueño && (
          importando ? (
            <div className="w-full mt-2 bg-slate-50 p-3 rounded-xl border border-slate-200"><div className="flex justify-between text-xs mb-2"><span>Importando...</span><span className="text-emerald-600 animate-pulse">Espera</span></div><div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-emerald-500 h-2 w-full animate-pulse"></div></div></div>
          ) : (
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:bg-emerald-700">
              <FileSpreadsheet size={16} /> Elegir archivo Excel <input type="file" accept=".xlsx,.xls" onChange={importarExcel} disabled={!esDueño} className="hidden" />
            </label>
          )
        )}
      </div>
    </>
  );
}