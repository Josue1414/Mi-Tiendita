// src/hooks/useBascula.ts
import { useState, useCallback, useRef } from 'react';
import { esAndroidNativo } from '../utilidades/utils';

interface CordovaSerialPlugin {
  requestPermission(
    success: (message: string) => void,
    error: (error: unknown) => void
  ): void;
  open(
    options: { baudRate: number; dataBits: number; stopBits: number; parity: number },
    success: (message: string) => void,
    error: (error: unknown) => void
  ): void;
  registerReadCallback(
    success: (data: ArrayBuffer | Uint8Array | { registerReadCallback?: string }) => void,
    error: (error: unknown) => void
  ): void;
  close(success: (message: string) => void, error: (error: unknown) => void): void;
}

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
    if (esAndroidNativo) {
      const serial = (window as Window & { serial?: CordovaSerialPlugin }).serial;
      if (!serial) {
        alert("El plugin serial no está disponible en este dispositivo Android.");
        return;
      }

      try {
        const baud = Number(config.baudRate || 9600);
        await new Promise<void>((resolve, reject) => {
          serial.requestPermission(() => resolve(), reject);
        });
        await new Promise<void>((resolve, reject) => {
          serial.open(
            { baudRate: baud, dataBits: 8, stopBits: 1, parity: 0 },
            () => resolve(),
            reject
          );
        });

        puertoRef.current = serial;
        const decoder = new TextDecoder();
        serial.registerReadCallback((data) => {
          if (!(data instanceof ArrayBuffer) && !(data instanceof Uint8Array)) return;

          const value = decoder.decode(data);
          const chunks = value.match(/[-+]?\d+(?:[.,]\d+)?/g) || [];
          const muestra = chunks.find((item) => item.length > 1);
          if (!muestra) return;

          const peso = parseFloat(muestra.replace(',', '.'));
          if (!isNaN(peso) && peso >= 0) {
            setPesoActual(peso);
          }
        }, (error) => {
          console.error("Error al leer la báscula:", error);
          setBasculaConectada(false);
        });
        setBasculaConectada(true);
      } catch (error) {
        console.error("Error al leer la báscula:", error);
        setBasculaConectada(false);
      }
      return;
    }

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
    if (esAndroidNativo) {
      try {
        const serial = puertoRef.current as CordovaSerialPlugin | null;
        if (serial) {
          await new Promise<void>((resolve, reject) => {
            serial.close(() => resolve(), reject);
          });
          puertoRef.current = null;
        }
      } catch (error) {
        console.error("Error al desconectar la báscula:", error);
      } finally {
        setBasculaConectada(false);
        setPesoActual(0);
      }
      return;
    }

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