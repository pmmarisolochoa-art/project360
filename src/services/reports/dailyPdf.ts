/**
 * El reporte de la Daily, en PDF y en correo.
 *
 * Reusa el MISMO motor paginado que el resto de reportes (`composeReport`), así
 * que comparte cabecera, footer y tamaño A4 con el semanal y el de reunión.
 *
 * POR QUÉ EXISTE: el PDF de una daily salía casi en blanco. El botón llamaba al
 * reporte genérico, que le pide todo a la IA a partir de las NOTAS — y una
 * reunión importada de Paralelo no tiene notas, tiene resumen. Resultado: un
 * titular, un párrafo y una página vacía.
 *
 * Aquí se pinta el reporte que ya está construido y guardado, con sus hechos
 * contados. No vuelve a preguntarle nada a la IA.
 */

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Client } from '@/types/client';
import type { Meeting } from '@/types/meeting';
import { composeReport, escapeReport as esc, type ReportModel } from '@/services/htmlReport';
import { BRAND } from '@/config/brand';
import { lineaDeAlerta, type FilaSeguimiento, type ReporteDaily } from './dailyReport';

const ESTADO_ETIQUETA: Record<FilaSeguimiento['estado'], { txt: string; cls: string }> = {
  completada: { txt: 'Completada', cls: 'ok' },
  en_progreso: { txt: 'En progreso', cls: 'wip' },
  vencida: { txt: 'Vencida', cls: 'bad' },
  pendiente: { txt: 'Pendiente', cls: '' },
};

function estilos(accent: string): string {
  return `
    *{box-sizing:border-box;margin:0;padding:0}
    .rep{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2430;line-height:1.5;background:#fff;width:760px}
    .rep .body,.rep .block{width:760px}
    .rep .block{padding-bottom:2px}
    .rep .pulso{border:1px solid #e6e8ee;border-left:5px solid ${accent};border-radius:10px;padding:14px 16px;margin-bottom:14px;background:#fafbfc}
    .rep .pulso.alerta{border-left-color:#f59e0b;background:#fffbf4}
    .rep .pulso .l{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;font-weight:700;margin-bottom:5px}
    .rep .pulso .t{font-size:14px;color:#1f2430;line-height:1.6}
    .rep .alertas{border:1px solid #fca5a5;background:#fef4f4;border-radius:10px;padding:13px 16px;margin-bottom:14px}
    .rep .alertas .l{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#dc2626;font-weight:800;margin-bottom:6px}
    .rep .alertas .a{font-size:12.5px;color:#1f2430;margin-top:4px}
    .rep .cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
    .rep .c{border:1px solid #e6e8ee;border-top:3px solid ${accent};border-radius:9px;padding:11px}
    .rep .c.ok{border-top-color:#10b981}.rep .c.bad{border-top-color:#ef4444}
    .rep .c .l{font-size:8.5px;letter-spacing:.09em;text-transform:uppercase;color:#6b7280;font-weight:700}
    .rep .c .n{font-size:24px;font-weight:800;margin-top:4px;line-height:1}
    .rep .sec{display:flex;align-items:center;gap:10px;margin:4px 0 10px}
    .rep .sec h2{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
    .rep .sec .ln{flex:1;height:1px;background:#e6e8ee}
    .rep .sec .ia{font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:#8b93a5;border:1px solid #e0e3ea;border-radius:20px;padding:2px 7px}
    .rep table{width:100%;border-collapse:collapse;border:1px solid #e6e8ee;border-radius:8px;overflow:hidden;margin-bottom:14px}
    .rep td{padding:8px 11px;font-size:12px;border-bottom:1px solid #eef0f4;vertical-align:top}
    .rep tr:last-child td{border-bottom:none}
    .rep .who{color:#5b6478;white-space:nowrap}
    .rep .st{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;padding:3px 8px;border-radius:5px;background:#f1f3f7;color:#5b6478}
    .rep .st.ok{background:#e7f8f1;color:#0f7a5a}.rep .st.wip{background:#eaf1fe;color:#2b5fd9}.rep .st.bad{background:#fdecec;color:#c22}
    .rep .late{color:#c22;font-size:11px;white-space:nowrap}
    .rep .cols{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
    .rep .col{border:1px solid #e6e8ee;border-radius:9px;padding:11px 13px}
    .rep .col .a{font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:#6b7280;font-weight:700;margin-bottom:5px}
    .rep .col li{font-size:12px;margin-left:15px;margin-top:3px;line-height:1.45}
    .rep .col .no{font-size:11.5px;color:#9aa1b0;font-style:italic}
    .rep .gente{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}
    .rep .p{border:1px solid #e6e8ee;border-radius:8px;padding:8px 11px}
    .rep .p .n{font-size:12.5px;font-weight:700}
    .rep .p .d{font-size:10.5px;color:#6b7280;margin-top:2px}
    .rep .p.blq{border-left:3px solid #f59e0b}
    .rep .vacio{font-size:11.5px;color:#9aa1b0;border:1px dashed #e0e3ea;border-radius:8px;padding:11px;margin-bottom:14px}
  `;
}

const sec = (titulo: string, ia = false) =>
  `<div class="sec"><h2>${esc(titulo)}</h2>${ia ? '<span class="ia">lectura</span>' : ''}<div class="ln"></div></div>`;

