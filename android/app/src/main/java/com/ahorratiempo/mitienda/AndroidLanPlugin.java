package com.ahorratiempo.mitienda;

import android.content.Intent;
import android.content.res.AssetManager;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.util.Log;
import android.view.WindowManager;
import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketConfig;
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
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "AndroidLan")
public class AndroidLanPlugin extends Plugin {
    private static final String TAG = "AndroidLanPlugin";
    private static final int SOCKET_PORT = 4000;
    private static final int WEB_PORT = 4001;
    private static final int DISCOVERY_PORT = 41234;
    private static final String TIPO_CEREBRO = "CEREBRO_MITIENDA";
    private static final ObjectMapper JSON = new ObjectMapper();
    private final ConcurrentHashMap<String, JsonNode> ultimosCarritosPorCaja = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> direccionesPorSesionSocket = new ConcurrentHashMap<>();
    private final Set<ClienteSse> clientesPantallaSse = ConcurrentHashMap.newKeySet();

    private SocketIOServer socketServer;
    private ServerSocket webServerSocket;
    private ExecutorService webExecutor;
    private volatile boolean webServerRunning;
    private ScheduledExecutorService anuncioCerebro;
    private DatagramSocket socketEscuchaCerebro;
    private volatile boolean escuchaCerebroActiva;
    private volatile String tiendaIdAnuncio = "";
    private volatile String deviceIdAnuncio = "";

    @PluginMethod
    public void startServer(PluginCall call) {
        try {
            String tiendaId = call.getString("tiendaId");
            String deviceId = call.getString("deviceId");
            if (tiendaId != null) tiendaIdAnuncio = tiendaId;
            if (deviceId != null) deviceIdAnuncio = deviceId;
            startServers();
            actualizarPantallaActiva(true);
            call.resolve(obtenerEstado());
        } catch (Exception error) {
            Log.e(TAG, "No se pudo iniciar el servidor LAN de Android.", error);
            String detalle = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
            call.reject("No se pudo iniciar el servidor LAN en los puertos 4000/4001: " + detalle, error);
        }
    }

    @PluginMethod
    public void getServerStatus(PluginCall call) {
        call.resolve(obtenerEstado());
    }

    @PluginMethod
    public synchronized void startDiscovery(PluginCall call) {
        if (escuchaCerebroActiva) {
            call.resolve();
            return;
        }
        try {
            DatagramSocket socket = new DatagramSocket(null);
            socket.setReuseAddress(true);
            socket.setBroadcast(true);
            socket.bind(new InetSocketAddress(DISCOVERY_PORT));
            socket.setSoTimeout(1000);
            socketEscuchaCerebro = socket;
            escuchaCerebroActiva = true;
            new Thread(() -> escucharCerebro(socket), "mitienda-descubrimiento-lan").start();
            call.resolve();
        } catch (IOException error) {
            Log.e(TAG, "No se pudo iniciar la escucha de Cerebros por LAN.", error);
            call.reject("No se pudo iniciar el descubrimiento LAN en el puerto " + DISCOVERY_PORT + ".", error);
        }
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        detenerEscuchaCerebro();
        call.resolve();
    }

    @PluginMethod
    public void getLaunchUrl(PluginCall call) {
        Intent intent = getActivity().getIntent();
        JSObject result = new JSObject();
        result.put("url", intent == null || intent.getData() == null ? JSObject.NULL : intent.getDataString());
        call.resolve(result);
    }

    @PluginMethod
    public void emitCustomerDisplay(PluginCall call) {
        String cajaId = call.getString("cajaId");
        JSObject payload = call.getObject("payload");
        if (cajaId == null || payload == null) {
            call.reject("No se pudo enviar el estado de pantalla cliente: faltan datos.");
            return;
        }

        SocketIOServer server = socketServer;
        JSObject result = new JSObject();
        try {
            JSObject message = new JSObject();
            message.put("cajaId", cajaId);
            message.put("payload", payload);
            JsonNode data = JSON.readTree(message.toString());
            if ("ACTUALIZAR_CARRITO".equals(payload.getString("tipo"))) {
                ultimosCarritosPorCaja.put(cajaId, data.deepCopy());
            }
            if (server != null) server.getBroadcastOperations().sendEvent("update-pantalla-cliente", data);
            enviarMensajePantallaSse(data);
            result.put("enviado", server != null || !clientesPantallaSse.isEmpty());
            call.resolve(result);
        } catch (Exception error) {
            Log.e(TAG, "No se pudo enviar el estado de pantalla cliente por LAN.", error);
            call.reject("No se pudo enviar el estado de pantalla cliente por LAN.", error);
        }
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        detenerServidores();
        actualizarPantallaActiva(false);
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
        detenerEscuchaCerebro();
        actualizarPantallaActiva(false);
        super.handleOnDestroy();
    }

