const haFormat = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Area in ha with two decimals and decimal comma, without unit. */
export function formatNumber(value: number): string {
  return haFormat.format(value);
}

export function formatHa(value: number): string {
  return `${formatNumber(value)} ha`;
}

/** "2026-04-15" -> "15.04.2026"; other formats pass through unchanged. */
export function formatDatum(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}
