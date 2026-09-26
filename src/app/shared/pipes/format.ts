import { inject, Pipe, PipeTransform } from '@angular/core';
import { LocaleService } from '../../core/i18n/locale.service';

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Latin → Arabic-Indic digits (spec §2: Arabic content uses ٠١٢٣). */
export function toArabicDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

/**
 * Localised digits for display. Arabic UI → Arabic-Indic; English → unchanged. Never use this on
 * phone numbers, emails or application references: those stay Latin in `<bdi dir="ltr">`.
 */
@Pipe({ name: 'digits', pure: false })
export class DigitsPipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const text = String(value);
    return this.locale.lang() === 'ar' ? toArabicDigits(text) : text;
  }
}

export function formatFileSize(bytes: number, intlLocale: string): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(intlLocale, {
    style: 'unit',
    unit: units[unit],
    unitDisplay: 'short',
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
}

/** `2.4 MB` / `٢٫٤ م.ب`. */
@Pipe({ name: 'fileSize', pure: false })
export class FileSizePipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(bytes: number | null | undefined): string {
    return bytes == null ? '' : formatFileSize(bytes, this.locale.intlLocale());
  }
}

export type DateStyle = 'long' | 'medium' | 'short' | 'datetime';

export function formatDate(value: string | Date, style: DateStyle, intlLocale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const options: Intl.DateTimeFormatOptions =
    style === 'datetime'
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: style };
  // Dates from the API are calendar dates (YYYY-MM-DD) or UTC instants; show them in Riyadh time.
  return new Intl.DateTimeFormat(intlLocale, { ...options, timeZone: 'Asia/Riyadh' }).format(date);
}

/** Locale-aware date (Gregorian, Arabic-Indic digits in Arabic). */
@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(value: string | Date | null | undefined, style: DateStyle = 'long'): string {
    return value ? formatDate(value, style, this.locale.intlLocale()) : '';
  }
}

export function relativeTime(value: string | Date, now: Date, intlLocale: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }
  return rtf.format(seconds, 'second');
}

/** "منذ ٣ أيام" / "3 days ago". */
@Pipe({ name: 'relTime', pure: false })
export class RelTimePipe implements PipeTransform {
  private readonly locale = inject(LocaleService);

  transform(value: string | Date | null | undefined, now: Date = new Date()): string {
    return value ? relativeTime(value, now, this.locale.intlLocale()) : '';
  }
}
