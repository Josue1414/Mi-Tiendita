// src/vistas/VistaFacturacion.tsx
import { useState, useEffect } from "react";
import { FileSpreadsheet, KeyRound, Download, AlertTriangle } from "lucide-react";
import { useEstadoVentas } from "../estado/estadoVentas";
import { useEstadoFacturacion, type ConfiguracionFiscal } from "../estado/estadoFacturacion";
import CampoFecha from "../componentes/ui/CampoFecha";
import ModalAviso from "../componentes/ui/ModalAviso";
import * as XLSX from "xlsx";
import { cn } from "../utilidades/utils";

export default function VistaFacturacion({ integrada = false }: { integrada?: boolean }) {
  const { ventas } = useEstadoVentas();
  const { configuracion, cargando, cargarConfiguracion, guardarConfiguracion } = useEstadoFacturacion();
  
  const [pestanaActiva, setPestanaActiva] = useState<"REPORTES" | "CONFIGURACION">("REPORTES");
  
  // Estados para Reportes
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string; tipo: "exito" | "advertencia" | "info" } | null>(null);

  // Estados para Configuración
  const [cambiosConfig, setCambiosConfig] = useState<Partial<ConfiguracionFiscal>>({});
  const formConfig: ConfiguracionFiscal = {
    proveedor: cambiosConfig.proveedor ?? configuracion?.proveedor ?? "facturapi",
    facturapi_key: cambiosConfig.facturapi_key ?? configuracion?.facturapi_key ?? "",
    rfc_emisor: cambiosConfig.rfc_emisor ?? configuracion?.rfc_emisor ?? "",
    regimen_fiscal: cambiosConfig.regimen_fiscal ?? configuracion?.regimen_fiscal ?? "612"
  };

  useEffect(() => {
    cargarConfiguracion();
  }, [cargarConfiguracion]);

  const exportarReporteContador = () => {
    if (!fechaInicio || !fechaFin) {
      setAviso({ titulo: "Fechas requeridas", mensaje: "Selecciona una fecha de inicio y fin para generar el reporte.", tipo: "advertencia" });
      return;
    }

    const ventasPeriodo = ventas.filter(v => {
      const fecha = v.fecha.slice(0, 10);
      return !v.cancelada && fecha >= fechaInicio && fecha <= fechaFin;
    });

    if (ventasPeriodo.length === 0) {
      setAviso({ titulo: "Sin ventas", mensaje: "No hay ventas registradas en este periodo.", tipo: "info" });
      return;
    }

    // Preparar datos desglosados para el contador
    const datos = ventasPeriodo.map(v => {
      // Suponiendo un IVA del 16% incluido (puedes ajustar esta fórmula según tu lógica de impuestos)
      const subtotalSinIva = v.total / 1.16;
      const iva = v.total - subtotalSinIva;

      return {
        "Fecha": new Date(v.fecha).toLocaleDateString('es-MX'),
        "Folio Ticket": v.id.slice(0, 8).toUpperCase(),
        "Método de Pago": v.metodoPago || "EFECTIVO",
        "Subtotal": Number(subtotalSinIva.toFixed(2)),
        "IVA (16%)": Number(iva.toFixed(2)),
        "Total Neto": Number(v.total.toFixed(2)),
        "Descuentos": Number((v.descuento || 0).toFixed(2))
      };
    });

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Contable");
    XLSX.writeFile(wb, `Reporte_Ingresos_${fechaInicio}_al_${fechaFin}.xlsx`);
    
    setAviso({ titulo: "Reporte Exportado", mensaje: `Se descargó el Excel con ${ventasPeriodo.length} tickets.`, tipo: "exito" });
  };

  const manejarGuardarConfiguracion = async (e: React.FormEvent) => {
    e.preventDefault();
    const exito = await guardarConfiguracion(formConfig);
    if (exito) {
      setAviso({ titulo: "Configuración Guardada", mensaje: "Tus credenciales de facturación se han guardado de forma segura.", tipo: "exito" });
    } else {
      setAviso({ titulo: "Error", mensaje: "No se pudo guardar la configuración. Revisa tu conexión.", tipo: "advertencia" });
    }
  };

  return (
    <div className={cn(
      "w-full flex flex-col p-6 animate-in fade-in duration-300",
      integrada ? "flex-none" : "h-full overflow-y-auto scrollbar-hide"
    )}>
      <ModalAviso 
        abierto={Boolean(aviso)} 
        titulo={aviso?.titulo ?? ""} 
        mensaje={aviso?.mensaje ?? ""} 
        tipo={aviso?.tipo} 
        alCerrar={() => setAviso(null)} 
      />

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400">
            <FileSpreadsheet size={24} />
          </div>
          Facturación y Reportes
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Exporta reportes para tu contador y configura la conexión con tu proveedor de facturas.
        </p>
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl max-w-md">
        <button 
          onClick={() => setPestanaActiva("REPORTES")}
          className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all", pestanaActiva === "REPORTES" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
        >
          Reporte Contable
        </button>
        <button 
          onClick={() => setPestanaActiva("CONFIGURACION")}
          className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all", pestanaActiva === "CONFIGURACION" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
        >
          Configuración Fiscal
        </button>
      </div>

      {pestanaActiva === "REPORTES" ? (
        <div className="max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-white/10 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Exportar Ventas a Excel</h2>
              <p className="text-xs text-slate-500">Desglose de Subtotal, IVA y métodos de pago para tu contador.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <label className="flex-1 text-xs font-bold text-slate-600 dark:text-slate-400">
              Fecha Inicial
              <CampoFecha value={fechaInicio} onChange={setFechaInicio} className="mt-2 w-full" aria-label="Fecha inicial" />
            </label>
            <label className="flex-1 text-xs font-bold text-slate-600 dark:text-slate-400">
              Fecha Final
              <CampoFecha value={fechaFin} onChange={setFechaFin} className="mt-2 w-full" aria-label="Fecha final" />
            </label>
          </div>

          <button 
            onClick={exportarReporteContador}
            className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={18} /> Descargar Archivo Excel
          </button>
        </div>
      ) : (
        <form onSubmit={manejarGuardarConfiguracion} className="max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-white/10 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Credenciales del Proveedor (BYOK)</h2>
              <p className="text-xs text-slate-500">Conecta tu propia cuenta para emitir facturas (timbres a tu cargo).</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Proveedor de Facturación</label>
              <select 
                value={formConfig.proveedor}
                onChange={(e) => setCambiosConfig((actual) => ({ ...actual, proveedor: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              >
                <option value="facturapi">Facturapi</option>
                <option value="contalink">Contalink</option>
                <option value="sat">Portal SAT (Próximamente)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">API Key Secreta (Test o Live)</label>
              <input 
                type="password" 
                value={formConfig.facturapi_key}
                onChange={(e) => setCambiosConfig((actual) => ({ ...actual, facturapi_key: e.target.value }))}
                placeholder="sk_test_..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">RFC Emisor</label>
                <input 
                  type="text" 
                  value={formConfig.rfc_emisor}
                  onChange={(e) => setCambiosConfig((actual) => ({ ...actual, rfc_emisor: e.target.value.toUpperCase() }))}
                  placeholder="XAXX010101000"
                  maxLength={13}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Régimen Fiscal (Clave)</label>
                <input 
                  type="text" 
                  value={formConfig.regimen_fiscal}
                  onChange={(e) => setCambiosConfig((actual) => ({ ...actual, regimen_fiscal: e.target.value.replace(/\D/g, '') }))}
                  placeholder="612"
                  maxLength={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl mb-6">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
              <strong>Privacidad Asegurada:</strong> Tu llave API se cifra y guarda en la base de datos de tu tienda. MiTienda no tiene acceso para utilizar tus timbres ni cobra comisiones por facturar.
            </p>
          </div>

          <button 
            type="submit"
            disabled={cargando || !formConfig.facturapi_key}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cargando ? "Guardando..." : "Guardar Configuración"}
          </button>
        </form>
      )}
    </div>
  );
}