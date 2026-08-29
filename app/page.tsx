'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

const materials = {
  profile_one: { label: 'Профлист односторонний', prices: { '1.8': 1900, '2': 2100 } },
  profile_two: { label: 'Профлист двусторонний', prices: { '1.8': 2200, '2': 2400 } },
  picket_single: { label: 'Евроштакетник, один ряд', prices: { '1.8': 2150, '2': 2300 } },
  picket_chess: { label: 'Евроштакетник, шахматка', prices: { '1.8': 3650, '2': 3900 } },
  mesh3d: { label: '3D-сетка', prices: { '1.7': 1900, '2': 2000 } },
  chainlink: { label: 'Сетка-рабица', prices: { '1.8': 900, '2': 1000 } },
  frame: { label: 'Каркас забора', prices: { '1.8': 1250, '2': 1400 } },
} as const;
type Material = keyof typeof materials;
type Wicket = 'adjacent' | 'separate' | 'none';
type State = {
  mode: 'standard' | 'fence'; material: Material; height: string; length: number; fencePrice: number;
  swingEnabled: boolean; swingWidth: string; swingPrice: number; swingCount: number;
  slidingEnabled: boolean; slidingWidth: string; slidingPrice: number; slidingCount: number;
  wicket: Wicket; wicketPrice: number; wicketCount: number;
  deliveryPrice: number; extension: number; paint: number;
};
type Line = { title: string; description: string; unit: string; quantity: number; unitPrice: number; amount: number; manual?: boolean };
const initial: State = {
  mode: 'standard', material: 'profile_one', height: '2', length: 70, fencePrice: 0,
  swingEnabled: true, swingWidth: '4', swingPrice: 0, swingCount: 1,
  slidingEnabled: false, slidingWidth: '4', slidingPrice: 0, slidingCount: 1,
  wicket: 'adjacent', wicketPrice: 0, wicketCount: 1, deliveryPrice: 0, extension: 0, paint: 0,
};
const money = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
const count = (value: string) => Math.max(1, Number(value) || 1);

