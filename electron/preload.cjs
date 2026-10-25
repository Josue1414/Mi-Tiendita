// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('apiLocal', {
  guardarDatos: (tabla, datos) => ipcRenderer.invoke('guardar-datos', tabla, datos),
  leerDatos: (tabla) => ipcRenderer.invoke('leer-datos', tabla),
  
  obtenerHardwareId: () => ipcRenderer.invoke('obtener-hardware-id'),
  validarSuscripcionOffline: () => ipcRenderer.invoke('validar-suscripcion-offline'),
  sincronizarReloj: (fechaVencimiento) => ipcRenderer.invoke('sincronizar-reloj', fechaVencimiento),
  imprimirSilencioso: (html) => ipcRenderer.invoke('imprimir-silencioso', html),

  escucharPeticionDispositivos: (callback) => {
    ipcRenderer.on('mostrar-lista-dispositivos', (event, datos) => callback(datos));
  },
  confirmarDispositivo: (idDispositivo) => {
    ipcRenderer.invoke('confirmar-dispositivo', idDispositivo);
  },

  // NUEVO: Llama al botón mágico
  repararFirewall: () => ipcRenderer.invoke('reparar-firewall'),

  obtenerIpLocal: () => ipcRenderer.invoke('obtener-ip-local'),
  iniciarServidorLAN: (tiendaId, deviceId) => ipcRenderer.invoke('iniciar-servidor-lan', tiendaId, deviceId),
  detenerServidorLAN: () => ipcRenderer.invoke('detener-servidor-lan'),
  obtenerEstadoLAN: () => ipcRenderer.invoke('obtener-estado-lan'),
  iniciarDescubrimientoLAN: () => ipcRenderer.invoke('iniciar-descubrimiento-lan'),
  detenerDescubrimientoLAN: () => ipcRenderer.invoke('detener-descubrimiento-lan'),
  onCerebroDetectado: (callback) => {
    const listener = (event, cerebro) => callback(cerebro);
    ipcRenderer.on('cerebro-detectado', listener);
    return () => ipcRenderer.removeListener('cerebro-detectado', listener);
  },
  onEstadoLAN: (callback) => {
    ipcRenderer.removeAllListeners('estado-servidor-lan');
    ipcRenderer.on('estado-servidor-lan', (event, estado) => callback(estado));
  },
  onSolicitudSnapshotLAN: (callback) => {
    ipcRenderer.removeAllListeners('solicitar-snapshot-lan');
    ipcRenderer.on('solicitar-snapshot-lan', (event, socketId) => callback(socketId));
  },
  emitirSnapshotLAN: (socketId, snapshot) => ipcRenderer.invoke('emitir-snapshot-a-cliente', socketId, snapshot),
  emitirAEsclavos: (data) => ipcRenderer.invoke('emitir-a-esclavos', data),
  onAccionDeEsclavo: (callback) => {
    ipcRenderer.removeAllListeners('accion-de-esclavo');
    ipcRenderer.on('accion-de-esclavo', (event, data) => callback(data));
  }
});