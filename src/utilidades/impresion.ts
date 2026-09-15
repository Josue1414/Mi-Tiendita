// src/utilidades/impresion.ts
import type { Venta } from "../estado/estadoVentas";

export const imprimirTicket = async (
  venta: Venta, 
  nombreTienda: string = "Mi Tienda", 
  mensajePie: string = "¡Gracias por su preferencia!",
  direccionTienda: string = "",
  logoTienda: string = ""
) => {
  let htmlArticulos = '';
  venta.articulos.forEach(art => {
    // Agregamos (art.unidad || 'PZA') y protecciones (art.precio || 0) para evitar que valores indefinidos rompan la aplicación
    htmlArticulos += `
      <tr>
        <td style="padding-top: 6px; padding-bottom: 2px;">${art.cantidad}</td>
        <td style="padding-top: 6px; padding-bottom: 2px; padding-left: 5px;">${art.nombre}</td>
        <td style="padding-top: 6px; padding-bottom: 2px; text-align: right;">$${(art.subtotal || 0).toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="3" style="font-size: 10px; color: #555; padding-left: 15px;">
          $${(art.precio || 0).toFixed(2)} x ${(art.unidad || 'PZA').toLowerCase()}
        </td>
      </tr>
    `;
  });

  // Protegemos la variable por si en ventas muy antiguas no existía el nombre del trabajador
  const nombreCajero = venta.trabajador ? venta.trabajador.replace(/-/g, "").replace(/(Dueño|Dueña|Trabajador|Trabajadora)/gi, "").trim() : "Cajero";

  // Se prepara el HTML del logo y la dirección si existen
  const logoHtml = logoTienda ? `<div class="center" style="margin-bottom: 10px;"><img src="${logoTienda}" style="max-width: 150px; max-height: 80px;" /></div>` : '';
  const direccionHtml = direccionTienda ? `<div class="center" style="margin-bottom: 15px; font-size: 10px; white-space: pre-wrap;">${direccionTienda}</div>` : '';

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
            padding: 20px 10px 10px 10px; /* Margen superior de 20px para que no pegue arriba */
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
            .ticket { margin: 0 auto; padding-top: 15px; } /* Espacio de seguridad al imprimir */
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
          
          <div style="margin-top: 10px; font-size: 11px;">Pago realizado con: ${venta.metodoPago}</div>
          <div class="divider"></div>
          <div class="center bold" style="margin-top: 15px;">${mensajePie || '¡Gracias por su preferencia!'}</div>
        </div>
      </body>
    </html>
  `;

  // Intentar impresión silenciosa en entorno de escritorio (Electron)
  if (typeof window !== 'undefined' && (window as any).apiLocal && (window as any).apiLocal.imprimirSilencioso) {
    try {
      await (window as any).apiLocal.imprimirSilencioso(html);
      return;
    } catch (error) {
      console.error("Error en impresión silenciosa:", error);
      // Si falla la API local, el código continuará con la impresión web estándar como respaldo.
    }
  }

  // Creación de iframe oculto para impresión web segura (evita bloqueadores de pop-ups)
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
  
  // Pequeño retraso para que el navegador procese el documento antes de lanzar la ventana de impresión
  setTimeout(() => {
    contentWindow.print();
    
    // Limpieza del DOM eliminando el iframe tras la interacción
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 300);
};