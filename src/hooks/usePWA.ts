// src/hooks/usePWA.ts
import { useState, useEffect } from 'react';

// Interfaz para el evento nativo de instalación de navegadores Chromium
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>;
  prompt(): Promise<void>;
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [estaInstalada, setEstaInstalada] = useState(false);

  useEffect(() => {
    // Intercepta el evento que lanza Chrome/Edge cuando la app cumple los requisitos PWA
    const manejarBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Detecta si el usuario aceptó la instalación
    const manejarAppInstalada = () => {
      setEstaInstalada(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', manejarBeforeInstallPrompt);
    window.addEventListener('appinstalled', manejarAppInstalada);

    // Verifica si ya se está ejecutando como ventana independiente (PWA instalada)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setEstaInstalada(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', manejarBeforeInstallPrompt);
      window.removeEventListener('appinstalled', manejarAppInstalada);
    };
  }, []);

  const instalarApp = async () => {
    if (!deferredPrompt) return;
    
    // Muestra el diálogo nativo de instalación de Windows/Navegador
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return { instalarApp, puedeInstalar: !!deferredPrompt, estaInstalada };
}