    private void actualizarPantallaActiva(boolean activa) {
        android.app.Activity activity = getActivity();
        if (activity == null) return;

        activity.runOnUiThread(() -> {
            if (activity.isFinishing() || activity.isDestroyed()) return;
            if (activa) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
        });
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (intent.getData() != null) {
            JSObject data = new JSObject();
            data.put("url", intent.getDataString());
            notifyListeners("appUrlOpen", data);
        }
    }

    private synchronized void startServers() throws IOException {
        if (socketServer != null && webServerSocket != null && !webServerSocket.isClosed()) return;

        SocketIOServer servidorNuevo = socketServer;
        ServerSocket servidorWebNuevo = null;
        ExecutorService executorNuevo = null;
        boolean crearServidorSocket = servidorNuevo == null;
        try {
            servidorWebNuevo = new ServerSocket();
            servidorWebNuevo.setReuseAddress(true);
            servidorWebNuevo.bind(new InetSocketAddress(WEB_PORT));

            if (crearServidorSocket) {
                Configuration configuration = new Configuration();
                configuration.setHostname("0.0.0.0");
                configuration.setPort(SOCKET_PORT);
                configuration.setOrigin("*");
                configuration.setAllowHeaders("Content-Type, Authorization, x-requested-with");
                configuration.setPingInterval(5000);
                configuration.setPingTimeout(10000);
                SocketConfig socketConfig = new SocketConfig();
                socketConfig.setReuseAddress(true);
                configuration.setSocketConfig(socketConfig);
                servidorNuevo = new SocketIOServer(configuration);

                SocketIOServer server = servidorNuevo;
                server.addConnectListener(client -> {
                    emitirEstado();
                });
                server.addDisconnectListener(client -> {
                    direccionesPorSesionSocket.remove(client.getSessionId().toString());
                    emitirEstado();
                });
                server.addEventListener("registrar-dispositivo-lan", Object.class, (client, data, ackRequest) -> {
                    String socketId = client.getSessionId().toString();
                    direccionesPorSesionSocket.put(
                        socketId,
                        obtenerDireccionUnica(client.getRemoteAddress(), socketId)
                    );
                    emitirEstado();
                });
                server.addEventListener("solicitar-estado-inicial", Object.class, (client, data, ackRequest) -> {
                    JSObject request = new JSObject();
                    request.put("socketId", client.getSessionId().toString());
                    notifyListeners("snapshotRequested", request);
                });
                server.addEventListener("accion-esclavo", JsonNode.class, (client, data, ackRequest) -> {
                    server.getBroadcastOperations().sendEvent("accion-maestro", client, data);
                    if (data != null) {
                        JSObject accion = new JSObject();
                        accion.put("tipo", data.path("tipo").asText());
                        if (data.has("payload")) {
                            accion.put("payload", JSON.convertValue(data.get("payload"), Object.class));
                        }
                        notifyListeners("slaveAction", accion);
                    }
                });
                server.addEventListener("sync-pantalla-cliente", JsonNode.class, (client, data, ackRequest) -> {
                    if (data.hasNonNull("cajaId") && data.hasNonNull("payload")) {
                        String cajaId = data.get("cajaId").asText();
                        JsonNode payload = data.get("payload");
                        if ("ACTUALIZAR_CARRITO".equals(payload.path("tipo").asText())) {
                            ultimosCarritosPorCaja.put(cajaId, data.deepCopy());
                        }
                        server.getBroadcastOperations().sendEvent("update-pantalla-cliente", data);
                    }
                });
                server.addEventListener("registrar-pantalla-cliente", JsonNode.class, (client, data, ackRequest) -> {
                    if (data.hasNonNull("cajaId")) {
                        JsonNode ultimoCarrito = ultimosCarritosPorCaja.get(data.get("cajaId").asText());
                        if (ultimoCarrito != null) client.sendEvent("update-pantalla-cliente", ultimoCarrito);
                        server.getBroadcastOperations().sendEvent("pantalla-cliente-conectada", data);
                        JSObject conectado = new JSObject();
                        conectado.put("cajaId", data.get("cajaId").asText());
                        notifyListeners("customerDisplayConnected", conectado);
                    }
                });
                server.start();
            }

            executorNuevo = Executors.newCachedThreadPool();
            webServerSocket = servidorWebNuevo;
            webExecutor = executorNuevo;
            socketServer = servidorNuevo;
            webServerRunning = true;
            ServerSocket serverSocketWeb = servidorWebNuevo;
            executorNuevo.execute(() -> aceptarSolicitudesWeb(serverSocketWeb));
            iniciarAnuncioCerebro();
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
        detenerAnuncioCerebro();
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
        direccionesPorSesionSocket.clear();
        for (ClienteSse cliente : clientesPantallaSse) {
            try {
                cliente.socket.close();
            } catch (IOException error) {
                Log.w(TAG, "No se pudo cerrar una conexión SSE de pantalla cliente.", error);
            }
        }
        clientesPantallaSse.clear();
        emitirEstado();
    }

    private synchronized void iniciarAnuncioCerebro() {
        if (anuncioCerebro != null && !anuncioCerebro.isShutdown()) return;
        anuncioCerebro = Executors.newSingleThreadScheduledExecutor();
        anuncioCerebro.scheduleAtFixedRate(this::anunciarCerebro, 0, 3, TimeUnit.SECONDS);
    }

    private void detenerAnuncioCerebro() {
        ScheduledExecutorService actual = anuncioCerebro;
        anuncioCerebro = null;
        if (actual != null) actual.shutdownNow();
    }

    private void anunciarCerebro() {
        try (DatagramSocket socket = new DatagramSocket()) {
            socket.setBroadcast(true);
            byte[] mensaje = JSON.writeValueAsBytes(
                JSON.createObjectNode()
                    .put("tipo", TIPO_CEREBRO)
                    .put("ip", obtenerIpLocal())
                    .put("puertoWeb", WEB_PORT)
                    .put("tiendaId", tiendaIdAnuncio)
                    .put("deviceId", deviceIdAnuncio)
                    .put("plataforma", "android")
            );
            Set<InetAddress> destinos = new HashSet<>();
            destinos.add(InetAddress.getByName("255.255.255.255"));
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces != null && interfaces.hasMoreElements()) {
                NetworkInterface networkInterface = interfaces.nextElement();
                if (!networkInterface.isUp() || networkInterface.isLoopback()) continue;
                for (InterfaceAddress direccion : networkInterface.getInterfaceAddresses()) {
                    InetAddress broadcast = direccion.getBroadcast();
                    if (broadcast != null) destinos.add(broadcast);
                }
            }
            for (InetAddress destino : destinos) {
                socket.send(new DatagramPacket(mensaje, mensaje.length, destino, DISCOVERY_PORT));
            }
        } catch (IOException error) {
            Log.e(TAG, "No se pudo anunciar el Cerebro en la red local.", error);
        }
    }

