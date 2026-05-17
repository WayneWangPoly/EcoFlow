import type { Customer, MapProvider } from '../domain/types';

export function makeMapUrl(customer: Customer | undefined, provider: MapProvider = 'google') {
  if (!customer) return '#';
  const address = [customer.address, customer.suburb, customer.postcode, 'SA', 'Australia'].filter(Boolean).join(', ');
  const encoded = encodeURIComponent(address);
  if (provider === 'apple') return `https://maps.apple.com/?daddr=${encoded}`;
  if (provider === 'waze') return `https://waze.com/ul?q=${encoded}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

export function suburbGroup(customer: Customer | undefined) {
  const suburb = (customer?.suburb ?? '').toLowerCase();
  if (['adelaide', 'unley', 'torrensville'].some((s) => suburb.includes(s))) return 'city';
  if (['mawson lakes', 'green fields'].some((s) => suburb.includes(s))) return 'north';
  if (['plympton', 'daw park'].some((s) => suburb.includes(s))) return 'southwest';
  if (['marryatville', 'linden park'].some((s) => suburb.includes(s))) return 'east';
  return 'other';
}

export function pointForCustomer(customer: Customer | undefined, index: number, total: number) {
  // Prefer approximate real Adelaide coordinates when available; otherwise fall back to a deterministic cluster layout.
  const minLat = -35.02;
  const maxLat = -34.78;
  const minLng = 138.54;
  const maxLng = 138.68;
  if (customer?.lat && customer?.lng) {
    const x = ((customer.lng - minLng) / (maxLng - minLng)) * 100;
    const y = (1 - (customer.lat - minLat) / (maxLat - minLat)) * 100;
    return { x: Math.max(6, Math.min(94, x)), y: Math.max(6, Math.min(94, y)) };
  }
  const group = suburbGroup(customer);
  const centers: Record<string, { x: number; y: number }> = {
    city: { x: 44, y: 56 },
    north: { x: 61, y: 20 },
    east: { x: 72, y: 55 },
    southwest: { x: 28, y: 76 },
    other: { x: 50, y: 50 }
  };
  const center = centers[group];
  const angle = (index / Math.max(1, total)) * Math.PI * 2;
  return { x: center.x + Math.cos(angle) * 6, y: center.y + Math.sin(angle) * 6 };
}