export default function Home() {
  const [s, setS] = useState<State>(initial);
  const [result, setResult] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const saved = localStorage.getItem('fence-estimate');
    if (saved) setS({ ...initial, ...JSON.parse(saved) });
    navigator.serviceWorker?.register('/sw.js');
  }, []);
  useEffect(() => localStorage.setItem('fence-estimate', JSON.stringify(s)), [s]);
  const set = <K extends keyof State>(key: K, value: State[K]) => setS(previous => ({ ...previous, [key]: value }));
  const quote = useMemo(() => {
    const list: Line[] = [];
    const catalogFence = materials[s.material].prices[s.height as keyof typeof materials[typeof s.material]['prices']] as number;
    const fenceUnit = s.fencePrice > 0 ? s.fencePrice : catalogFence;
    list.push({ title: 'Забор', description: `${materials[s.material].label}; высота ${s.height.replace('.', ',')} м; длина ${s.length} м`, unit: 'м.п.', quantity: s.length, unitPrice: fenceUnit, amount: s.length * fenceUnit, manual: s.fencePrice > 0 });
    if (s.mode === 'standard') {
      if (s.swingEnabled) {
        const unit = s.swingPrice > 0 ? s.swingPrice : s.swingWidth === '5' ? 23000 : ['3', '3.5', '4'].includes(s.swingWidth) ? 17000 : null;
        if (unit !== null) list.push({ title: 'Распашные ворота', description: `Ширина ${s.swingWidth.replace('.', ',')} м`, unit: 'компл.', quantity: Math.max(1, s.swingCount), unitPrice: unit, amount: unit * Math.max(1, s.swingCount), manual: s.swingPrice > 0 });
      }
      if (s.slidingEnabled) {
        const unit = s.slidingPrice > 0 ? s.slidingPrice : s.slidingWidth === '5' ? 75000 : ['3', '3.5', '4'].includes(s.slidingWidth) ? 69000 : null;
        if (unit !== null) list.push({ title: 'Откатные ворота', description: `Ширина ${s.slidingWidth.replace('.', ',')} м`, unit: 'компл.', quantity: Math.max(1, s.slidingCount), unitPrice: unit, amount: unit * Math.max(1, s.slidingCount), manual: s.slidingPrice > 0 });
      }
      if (s.wicket !== 'none') {
        const unit = s.wicketPrice > 0 ? s.wicketPrice : s.wicket === 'separate' ? 15000 : 13000;
        list.push({ title: 'Калитка', description: s.wicket === 'separate' ? 'Отдельно стоящая' : 'Рядом с воротами', unit: 'шт.', quantity: Math.max(1, s.wicketCount), unitPrice: unit, amount: unit * Math.max(1, s.wicketCount), manual: s.wicketPrice > 0 });
      }
      const automaticDelivery = s.length <= 60 ? 6000 : s.length <= 120 ? 8000 : 12000;
      const delivery = s.deliveryPrice > 0 ? s.deliveryPrice : automaticDelivery;
      list.push({ title: 'Доставка', description: s.deliveryPrice > 0 ? 'Стоимость задана вручную' : `Автоматически по метражу: ${s.length} м`, unit: 'усл.', quantity: 1, unitPrice: delivery, amount: delivery, manual: s.deliveryPrice > 0 });
      if (s.extension) list.push({ title: 'Удлинение столбов', description: 'Дополнительные работы', unit: 'м', quantity: s.extension, unitPrice: 300, amount: s.extension * 300 });
      if (s.paint) list.push({ title: 'Покраска каркаса', description: 'Дополнительные работы', unit: 'м', quantity: s.paint, unitPrice: 250, amount: s.paint * 250 });
    }
    return { list, total: list.reduce((sum, item) => sum + item.amount, 0) };
  }, [s]);
  const price = (label: string, value: number, key: 'fencePrice' | 'swingPrice' | 'slidingPrice' | 'wicketPrice' | 'deliveryPrice', placeholder: string) => <label>{label}<input type="number" min="0" placeholder={placeholder} value={value || ''} onChange={event => set(key, Number(event.target.value))} /><span className="hint">Необязательно: пустое поле использует цену прайса или правило расчёта.</span></label>;
  const needsManualPrice = (width: string, value: number) => !['3', '3.5', '4', '5'].includes(width) && value <= 0;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (s.length <= 0) { setError('Введите длину забора.'); return; }
    if (s.mode === 'standard' && s.swingEnabled && needsManualPrice(s.swingWidth, s.swingPrice)) { setError(`Для распашных ворот шириной ${s.swingWidth.replace('.', ',')} м укажите свою цену за комплект.`); return; }
    if (s.mode === 'standard' && s.slidingEnabled && needsManualPrice(s.slidingWidth, s.slidingPrice)) { setError(`Для откатных ворот шириной ${s.slidingWidth.replace('.', ',')} м укажите свою цену за комплект.`); return; }
    setError(''); setResult(true);
  };
  const widths = (value: string, key: 'swingWidth' | 'slidingWidth') => <label>Ширина, м<select value={value} onChange={event => set(key, event.target.value)}>{['3', '3.5', '4', '4.5', '5', '5.5', '6'].map(width => <option key={width} value={width}>{width.replace('.', ',')}</option>)}</select></label>;

  if (result) return <main className="result"><button className="back" onClick={() => setResult(false)}>‹ Изменить расчёт</button><article className="quote quote-table"><header><div><small>{s.mode === 'fence' ? 'Режим «Только забор»' : 'Предварительный расчёт'}</small><strong>Смета на устройство забора</strong><span>от {new Date().toLocaleDateString('ru-RU')}</span></div></header><div className="estimate-table" role="table" aria-label="Подробная смета"><div className="estimate-head" role="row"><span>Работы и материалы</span><span>Ед. изм.</span><span>Кол-во</span><span>Цена, руб.</span><span>Сумма, руб.</span></div>{quote.list.map(item => <div className="estimate-row" role="row" key={item.title + item.description}><div><b>{item.title}</b><small>{item.description}{item.manual ? ' · ручная цена' : ''}</small></div><span>{item.unit}</span><span>{item.quantity}</span><span>{money(item.unitPrice)}</span><b>{money(item.amount)}</b></div>)}<div className="estimate-total" role="row"><b>Итого</b><span>Включая материалы и работы</span><b>{money(quote.total)}</b></div></div><footer><b>Предварительная смета</b><p>Действует 7 календарных дней. Окончательная стоимость уточняется после выезда на объект.</p></footer></article><button className="primary" onClick={() => navigator.share?.({ title: 'Смета забора', text: `Предварительная смета: ${money(quote.total)}` })}>Поделиться</button><p>Сделайте скриншот карточки или отправьте результат через «Поделиться».</p></main>;
  return <main className="app"><header className="head"><span className="mark">⌁</span><div><small>Локальный расчёт</small><h1>Смета забора</h1></div></header><section className="hero"><span>Предварительная смета</span><b>{money(quote.total)}</b></section><form onSubmit={submit}>
    <section className="card"><small>Режим расчёта</small><label>Выберите режим<select value={s.mode} onChange={event => set('mode', event.target.value as State['mode'])}><option value="standard">Полная смета</option><option value="fence">Только забор</option></select></label><p className="hint">{s.mode === 'fence' ? 'В этом режиме не учитываются ворота, калитка, доставка и допработы.' : 'Настройте состав и при необходимости замените цены прайса своими.'}</p></section>
    <section className="card"><small>01 · Участок забора</small><label>Материал<select value={s.material} onChange={event => { const material = event.target.value as Material; set('material', material); set('height', Object.keys(materials[material].prices)[0]); }}>{Object.entries(materials).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label><div className="grid"><label>Высота, м<select value={s.height} onChange={event => set('height', event.target.value)}>{Object.keys(materials[s.material].prices).map(height => <option key={height} value={height}>{height.replace('.', ',')}</option>)}</select></label><label>Длина, м<input type="number" min="1" value={s.length} onChange={event => set('length', Number(event.target.value))} /></label></div>{price('Своя цена забора за метр, ₽', s.fencePrice, 'fencePrice', 'Например, 2800')}</section>
    {s.mode === 'standard' && <><section className="card"><small>02 · Ворота и калитка</small>
      <label className="toggle-line"><input type="checkbox" checked={s.swingEnabled} onChange={event => { set('swingEnabled', event.target.checked); if (event.target.checked) set('swingWidth', '4'); }} /><span>Добавить распашные ворота</span></label>
      {s.swingEnabled && <><div className="grid">{widths(s.swingWidth, 'swingWidth')}<label>Количество распашных ворот<input type="number" min="1" value={s.swingCount} onChange={event => set('swingCount', count(event.target.value))} /></label></div>{price('Своя цена распашных ворот за комплект, ₽', s.swingPrice, 'swingPrice', 'По прайсу')}{needsManualPrice(s.swingWidth, s.swingPrice) && <p className="price-warning">Для ширины {s.swingWidth.replace('.', ',')} м назначьте свою цену за комплект: автоматической цены нет.</p>}</>}
      <label className="toggle-line"><input type="checkbox" checked={s.slidingEnabled} onChange={event => { set('slidingEnabled', event.target.checked); if (event.target.checked) set('slidingWidth', '4'); }} /><span>Добавить откатные ворота</span></label>
      {s.slidingEnabled && <><div className="grid">{widths(s.slidingWidth, 'slidingWidth')}<label>Количество откатных ворот<input type="number" min="1" value={s.slidingCount} onChange={event => set('slidingCount', count(event.target.value))} /></label></div>{price('Своя цена откатных ворот за комплект, ₽', s.slidingPrice, 'slidingPrice', 'По прайсу')}{needsManualPrice(s.slidingWidth, s.slidingPrice) && <p className="price-warning">Для ширины {s.slidingWidth.replace('.', ',')} м назначьте свою цену за комплект: автоматической цены нет.</p>}</>}
      <label>Калитка<select value={s.wicket} onChange={event => set('wicket', event.target.value as Wicket)}><option value="adjacent">Калитка рядом с воротами</option><option value="separate">Калитка отдельно стоящая</option><option value="none">Нет калитки</option></select></label>
      {s.wicket !== 'none' && <><label>Количество калиток<input type="number" min="1" value={s.wicketCount} onChange={event => set('wicketCount', count(event.target.value))} /></label>{price('Своя цена калитки за единицу, ₽', s.wicketPrice, 'wicketPrice', 'По прайсу')}</>}
    </section><section className="card"><small>03 · Дополнительно</small><div className="grid"><label>Удлинение столбов, м<input type="number" min="0" value={s.extension} onChange={event => set('extension', Number(event.target.value))} /></label><label>Покраска каркаса, м<input type="number" min="0" value={s.paint} onChange={event => set('paint', Number(event.target.value))} /></label></div>{price('Своя стоимость доставки, ₽', s.deliveryPrice, 'deliveryPrice', 'По метражу')}</section></>}
    {error && <p className="error">{error}</p>}<button className="primary">Показать результат →</button><button type="button" className="reset" onClick={() => setS(initial)}>Сбросить</button>
  </form><p className="note">Без CRM и n8n · данные остаются на устройстве</p><details><summary>Как установить на iPhone</summary><p>Откройте сайт в Safari → «Поделиться» → «На экран Домой». После первого открытия расчёт работает офлайн.</p></details></main>;
}
