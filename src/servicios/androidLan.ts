import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface EstadoServidorAndroid {
  activo: boolean;
  dispositivosConectados: number;
  ip: string;
  webPort: number;
}

interface PluginLANAndroid {
  getLaunchUrl(): Promise<{ url: string | null }>;
  openHotspotSettings(): Promise<void>;
  startServer(options?: { tiendaId: string; deviceId: string }): Promise<EstadoServidorAndroid>;
  getServerStatus(): Promise<EstadoServidorAndroid>;
  stopServer(): Promise<EstadoServidorAndroid>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  emitCustomerDisplay(options: { cajaId: string; payload: unknown }): Promise<{ enviado: boolean }>;
  emitSnapshot(options: { socketId: string; snapshot: unknown }): Promise<void>;
  emitAction(options: { action: unknown }): Promise<void>;
  addListener(
    eventName: "serverStatus",
    listenerFunc: (status: EstadoServidorAndroid) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "snapshotRequested",
    listenerFunc: (request: { socketId: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "slaveAction",
    listenerFunc: (action: unknown) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "customerDisplayConnected",
    listenerFunc: (data: { cajaId: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "appUrlOpen",
    listenerFunc: (data: { url: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "brainDetected",
    listenerFunc: (data: { ip: string; puertoWeb: number; tiendaId: string; deviceId: string; plataforma: string }) => void,
  ): Promise<PluginListenerHandle>;
}

export const androidLan = registerPlugin<PluginLANAndroid>("AndroidLan");
