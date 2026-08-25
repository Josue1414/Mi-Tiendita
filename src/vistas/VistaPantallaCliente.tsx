// src/vistas/VistaPantallaCliente.tsx
import { useEffect, useState } from "react";
import { CheckCircle2, ShoppingCart, Settings, Sun, Moon, X } from "lucide-react";
import { useReceptorPantallaCliente } from "../hooks/usePantallaCliente";
import ImagenLocal from "../componentes/ui/ImagenLocal";
import QRCode from "qrcode";

type Densidad = "compacta" | "normal" | "amplia";
type Tema = "verde" | "claro" | "oscuro" | "grafito";

const estilosTema: Record<Tema, string> = {
  verde: "bg-emerald-800 text-white",
  claro: "bg-slate-100 text-slate-900",
  oscuro: "bg-black text-white",
  grafito: "bg-zinc-900 text-zinc-100",
};

export default function VistaPantallaCliente() {
  const { datosCarrito, mensajeExito } = useReceptorPantallaCliente();
  const [hora, setHora] = useState("");
  const [opcionesAbiertas, setOpcionesAbiertas] = useState(false);
  const [densidad, setDensidad] = useState<Densidad>("compacta");
  const [tema, setTema] = useState<Tema>("verde");

  useEffect(() => {
    const actualizarHora = () => setHora(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
    actualizarHora();
    const intervalo = window.setInterval(actualizarHora, 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  const compacto = densidad === "compacta";
  const altoFila = compacto ? "h-11" : densidad === "normal" ? "h-14" : "h-20";
  const textoNombre = compacto ? "text-sm" : densidad === "normal" ? "text-base" : "text-lg";
  const textoTotal = compacto ? "text-4xl" : densidad === "normal" ? "text-5xl" : "text-6xl";
  const temaClaro = tema === "claro";
  const transferenciaActiva = datosCarrito.metodoPago === "TRANSFERENCIA" && datosCarrito.datosTransferencia;

  return (
    <div className={`w-screen h-screen flex flex-col select-none overflow-hidden ${estilosTema[tema]}`}>
      <header className={`flex items-center justify-between px-5 py-3 border-b ${temaClaro ? "border-slate-200 bg-white" : "border-white/10 bg-black/20"}`}>
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${temaClaro ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/20 text-emerald-300"}`}>
            <ShoppingCart size={20} />
          </div>
          <h1 className="text-lg font-bold tracking-wide">Mi Tienda</h1>
        </div>
        <span className={`text-sm font-semibold ${temaClaro ? "text-slate-500" : "text-emerald-200"}`}>{hora}</span>
      </header>

      <button
        onClick={() => setOpcionesAbiertas((abierto) => !abierto)}
        aria-label="Opciones de pantalla"
        className={`absolute right-3 top-3 z-20 rounded-full p-1.5 opacity-60 hover:opacity-100 ${temaClaro ? "text-slate-500 hover:bg-slate-100" : "text-white hover:bg-white/10"}`}
      >
        {opcionesAbiertas ? <X size={15} /> : <Settings size={15} />}
      </button>

      {opcionesAbiertas && (
        <div className="fixed inset-0 z-10" onClick={() => setOpcionesAbiertas(false)}>
          <div onClick={(evento) => evento.stopPropagation()} className={`absolute right-3 top-12 z-20 w-56 rounded-xl border p-3 shadow-xl ${temaClaro ? "border-slate-200 bg-white" : "border-white/10 bg-slate-900/95"}`}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider opacity-60">Vista</p>
          <div className="grid grid-cols-3 gap-1">
            {(["compacta", "normal", "amplia"] as Densidad[]).map((opcion) => (
              <button key={opcion} onClick={() => setDensidad(opcion)} className={`rounded-md px-1 py-1.5 text-[10px] font-semibold ${densidad === opcion ? "bg-emerald-500 text-white" : "bg-black/10 opacity-70"}`}>
                {opcion}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-3 text-[10px] font-bold uppercase tracking-wider opacity-60">Tema</p>
          <div className="grid grid-cols-2 gap-1">
            {(["verde", "claro", "oscuro", "grafito"] as Tema[]).map((opcion) => (
              <button key={opcion} onClick={() => setTema(opcion)} className={`flex items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-semibold ${tema === opcion ? "bg-emerald-500 text-white" : "bg-black/10 opacity-70"}`}>
                {opcion === "claro" ? <Sun size={11} /> : opcion === "oscuro" ? <Moon size={11} /> : null}
                {opcion}
              </button>
            ))}
          </div>
          </div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col px-5 py-4">
        {mensajeExito ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 size={70} className="text-emerald-400" />
            <h2 className="text-3xl font-bold">Gracias por su compra</h2>
            <p className="text-xl opacity-75">Total pagado: ${mensajeExito.total.toFixed(2)}</p>
            <p className="max-w-xl text-base text-emerald-200">{mensajeExito.mensajePago}</p>
          </div>
        ) : transferenciaActiva ? (
          <div className="flex h-full min-h-0 flex-col items-center justify-start gap-3 pt-6 text-center sm:gap-4 sm:pt-10">
            <p className="text-xl font-bold text-emerald-400 sm:text-2xl">Realiza tu transferencia</p>
            <div className={`flex max-w-3xl items-center gap-5 rounded-2xl border p-5 text-left sm:gap-8 sm:p-7 ${temaClaro ? "border-emerald-200 bg-white shadow-sm" : "border-emerald-400/30 bg-black/25"}`}>
              {datosCarrito.datosTransferencia?.cuenta && <TransferenciaQr cuenta={datosCarrito.datosTransferencia.cuenta} banco={datosCarrito.datosTransferencia.banco} grande />}
              <div className="text-lg leading-relaxed">
                <p><strong>Banco:</strong> {datosCarrito.datosTransferencia?.banco || "No especificado"}</p>
                {datosCarrito.datosTransferencia?.titular && <p><strong>Titular:</strong> {datosCarrito.datosTransferencia.titular}</p>}
                <p className="break-all"><strong>Cuenta:</strong> {datosCarrito.datosTransferencia?.cuenta || "No especificada"}</p>
              </div>
            </div>
            <div className={`absolute bottom-12 left-5 right-5 flex items-center justify-between rounded-2xl px-5 py-3 sm:px-7 sm:py-4 ${temaClaro ? "bg-white shadow-sm" : "bg-black/25"}`}>
              <span className="text-lg opacity-75 sm:text-2xl">Total a pagar</span>
              <span className="text-4xl font-bold text-emerald-400 sm:text-5xl">${datosCarrito.total.toFixed(2)}</span>
            </div>
          </div>
        ) : datosCarrito.items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 opacity-50">
            <ShoppingCart size={64} />
            <h2 className="text-2xl font-bold">Bienvenido</h2>
            <p className="text-base">Esperando productos...</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">Su compra</h2>
              <span className="text-xs opacity-60">{datosCarrito.items.length} productos</span>
            </div>
            {transferenciaActiva && (
              <div className={`mb-3 flex items-center gap-3 rounded-xl border p-3 ${temaClaro ? "border-emerald-200 bg-emerald-50" : "border-emerald-400/30 bg-emerald-950/50"}`}>
                <div className="min-w-0 flex-1 text-xs">
                  <p className="mb-1 font-bold text-emerald-400">Datos para transferencia</p>
                  <p>Banco: {datosCarrito.datosTransferencia?.banco || "No especificado"}</p>
                  {datosCarrito.datosTransferencia?.titular && <p>Titular: {datosCarrito.datosTransferencia.titular}</p>}
                  <p className="break-all">Cuenta: {datosCarrito.datosTransferencia?.cuenta || "No especificada"}</p>
                </div>
                {datosCarrito.datosTransferencia?.cuenta && <TransferenciaQr cuenta={datosCarrito.datosTransferencia.cuenta} banco={datosCarrito.datosTransferencia.banco} />}
              </div>
            )}
            <div className="grid min-h-0 flex-1 content-start grid-cols-1 gap-1.5 overflow-y-auto pr-1">
              {datosCarrito.items.map((item) => (
                <div key={item.id} className={`flex ${altoFila} items-center justify-between gap-3 rounded-lg px-3 ${temaClaro ? "bg-white shadow-sm" : "bg-black/20"}`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <ImagenLocal nombreArchivo={item.imagen_url} nombreProducto={item.nombre} className={`${compacto ? "h-7 w-7" : "h-10 w-10"} shrink-0 rounded-md object-cover text-xs`} />
                    <div className="min-w-0">
                      <h3 className={`${textoNombre} truncate font-semibold`}>{item.nombre}</h3>
                      <p className="text-[11px] opacity-60">{item.cantidad} {item.unidad.toLowerCase()} · ${item.precio.toFixed(2)}</p>
                    </div>
                  </div>
                  <span className={`${compacto ? "text-sm" : "text-base"} shrink-0 font-bold`}>${item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className={`mt-3 flex items-center justify-between rounded-xl px-5 py-3 ${temaClaro ? "bg-white shadow-sm" : "bg-black/25"}`}>
              <span className="text-lg opacity-75">Total a pagar</span>
              <span className={`${textoTotal} font-bold text-emerald-400`}>${datosCarrito.total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </main>

      <footer className={`flex items-center justify-center gap-2 border-t py-2 text-[10px] uppercase tracking-widest opacity-50 ${temaClaro ? "border-slate-200" : "border-white/10"}`}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Sistema conectado
      </footer>
    </div>
  );
}

function TransferenciaQr({ cuenta, banco, grande = false }: { cuenta: string; banco: string; grande?: boolean }) {
  const [codigo, setCodigo] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    QRCode.toDataURL(`Cuenta para transferencia: ${cuenta}\nBanco: ${banco}`, { width: grande ? 240 : 72, margin: 1 })
      .then((url) => { if (activo) setCodigo(url); })
      .catch(() => { if (activo) setCodigo(null); });
    return () => { activo = false; };
  }, [banco, cuenta]);

  return codigo ? <img src={codigo} alt="Código QR de transferencia" className={`${grande ? "h-44 w-44 sm:h-56 sm:w-56" : "h-16 w-16"} shrink-0 rounded-md bg-white p-1`} /> : null;
}
