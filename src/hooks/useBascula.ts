// src/hooks/useBascula.ts
import { useState, useCallback, useRef } from 'react';

export interface BasculaConfig {
  modelo?: string;
  puerto?: string;
  baudRate?: string | number;
  formato?: string;
  unidad?: string;
}

export function useBascula(config: BasculaConfig = {}) {
  const [pesoActual, setPesoActual] = useState<number>(0);
  const [basculaConectada, setBasculaConectada] = useState<boolean>(false);

  // Referencias para manejar el ciclo de vida del puerto serial
  const puertoRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const streamClosedRef = useRef<Promise<void> | null>(null);

  const conectarBascula = useCallback(async () => {
    if (!('serial' in navigator)) {
      alert("La lectura de básculas no está soportada en este entorno.");
      return;
    }

    try {
      const baud = Number(config.baudRate || 9600);
      const puerto = await (navigator as any).serial.requestPort();
      await puerto.open({ baudRate: baud });

      puertoRef.current = puerto;
      setBasculaConectada(true);

      const textDecoder = new TextDecoderStream();
      streamClosedRef.current = puerto.readable.pipeTo(textDecoder.writable);

      const reader = textDecoder.readable.getReader();
      readerRef.current = reader;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunks = (value || '').match(/[-+]?\d+(?:[.,]\d+)?/g) || [];
        const muestra = chunks.find((item) => item.length > 1);
        if (!muestra) continue;

        const peso = parseFloat(muestra.replace(',', '.'));
        if (!isNaN(peso) && peso >= 0) {
          setPesoActual(peso);
        }
      }
    } catch (error) {
      console.error("Error al leer la báscula:", error);
      setBasculaConectada(false);
    }
  }, [config.baudRate, config.formato]);

  const desconectarBascula = useCallback(async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }

      if (streamClosedRef.current) {
        await streamClosedRef.current.catch(() => {});
        streamClosedRef.current = null;
      }

      if (puertoRef.current) {
        await puertoRef.current.close();
        puertoRef.current = null;
      }
    } catch (error) {
      console.error("Error al desconectar la báscula:", error);
    } finally {
      setBasculaConectada(false);
      setPesoActual(0);
    }
  }, []);

  return { pesoActual, basculaConectada, conectarBascula, desconectarBascula };
}