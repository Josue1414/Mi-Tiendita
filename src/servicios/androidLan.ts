import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface EstadoServidorAndroid {
  activo: boolean;
  dispositivosConectados: number;
  ip: string;
  webPort: number;
}

interface PluginLANAndroid {
  startServer(): Promise<EstadoServidorAndroid>;
  getServerStatus(): Promise<EstadoServidorAndroid>;
  stopServer(): Promise<EstadoServidorAndroid>;
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
}

export const androidLan = registerPlugin<PluginLANAndroid>("AndroidLan");