    private void escucharCerebro(DatagramSocket socket) {
        byte[] buffer = new byte[1024];
        String ultimaIpNotificada = null;
        while (escuchaCerebroActiva && !socket.isClosed()) {
            DatagramPacket paquete = new DatagramPacket(buffer, buffer.length);
            try {
                socket.receive(paquete);
                String mensaje = new String(
                    paquete.getData(),
                    paquete.getOffset(),
                    paquete.getLength(),
                    StandardCharsets.UTF_8
                );
                JsonNode datos = JSON.readTree(mensaje);
                if (datos == null || !TIPO_CEREBRO.equals(datos.path("tipo").asText())) continue;
                if (!datos.path("ip").isTextual() || !datos.path("puertoWeb").canConvertToInt()) continue;
                String ip = paquete.getAddress().getHostAddress();
                if (!esIpLanValida(ip) || ip.equals(ultimaIpNotificada)) continue;

                ultimaIpNotificada = ip;
                JSObject resultado = new JSObject();
                resultado.put("ip", ip);
                resultado.put("puertoWeb", datos.path("puertoWeb").asInt());
                resultado.put("tiendaId", datos.path("tiendaId").asText());
                resultado.put("deviceId", datos.path("deviceId").asText());
                resultado.put("plataforma", datos.path("plataforma").asText());
                notifyListeners("brainDetected", resultado);
            } catch (java.net.SocketTimeoutException error) {
                continue;
            } catch (IOException error) {
                if (escuchaCerebroActiva) Log.e(TAG, "Error escuchando anuncios de Cerebro por LAN.", error);
            }
        }
    }

