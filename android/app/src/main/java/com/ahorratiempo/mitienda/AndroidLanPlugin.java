package com.ahorratiempo.mitienda;

import android.content.res.AssetManager;
import android.util.Log;
import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.listener.DataListener;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.Inet4Address;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

@CapacitorPlugin(name = "AndroidLan")
public class AndroidLanPlugin extends Plugin {
    private static final String TAG = "AndroidLanPlugin";
    private static final int SOCKET_PORT = 4000;
    private static final int WEB_PORT = 4001;
    private static final ObjectMapper JSON = new ObjectMapper();

    private SocketIOServer socketServer;
    private ServerSocket webServerSocket;
    private ExecutorService webExecutor;
    private volatile boolean webServerRunning;

    @PluginMethod
    public void startServer(PluginCall call) {
        try {
            startServers();
            call.resolve(obtenerEstado());
        } catch (Exception error) {
            Log.e(TAG, "No se pudo iniciar el servidor LAN de Android.", error);
            call.reject("No se pudo iniciar el servidor LAN. Revisa que los puertos 4000 y 4001 estén disponibles.", error);
        }
    }

    @PluginMethod
    public void getServerStatus(PluginCall call) {
        call.resolve(obtenerEstado());
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        detenerServidores();
        call.resolve(obtenerEstado());
    }

    @PluginMethod
    public void emitSnapshot(PluginCall call) {
        String socketId = call.getString("socketId");
        JSObject snapshot = call.getObject("snapshot");
        if (socketId == null || snapshot == null || socketServer == null) {
            call.reject("No se pudo enviar el estado inicial: faltan datos o el servidor está detenido.");
            return;
        }

        try {
            SocketIOClient client = socketServer.getClient(UUID.fromString(socketId));
            if (client == null) {
                call.reject("El dispositivo solicitante ya se desconectó.");
                return;
            }
            client.sendEvent("estado-inicial-lan", JSON.readTree(snapshot.toString()));
            call.resolve();
        } catch (Exception error) {
            Log.e(TAG, "No se pudo enviar el estado inicial por LAN.", error);
            call.reject("No se pudo enviar el estado inicial por LAN.", error);
        }
    }

    @PluginMethod
    public void emitAction(PluginCall call) {
        JSObject action = call.getObject("action");
        if (action == null || socketServer == null) {
            call.reject("No se pudo propagar el cambio: faltan datos o el servidor está detenido.");
            return;
        }

        try {
            socketServer.getBroadcastOperations().sendEvent(
                "accion-maestro",
                JSON.readTree(action.toString())
            );
            call.resolve();
        } catch (Exception error) {
            Log.e(TAG, "No se pudo propagar el cambio del Cerebro por LAN.", error);
            call.reject("No se pudo propagar el cambio del Cerebro por LAN.", error);
        }
    }

    @Override
    protected void handleOnDestroy() {
        detenerServidores();
        super.handleOnDestroy();
    }

    private synchronized void startServers() throws IOException {
        if (socketServer != null && webServerSocket != null && !webServerSocket.isClosed()) return;

        SocketIOServer servidorNuevo = socketServer;
        ServerSocket servidorWebNuevo = null;
        ExecutorService executorNuevo = null;
        boolean crearServidorSocket = servidorNuevo == null;
        try {
            servidorWebNuevo = new ServerSocket(WEB_PORT);

            if (crearServidorSocket) {
                Configuration configuration = new Configuration();
                configuration.setHostname("0.0.0.0");
                configuration.setPort(SOCKET_PORT);
                configuration.setOrigin("*");
                servidorNuevo = new SocketIOServer(configuration);

                SocketIOServer server = servidorNuevo;
                server.addConnectListener(client -> emitirEstado());
                server.addDisconnectListener(client -> emitirEstado());
                server.addEventListener("solicitar-estado-inicial", Object.class, (client, data, ackRequest) -> {
                    JSObject request = new JSObject();
                    request.put("socketId", client.getSessionId().toString());
                    notifyListeners("snapshotRequested", request);
                });
                server.addEventListener("accion-esclavo", JsonNode.class, (client, data, ackRequest) ->
                    server.getBroadcastOperations().sendEvent("accion-maestro", client, data)
                );
                server.start();
            }

            executorNuevo = Executors.newCachedThreadPool();
            webServerSocket = servidorWebNuevo;
            webExecutor = executorNuevo;
            socketServer = servidorNuevo;
            webServerRunning = true;
            ServerSocket serverSocketWeb = servidorWebNuevo;
            executorNuevo.execute(() -> aceptarSolicitudesWeb(serverSocketWeb));
            emitirEstado();
        } catch (RuntimeException | IOException error) {
            if (servidorWebNuevo != null) {
                try {
                    servidorWebNuevo.close();
                } catch (IOException errorCierre) {
                    Log.w(TAG, "No se pudo liberar el puerto web durante el rollback.", errorCierre);
                }
            }
            if (executorNuevo != null) executorNuevo.shutdownNow();
            if (crearServidorSocket && servidorNuevo != null) servidorNuevo.stop();
            webServerSocket = null;
            webExecutor = null;
            webServerRunning = false;
            throw error;
        }
    }

    private synchronized void detenerServidores() {
        webServerRunning = false;
        if (webServerSocket != null) {
            try {
                webServerSocket.close();
            } catch (IOException error) {
                Log.w(TAG, "No se pudo cerrar el servidor web local.", error);
            }
            webServerSocket = null;
        }
        if (webExecutor != null) {
            webExecutor.shutdownNow();
            webExecutor = null;
        }
        if (socketServer != null) {
            socketServer.stop();
            socketServer = null;
        }
        emitirEstado();
    }

