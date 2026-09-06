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

const SECRETO = 'MiTiendaSegura2026_ClaveMaestraV1';
const ENCRYPTION_KEY = crypto.scryptSync(SECRETO, 'sal', 32); 
const IV_LENGTH = 16;
let ioServidor;

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

  return { activo: true };
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

function iniciarServidorLAN() {
  if (ioServidor) return;
  const appExpress = express();
  const server = http.createServer(appExpress);
  ioServidor = new Server(server, { cors: { origin: "*" } });

  ioServidor.on('connection', (socket) => {
    console.log('Dispositivo esclavo conectado:', socket.id);
    
    // Interceptar acciones de los clientes (celulares/PCs secundarias)
    socket.on('accion-esclavo', (data) => {
      const wins = BrowserWindow.getAllWindows();
      if (wins.length > 0) {
        // Enviar a la vista React de la PC maestra para procesar y guardar en BD local
        wins[0].webContents.send('accion-de-esclavo', data);
      }
    });
  });

  server.listen(4000, '0.0.0.0', () => {
    console.log('Servidor LAN iniciado en puerto 4000');
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
    webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
      event.preventDefault();
      if (portList && portList.length > 0) callback(portList[0].portId);
      else callback(''); 
    });
    webContents.session.setPermissionCheckHandler((webContents, permission) => permission === 'serial');
    webContents.session.setDevicePermissionHandler((details) => details.deviceType === 'serial');
  });

  ipcMain.handle('imprimir-silencioso', async (event, htmlContent) => {
    const winPrint = new BrowserWindow({ show: false });
    await winPrint.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
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

  // RUTAS IPC PARA RED LOCAL
  ipcMain.handle('obtener-ip-local', () => obtenerIpLocal());
  ipcMain.handle('iniciar-servidor-lan', () => { iniciarServidorLAN(); return true; });
  ipcMain.handle('emitir-a-esclavos', (event, data) => {
    if (ioServidor) ioServidor.emit('accion-maestro', data);
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