    private boolean esIpLanValida(String ip) {
        if (ip == null || !ip.matches("\\d{1,3}(\\.\\d{1,3}){3}")) return false;
        try {
            InetAddress direccion = InetAddress.getByName(ip);
            return direccion instanceof Inet4Address && direccion.isSiteLocalAddress();
        } catch (IOException error) {
            return false;
        }
    }

    private synchronized void detenerEscuchaCerebro() {
        escuchaCerebroActiva = false;
        if (socketEscuchaCerebro != null) {
            socketEscuchaCerebro.close();
            socketEscuchaCerebro = null;
        }
    }

    private JSObject obtenerEstado() {
        JSObject status = new JSObject();
        status.put("activo", socketServer != null && webServerSocket != null && !webServerSocket.isClosed());
        status.put("dispositivosConectados", contarDispositivosConectados());
        status.put("ip", obtenerIpLocal());
        status.put("webPort", WEB_PORT);
        return status;
    }

    private int contarDispositivosConectados() {
        return new HashSet<>(direccionesPorSesionSocket.values()).size();
    }

    private String obtenerDireccionUnica(SocketAddress remoteAddress, String fallback) {
        if (remoteAddress instanceof InetSocketAddress) {
            InetSocketAddress direccion = (InetSocketAddress) remoteAddress;
            if (direccion.getAddress() != null && direccion.getAddress().isLoopbackAddress()) return fallback;
            String host = direccion.getAddress() == null
                ? direccion.getHostString()
                : direccion.getAddress().getHostAddress();
            if (host != null && !host.isEmpty()) {
                return host.toLowerCase(Locale.ROOT);
            }
        }
        return fallback;
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

            String[] partesRuta = requestLine.split(" ")[1].split("\\?", 2);
            String ruta = partesRuta[0];
            ruta = URLDecoder.decode(ruta, StandardCharsets.UTF_8.name());
            if (ruta.contains("..") || ruta.startsWith("//")) {
                escribirRespuesta(client, 400, "text/plain; charset=utf-8", "Ruta inválida".getBytes(StandardCharsets.UTF_8));
                return;
            }
            if ("/events".equals(ruta)) {
                String cajaId = obtenerParametroQuery(partesRuta.length > 1 ? partesRuta[1] : "", "cajaId");
                if (cajaId == null || cajaId.isEmpty()) {
                    escribirRespuesta(client, 400, "text/plain; charset=utf-8", "Falta la caja de pantalla cliente".getBytes(StandardCharsets.UTF_8));
                    return;
                }
                servirEventosPantallaCliente(client, cajaId);
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

    private void servirEventosPantallaCliente(Socket socket, String cajaId) throws IOException {
        BufferedOutputStream output = new BufferedOutputStream(socket.getOutputStream());
        String headers = "HTTP/1.1 200 OK\r\n"
            + "Content-Type: text/event-stream; charset=utf-8\r\n"
            + "Cache-Control: no-cache, no-transform\r\n"
            + "Connection: keep-alive\r\n"
            + "Access-Control-Allow-Origin: *\r\n\r\n";
        output.write(headers.getBytes(StandardCharsets.UTF_8));
        output.write(": conectado\n\n".getBytes(StandardCharsets.UTF_8));
        output.flush();

        ClienteSse cliente = new ClienteSse(cajaId, socket, output);
        clientesPantallaSse.add(cliente);
        emitirEstado();
        JsonNode ultimoCarrito = ultimosCarritosPorCaja.get(cajaId);
        if (ultimoCarrito != null) escribirEventoSse(cliente, ultimoCarrito);

        try {
            while (webServerRunning && !socket.isClosed()) {
                Thread.sleep(15000L);
                synchronized (cliente) {
                    output.write(": mantener-conexion\n\n".getBytes(StandardCharsets.UTF_8));
                    output.flush();
                }
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        } catch (IOException error) {
            if (webServerRunning) Log.d(TAG, "Se cerró una conexión SSE de pantalla cliente.");
        } finally {
            clientesPantallaSse.remove(cliente);
            emitirEstado();
        }
    }

    private String obtenerParametroQuery(String query, String nombre) throws IOException {
        for (String parametro : query.split("&")) {
            String[] partes = parametro.split("=", 2);
            if (partes.length == 2 && nombre.equals(URLDecoder.decode(partes[0], StandardCharsets.UTF_8.name()))) {
                return URLDecoder.decode(partes[1], StandardCharsets.UTF_8.name());
            }
        }
        return null;
    }

    private void enviarMensajePantallaSse(JsonNode data) {
        String cajaId = data.path("cajaId").asText();
        for (ClienteSse cliente : clientesPantallaSse) {
            if (cajaId.equals(cliente.cajaId)) escribirEventoSse(cliente, data);
        }
    }

    private void escribirEventoSse(ClienteSse cliente, JsonNode data) {
        try {
            byte[] evento = ("data: " + JSON.writeValueAsString(data) + "\n\n").getBytes(StandardCharsets.UTF_8);
            synchronized (cliente) {
                cliente.output.write(evento);
                cliente.output.flush();
            }
        } catch (IOException error) {
            try {
                cliente.socket.close();
            } catch (IOException errorCierre) {
                Log.w(TAG, "No se pudo cerrar una conexión SSE que dejó de responder.", errorCierre);
            }
        }
    }

    private static final class ClienteSse {
        private final String cajaId;
        private final Socket socket;
        private final OutputStream output;

        private ClienteSse(String cajaId, Socket socket, OutputStream output) {
            this.cajaId = cajaId;
            this.socket = socket;
            this.output = output;
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
            case "wasm": return "application/wasm";
            case "woff":
            case "woff2": return "font/" + extension;
            default: return "application/octet-stream";
        }
    }

    private String obtenerIpLocal() {
        try {
            ConnectivityManager connectivityManager =
                (ConnectivityManager) getContext().getSystemService(android.content.Context.CONNECTIVITY_SERVICE);
            if (connectivityManager != null) {
                for (Network network : connectivityManager.getAllNetworks()) {
                    NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(network);
                    if (capabilities == null || !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) continue;
                    LinkProperties properties = connectivityManager.getLinkProperties(network);
                    if (properties == null) continue;
                    for (LinkAddress linkAddress : properties.getLinkAddresses()) {
                        java.net.InetAddress address = linkAddress.getAddress();
                        if (address instanceof Inet4Address && !address.isLoopbackAddress() && !address.isLinkLocalAddress()) {
                            return address.getHostAddress();
                        }
                    }
                }
            }

            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            java.util.List<NetworkInterface> disponibles = Collections.list(interfaces);
            disponibles.sort((primera, segunda) -> Integer.compare(
                prioridadInterfaz(primera.getName()),
                prioridadInterfaz(segunda.getName())
            ));
            for (NetworkInterface networkInterface : disponibles) {
                if (!networkInterface.isUp() || networkInterface.isLoopback()) continue;
                for (java.net.InetAddress address : Collections.list(networkInterface.getInetAddresses())) {
                    if (address instanceof Inet4Address && !address.isLoopbackAddress() && !address.isLinkLocalAddress()) {
                        return address.getHostAddress();
                    }
                }
            }
        } catch (Exception error) {
            Log.w(TAG, "No se pudo determinar la dirección IP LAN.", error);
        }
        return "127.0.0.1";
    }

    private int prioridadInterfaz(String nombre) {
        if (nombre.startsWith("wlan")) return 0;
        if (nombre.startsWith("eth") || nombre.startsWith("en")) return 1;
        if (nombre.startsWith("rmnet") || nombre.startsWith("tun") || nombre.startsWith("p2p")) return 3;
        return 2;
    }
}