    private JSObject obtenerEstado() {
        JSObject status = new JSObject();
        status.put("activo", socketServer != null && webServerSocket != null && !webServerSocket.isClosed());
        status.put("dispositivosConectados", socketServer == null ? 0 : socketServer.getAllClients().size());
        status.put("ip", obtenerIpLocal());
        status.put("webPort", WEB_PORT);
        return status;
    }

    private void emitirEstado() {
        notifyListeners("serverStatus", obtenerEstado());
    }

    private void aceptarSolicitudesWeb(ServerSocket serverSocket) {
        while (webServerRunning && webServerSocket == serverSocket) {
            try {
                Socket client = serverSocket.accept();
                ExecutorService executor = webExecutor;
                if (executor != null) {
                    try {
                        executor.execute(() -> servirArchivoWeb(client));
                    } catch (RejectedExecutionException error) {
                        try {
                            client.close();
                        } catch (IOException errorCierre) {
                            Log.w(TAG, "No se pudo cerrar una conexión web rechazada.", errorCierre);
                        }
                    }
                } else {
                    client.close();
                }
            } catch (IOException error) {
                if (webServerRunning && webServerSocket == serverSocket) {
                    Log.e(TAG, "Error aceptando una solicitud web LAN.", error);
                }
            }
        }
    }

    private void servirArchivoWeb(Socket socket) {
        try (Socket client = socket) {
            client.setSoTimeout(5000);
            BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.UTF_8));
            String requestLine = reader.readLine();
            if (requestLine == null || !requestLine.startsWith("GET ")) {
                escribirRespuesta(client, 405, "text/plain; charset=utf-8", "Método no permitido".getBytes(StandardCharsets.UTF_8));
                return;
            }

            String ruta = requestLine.split(" ")[1].split("\\?", 2)[0];
            ruta = URLDecoder.decode(ruta, StandardCharsets.UTF_8.name());
            if (ruta.contains("..") || ruta.startsWith("//")) {
                escribirRespuesta(client, 400, "text/plain; charset=utf-8", "Ruta inválida".getBytes(StandardCharsets.UTF_8));
                return;
            }
            if ("/".equals(ruta) || ruta.isEmpty()) ruta = "/index.html";

            byte[] contenido = leerAssetWeb(ruta.substring(1));
            String tipo = obtenerTipoContenido(ruta);
            if (contenido == null) {
                contenido = leerAssetWeb("index.html");
                tipo = "text/html; charset=utf-8";
            }
            if (contenido == null) {
                escribirRespuesta(client, 404, "text/plain; charset=utf-8", "No se encontró la aplicación".getBytes(StandardCharsets.UTF_8));
                return;
            }
            escribirRespuesta(client, 200, tipo, contenido);
        } catch (Exception error) {
            Log.w(TAG, "No se pudo responder la solicitud de la aplicación web LAN.", error);
        }
    }

    private byte[] leerAssetWeb(String ruta) throws IOException {
        AssetManager assets = getContext().getAssets();
        try (InputStream input = new BufferedInputStream(assets.open("public/" + ruta));
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int leidos;
            while ((leidos = input.read(buffer)) != -1) output.write(buffer, 0, leidos);
            return output.toByteArray();
        } catch (IOException error) {
            return null;
        }
    }

    private void escribirRespuesta(Socket client, int estado, String tipo, byte[] cuerpo) throws IOException {
        BufferedOutputStream output = new BufferedOutputStream(client.getOutputStream());
        String textoEstado = estado == 200 ? "OK" : estado == 404 ? "Not Found" : estado == 405 ? "Method Not Allowed" : "Bad Request";
        String cabeceras = "HTTP/1.1 " + estado + " " + textoEstado + "\r\n"
            + "Content-Type: " + tipo + "\r\n"
            + "Content-Length: " + cuerpo.length + "\r\n"
            + "Connection: close\r\n"
            + "Access-Control-Allow-Origin: *\r\n\r\n";
        output.write(cabeceras.getBytes(StandardCharsets.UTF_8));
        output.write(cuerpo);
        output.flush();
    }

    private String obtenerTipoContenido(String ruta) {
        String extension = ruta.substring(ruta.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (extension) {
            case "html": return "text/html; charset=utf-8";
            case "js": return "text/javascript; charset=utf-8";
            case "css": return "text/css; charset=utf-8";
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            case "jpg":
            case "jpeg": return "image/jpeg";
            case "ico": return "image/x-icon";
            case "json":
            case "webmanifest": return "application/json; charset=utf-8";
            case "woff":
            case "woff2": return "font/" + extension;
            default: return "application/octet-stream";
        }
    }

    private String obtenerIpLocal() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            for (NetworkInterface networkInterface : Collections.list(interfaces)) {
                if (!networkInterface.isUp() || networkInterface.isLoopback()) continue;
                for (java.net.InetAddress address : Collections.list(networkInterface.getInetAddresses())) {
                    if (address instanceof Inet4Address && !address.isLoopbackAddress()) return address.getHostAddress();
                }
            }
        } catch (Exception error) {
            Log.w(TAG, "No se pudo determinar la dirección IP LAN.", error);
        }
        return "127.0.0.1";
    }
}
