import React from "react";
import { ArrowLeft, CheckCircle2, KeyRound, Mail } from "lucide-react";

interface PropsVistaRecuperacionPassword {
  emailSaaS: string;
  setEmailSaaS: (valor: string) => void;
  errorSaaS: string;
  mensajeExito: string;
  cargandoSaaS: boolean;
  modoOfflineInfo: boolean;
  onRecuperar: (e: React.FormEvent) => Promise<void>;
  onVolver: () => void;
}

export default function VistaRecuperacionPassword({
  emailSaaS,
  setEmailSaaS,
  errorSaaS,
  mensajeExito,
  cargandoSaaS,
  modoOfflineInfo,
  onRecuperar,
  onVolver,
}: PropsVistaRecuperacionPassword) {
  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
      <button onClick={onVolver} className="self-start p-2 -ml-2 mb-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <ArrowLeft size={20} />
      </button>

      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
        <KeyRound className="text-emerald-600" /> Recuperar Contraseña
      </h2>
      <p className="text-xs text-slate-500 mb-6">
        Ingresa el correo electrónico asociado a tu cuenta y te enviaremos un enlace para restablecerla.
      </p>

      <form onSubmit={onRecuperar} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
            <span className="inline-flex items-center gap-1.5"><Mail size={12} /> Correo Electrónico</span>
          </label>
          <input
            type="email"
            required
            autoFocus
            autoComplete="username"
            name="recover-email"
            value={emailSaaS}
            onChange={(e) => setEmailSaaS(e.target.value)}
            disabled={modoOfflineInfo}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all disabled:opacity-50"
            placeholder="admin@mitienda.com"
          />
        </div>

        {errorSaaS && (
          <p className="text-red-500 text-xs font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
            {errorSaaS}
          </p>
        )}
        {mensajeExito && (
          <p className="text-emerald-600 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
            {mensajeExito}
          </p>
        )}

        <button
          type="submit"
          disabled={cargandoSaaS || modoOfflineInfo}
          className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base py-3.5 rounded-2xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 flex justify-center items-center gap-2"
        >
          {cargandoSaaS ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Enviando...</> : "Enviar Instrucciones"}
        </button>

        <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-500">
          <CheckCircle2 size={14} className="text-emerald-600" />
          <span>Recuerda revisar spam o correo no deseado.</span>
        </div>
      </form>
    </div>
  );
}
