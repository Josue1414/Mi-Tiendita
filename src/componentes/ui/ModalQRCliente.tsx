// src/componentes/ui/ModalQRCliente.tsx
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Capacitor } from "@capacitor/core";
import { X, MonitorSmartphone } from "lucide-react";
import { androidLan } from "../../servicios/androidLan";
import { useEstadoConfiguracion } from "../../estado/estadoConfiguracion";
import { useEstadoRed } from "../../estado/estadoRed";
import { obtenerIdentificadorDispositivo, obtenerTiendaIdActual } from "../../servicios/supabase";
import { generarSlug } from "../../utilidades/utils";
import { crearIdPeer } from "../../hooks/usePantallaCliente";

const CLAVE_MODO_CONEXION = "modo_conexion_pantalla_cliente_v2";

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  nombreCaja: string;
}

export default function ModalQRCliente({ abierto, alCerrar, nombreCaja }: Props) {
  const { nombreTienda } = useEstadoConfiguracion();
  const { esMaestro, ipMaestro, setIpMaestro } = useEstadoRed();
  const esAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  const [baseUrl, setBaseUrl] = useState("");
  const [errorConexion, setErrorConexion] = useState("");
  const [intentosConexion, setIntentosConexion] = useState(0);
  const [modoConexion, setModoConexion] = useState<"internet" | "local">(() =>
    localStorage.getItem(CLAVE_MODO_CONEXION) === "local" ? "local" : "internet"
  );

  const seleccionarModoConexion = (modo: "internet" | "local") => {
    localStorage.setItem(CLAVE_MODO_CONEXION, modo);
    setModoConexion(modo);
  };

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    let cancelarDescubrimiento: (() => void) | null = null;

    const descubrirCerebro = async () => {
      const api = window.apiLocal;
      if (!api?.onCerebroDetectado || !api.iniciarDescubrimientoLAN) {
        throw new Error("Este equipo no puede buscar el Cerebro automáticamente. Configura su IP desde Configuración > Red.");
      }

      const tiendaId = await obtenerTiendaIdActual();
      const deviceId = await obtenerIdentificadorDispositivo();
      if (!tiendaId) throw new Error("No se encontró la tienda activa para buscar el Cerebro.");

      return new Promise<{ ip: string; puertoWeb: number }>((resolve, reject) => {
        let finalizado = false;
        let quitarListener: (() => void) | null = null;
        const temporizador = window.setTimeout(() => {
          finalizar(() => reject(new Error("No se encontró el Cerebro en la red. Verifica que ambos equipos estén en la misma Wi-Fi y vuelve a intentar.")));
        }, 10000);

        const finalizar = (accion: () => void) => {
          if (finalizado) return;
          finalizado = true;
          window.clearTimeout(temporizador);
          quitarListener?.();
          cancelarDescubrimiento = null;
          accion();
        };

        cancelarDescubrimiento = () => {
          finalizar(() => reject(new Error("Se canceló la búsqueda del Cerebro.")));
        };
        quitarListener = api.onCerebroDetectado((cerebro) => {
          if (cerebro.tiendaId !== tiendaId || cerebro.deviceId === deviceId) return;
          if (![4000, 4001].includes(cerebro.puertoWeb)) return;
          finalizar(() => resolve({ ip: cerebro.ip, puertoWeb: cerebro.puertoWeb }));
        });

        void api.iniciarDescubrimientoLAN().catch((error: unknown) => {
          finalizar(() => reject(error));
        });
      });
    };

    const obtenerBaseUrl = async () => {
      setBaseUrl("");
      setErrorConexion("");
      try {
        if (modoConexion === "internet") {
          if (!cancelado) setBaseUrl("https://mitienda.ahorratiempo.com.mx");
          return;
        }

        if (esAndroid && modoConexion === "local") {
          if (esMaestro) {
            let estado = await androidLan.getServerStatus();
            if (!estado.activo) estado = await androidLan.startServer();
            if (!estado.activo || !estado.ip || estado.ip === "127.0.0.1") {
              throw new Error("No se pudo iniciar automáticamente el servidor LAN. Conecta este equipo a una red Wi-Fi y vuelve a intentarlo.");
            }
            if (!cancelado) setBaseUrl(`http://${estado.ip}:${estado.webPort}`);
          } else {
            const puertoWeb = Number(localStorage.getItem("puerto_web_maestro_lan")) || 4000;
            if (!ipMaestro) throw new Error("No se encontró el Cerebro en la red. Conéctate a la misma Wi-Fi e intenta de nuevo.");
            if (!cancelado) setBaseUrl(`http://${ipMaestro}:${puertoWeb}`);
          }
          return;
        }

        const apiLocal = (window as Window & {
          apiLocal?: {
            obtenerEstadoLAN?: () => Promise<{ activo: boolean; ip: string }>;
            obtenerIpLocal?: () => Promise<string>;
          };
        }).apiLocal;
        if (apiLocal?.obtenerEstadoLAN) {
          if (!esMaestro) {
            let hostMaestro = ipMaestro;
            let puertoWeb = Number(localStorage.getItem("puerto_web_maestro_lan"));
            if (!hostMaestro || ![4000, 4001].includes(puertoWeb)) {
              const cerebro = await descubrirCerebro();
              hostMaestro = cerebro.ip;
              puertoWeb = cerebro.puertoWeb;
              localStorage.setItem("puerto_web_maestro_lan", String(puertoWeb));
              setIpMaestro(hostMaestro);
            }
            if (!cancelado) setBaseUrl(`http://${hostMaestro}:${puertoWeb}`);
            return;
          }
          const estado = await apiLocal.obtenerEstadoLAN();
          if (estado.activo && estado.ip && estado.ip !== "127.0.0.1") {
            if (!cancelado) setBaseUrl(`http://${estado.ip}:4000`);
            return;
          }
          throw new Error("El servidor LAN no está activo. Activa este equipo como Cerebro para compartir la pantalla por Wi-Fi.");
        }

        const puertoWebLocal = Number(localStorage.getItem("puerto_web_maestro_lan")) || 4000;
        const puertoActual = Number(window.location.port);
        if (
          window.location.protocol === "http:"
          && window.location.hostname !== "localhost"
          && [4000, 4001].includes(puertoActual)
        ) {
          if (!cancelado) setBaseUrl(window.location.origin);
          return;
        }

        if (ipMaestro) {
          if (!cancelado) setBaseUrl(`http://${ipMaestro}:${puertoWebLocal}`);
          return;
        }

        throw new Error("No se encontró el Cerebro en la red. Conecta este equipo a la misma Wi-Fi y configura su IP desde Configuración > Red.");
      } catch (error: unknown) {
        if (!cancelado) {
          setErrorConexion(error instanceof Error ? error.message : "No se pudo preparar el enlace de la pantalla cliente.");
        }
      }
    };

    void obtenerBaseUrl();
    return () => {
      cancelado = true;
      cancelarDescubrimiento?.();
    };
  }, [abierto, esAndroid, esMaestro, ipMaestro, intentosConexion, modoConexion, setIpMaestro]);

  if (!abierto) return null;

  const idPeer = crearIdPeer(nombreCaja);
  const enlaceCliente = baseUrl
    ? (() => {
      const urlCliente = new URL(baseUrl);
      if (modoConexion === "internet") urlCliente.searchParams.set("peer", idPeer);
      if (modoConexion === "local" && urlCliente.protocol === "http:") {
        const puertoWeb = urlCliente.port || Number(localStorage.getItem("puerto_web_maestro_lan")) || "4000";
        urlCliente.searchParams.set("lanHost", esMaestro ? urlCliente.hostname : ipMaestro || urlCliente.hostname);
        urlCliente.searchParams.set("lanPort", String(puertoWeb));
      }
      urlCliente.searchParams.set("cliente", nombreCaja);
      urlCliente.searchParams.set("tienda", generarSlug(nombreTienda));
      urlCliente.searchParams.set("nombreTienda", nombreTienda);
      return urlCliente.toString();
    })()
    : "";
  const enlaceQR = enlaceCliente;

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
          <div className="grid w-full grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => seleccionarModoConexion("internet")}
              aria-pressed={modoConexion === "internet"}
              className={`rounded-lg px-2 py-2 text-xs font-bold transition-colors ${modoConexion === "internet" ? "bg-white text-emerald-700 shadow dark:bg-slate-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}`}
            >
              Internet · P2P
            </button>
            <button
              type="button"
              onClick={() => seleccionarModoConexion("local")}
              aria-pressed={modoConexion === "local"}
              className={`rounded-lg px-2 py-2 text-xs font-bold transition-colors ${modoConexion === "local" ? "bg-white text-emerald-700 shadow dark:bg-slate-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}`}
            >
              Wi-Fi local
            </button>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {modoConexion === "internet"
              ? <>Escanea este código para conectar una pantalla cliente por Internet mediante P2P y mostrar las ventas de <strong>{nombreCaja}</strong>.</>
              : <>Escanea este código desde un dispositivo conectado a la misma Wi-Fi para mostrar las ventas de <strong>{nombreCaja}</strong> al instante.</>}
          </p>

          {enlaceCliente ? (
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 relative flex items-center justify-center shrink-0">
              <QRCode value={enlaceQR} size={180} className="rounded-lg" />
            </div>
          ) : (
            <div role="alert" className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
              {errorConexion || "Obteniendo la dirección de la red local..."}
              {errorConexion && (
                <button
                  type="button"
                  onClick={() => setIntentosConexion((intento) => intento + 1)}
                  className="mt-2 block font-bold underline"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          {enlaceCliente && (
            <div className="w-full bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-white/5 shrink-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">O ingresa esta URL en la tablet:</p>
              <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 break-all select-all font-semibold">
                {enlaceCliente}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}