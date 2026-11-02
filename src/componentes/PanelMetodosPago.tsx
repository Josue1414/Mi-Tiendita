import { useState, useRef, useEffect } from "react";
import { QrCode, Smartphone, Save, ImagePlus, X, AlertTriangle } from "lucide-react";
import { useEstadoConfiguracion } from "../estado/estadoConfiguracion";
import ModalAviso from "./ui/ModalAviso";
import { cn } from "../utilidades/utils";

export default function PanelMetodosPago() {
  const { mp_access_token, mp_pos_id, codi_imagen, codi_clabe, cargando, setCredencialesMP, setConfiguracionCodi } = useEstadoConfiguracion();
  
  const [pestana, setPestana] = useState<"CODI" | "MP">("CODI");
  const [formCodi, setFormCodi] = useState({ clabe: codi_clabe || "", imagen: codi_imagen || "" });
  const formCodiModificado = useRef(false);
  const [formMp, setFormMp] = useState({ token: mp_access_token || "", posId: mp_pos_id || "" });
  const [guardandoCodi, setGuardandoCodi] = useState(false);
  const [aviso, setAviso] = useState<{ titulo: string; mensaje: string; tipo: "exito" | "info" | "advertencia" } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cargando || formCodiModificado.current) return;
    setFormCodi({ clabe: codi_clabe || "", imagen: codi_imagen || "" });
  }, [cargando, codi_clabe, codi_imagen]);

  const manejarSubidaQR = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evento) => {
      const imagen = evento.target?.result;
      if (typeof imagen !== "string") return;
      formCodiModificado.current = true;
      setFormCodi(prev => ({ ...prev, imagen }));
    };
    reader.readAsDataURL(file);
  };

  const guardarCodi = async () => {
    setGuardandoCodi(true);
    try {
      await setConfiguracionCodi(formCodi.imagen, formCodi.clabe);
      formCodiModificado.current = false;
      setAviso({ titulo: "CoDi Guardado", mensaje: "El QR y la CLABE se guardaron y se mostrarán en la pantalla cliente al cobrar.", tipo: "exito" });
    } catch (error) {
      console.error("No se pudo guardar la configuración de CoDi:", error);
      setAviso({
        titulo: "Error al guardar CoDi",
        mensaje: `No se guardaron el QR ni la CLABE. ${error instanceof Error ? error.message : String(error)}`,
        tipo: "advertencia"
      });
    } finally {
      setGuardandoCodi(false);
    }
  };

  const guardarMP = () => {
    setCredencialesMP(formMp.token, formMp.posId);
    setAviso({ titulo: "Mercado Pago Guardado", mensaje: "Las credenciales se guardaron localmente en esta caja.", tipo: "exito" });
  };

  return (
    <div className="max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-white/10 p-6 shadow-sm">
      <ModalAviso abierto={Boolean(aviso)} titulo={aviso?.titulo ?? ""} mensaje={aviso?.mensaje ?? ""} tipo={aviso?.tipo} alCerrar={() => setAviso(null)} />
      
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <QrCode size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Métodos de Pago Digitales</h2>
          <p className="text-xs text-slate-500">Configura tus propias cuentas bancarias para recibir pagos directo (BYOK).</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl">
        <button onClick={() => setPestana("CODI")} className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2", pestana === "CODI" ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
          <QrCode size={16} /> QR CoDi / Banco
        </button>
        <button onClick={() => setPestana("MP")} className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2", pestana === "MP" ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
          <Smartphone size={16} /> Mercado Pago
        </button>
      </div>

      {pestana === "CODI" ? (
        <div className="animate-in fade-in space-y-4">
          <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-xl mb-2">
            <AlertTriangle size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800 dark:text-emerald-400">
              Sube el código QR estático generado desde la app de tu banco. Al cobrar, se proyectará en la pantalla del cliente junto con el monto a transferir. <b>Cero comisiones.</b>
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">CLABE Interbancaria (Opcional)</label>
            <input type="text" value={formCodi.clabe} onChange={(e) => {
              formCodiModificado.current = true;
              setFormCodi({ ...formCodi, clabe: e.target.value.replace(/\D/g, '') });
            }} disabled={guardandoCodi} maxLength={18} placeholder="18 dígitos" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white font-mono disabled:opacity-60" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Imagen del QR (CoDi)</label>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950">
                {formCodi.imagen ? (
                  <img src={formCodi.imagen} alt="QR CoDi" className="w-full h-full object-contain" />
                ) : (
                  <QrCode size={32} className="text-slate-300 dark:text-slate-600" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input type="file" accept="image/*" ref={fileInputRef} onChange={manejarSubidaQR} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={guardandoCodi} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl flex items-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
                  <ImagePlus size={16} /> Subir Imagen QR
                </button>
                {formCodi.imagen && (
                  <button onClick={() => {
                    formCodiModificado.current = true;
                    setFormCodi({ ...formCodi, imagen: "" });
                  }} disabled={guardandoCodi} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-sm font-bold rounded-xl flex items-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
                    <X size={16} /> Quitar
                  </button>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => void guardarCodi()} disabled={guardandoCodi} className="mt-4 w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60">
            <Save size={18} /> {guardandoCodi ? "Guardando..." : "Guardar CoDi"}
          </button>
        </div>
      ) : (
        <div className="animate-in fade-in space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">Access Token (Producción)</label>
            <input type="password" value={formMp.token} onChange={(e) => setFormMp({ ...formMp, token: e.target.value })} placeholder="APP_USR-..." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">ID de Caja (External POS ID)</label>
            <input type="text" value={formMp.posId} onChange={(e) => setFormMp({ ...formMp, posId: e.target.value })} placeholder="CAJA_01" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-mono" />
          </div>
          <button onClick={guardarMP} className="mt-4 w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2">
            <Save size={18} /> Guardar Mercado Pago
          </button>
        </div>
      )}
    </div>
  );
}