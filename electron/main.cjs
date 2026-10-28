// electron/main.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const dgram = require('dgram');
const net = require('net');
const { exec } = require('child_process');

const SECRETO = 'MiTiendaSegura2026_ClaveMaestraV1';
const ENCRYPTION_KEY = crypto.scryptSync(SECRETO, 'sal', 32); 
const IV_LENGTH = 16;
let ioServidor;
let servidorHttpLAN;
let anuncioCerebro;
let temporizadorAnuncioCerebro;
let escuchaCerebro;
let tiendaIdAnuncio = '';
let deviceIdAnuncio = '';
const dispositivosCajaLAN = new Set();
const ultimosMensajesPantalla = new Map();
const PUERTO_DESCUBRIMIENTO_LAN = 41234;
const TIPO_CEREBRO = 'CEREBRO_MITIENDA';

let dispositivoCallback = null;

function encriptar(texto) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encriptado = cipher.update(texto);
  encriptado = Buffer.concat([encriptado, cipher.final()]);
  return iv.toString('hex') + ':' + encriptado.toString('hex');
}

function desencriptar(texto) {
  try {
    const partes = texto.split(':');
    const iv = Buffer.from(partes.shift(), 'hex');
    const textoEncriptado = Buffer.from(partes.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let desencriptado = decipher.update(textoEncriptado);
    desencriptado = Buffer.concat([desencriptado, decipher.final()]);
    return desencriptado.toString();
  } catch (error) {
    console.error("Error al desencriptar:", error);
    return null;
  }
}

function obtenerHardwareIdLocal(userDataPath) {
  const hwidPath = path.join(userDataPath, 'hardware.key');
  if (fs.existsSync(hwidPath)) {
    return fs.readFileSync(hwidPath, 'utf8');
  }
  const newHwid = crypto.randomUUID();
  fs.writeFileSync(hwidPath, newHwid, 'utf8');
  return newHwid;
}

function validarSuscripcionLocal(dbPath) {
  const saasPath = path.join(dbPath, 'saas_state.enc');
  if (!fs.existsSync(saasPath)) return { activo: false, error: 'No hay registro de pago local. Conéctate a internet para validar tu cuenta por primera vez.' };

  const data = desencriptar(fs.readFileSync(saasPath, 'utf8'));
  if (!data) return { activo: false, error: 'Archivo de seguridad corrupto.' };

  const estado = JSON.parse(data);
  const ahora = new Date().getTime();
  const ultimaVez = new Date(estado.ultimaFechaConocida).getTime();
  const vencimiento = new Date(estado.fechaVencimiento).getTime();

  if (ahora < ultimaVez) {
    return { activo: false, error: 'Se detectó una alteración en el reloj de Windows. Conéctate a internet para sincronizar la seguridad.' };
  }

  estado.ultimaFechaConocida = new Date().toISOString();
  fs.writeFileSync(saasPath, encriptar(JSON.stringify(estado)), 'utf8');

  if (ahora > vencimiento) {
    return { activo: false, error: 'Tu suscripción mensual ha vencido. Realiza tu pago y conéctate a internet para renovar el acceso.' };
  }

  return { activo: true, fechaVencimiento: estado.fechaVencimiento }; 
}

function obtenerIpLocal() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function obtenerEstadoLAN() {
  return {
    activo: Boolean(servidorHttpLAN?.listening),
    dispositivosConectados: dispositivosCajaLAN.size,
    ip: obtenerIpLocal()
  };
}

function ipANumero(ip) {
  return ip.split('.').reduce((acumulado, octeto) => ((acumulado << 8) | Number(octeto)) >>> 0, 0);
}

function esIpPrivada(ip) {
  if (!net.isIPv4(ip)) return false;
  const [primero, segundo] = ip.split('.').map(Number);
  return primero === 10
    || (primero === 172 && segundo >= 16 && segundo <= 31)
    || (primero === 192 && segundo === 168)
    || (primero === 169 && segundo === 254);
}

function obtenerDireccionesBroadcast() {
  const destinos = new Set(['255.255.255.255']);
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const interfaz of interfaces ?? []) {
      if (interfaz.family !== 'IPv4' || interfaz.internal || !interfaz.netmask) continue;
      const ip = ipANumero(interfaz.address);
      const mascara = ipANumero(interfaz.netmask);
      const broadcast = (ip | (~mascara >>> 0)) >>> 0;
      destinos.add([24, 16, 8, 0].map((desplazamiento) => (broadcast >>> desplazamiento) & 255).join('.'));
    }
  }
  return destinos;
}

