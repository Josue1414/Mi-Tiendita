import { LogOut } from "lucide-react";
import type { SeccionApp } from "../../estado/estadoNavegacion";
import AccionEscaneoInventario from "../movil/AccionEscaneoInventario";
import type { ItemMenuApp, PropsAlertasMenu } from "./tipos";

interface PropsMenuMovil extends PropsAlertasMenu {
  menus: ItemMenuApp[];
  puntoEscaneo: number;
  seccionActual: SeccionApp;
  setSeccionActual: (seccion: SeccionApp) => void;
  abrirPantallaCliente: () => void;
  cerrarSesion: () => void;
}

export default function MenuMovil({
  alertasPorTerminar,
  alertasAgotados,
  alertasCaducadas,
  menus,
  puntoEscaneo,
  seccionActual,
  setSeccionActual,
  abrirPantallaCliente,
  cerrarSesion,
}: PropsMenuMovil) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 h-[4.75rem] lg:hidden border-t border-slate-200/70 bg-white/95 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-zinc-950/95">
      <div className="absolute inset-y-0 left-0 right-1/2 min-w-0 overflow-hidden pr-14">
        <div className="h-full w-full min-w-0 touch-pan-x overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-1 px-2 py-2">
            {menus.slice(0, puntoEscaneo).map((menu) => {
              const Icono = menu.icono;
              const activo = menu.id !== "pantalla-cliente" && (seccionActual === menu.id || (menu.id === "inventario" && seccionActual === "nuevo-producto"));

              return (
                <button key={menu.id} onClick={() => {
                  if (menu.id === "pantalla-cliente") {
                    abrirPantallaCliente();
                    return;
                  }
                  setSeccionActual(menu.id as SeccionApp);
                }} title={menu.texto} className={`relative flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold ${activo ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"}`}>
                  <Icono size={18} />
                  <span className="max-w-[4.5rem] truncate">{menu.texto}</span>
                  {menu.id === "stock-bajo" && alertasPorTerminar > 0 && (
                    <span className="absolute left-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white shadow-sm">
                      {alertasPorTerminar > 99 ? "99+" : alertasPorTerminar}
                    </span>
                  )}
                  {menu.id === "stock-bajo" && alertasAgotados > 0 && (
                    <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
                      {alertasAgotados > 99 ? "99+" : alertasAgotados}
                    </span>
                  )}
                  {menu.id === "stock-bajo" && alertasCaducadas > 0 && (
                    <span className="absolute bottom-[21px] left-1/2 flex h-4 min-w-4 -translate-x-1/2 items-center justify-center rounded-full bg-purple-600 px-1 text-[9px] font-bold text-white shadow-sm">
                      {alertasCaducadas > 99 ? "99+" : alertasCaducadas}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <AccionEscaneoInventario />
      <div className="absolute inset-y-0 left-1/2 right-0 min-w-0 overflow-hidden pl-14">
        <div className="h-full w-full min-w-0 touch-pan-x overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max items-center gap-1 px-2 py-2">
            {menus.slice(puntoEscaneo).map((menu) => {
              const Icono = menu.icono;
              const activo = menu.id !== "pantalla-cliente" && (seccionActual === menu.id || (menu.id === "inventario" && seccionActual === "nuevo-producto"));

              return (
                <button key={menu.id} onClick={() => {
                  if (menu.id === "pantalla-cliente") {
                    abrirPantallaCliente();
                    return;
                  }
                  setSeccionActual(menu.id as SeccionApp);
                }} title={menu.texto} className={`relative flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold ${activo ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"}`}>
                  <Icono size={18} />
                  <span className="max-w-[4.5rem] truncate">{menu.texto}</span>
                  {menu.id === "stock-bajo" && alertasPorTerminar > 0 && (
                    <span className="absolute left-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white shadow-sm">
                      {alertasPorTerminar > 99 ? "99+" : alertasPorTerminar}
                    </span>
                  )}
                  {menu.id === "stock-bajo" && alertasAgotados > 0 && (
                    <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm">
                      {alertasAgotados > 99 ? "99+" : alertasAgotados}
                    </span>
                  )}
                  {menu.id === "stock-bajo" && alertasCaducadas > 0 && (
                    <span className="absolute bottom-[21px] left-1/2 flex h-4 min-w-4 -translate-x-1/2 items-center justify-center rounded-full bg-purple-600 px-1 text-[9px] font-bold text-white shadow-sm">
                      {alertasCaducadas > 99 ? "99+" : alertasCaducadas}
                    </span>
                  )}
                </button>
              );
            })}
            <button onClick={cerrarSesion} title="Cerrar Sesión" className="flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"><LogOut size={18} /><span>Salir</span></button>
          </div>
        </div>
      </div>
    </nav>
  );
}
