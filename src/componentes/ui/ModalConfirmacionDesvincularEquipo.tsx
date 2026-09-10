import React from "react";
import { AlertTriangle, Check, X, Wifi, CloudLightning } from "lucide-react";

interface Dispositivo {
  id: string;
  hardware_id: string;
  nombre_dispositivo: string;
  ultimo_acceso: string;
  tienda_id: string;
  es_cerebro?: boolean;
}

interface PropsModalConfirmacionDesvincularEquipo {
  abierto: boolean;
  equipo: Dispositivo | null;
  dispositivos: Dispositivo[];
  alCerrar: () => void;
  alConfirmar: (nuevoCerebroId?: string) => Promise<void> | void;
}

export default function ModalConfirmacionDesvincularEquipo({
  abierto,
  equipo,
  dispositivos,
  alCerrar,
  alConfirmar,
}: PropsModalConfirmacionDesvincularEquipo) {
  const [nuevoCerebroId, setNuevoCerebroId] = React.useState<string>("");
  const candidatos = dispositivos.filter((d) => d.id !== equipo?.id);

  React.useEffect(() => {
    if (abierto && candidatos.length > 0) {
      setNuevoCerebroId(candidatos[0].id);
    } else {
      setNuevoCerebroId("");
    }
  }, [abierto, equipo?.id, dispositivos]);

  if (!abierto || !equipo) return null;

  const esCerebro = Boolean(equipo.es_cerebro);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={alCerrar}>
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
            <AlertTriangle size={24} />
          </div>
          <button onClick={alCerrar} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Confirmar desvinculación</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {esCerebro
              ? `Se va a eliminar la PC cerebro “${equipo.nombre_dispositivo}”. Antes de hacerlo elige la nueva PC que asumirá el rol de cerebro para sincronizar la tienda.`
              : `¿Deseas desvincular “${equipo.nombre_dispositivo}” de esta tienda?`}
          </p>

          {esCerebro && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20 p-4">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-black text-xs uppercase tracking-wide">
                <CloudLightning size={16} /> Nuevo cerebro requerido
              </div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                El nuevo cerebro debe estar conectado a internet para sincronizar la información encriptada y actualizar la red del negocio.
              </p>

              <div className="mt-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Dispositivos disponibles</span>
                <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/60">
                  {candidatos.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500 dark:text-slate-400">No hay otra PC registrada para asumir el cerebro.</div>
                  ) : (
                    candidatos.map((disp) => (
                      <label key={disp.id} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <input
                          type="radio"
                          name="nuevo_cerebro"
                          value={disp.id}
                          checked={nuevoCerebroId === disp.id}
                          onChange={(e) => setNuevoCerebroId(e.target.value)}
                          className="accent-emerald-600"
                        />
                        <div className="flex-1">
                          <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">{disp.nombre_dispositivo}</span>
                          <span className="block text-[10px] font-mono text-slate-500 dark:text-slate-400">{disp.hardware_id.slice(0, 12)}...</span>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                          <Wifi size={10} /> {disp.ultimo_acceso ? new Date(disp.ultimo_acceso).toLocaleDateString('es-MX') : 'Sin acceso'}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={alCerrar} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={() => alConfirmar(esCerebro ? nuevoCerebroId : undefined)} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02]">
            <span className="inline-flex items-center gap-2">
              <Check size={16} /> Desvincular
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