function iniciarAnuncioCerebro(tiendaId, deviceId) {
  if (tiendaId) tiendaIdAnuncio = tiendaId;
  if (deviceId) deviceIdAnuncio = deviceId;
  if (temporizadorAnuncioCerebro) return;
  anuncioCerebro = dgram.createSocket('udp4');
  anuncioCerebro.on('error', (error) => console.error('Error en el anuncio UDP del Cerebro:', error));
  const enviarAnuncio = () => {
    if (!anuncioCerebro) return;
    const mensaje = Buffer.from(JSON.stringify({
      tipo: TIPO_CEREBRO,
      ip: obtenerIpLocal(),
      puertoWeb: 4000,
      tiendaId: tiendaIdAnuncio,
      deviceId: deviceIdAnuncio,
      plataforma: 'windows'
    }));
    for (const destino of obtenerDireccionesBroadcast()) {
      anuncioCerebro.send(mensaje, PUERTO_DESCUBRIMIENTO_LAN, destino, (error) => {
        if (error) console.error(`No se pudo anunciar el Cerebro a ${destino}:`, error);
      });
    }
  };
  anuncioCerebro.bind(() => {
    if (!anuncioCerebro) return;
    anuncioCerebro.setBroadcast(true);
    enviarAnuncio();
    temporizadorAnuncioCerebro = setInterval(enviarAnuncio, 3000);
  });
}

function detenerAnuncioCerebro() {
  if (temporizadorAnuncioCerebro) clearInterval(temporizadorAnuncioCerebro);
  temporizadorAnuncioCerebro = undefined;
  if (anuncioCerebro) anuncioCerebro.close();
  anuncioCerebro = undefined;
}

function iniciarDescubrimientoLAN() {
  if (escuchaCerebro) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    let listo = false;
    socket.on('error', (error) => {
      if (!listo) {
        socket.close();
        reject(error);
      } else {
        console.error('Error escuchando anuncios LAN del Cerebro:', error);
      }
    });
    socket.on('message', (mensaje, remitente) => {
      try {
        const anuncio = JSON.parse(mensaje.toString());
        if (anuncio.tipo !== TIPO_CEREBRO || typeof anuncio.ip !== 'string' || !esIpPrivada(remitente.address)) return;
        if (![4000, 4001].includes(anuncio.puertoWeb)) return;
        const cerebro = {
          ip: remitente.address,
          puertoWeb: anuncio.puertoWeb,
          tiendaId: anuncio.tiendaId,
          deviceId: anuncio.deviceId,
          plataforma: anuncio.plataforma
        };
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('cerebro-detectado', cerebro);
        }
      } catch (error) {
        console.error('Se recibió un anuncio UDP de Cerebro inválido:', error);
      }
    });
    socket.bind(PUERTO_DESCUBRIMIENTO_LAN, '0.0.0.0', () => {
      listo = true;
      escuchaCerebro = socket;
      resolve();
    });
  });
}

function detenerDescubrimientoLAN() {
  if (escuchaCerebro) escuchaCerebro.close();
  escuchaCerebro = undefined;
}

function emitirEstadoLAN() {
  const estado = obtenerEstadoLAN();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('estado-servidor-lan', estado);
  }
}

