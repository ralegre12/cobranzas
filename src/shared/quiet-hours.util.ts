// file: src/shared/quiet-hours.util.ts
import { findTimeZone, getZonedTime } from 'timezone-support';

/**
 * Devuelve true si la hora local del tenant está dentro de quiet hours.
 * quietStart/quietEnd: "HH:mm" 24h. Soporta rangos que CRUZAN medianoche (ej 22:00-08:00)
 * y rangos diurnos (ej 13:00-15:00).
 */
export function isQuietHours(tenantTz: string, quietStart = '22:00', quietEnd = '08:00') {
  try {
    const zone = findTimeZone(tenantTz || 'America/Argentina/Buenos_Aires');
    const nowLocal = getZonedTime(new Date(), zone);
    const [sH, sM] = quietStart.split(':').map(Number);
    const [eH, eM] = quietEnd.split(':').map(Number);

    const cur = nowLocal.hours * 60 + nowLocal.minutes;
    const start = sH * 60 + sM;
    const end = eH * 60 + eM;

    if (start === end) return false; // rango vacío
    if (start < end) {
      // rango diurno (no cruza medianoche): [start, end)
      return cur >= start && cur < end;
    }
    // cruza medianoche: [start, 24h) U [0, end)
    return cur >= start || cur < end;
  } catch {
    return false;
  }
}
