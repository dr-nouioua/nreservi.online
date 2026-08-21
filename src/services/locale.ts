export const APP_LOCALE = "fr-DZ";
export const APP_CURRENCY = "DZD";

const numberFormatter = new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 0 });

export function formatDzd(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return `${numberFormatter.format(Number.isFinite(amount) ? amount : 0)} DA`;
}

export function formatDateDz(value: string | Date) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(APP_LOCALE);
}
