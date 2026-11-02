import type { Venta } from "../estado/estadoVentas";
import { abreviaturaUnidad } from "../tipos/producto";
import { esAndroidNativo } from "./utils";

export const imprimirTicket = async (
  venta: Venta, 
  nombreTienda: string = "Mi Tienda", 
  mensajePie: string = "¡Gracias por su preferencia!",
  direccionTienda: string = "",
  logoTienda: string = "",
  urlFactura?: string // <-- Nuevo parámetro opcional
) => {
  let htmlArticulos = '';
  venta.articulos.forEach(art => {
    const esFraccion = art.unidad === "KG" || art.unidad === "LITRO" || art.unidad === "GRAMO" || art.unidad === "MILILITRO" || art.unidad === "MILIGRAMO";
    const cantidadFormateada = esFraccion ? art.cantidad.toFixed(3) : art.cantidad.toString();
    const abreviatura = abreviaturaUnidad(art.unidad || 'PIEZA');

    htmlArticulos += `
      <tr>
        <td style="padding-top: 6px; padding-bottom: 2px;">${cantidadFormateada} ${abreviatura}</td>
        <td style="padding-top: 6px; padding-bottom: 2px; padding-left: 5px;">${art.nombre}</td>
        <td style="padding-top: 6px; padding-bottom: 2px; text-align: right;">$${(art.subtotal || 0).toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="3" style="font-size: 10px; color: #555; padding-left: 15px;">
          $${(art.precio || 0).toFixed(2)} x ${abreviatura}
        </td>
      </tr>
    `;
  });

  const nombreCajero = venta.trabajador ? venta.trabajador.replace(/-/g, "").replace(/(Dueño|Dueña|Trabajador|Trabajadora)/gi, "").trim() : "Cajero";
  const logoHtml = logoTienda ? `<div class="center" style="margin-bottom: 10px;"><img src="${logoTienda}" alt="Logo" style="display: block; max-width: 150px; max-height: 80px; margin: 0 auto; object-fit: contain;" /></div>` : '';
  const direccionHtml = direccionTienda ? `<div class="center" style="margin-bottom: 15px; font-size: 10px; white-space: pre-wrap;">${direccionTienda}</div>` : '';

  // Bloque para inyectar el código QR si existe una URL de autofacturación
  const facturaHtml = urlFactura 
    ? `
      <div class="divider"></div>
      <div class="center bold" style="margin-top: 10px; font-size: 11px;">¿Requiere Factura?</div>
      <div class="center" style="font-size: 10px; margin-bottom: 5px;">Escanee este código para generarla:</div>
      <div class="center">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(urlFactura)}" alt="QR Factura" style="display: block; margin: 0 auto; width: 130px; height: 130px;" />
      </div>
      <div class="center" style="font-size: 9px; margin-top: 5px; word-break: break-all;">${urlFactura}</div>
    ` 
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket de Venta</title>
        <style>
          html, body { margin: 0; padding: 0; width: 100%; background-color: #fff; }
          body { display: flex; justify-content: center; align-items: flex-start; }
          .ticket {
            width: 80mm; 
            max-width: 100%;
            padding: 20px 10px 10px 10px;
            text-align: left;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            color: #000;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { vertical-align: top; }
          @media print {
            body { display: block; }
            .ticket { margin: 0 auto; padding-top: 15px; }
            @page { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          ${logoHtml}
          <div class="center bold" style="font-size: 18px; margin-bottom: 5px; text-transform: uppercase;">${nombreTienda}</div>
          ${direccionHtml}
          <div class="center" style="margin-bottom: 15px; font-size: 10px;">Comprobante de Venta</div>
          
          <div><span class="bold">Ticket:</span> ${venta.id}</div>
          <div><span class="bold">Fecha:</span> ${new Date(venta.fecha).toLocaleString('es-MX')}</div>
          <div><span class="bold">Cajero:</span> ${nombreCajero}</div>
          
          <div class="divider"></div>
          <table>
            <tr class="bold" style="border-bottom: 1px solid #000;">
              <td style="padding-bottom: 5px;">Cant</td>
              <td style="padding-bottom: 5px; padding-left: 5px;">Descripción</td>
              <td style="padding-bottom: 5px; text-align: right;">Total</td>
            </tr>
            ${htmlArticulos}
          </table>
          <div class="divider"></div>
          
          ${venta.descuento > 0 ? `
          <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>$${(venta.subtotal || 0).toFixed(2)}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Descuento:</span><span>-$${(venta.descuento || 0).toFixed(2)}</span></div>
          ` : ''}
          
          <div class="bold" style="display: flex; justify-content: space-between; font-size: 16px; margin-top: 8px;">
            <span>TOTAL:</span>
            <span>$${(venta.total || 0).toFixed(2)}</span>
          </div>
          
          <div style="margin-top: 10px; font-size: 11px;">Pago: ${venta.metodoPago}</div>
          
          ${facturaHtml} 
          
          <div class="divider"></div>
          <div class="center bold" style="margin-top: 15px;">${mensajePie || '¡Gracias por su preferencia!'}</div>
        </div>
      </body>
    </html>
  `;

  if (esAndroidNativo) {
    // TODO: Integrar plugin nativo
  } else if (typeof window !== 'undefined' && window.apiLocal?.imprimirSilencioso) {
    try {
      await window.apiLocal.imprimirSilencioso(html);
      return;
    } catch (error) {
      console.error("Error en impresión silenciosa:", error);
    }
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const contentWindow = iframe.contentWindow;
  if (!contentWindow) return;

  const doc = contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  contentWindow.focus();
  
  setTimeout(() => {
    void Promise.all(
      Array.from(doc.images, imagen => imagen.decode().catch(() => {}))
    ).then(() => {
      contentWindow.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 1000);
    });
  }, 300);
};