function iniciarServidorLAN(tiendaId, deviceId) {
  if (tiendaId) tiendaIdAnuncio = tiendaId;
  if (deviceId) deviceIdAnuncio = deviceId;
  if (servidorHttpLAN?.listening) return Promise.resolve(obtenerEstadoLAN());
  const appExpress = express();
  const server = http.createServer(appExpress);
  
  const distPath = path.join(__dirname, '../dist');
  appExpress.use(express.static(distPath));
  appExpress.get(/.*/, (req, res) => res.sendFile(path.join(distPath, 'index.html')));

  ioServidor = new Server(server, {
    cors: { origin: "*" },
    pingInterval: 5000,
    pingTimeout: 10000
  });

  ioServidor.on('connection', (socket) => {
    console.log('Dispositivo LAN conectado:', socket.id);
    emitirEstadoLAN();

    socket.on('disconnect', () => {
      dispositivosCajaLAN.delete(socket.id);
      emitirEstadoLAN();
    });

    socket.on('registrar-dispositivo-lan', () => {
      dispositivosCajaLAN.add(socket.id);
      emitirEstadoLAN();
    });

    socket.on('registrar-pantalla-cliente', (data) => {
      if (!data || typeof data.cajaId !== 'string') return;
      const ultimoMensaje = ultimosMensajesPantalla.get(data.cajaId);
      if (ultimoMensaje) socket.emit('update-pantalla-cliente', ultimoMensaje);
    });
    
    socket.on('sync-pantalla-cliente', (data) => {
      if (data?.cajaId && data?.payload?.tipo === 'ACTUALIZAR_CARRITO') {
        ultimosMensajesPantalla.set(data.cajaId, data);
      }
      ioServidor.emit('update-pantalla-cliente', data);
    });
    
    socket.on('accion-esclavo', (data) => {
      socket.broadcast.emit('accion-maestro', data);
      const wins = BrowserWindow.getAllWindows();
      if (wins.length > 0) {
        wins[0].webContents.send('accion-de-esclavo', data);
      }
    });

    // CORREGIDO: Redirigir correctamente la solicitud de snapshot a la interfaz de React
    socket.on('solicitar-estado-inicial', () => {
      const wins = BrowserWindow.getAllWindows();
      if (wins.length > 0) {
        wins[0].webContents.send('solicitar-snapshot-lan', socket.id);
      }
    });
  });

  servidorHttpLAN = server;
  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      ioServidor = undefined;
      servidorHttpLAN = undefined;
      reject(error);
    });
    server.listen(4000, '0.0.0.0', () => {
      console.log('Servidor LAN iniciado en puerto 4000');
      iniciarAnuncioCerebro(tiendaId, deviceId);
      emitirEstadoLAN();
      resolve(obtenerEstadoLAN());
    });
  });
}

