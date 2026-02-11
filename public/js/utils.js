export const seasonLabel = {
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn'
};

export function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function prettyDate(dateLike) {
  if (!dateLike) return 'Date unknown';
  const date = new Date(dateLike);
  if (Number.isNaN(date.valueOf())) return 'Date unknown';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

export function queryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

export function imageOrPlaceholder(url, label = 'Wildlight Archive') {
  if (url && String(url).trim()) {
    return String(url).trim();
  }

  const safeLabel = encodeURIComponent(label.slice(0, 30));
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1400' height='900'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%232c3b36'/%3E%3Cstop offset='55%25' stop-color='%235f6c5b'/%3E%3Cstop offset='100%25' stop-color='%238f9d8c'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1400' height='900' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-family='Georgia, serif' font-size='54' opacity='0.86'%3E${safeLabel}%3C/text%3E%3C/svg%3E`;
}

export async function fetchJson(url, options) {
  const response = await fetch(url, options);
  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }

  return payload;
}
