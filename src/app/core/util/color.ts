/**
 * True si un color hex (#rgb o #rrggbb) es claro, para decidir si el texto
 * encima debe ser oscuro. Colores no parseables se tratan como oscuros.
 */
export function isLightColor(hex: string | null | undefined): boolean {
  if (!hex) return false;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Luminancia perceptual (ITU-R BT.601)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
