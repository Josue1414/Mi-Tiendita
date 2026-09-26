// src/componentes/ui/ModalQRCliente.tsx
import QRCode from "react-qr-code";
import { X, MonitorSmartphone, AlertTriangle } from "lucide-react";

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  ipLocal: string;
  nombreCaja: string;
}

export default function ModalQRCliente({ abierto, alCerrar, ipLocal, nombreCaja }: Props) {
  if (!abierto) return null;

  // Generamos la URL única con la IP LAN y el nombre de esta caja
  const ipLimpia = ipLocal === "127.0.0.1" || !ipLocal ? "localhost" : ipLocal;
  const urlCliente = `http://${ipLimpia}:4000?cliente=${encodeURIComponent(nombreCaja)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={alCerrar}>
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-950/50">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <MonitorSmartphone className="text-emerald-600" size={20} />
            Conectar Pantalla Cliente
          </h2>
          <button onClick={alCerrar} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Escanea este código con la cámara de una tableta o celular. El dispositivo mostrará las ventas de <strong>{nombreCaja}</strong> en tiempo real.
          </p>

          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mt-2">
            <QRCode value={urlCliente} size={160} className="rounded-lg" />
          </div>

          {/* AVISO IMPORTANTE SOBRE LAN Y EL .EXE */}
          <div className="w-full mt-2 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-3.5 rounded-xl text-xs text-left border border-amber-200 dark:border-amber-800/30 flex gap-3 items-start shadow-sm">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Importante:</strong> Para que esta pantalla remota funcione, esta PC debe estar usando la <strong>aplicación de escritorio (.exe)</strong> y ambos dispositivos deben estar conectados a la misma red Wi-Fi.
            </p>
          </div>

          <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-white/5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">O ingresa esta URL en la tablet:</p>
            <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 break-all select-all font-semibold">
              {urlCliente}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}