function detenerServidorLAN() {
  detenerAnuncioCerebro();
  const servidor = servidorHttpLAN;
  if (!servidor?.listening) {
    return new Promise((resolve) => {
      const finalizar = () => {
        ioServidor = undefined;
        servidorHttpLAN = undefined;
        dispositivosCajaLAN.clear();
        emitirEstadoLAN();
        resolve();
      };
      if (ioServidor) ioServidor.close(finalizar);
      else finalizar();
    });
  }

  return new Promise((resolve, reject) => {
    const finalizar = (error) => {
      ioServidor = undefined;
      servidorHttpLAN = undefined;
      dispositivosCajaLAN.clear();
      emitirEstadoLAN();
      if (error) reject(error);
      else resolve();
    };
    if (ioServidor) ioServidor.close(finalizar);
    else servidor.close(finalizar);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../public/logo mi tienda.jpeg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'datos_seguros');

  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  app.on('web-contents-created', (event, webContents) => {
    webContents.session.setPermissionCheckHandler((wc, permission) => {
      return permission === 'serial' || permission === 'usb';
    });
    webContents.session.setDevicePermissionHandler((details) => {
      return details.deviceType === 'serial' || details.deviceType === 'usb';
    });

    webContents.session.on('select-serial-port', (event, portList, wc, callback) => {
      event.preventDefault();
      dispositivoCallback = callback;
      wc.send('mostrar-lista-dispositivos', { tipo: 'serial', lista: portList });
    });

    webContents.session.on('select-usb-device', (event, details, callback) => {
      event.preventDefault();
      dispositivoCallback = callback;
      webContents.send('mostrar-lista-dispositivos', { tipo: 'usb', lista: details.deviceList });
    });
  });

  ipcMain.handle('confirmar-dispositivo', (event, idDispositivo) => {
    if (dispositivoCallback) {
      dispositivoCallback(idDispositivo);
      dispositivoCallback = null;
    }
  });

  ipcMain.handle('imprimir-silencioso', async (event, htmlContent) => {
    const winPrint = new BrowserWindow({ show: false });
    await winPrint.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    await winPrint.webContents.executeJavaScript(
      "Promise.all(Array.from(document.images, imagen => imagen.decode().catch(error => console.error('Error al cargar una imagen del ticket:', error))))"
    );
    winPrint.webContents.print({ silent: true, printBackground: true }, (success, errorType) => {
      if (!success) console.error("Fallo impresión silenciosa:", errorType);
      winPrint.close();
    });
    return true;
  });

  ipcMain.handle('guardar-datos', async (event, nombreTabla, datos) => {
    try {
      const archivoRuta = path.join(dbPath, `${nombreTabla}.enc`);
      fs.writeFileSync(archivoRuta, encriptar(JSON.stringify(datos)), 'utf8');
      return { exito: true };
    } catch (error) {
      return { exito: false, error: error.message };
    }
  });

  ipcMain.handle('leer-datos', async (event, nombreTabla) => {
    try {
      const archivoRuta = path.join(dbPath, `${nombreTabla}.enc`);
      if (!fs.existsSync(archivoRuta)) return [];
      const textoJSON = desencriptar(fs.readFileSync(archivoRuta, 'utf8'));
      return textoJSON ? JSON.parse(textoJSON) : [];
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('obtener-hardware-id', () => obtenerHardwareIdLocal(userDataPath));
  ipcMain.handle('validar-suscripcion-offline', () => validarSuscripcionLocal(dbPath));
  ipcMain.handle('sincronizar-reloj', (event, fechaVencimientoNube) => {
    try {
      const saasPath = path.join(dbPath, 'saas_state.enc');
      const estado = { ultimaFechaConocida: new Date().toISOString(), fechaVencimiento: fechaVencimientoNube };
      fs.writeFileSync(saasPath, encriptar(JSON.stringify(estado)), 'utf8');
      return { exito: true };
    } catch (error) {
      return { exito: false, error: error.message };
    }
  });

  ipcMain.handle('reparar-firewall', async () => {
    return new Promise((resolve) => {
      const scriptElevado = [
        'netsh advfirewall firewall add rule name="Mi Tiendita POS" dir=in action=allow protocol=TCP localport=4000',
        'if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
        'netsh advfirewall firewall add rule name="Mi Tiendita Descubrimiento LAN" dir=in action=allow protocol=UDP localport=41234',
        'exit $LASTEXITCODE'
      ].join('; ');
      const comandoCodificado = Buffer.from(scriptElevado, 'utf16le').toString('base64');
      const comando = `$proceso = Start-Process powershell.exe -ArgumentList '-NoProfile -EncodedCommand ${comandoCodificado}' -Verb RunAs -WindowStyle Hidden -Wait -PassThru; if ($proceso.ExitCode -ne 0) { exit $proceso.ExitCode }`;
      exec(`powershell.exe -NoProfile -Command "${comando}"`, (error) => {
        if (error) {
          resolve({ exito: false, error: error.message });
        } else {
          resolve({ exito: true });
        }
      });
    });
  });

  ipcMain.handle('obtener-ip-local', () => obtenerIpLocal());
  ipcMain.handle('iniciar-servidor-lan', (event, tiendaId, deviceId) => iniciarServidorLAN(tiendaId, deviceId));
  ipcMain.handle('detener-servidor-lan', () => detenerServidorLAN());
  ipcMain.handle('obtener-estado-lan', () => obtenerEstadoLAN());
  ipcMain.handle('iniciar-descubrimiento-lan', () => iniciarDescubrimientoLAN());
  ipcMain.handle('detener-descubrimiento-lan', () => detenerDescubrimientoLAN());
  ipcMain.handle('emitir-a-esclavos', (event, data) => {
    if (ioServidor) ioServidor.emit('accion-maestro', data);
  });
  
  // CORREGIDO: Confirmar el envío masivo (Snapshot) a través del socket solicitado
  ipcMain.handle('emitir-snapshot-a-cliente', (event, socketId, snapshot) => {
    if (ioServidor) {
      ioServidor.to(socketId).emit('estado-inicial-lan', snapshot);
    }
  });

  createWindow();
  autoUpdater.checkForUpdatesAndNotify();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  detenerDescubrimientoLAN();
  detenerAnuncioCerebro();
});