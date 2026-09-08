export function deriveFenceUnitPrice({ targetTotal, length, fixedTotal }) {
  if (!Number.isFinite(length) || length <= 0) {
    return { ok: false, message: 'Укажите длину забора больше нуля.' };
  }
  const remaining = targetTotal - fixedTotal;
  if (remaining < 0) {
    return { ok: false, message: 'Желаемый итог меньше суммы остальных участков, ворот, калиток, доставки и допработ.' };
  }
  return { ok: true, unitPrice: remaining / length, fenceAmount: remaining };
}
