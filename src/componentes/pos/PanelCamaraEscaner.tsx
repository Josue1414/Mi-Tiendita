// src/componentes/pos/PanelCamaraEscaner.tsx
import { useEffect, useRef, useState } from "react";
import { Camera, ScanBarcode, X } from "lucide-react";

interface Props {
  alDetectar?: (codigo: string) => void;
  className?: string;
}

type DetectorCodigo = { detect: (imagen: HTMLVideoElement | HTMLCanvasElement) => Promise<Array<{ rawValue: string }>> };
type ConstructorDetector = new (opciones?: { formats?: string[] }) => DetectorCodigo;

export default function PanelCamaraEscaner({ alDetectar, className = "" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<DetectorCodigo | null>(null);
  const ultimoCodigoRef = useRef<string>("");
  const timeoutRef = useRef<number | undefined>(undefined);
  const [error, setError] = useState("");
  const [escaneando, setEscaneando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    const iniciar = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Cámara no soportada");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        if (cancelado || !stream || !videoRef.current) return;

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const Constructor = (window as Window & { BarcodeDetector?: ConstructorDetector }).BarcodeDetector;
        if (!Constructor) {
          setError("Sin soporte de BarcodeDetector");
          return;
        }

        detectorRef.current = new Constructor({ formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf", "codabar"] });
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

            const canvas = document.createElement("canvas");
            canvas.width = Math.min(video.videoWidth, 1280);
            canvas.height = Math.min(video.videoHeight, 720);

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              timeoutRef.current = window.setTimeout(revisar, 250);
              return;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const resultados = await detectorRef.current.detect(canvas);
            const codigo = resultados[0]?.rawValue?.trim();

            if (!codigo) {
              timeoutRef.current = window.setTimeout(revisar, 250);
              return;
            }

            if (codigo === ultimoCodigoRef.current) {
              timeoutRef.current = window.setTimeout(revisar, 400);
              return;
            }

            ultimoCodigoRef.current = codigo;
            if (alDetectar) {
              alDetectar(codigo);
            }
          } catch {
            setError("No se pudo enfocar la etiqueta");
            timeoutRef.current = window.setTimeout(revisar, 500);
          }
        };

        revisar();
      } catch {
        setError("Cámara no disponible");
      }
    };

    iniciar();

    return () => {
      cancelado = true;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      streamRef.current?.getTracks().forEach((pista) => pista.stop());
      streamRef.current = null;
      detectorRef.current = null;
      ultimoCodigoRef.current = "";
      setEscaneando(false);
    };
  }, [alDetectar]);

  return (
    <div className={`relative w-full rounded-2xl border border-emerald-200/60 bg-slate-950 shadow-md overflow-hidden ${className}`}> 
      <div className="relative aspect-video w-full bg-slate-950">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-4 rounded-xl border-2 border-emerald-400/90" />
        <div className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white flex items-center gap-1">
          <Camera size={12} />Scanner
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-slate-950/80 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white flex items-center gap-1">
          <ScanBarcode size={12} />
          {escaneando ? "ON" : "OFF"}
        </div>
        {!escaneando && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-[11px] font-bold text-white/80">
            <Camera size={16} className="mr-2" />Preparando cámara...
          </div>
        )}
        {error && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1 rounded-lg bg-amber-500/90 px-2 py-1 text-[10px] font-bold text-white">
            <X size={12} /> {error}
          </div>
        )}
      </div>
    </div>
  );
}
