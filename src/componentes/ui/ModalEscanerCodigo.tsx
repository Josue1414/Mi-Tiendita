import { useEffect, useRef, useState } from "react";
import { Barcode, Camera, X } from "lucide-react";

interface PropsModalEscanerCodigo {
  abierto: boolean;
  alCerrar: () => void;
  alDetectar: (codigo: string) => void;
}

type DetectorCodigo = { detect: (imagen: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type ConstructorDetector = new (opciones?: { formats?: string[] }) => DetectorCodigo;

export default function ModalEscanerCodigo({ abierto, alCerrar, alDetectar }: PropsModalEscanerCodigo) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  const [codigoManual, setCodigoManual] = useState("");

  const enviarCodigoManual = () => {
    const codigo = codigoManual.trim();
    if (codigo.length < 4) {
      setError("Escribe un código válido de al menos 4 caracteres.");
      return;
    }
    alDetectar(codigo);
  };

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    const iniciar = async () => {
      try {
        const stream = await navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelado || !stream || !videoRef.current) return;
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const Constructor = (window as Window & { BarcodeDetector?: ConstructorDetector }).BarcodeDetector;
        if (!Constructor) {
          setError("Tu navegador no detecta códigos desde la cámara. Usa un escáner USB o captura el código manualmente.");
          return;
        }
        const detector = new Constructor({ formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf", "codabar"] });
        setEscaneando(true);
        const revisar = async () => {
          if (cancelado || !videoRef.current) return;
          try {
            const resultados = await detector.detect(videoRef.current);
            const codigo = resultados[0]?.rawValue?.trim();
            if (codigo) {
              alDetectar(codigo);
              alCerrar();
              return;
            }
          } catch {
            setError("No se pudo leer el código. Acerca y enfoca la etiqueta.");
          }
          window.setTimeout(revisar, 250);
        };
        revisar();
      } catch {
        setError("No se pudo abrir la cámara. Concede permiso al navegador o escribe el código manualmente.");
      }
    };
    iniciar();
    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((pista) => pista.stop());
      streamRef.current = null;
      setEscaneando(false);
    };
  }, [abierto, alCerrar, alDetectar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={alCerrar}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900" onClick={(evento) => evento.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100"><Camera size={18} className="text-emerald-600" /> Escanear código</h2>
          <button onClick={alCerrar} aria-label="Cerrar cámara" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        <div className="relative aspect-video bg-slate-950">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-emerald-400/90" />
          {!escaneando && <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-white/80"><Barcode size={26} className="mr-2" /> Preparando cámara...</div>}
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Apunta al código de la envoltura y mantenlo dentro del recuadro.</p>
          {error && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{error}</p>}
          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
            <Camera size={16} /> Usar foto del código
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={() => setError("La lectura desde foto depende del soporte del navegador. Si no se detecta, escribe el código manualmente.")} />
          </label>
          <div className="mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
            <label htmlFor="codigo-manual" className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Escribir código manualmente</label>
            <div className="flex gap-2">
              <input
                id="codigo-manual"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={codigoManual}
                onChange={(evento) => setCodigoManual(evento.target.value)}
                onKeyDown={(evento) => { if (evento.key === "Enter") enviarCodigoManual(); }}
                placeholder="Ej. 7501234567890"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              />
              <button type="button" onClick={enviarCodigoManual} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-700">Buscar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
