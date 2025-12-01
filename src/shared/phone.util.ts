import { BadRequestException } from '@nestjs/common';
import { CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';

export function toE164(raw: string, defaultCountry: 'AR' | CountryCode = 'AR') {
  const p = parsePhoneNumberFromString((raw ?? '').trim(), defaultCountry);
  if (!p || !p.isValid()) {
    throw new BadRequestException('Número de teléfono inválido');
  }
  return p.number;
}