const tabla = (filas: FilaSeguimiento[], conAtraso: boolean) =>
  `<table>${filas
    .map((f) => {
      const e = ESTADO_ETIQUETA[f.estado];
      return `<tr><td>${esc(f.titulo)}</td><td class="who">${esc(f.responsable)}</td><td><span class="st ${e.cls}">${e.txt}</span></td>${
        conAtraso ? `<td class="late">${f.diasAtraso > 0 ? `hace ${f.diasAtraso}d` : ''}</td>` : ''
      }</tr>`;
    })
    .join('')}</table>`;

/** Los bloques, en el mismo orden que en pantalla: primero lo que hace actuar. */
function bloques(r: ReporteDaily): string[] {
  const b: string[] = [];
  const alerta = lineaDeAlerta(r.vencidas);
  const hayAlerta = !!alerta || r.alertas.length > 0;

  if (r.pulso) {
    b.push(
      `<div class="pulso${hayAlerta ? ' alerta' : ''}"><div class="l">Pulso general</div><div class="t">${esc(r.pulso)}</div></div>`,
    );
  }

  if (hayAlerta) {
    b.push(
      `<div class="alertas"><div class="l">Alertas y urgencias</div>${
        alerta ? `<div class="a"><b>${esc(alerta)}</b></div>` : ''
      }${r.alertas.map((a) => `<div class="a">· ${esc(a)}</div>`).join('')}</div>`,
    );
  }

  const completadas = r.seguimiento.filter((s) => s.estado === 'completada').length;
  b.push(
    `<div class="cifras">
      <div class="c"><div class="l">Venían</div><div class="n">${r.seguimiento.length}</div></div>
      <div class="c ok"><div class="l">Completadas</div><div class="n">${completadas}</div></div>
      <div class="c${r.vencidas > 0 ? ' bad' : ''}"><div class="l">Vencidas</div><div class="n">${r.vencidas}</div></div>
      <div class="c"><div class="l">Nuevas hoy</div><div class="n">${r.nuevas.length}</div></div>
    </div>`,
  );

  if (r.estadoEquipo.length) {
    b.push(
      sec('Estado del equipo', true) +
        `<div class="gente">${r.estadoEquipo
          .map(
            (p) =>
              `<div class="p${p.estado === 'Con bloqueante' ? ' blq' : ''}"><div class="n">${esc(p.persona)}</div><div class="d">${esc(p.area)} · ${esc(p.estado)}${
                p.observacion ? ` · ${esc(p.observacion)}` : ''
              }</div></div>`,
          )
          .join('')}</div>`,
    );
  }

  if (r.prioridades.length) {
    b.push(
      sec('Prioridades', true) +
        `<div class="cols">${r.prioridades
          .map((p) => {
            const sinDatos = p.items.length === 1 && /no mencionad/i.test(p.items[0]);
            return `<div class="col"><div class="a">${esc(p.area)}</div>${
              sinDatos
                ? '<div class="no">No se mencionó en esta daily</div>'
                : `<ol>${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>`
            }</div>`;
          })
          .join('')}</div>`,
    );
  }

  const tituloSeg = r.dailyAnterior
    ? `Tareas de la daily del ${format(parseISO(r.dailyAnterior.fecha), 'd MMM', { locale: es })}`
    : 'Seguimiento';
  b.push(
    sec(tituloSeg) +
      (r.seguimiento.length
        ? tabla(r.seguimiento, true)
        : `<div class="vacio">${
            r.dailyAnterior
              ? 'La daily anterior no dejó tareas registradas.'
              : 'Es la primera daily registrada: no hay con qué comparar.'
          }</div>`),
  );

  b.push(
    sec('Nuevas tareas asignadas hoy') +
      (r.nuevas.length ? tabla(r.nuevas, false) : '<div class="vacio">Esta daily no generó tareas nuevas.</div>'),
  );

  return b;
}

export function modeloDaily(client: Client, meeting: Meeting, r: ReporteDaily): ReportModel {
  const accent = client.primaryColor || '#6366F1';
  const fecha = parseISO(r.fecha);
  const fechaLarga = format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es });
  return {
    styles: estilos(accent),
    blocks: bloques(r),
    accentClient: accent,
    client: client.name,
    agency: BRAND.label,
    titleLines: ['Reporte de', 'la Daily'],
    subtitle: r.pulso ? r.pulso.slice(0, 90) : meeting.title,
    runningLabel: 'Reporte de la Daily',
    meta: [
      { k: 'Día', v: r.diaSemana },
      { k: 'Fecha', v: format(fecha, 'd MMM yyyy', { locale: es }) },
      { k: 'Duración', v: `${r.duracionMin} min` },
    ],
    footerLeft: `${client.name} · Reporte de la Daily · ${fechaLarga}`,
    fileName: `Reporte_Daily_${format(fecha, 'yyyy-MM-dd')}.pdf`,
    imageFormat: 'JPEG',
    imageQuality: 0.82,
  };
}

/** PDF de la daily, a partir del reporte ya construido. */
export async function pdfDaily(client: Client, meeting: Meeting, r: ReporteDaily) {
  const doc = await composeReport(modeloDaily(client, meeting, r));
  const dataUri = doc.output('datauristring') as string;
  return {
    blob: doc.output('blob') as Blob,
    base64: dataUri.slice(dataUri.indexOf(',') + 1),
    fileName: modeloDaily(client, meeting, r).fileName,
    deck: r.pulso,
  };
}
