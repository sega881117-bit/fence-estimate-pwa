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
type Gate = 'swing' | 'sliding' | 'none';
type Wicket = 'adjacent' | 'separate' | 'none';
type State = {
  mode: 'standard' | 'fence'; material: Material; height: string; length: number; fencePrice: number;
  gate: Gate; width: string; gatePrice: number; gateCount: number;
  wicket: Wicket; wicketPrice: number; wicketCount: number; setupView: 'detailed' | 'quick';
  extension: number; paint: number;
};
const initial: State = {
  mode: 'standard', material: 'profile_one', height: '2', length: 70, fencePrice: 0,
  gate: 'swing', width: '4', gatePrice: 0, gateCount: 1,
  wicket: 'adjacent', wicketPrice: 0, wicketCount: 1, setupView: 'detailed', extension: 0, paint: 0,
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
    const list: { label: string; amount: number; note: string }[] = [];
    const catalogFence = materials[s.material].prices[s.height as keyof typeof materials[typeof s.material]['prices']] as number;
    const fenceUnit = s.fencePrice > 0 ? s.fencePrice : catalogFence;
    list.push({ label: `${materials[s.material].label}, ${s.height.replace('.', ',')} м`, amount: s.length * fenceUnit, note: `${s.length} м × ${money(fenceUnit)}${s.fencePrice > 0 ? ' · ручная цена' : ''}` });
    if (s.mode === 'standard') {
      if (s.gate !== 'none') {
        const catalog = s.gate === 'sliding' ? (s.width === '5' ? 75000 : 69000) : (s.width === '5' ? 23000 : 17000);
        const unit = s.gatePrice > 0 ? s.gatePrice : catalog;
        list.push({ label: `${s.gate === 'sliding' ? 'Откатные' : 'Распашные'} ворота ${s.width} м`, amount: unit * Math.max(1, s.gateCount), note: `${Math.max(1, s.gateCount)} шт. × ${money(unit)}${s.gatePrice > 0 ? ' · ручная цена' : ''}` });
      }
      if (s.wicket !== 'none') {
        const unit = s.wicketPrice > 0 ? s.wicketPrice : s.wicket === 'separate' ? 15000 : 13000;
        list.push({ label: s.wicket === 'separate' ? 'Калитка отдельно стоящая' : 'Калитка рядом с воротами', amount: unit * Math.max(1, s.wicketCount), note: `${Math.max(1, s.wicketCount)} шт. × ${money(unit)}${s.wicketPrice > 0 ? ' · ручная цена' : ''}` });
      }
      list.push({ label: 'Доставка', amount: s.length <= 60 ? 6000 : s.length <= 120 ? 8000 : 12000, note: '' });
      if (s.extension) list.push({ label: 'Удлинение столбов', amount: s.extension * 300, note: '' });
      if (s.paint) list.push({ label: 'Покраска каркаса', amount: s.paint * 250, note: '' });
    }
    return { list, total: list.reduce((sum, item) => sum + item.amount, 0) };
  }, [s]);
  const price = (label: string, value: number, key: 'fencePrice' | 'gatePrice' | 'wicketPrice', placeholder: string) => <label>{label}<input type="number" min="0" placeholder={placeholder} value={value || ''} onChange={event => set(key, Number(event.target.value))} /><span className="hint">Необязательно: пустое поле использует цену прайса.</span></label>;
  const submit = (event: FormEvent) => { event.preventDefault(); if (s.length <= 0) { setError('Введите длину забора.'); return; } setError(''); setResult(true); };
  const selector = <div className="view-switch" role="group" aria-label="Способ настройки"><button type="button" className={s.setupView === 'detailed' ? 'selected' : ''} onClick={() => set('setupView', 'detailed')}>Подробный</button><button type="button" className={s.setupView === 'quick' ? 'selected' : ''} onClick={() => set('setupView', 'quick')}>Быстрый</button></div>;
  const gateChoice = (value: Gate, label: string) => <button type="button" className={`choice ${s.gate === value ? 'selected' : ''}`} onClick={() => set('gate', s.gate === value ? 'none' : value)}>{s.gate === value ? '✓ ' : ''}{label}</button>;
  const wicketChoice = (value: Wicket, label: string) => <button type="button" className={`choice ${s.wicket === value ? 'selected' : ''}`} onClick={() => set('wicket', s.wicket === value ? 'none' : value)}>{s.wicket === value ? '✓ ' : ''}{label}</button>;

  if (result) return <main className="result"><button className="back" onClick={() => setResult(false)}>‹ Изменить расчёт</button><article className="quote"><header><span className="mark">⌁</span><div><small>{s.mode === 'fence' ? 'Только забор' : 'Предварительный расчёт'}</small><strong>Смета забора</strong></div><time>{new Date().toLocaleDateString('ru-RU')}</time></header><section className="total"><small>Итого</small><b>{money(quote.total)}</b><span>Общая длина — {s.length} м</span></section><div className="rows">{quote.list.map(item => <div key={item.label}><span>{item.label}<small>{item.note}</small></span><b>{money(item.amount)}</b></div>)}</div><footer><b>Предварительная стоимость</b><p>Точную стоимость и состав работ подтвердим после выездного замера.</p></footer></article><button className="primary" onClick={() => navigator.share?.({ title: 'Смета забора', text: `Предварительная смета: ${money(quote.total)}` })}>Поделиться</button><p>Сделайте скриншот карточки или отправьте результат через «Поделиться».</p></main>;
  return <main className="app"><header className="head"><span className="mark">⌁</span><div><small>Локальный расчёт</small><h1>Смета забора</h1></div></header><section className="hero"><span>Предварительная смета</span><b>{money(quote.total)}</b></section><form onSubmit={submit}>
    <section className="card"><small>Режим расчёта</small><label>Выберите режим<select value={s.mode} onChange={event => set('mode', event.target.value as State['mode'])}><option value="standard">Полная смета</option><option value="fence">Только забор</option></select></label><p className="hint">{s.mode === 'fence' ? 'В этом режиме не учитываются ворота, калитка, доставка и допработы.' : 'Настройте состав и при необходимости замените цены прайса своими.'}</p></section>
    <section className="card"><small>01 · Участок забора</small><label>Материал<select value={s.material} onChange={event => { const material = event.target.value as Material; set('material', material); set('height', Object.keys(materials[material].prices)[0]); }}>{Object.entries(materials).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label><div className="grid"><label>Высота, м<select value={s.height} onChange={event => set('height', event.target.value)}>{Object.keys(materials[s.material].prices).map(height => <option key={height} value={height}>{height.replace('.', ',')}</option>)}</select></label><label>Длина, м<input type="number" min="1" value={s.length} onChange={event => set('length', Number(event.target.value))} /></label></div>{price('Своя цена забора за метр, ₽', s.fencePrice, 'fencePrice', 'Например, 2800')}</section>
    {s.mode === 'standard' && <><section className="card"><small>02 · Ворота и калитка</small>{selector}
      {s.setupView === 'detailed' ? <><div className="grid"><label>Ворота<select value={s.gate} onChange={event => set('gate', event.target.value as Gate)}><option value="swing">Распашные</option><option value="sliding">Откатные</option><option value="none">Нет ворот</option></select></label>{s.gate !== 'none' && <><label>Ширина, м<select value={s.width} onChange={event => set('width', event.target.value)}>{['3', '3.5', '4', '5'].map(width => <option key={width} value={width}>{width.replace('.', ',')}</option>)}</select></label><label>Количество ворот<input type="number" min="1" value={s.gateCount} onChange={event => set('gateCount', count(event.target.value))} /></label></>}</div>{s.gate !== 'none' && price('Своя цена ворот за комплект, ₽', s.gatePrice, 'gatePrice', 'По прайсу')}<div className="grid"><label>Калитка<select value={s.wicket} onChange={event => set('wicket', event.target.value as Wicket)}><option value="adjacent">Калитка рядом с воротами</option><option value="separate">Калитка отдельно стоящая</option><option value="none">Нет калитки</option></select></label>{s.wicket !== 'none' && <label>Количество калиток<input type="number" min="1" value={s.wicketCount} onChange={event => set('wicketCount', count(event.target.value))} /></label>}</div>{s.wicket !== 'none' && price('Своя цена калитки за единицу, ₽', s.wicketPrice, 'wicketPrice', 'По прайсу')}</> : <><p className="hint">Нажмите на позицию. Повторное нажатие исключает её из сметы.</p><div className="quick-choices"><span>Ворота</span>{gateChoice('swing', 'Добавить распашные ворота')}{gateChoice('sliding', 'Добавить откатные ворота')}</div>{s.gate !== 'none' && <><div className="grid"><label>Количество ворот<input type="number" min="1" value={s.gateCount} onChange={event => set('gateCount', count(event.target.value))} /></label><label>Ширина, м<select value={s.width} onChange={event => set('width', event.target.value)}>{['3', '3.5', '4', '5'].map(width => <option key={width} value={width}>{width.replace('.', ',')}</option>)}</select></label></div>{price('Своя цена ворот за комплект, ₽', s.gatePrice, 'gatePrice', 'По прайсу')}</>}<div className="quick-choices"><span>Калитка</span>{wicketChoice('adjacent', 'Добавить калитку рядом с воротами')}{wicketChoice('separate', 'Добавить отдельно стоящую калитку')}</div>{s.wicket !== 'none' && <><label>Количество калиток<input type="number" min="1" value={s.wicketCount} onChange={event => set('wicketCount', count(event.target.value))} /></label>{price('Своя цена калитки за единицу, ₽', s.wicketPrice, 'wicketPrice', 'По прайсу')}</>}</>}</section><section className="card"><small>03 · Дополнительно</small><div className="grid"><label>Удлинение столбов, м<input type="number" min="0" value={s.extension} onChange={event => set('extension', Number(event.target.value))} /></label><label>Покраска каркаса, м<input type="number" min="0" value={s.paint} onChange={event => set('paint', Number(event.target.value))} /></label></div></section></>}
    {error && <p className="error">{error}</p>}<button className="primary">Показать результат →</button><button type="button" className="reset" onClick={() => setS(initial)}>Сбросить</button>
  </form><p className="note">Без CRM и n8n · данные остаются на устройстве</p><details><summary>Как установить на iPhone</summary><p>Откройте сайт в Safari → «Поделиться» → «На экран Домой». После первого открытия расчёт работает офлайн.</p></details></main>;
}
