import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import {
  BarcodeDetector as BarcodeDetectorPonyfill,
  prepareZXingModule,
} from "barcode-detector/ponyfill";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";

interface Props {
  alDetectar?: (codigo: string) => void;
  className?: string;
  activo?: boolean;
}

const FORMATOS_CODIGO = ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf", "codabar"] as const;

prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => path.endsWith(".wasm") ? wasmUrl : prefix + path,
  },
});

export default function PanelCamaraEscaner({ alDetectar, className = "", activo = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorPonyfill | null>(null);
  const alDetectarRef = useRef(alDetectar);
  const timeoutRef = useRef<number | undefined>(undefined);
  const codigosRecientesRef = useRef(new Map<string, number>());
  const [error, setError] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  const [reintentoCamara, setReintentoCamara] = useState(0);
  const [ultimoCodigo, setUltimoCodigo] = useState("");

  useEffect(() => {
    alDetectarRef.current = alDetectar;
  }, [alDetectar]);

  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    const iniciar = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Cámara no soportada en este navegador.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelado || !videoRef.current) {
          stream.getTracks().forEach((pista) => pista.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        detectorRef.current = new BarcodeDetectorPonyfill({ formats: [...FORMATOS_CODIGO] });
        setEscaneando(true);
        setError("");

        const revisar = async () => {
          if (cancelado || !videoRef.current || !detectorRef.current) return;
          try {
            const video = videoRef.current;
            if (!video.videoWidth || !video.videoHeight) {
              timeoutRef.current = window.setTimeout(revisar, 250);
              return;
            }
            const factor = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight);
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(video.videoWidth * factor);
            canvas.height = Math.round(video.videoHeight * factor);
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              timeoutRef.current = window.setTimeout(revisar, 250);
              return;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const ahora = Date.now();
            const resultados = await detectorRef.current.detect(canvas);
            for (const resultado of resultados) {
              const codigo = resultado.rawValue.trim();
              if (!codigo || ahora - (codigosRecientesRef.current.get(codigo) ?? 0) < 1200) continue;

              codigosRecientesRef.current.set(codigo, ahora);
              if (codigosRecientesRef.current.size > 40) {
                for (const [codigoReciente, tiempo] of codigosRecientesRef.current) {
                  if (ahora - tiempo > 10_000) codigosRecientesRef.current.delete(codigoReciente);
                }
              }
              setUltimoCodigo(codigo);
              alDetectarRef.current?.(codigo);
            }
            timeoutRef.current = window.setTimeout(revisar, 180);
          } catch {
            setError("No se pudo leer el código. Acerca y enfoca la etiqueta.");
            timeoutRef.current = window.setTimeout(revisar, 500);
          }
        };
        void revisar();
      } catch (errorCamara: unknown) {
        setError(errorCamara instanceof Error ? errorCamara.message : "No se pudo abrir la cámara.");
      }
    };

    void iniciar();
    return () => {
      cancelado = true;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      streamRef.current?.getTracks().forEach((pista) => pista.stop());
      streamRef.current = null;
      detectorRef.current = null;
    };
  }, [activo, reintentoCamara]);

  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-2xl border border-emerald-200/60 bg-slate-950 shadow-md ${className}`}>
      <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-[12%] rounded-xl border-2 border-emerald-400/90" />
      {(!activo || !escaneando || ultimoCodigo) && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-slate-950/70 px-3 py-2 text-white">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold">
            <Camera size={14} className="text-emerald-400" />
            {!activo ? "Cámara en pausa" : escaneando ? "Cámara activa · escaneando" : error || "Preparando cámara..."}
          </span>
          {escaneando && ultimoCodigo && (
            <span className="max-w-[50%] truncate font-mono text-[10px] text-emerald-300">{ultimoCodigo}</span>
          )}
          {error && activo && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setEscaneando(false);
                setReintentoCamara((intento) => intento + 1);
              }}
              className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white"
            >
              Reintentar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
