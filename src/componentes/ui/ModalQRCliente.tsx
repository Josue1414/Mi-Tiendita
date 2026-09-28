// src/componentes/ui/ModalQRCliente.tsx
import QRCode from "react-qr-code";
import { X, MonitorSmartphone, Wifi } from "lucide-react";
import { useEstadoConfiguracion } from "../../estado/estadoConfiguracion"; // <-- IMPORTACIÓN

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  nombreCaja: string;
}

export default function ModalQRCliente({ abierto, alCerrar, nombreCaja }: Props) {
  // Extraemos el nombre de la tienda del estado
  const { nombreTienda } = useEstadoConfiguracion();

  if (!abierto) return null;

  const tiendaId = localStorage.getItem("tienda_id_cache") || "tienda-demo";
  const idUnico = `pos-${tiendaId}-${nombreCaja}`.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  let baseUrl = window.location.origin;
  
  if (baseUrl.includes("file://") || baseUrl.includes("localhost")) {
      baseUrl = "https://ahorratiempo-mitienda.pages.dev"; 
  }

  // SOLUCIÓN: Agregamos &tienda= al final del enlace
  const urlCliente = `${baseUrl}?peer=${idUnico}&cliente=${encodeURIComponent(nombreCaja)}&tienda=${encodeURIComponent(nombreTienda)}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={alCerrar}>
      <div 
        className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-950/50 shrink-0 sticky top-0 z-10">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <MonitorSmartphone className="text-emerald-600" size={20} />
            Pantalla Remota
          </h2>
          <button onClick={alCerrar} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5 flex flex-col items-center text-center gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Escanea este código con cualquier celular o tablet. El dispositivo mostrará las ventas de <strong>{nombreCaja}</strong> al instante.
          </p>

          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 relative flex items-center justify-center shrink-0">
            <QRCode value={urlCliente} size={180} className="rounded-lg" />
          </div>

          <div className="w-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 p-3.5 rounded-xl text-xs text-left border border-emerald-200 dark:border-emerald-800/30 flex gap-3 items-start shadow-sm shrink-0">
            <Wifi size={18} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              La conexión utiliza comunicación directa <strong>Peer-to-Peer</strong>. No requiere configurar redes, no necesita cables y no consume base de datos.
            </p>
          </div>

          <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-white/5 shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">O ingresa esta URL en la tablet:</p>
            <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 break-all select-all font-semibold">
              {urlCliente}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}