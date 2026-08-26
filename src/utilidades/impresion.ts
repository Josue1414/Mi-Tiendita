// src/utilidades/impresion.ts
import type { Venta } from "../estado/estadoVentas";

export const imprimirTicket = (venta: Venta, nombreTienda: string = "Mi Tienda", mensajePie: string = "¡Gracias por su preferencia!") => {
  const ventana = window.open('', 'PRINT', 'height=600,width=400');
  if (!ventana) return;

  let htmlArticulos = '';
  venta.articulos.forEach(art => {
    htmlArticulos += `
      <tr>
        <td style="padding-top: 6px; padding-bottom: 2px;">${art.cantidad}</td>
        <td style="padding-top: 6px; padding-bottom: 2px; padding-left: 5px;">${art.nombre}</td>
        <td style="padding-top: 6px; padding-bottom: 2px; text-align: right;">$${art.subtotal.toFixed(2)}</td>
      </tr>
      <tr>
        <td colspan="3" style="font-size: 10px; color: #555; padding-left: 15px;">
          $${art.precio.toFixed(2)} x ${art.unidad.toLowerCase()}
        </td>
      </tr>
    `;
  });

  const nombreCajero = venta.trabajador.replace(/-/g, "").replace(/(Dueño|Dueña|Trabajador|Trabajadora)/gi, "").trim();

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket de Venta</title>
        <style>
          body { 
            margin: 0; 
            padding: 20px 0; 
            text-align: center; 
            background: #fff; 
          }
          .ticket { 
            margin: 0 auto; 
            width: 100%; 
            max-width: 300px; /* Ancho estándar de impresora de 80mm */
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
            @page { margin: 0; }
            body { padding: 10px 0; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="center bold" style="font-size: 18px; margin-bottom: 5px; text-transform: uppercase;">${nombreTienda}</div>
          <div class="center" style="margin-bottom: 15px; font-size: 10px;">Comprobante de Venta</div>
          
          <div><span class="bold">Ticket:</span> ${venta.id.split('-')[0].toUpperCase()}</div>
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
          <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>$${venta.subtotal.toFixed(2)}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Descuento:</span><span>-$${venta.descuento.toFixed(2)}</span></div>
          ` : ''}
          
          <div class="bold" style="display: flex; justify-content: space-between; font-size: 16px; margin-top: 8px;">
            <span>TOTAL:</span>
            <span>$${venta.total.toFixed(2)}</span>
          </div>
          
          <div style="margin-top: 10px; font-size: 11px;">Pago realizado con: ${venta.metodoPago}</div>
          <div class="divider"></div>
          <div class="center bold" style="margin-top: 15px;">${mensajePie || '¡Gracias por su preferencia!'}</div>
        </div>
      </body>
    </html>
  `;

  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
  
  setTimeout(() => {
    ventana.print();
    ventana.close();
  }, 300);
};