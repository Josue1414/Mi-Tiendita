import { useEffect, useState } from "react";
import { Usb, X, Check } from "lucide-react";

interface DispositivoHardware {
  portId?: string; // Para dispositivos Serial
  deviceId?: string; // Para dispositivos USB
  displayName?: string;
  vendorId?: number;
  productId?: number;
  productName?: string;
  manufacturerName?: string;
}

interface DatosPeticion {
  tipo: "usb" | "serial";
  lista: DispositivoHardware[];
}

export default function ModalSeleccionDispositivo() {
  const [peticion, setPeticion] = useState<DatosPeticion | null>(null);
  const [seleccionado, setSeleccionado] = useState<string>("");

  useEffect(() => {
    const win = window as any;
    // Escuchamos el evento desde Electron
    if (win.apiLocal?.escucharPeticionDispositivos) {
      win.apiLocal.escucharPeticionDispositivos((datos: DatosPeticion) => {
        setPeticion(datos);
        setSeleccionado(""); // Reiniciamos selección
      });
    }
  }, []);

  if (!peticion) return null;

  const cerrarYCancelar = () => {
    const win = window as any;
    if (win.apiLocal?.confirmarDispositivo) {
      win.apiLocal.confirmarDispositivo(""); // Mandar string vacío cancela la solicitud
    }
    setPeticion(null);
  };

  const confirmarSeleccion = () => {
    if (!seleccionado) return;
    const win = window as any;
    if (win.apiLocal?.confirmarDispositivo) {
      win.apiLocal.confirmarDispositivo(seleccionado);
    }
    setPeticion(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900">
        
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Usb size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Seleccionar Dispositivo
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Elige el hardware que deseas conectar.
              </p>
            </div>
          </div>
          <button onClick={cerrarYCancelar} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2 mb-5 scrollbar-hide pr-1">
          {peticion.lista.length === 0 ? (
            <p className="text-sm text-center text-slate-500 py-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              No se detectaron dispositivos compatibles conectados.
            </p>
          ) : (
            peticion.lista.map((disp, index) => {
              // Extraer ID dependiendo si es Serial o USB
              const id = disp.portId || disp.deviceId || String(index);
              const nombreVisible = disp.displayName || disp.productName || `Dispositivo ${peticion.tipo.toUpperCase()} Desconocido`;
              const detalles = disp.manufacturerName ? `Fabricante: ${disp.manufacturerName}` : `ID: ${id}`;

              return (
                <button
                  key={id}
                  onClick={() => setSeleccionado(id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    seleccionado === id
                      ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/50 dark:border-blue-500 dark:bg-blue-900/20"
                      : "border-slate-200 bg-white hover:border-blue-300 dark:border-white/10 dark:bg-slate-950 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{nombreVisible}</span>
                    <span className="text-[10px] text-slate-500">{detalles}</span>
                  </div>
                  {seleccionado === id && <Check size={16} className="text-blue-600 dark:text-blue-400" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={cerrarYCancelar} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={confirmarSeleccion} disabled={!seleccionado} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            Conectar
          </button>
        </div>
      </div>
    </div>
  );
}