// src/vistas/pos/EstadoCajaBloqueado.tsx
import { Lock, Wallet } from "lucide-react";

interface EstadoCajaBloqueadoProps {
  turnoExpirado: boolean;
  alIrACaja: () => void;
}

export default function EstadoCajaBloqueado({ turnoExpirado, alIrACaja }: EstadoCajaBloqueadoProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-900/50">
      <div className="efecto-cristal p-10 rounded-3xl border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-slate-900 flex flex-col items-center text-center max-w-md shadow-xl animate-in zoom-in duration-300">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 relative">
          <Wallet size={36} />
          <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-900 rounded-full p-1">
            <Lock size={20} className="text-amber-500" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
          {turnoExpirado ? "Corte de Caja Pendiente" : "Confirma tu fondo de caja"}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
          {turnoExpirado
            ? "Tu horario de salida ha expirado hace más de 1 hora, o dejaste abierto un turno anterior. Debes realizar tu corte de caja y depositar el efectivo para poder continuar operando."
            : "El administrador ha configurado que debes confirmar la recepción del dinero en caja antes de poder realizar ventas o escanear productos."}
        </p>

        <button
          onClick={alIrACaja}
          className="w-full py-4 rounded-xl font-bold flex justify-center items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02]"
        >
          Ir a Corte de Caja
        </button>
      </div>
    </div>
  );
}
