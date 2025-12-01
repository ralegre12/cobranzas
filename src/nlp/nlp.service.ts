import { Injectable } from '@nestjs/common';

// Intents base para ES. Expandible a ML luego.
export type Intent = 'PTP' | 'PAGO' | 'BAJA' | 'NEGATIVA' | 'CONSULTA' | 'DESCONOCIDO';

export type NlpResult = {
  intent: Intent;
  amount?: number;
  date?: string; // YYYY-MM-DD
  reason?: string; // texto libre (ej. “no puedo pagar”)
};

@Injectable()
export class NlpService {
  classify(textRaw: string): NlpResult {
    const text = (textRaw || '').toLowerCase().trim();

    // BAJA / DNC
    if (/(baja|no.+(contact|escrib)|deja?r? de|stop|unsuscribe|unsubscribe)/i.test(textRaw)) {
      return { intent: 'BAJA' };
    }

    // PAGO confirmado / comprobante
    if (/(pag(u|ó)|transfer(i|e)|comprobante|pagué|pague|pago realizado)/i.test(textRaw)) {
      return { intent: 'PAGO' };
    }

    // PTP / promesa (“pago el viernes 20000”, “te deposito mañana 15.000”)
    const date = this.extractDate(text);
    const amount = this.extractAmount(text);
    if (/(pago|deposit|transfer|abono)/.test(text) && (date || amount)) {
      return { intent: 'PTP', amount, date };
    }

    // Negativa (“no puedo pagar”, “no tengo plata”, “imposible”)
    if (/(no puedo|no tengo|imposible|no voy a|no pagar)/.test(text)) {
      return { intent: 'NEGATIVA', reason: textRaw };
    }

    // Consulta (“cómo pago”, “cuánto debo”, “link”)
    if (/(como pago|cómo pago|link|cu(a|á)nto debo|medio de pago|ayuda|info)/i.test(textRaw)) {
      return { intent: 'CONSULTA' };
    }

    return { intent: 'DESCONOCIDO' };
  }

  private extractAmount(text: string): number | undefined {
    // capta 1.234,56 | 1234,56 | 1234.56 | $ 1.234
    const m = text.match(/(?:\$|\b)\s*([\d.\,]{2,})/);
    if (!m) return undefined;
    const raw = m[1];
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    let normalized = raw;
    if (lastComma >= 0 && lastDot >= 0) {
      normalized =
        lastComma > lastDot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
    } else {
      normalized = raw.replace(',', '.');
    }
    const n = Number(normalized);
    return Number.isFinite(n) ? Math.abs(n) : undefined;
  }

  private extractDate(text: string): string | undefined {
    // hoy/mañana/viernes + fechas dd/mm/yyyy o yyyy-mm-dd
    const today = new Date();
    if (/mañana/.test(text)) {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }
    if (/\bhoy\b/.test(text)) return today.toISOString().slice(0, 10);

    const m1 = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
    if (m1) {
      const dd = m1[1].padStart(2, '0');
      const mm = m1[2].padStart(2, '0');
      let yy = m1[3];
      if (yy.length === 2) yy = (Number(yy) > 50 ? '19' : '20') + yy;
      return `${yy}-${mm}-${dd}`;
    }
    const m2 = text.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
    if (m2) {
      const yy = m2[1],
        mm = m2[2].padStart(2, '0'),
        dd = m2[3].padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    }
    return undefined;
  }
}
