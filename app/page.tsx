'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { deriveFenceUnitPrice } from '../lib/target-fence-price.mjs';

const PRICE_API = 'https://fence-prices.sega881117.workers.dev/v1/prices';
const materials = {
  profile_one: { label: 'Профлист односторонний', heights: ['1.8', '2'], priceKeys: { '1.8': 'profile_single_1_8', '2': 'profile_single_2_0' } },
  profile_two: { label: 'Профлист двусторонний', heights: ['1.8', '2'], priceKeys: { '1.8': 'profile_double_1_8', '2': 'profile_double_2_0' } },
  picket_single: { label: 'Евроштакетник, один ряд', heights: ['1.8', '2'], priceKeys: { '1.8': 'picket_single_1_8', '2': 'picket_single_2_0' } },
  // В текущем утверждённом прайсе этой отдельной позиции нет: цену задают вручную.
  picket_double_single: { label: 'Евроштакетник 2х сторонний, один ряд', heights: ['1.8', '2'], priceKeys: {} },
  picket_chess: { label: 'Евроштакетник, шахматка', heights: ['1.8', '2'], priceKeys: { '1.8': 'picket_chess_1_8', '2': 'picket_chess_2_0' } },
  // 3D 1,8 м использует согласованный тариф 1,7 м; размер в смете остаётся 1,8 м.
  mesh3d: { label: '3D-сетка', heights: ['1.7', '1.8', '2'], priceKeys: { '1.7': 'mesh3d_1_7', '1.8': 'mesh3d_1_7', '2': 'mesh3d_2_0' } },
  chainlink: { label: 'Сетка-рабица', heights: ['1.8', '2'], priceKeys: { '1.8': 'chainlink_1_8', '2': 'chainlink_2_0' } },
  frame: { label: 'Каркас забора', heights: ['1.8', '2'], priceKeys: {} },
} as const;
type Material = keyof typeof materials;
type PriceCatalog = Record<string, number>;
type Wicket = 'adjacent' | 'separate' | 'none';
type GateCount = number | '';
type FenceSection = { id: string; material: Material; height: string; length: number | ''; fencePrice: number | '' };
type NumericKey = 'length' | 'fencePrice' | 'targetTotal' | 'swingPrice' | 'slidingPrice' | 'swingCount' | 'slidingCount' | 'wicketPrice' | 'wicketCount' | 'deliveryPrice' | 'extension' | 'paint' | 'gravel' | 'pTrim';
type State = {
  extraSections: FenceSection[]; targetSection: string;
  mode: 'standard' | 'fence'; material: Material; height: string; length: number; fencePrice: number; targetTotal: number;
  swingEnabled: boolean; swingWidth: string; swingPrice: number; swingCount: GateCount;
  slidingEnabled: boolean; slidingAutomation: boolean; slidingWidth: string; slidingPrice: number; slidingCount: GateCount;
  wicket: Wicket; wicketPrice: number; wicketCount: number;
  deliveryPrice: number; extension: number; paint: number; gravel: number; pTrim: number;
};
type Line = { title: string; details: string[]; unit: string; quantity: number; unitPrice: number; amount: number; manual?: boolean; requiresReview?: boolean };
type SavedCalculation = { id: string; name: string; updatedAt: string; state: State; prices: PriceCatalog; total: number };
const SAVED_KEY = 'fence-estimate-library-v1';
const DRAFT_KEY = 'fence-estimate-draft-v2';
const initial: State = {
  extraSections: [], targetSection: 'first',
  mode: 'standard', material: 'profile_one', height: '2', length: 70, fencePrice: 0, targetTotal: 0,
  swingEnabled: true, swingWidth: '4', swingPrice: 0, swingCount: 1,
  slidingEnabled: false, slidingAutomation: false, slidingWidth: '4', slidingPrice: 0, slidingCount: 1,
  wicket: 'adjacent', wicketPrice: 0, wicketCount: 1, deliveryPrice: 0, extension: 0, paint: 0, gravel: 0, pTrim: 0,
};
const numericRules: Record<NumericKey, { min: number; integer?: boolean; blankWhenZero?: boolean }> = {
  length: { min: 1, integer: true },
  fencePrice: { min: 0, blankWhenZero: true }, targetTotal: { min: 0, blankWhenZero: true }, swingPrice: { min: 0, blankWhenZero: true }, slidingPrice: { min: 0, blankWhenZero: true },
  swingCount: { min: 1, integer: true }, slidingCount: { min: 1, integer: true }, wicketCount: { min: 1, integer: true }, wicketPrice: { min: 0, blankWhenZero: true },
  deliveryPrice: { min: 0, blankWhenZero: true }, extension: { min: 0 }, paint: { min: 0 }, gravel: { min: 0 }, pTrim: { min: 0 },
};
const money = (value: number, calculated = false) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: calculated && !Number.isInteger(value) ? 4 : 0, maximumFractionDigits: calculated && !Number.isInteger(value) ? 4 : 0 }).format(value);
const gateCount = (value: GateCount) => typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
const rate = (prices: PriceCatalog | null, key: string) => Number(prices?.[key]) || 0;
const materialPriceKey = (material: Material, height: string) => (materials[material].priceKeys as Record<string, string>)[height] || '';
const sectionsFor = (s: State): FenceSection[] => [{ id: 'first', material: s.material, height: s.height, length: s.length, fencePrice: s.fencePrice }, ...s.extraSections];
const totalLengthFor = (s: State) => sectionsFor(s).reduce((sum, section) => sum + Number(section.length), 0);
const sectionUnit = (section: FenceSection, prices: PriceCatalog | null) => Number(section.fencePrice) > 0 ? Number(section.fencePrice) : rate(prices, materialPriceKey(section.material, section.height));
const targetFor = (s: State, fixedTotal: number, prices: PriceCatalog | null) => {
  const sections = sectionsFor(s);
  const selected = sections.find(section => section.id === s.targetSection) || sections[0];
  const otherFences = sections.filter(section => section.id !== selected.id).reduce((sum, section) => sum + Number(section.length) * sectionUnit(section, prices), 0);
  return deriveFenceUnitPrice({ targetTotal: s.targetTotal, length: Number(selected.length), fixedTotal: fixedTotal + otherFences });
};
const slidingUnitFor = (s: State, prices: PriceCatalog | null): number | null => {
  if (s.slidingPrice > 0) return s.slidingPrice;
  if (s.slidingAutomation) return s.slidingWidth === '4' ? 100000 : s.slidingWidth === '5' ? 110000 : null;
  return s.slidingWidth === '5' ? rate(prices, 'sliding_5') : ['3', '3.5', '4'].includes(s.slidingWidth) ? rate(prices, 'sliding_3_4') : null;
};
const fixedTotalFor = (s: State, prices: PriceCatalog | null) => {
  const length = totalLengthFor(s);
  const delivery = s.deliveryPrice > 0 ? s.deliveryPrice : length <= 60 ? rate(prices, 'delivery_0_60') : length <= 120 ? rate(prices, 'delivery_61_120') : rate(prices, 'delivery_121_plus');
  if (s.mode === 'fence') return delivery;
  let total = 0;
  if (s.swingEnabled) {
    const unit = s.swingPrice > 0 ? s.swingPrice : s.swingWidth === '5' ? rate(prices, 'swing_5') : ['3', '3.5', '4'].includes(s.swingWidth) ? rate(prices, 'swing_3_4') : 0;
    total += unit * gateCount(s.swingCount);
  }
  if (s.slidingEnabled) {
    const unit = slidingUnitFor(s, prices) ?? 0;
    total += unit * gateCount(s.slidingCount);
  }
  if (s.wicket !== 'none') total += (s.wicketPrice > 0 ? s.wicketPrice : s.wicket === 'separate' ? rate(prices, 'wicket_separate') : rate(prices, 'wicket_adjacent')) * Math.max(1, s.wicketCount);
  total += delivery;
  total += s.extension * 300 + s.paint * 300 + s.gravel * 300 + s.pTrim * 250;
  return total;
};
const fenceSpec = (material: Material, height: string) => {
  const h = height.replace('.', ',');
  const post = String(Number(height) + 1).replace('.', ',');
  const standardPosts = 'столбы L-' + post + ' м, 60×60, толщина стенки 2 мм;';
  if (material === 'profile_one' || material === 'profile_two') {
    const twoSided = material === 'profile_two';
    return { title: 'Забор из профнастила, покрытие ' + (twoSided ? 'двухстороннее' : 'одностороннее') + '; высота Н-' + h + ' м; 2 лаги.', details: [
      'профнастил С8, 0,4 мм, RAL 7024, НЛМК;', standardPosts, 'лаги 40×20, толщина стенки 1,5 мм;', 'пластиковые заглушки на столбах;', 'саморезы в цвет профнастила;', 'забивание столбов на глубину 1,2 м с шагом 2,5 м;', twoSided ? 'покраска каркаса: Эмаль Dali 3в1.' : 'грунтовка ГФ-021 светло-серого цвета.'
    ] };
  }
  if (material === 'picket_single' || material === 'picket_double_single' || material === 'picket_chess') {
    const chess = material === 'picket_chess';
    const twoSided = material !== 'picket_single';
    return { title: 'Забор из евроштакетника, покрытие ' + (twoSided ? 'двухстороннее' : 'одностороннее') + '; высота Н-' + h + ' м; 2 лаги.', details: [
      'евроштакетник М-образный, 0,4 мм, RAL 7024, зазор ' + (chess ? '7' : '3') + ' см, порядок ' + (chess ? 'Шахматный' : 'Обычный') + ';', standardPosts, 'лаги 40×20, толщина стенки 1,5 мм;', 'пластиковые заглушки на столбах;', 'саморезы в цвет евроштакетника;', 'забивание столбов на глубину 1,2 м с шагом 2,5 м;', twoSided ? 'покраска каркаса: Эмаль Dali 3в1.' : 'грунтовка ГФ-021 светло-серого цвета.'
    ] };
  }
  if (material === 'mesh3d') {
    const meshPost = String(Number(height) + 1.2).replace('.', ',');
    return { title: 'Забор 3D, высота ' + h + ' м.', details: ['секции 3D RAL 8017, толщина прутка 4 мм;', '3 скобы на 1 секцию;', 'столбы 60×60, L-' + meshPost + ' м, толщина стенки 2 мм, покраска DALI RAL 8017;', 'забивание столбов с шагом 2,5 м и заглублением 1,2 м.'] };
  }
  if (material === 'chainlink') return { title: 'Забор из сетки рабицы в натяжку; высота Н-' + h + ' м.', details: ['оцинкованная сетка-рабица с ячейками 50×50 мм, толщина 1,8 мм;', 'столбы L-' + post + ' м, 60×40, толщина стенки 1,5 мм;', 'грунтовка ГФ-021 светло-серого цвета;', 'пластиковые заглушки на столбах;', 'забивание столбов на глубину до 1 м с шагом 2,5 м.'] };
  return { title: 'Каркас забора; высота Н-' + h + ' м; 2 лаги.', details: [standardPosts, 'лаги 40×20, толщина стенки 1,5 мм;', 'пластиковые заглушки на столбах;', 'забивание столбов на глубину 1,2 м с шагом 2,5 м;', 'грунтовка ГФ-021 светло-серого цвета.'] };
};

export default function Home() {
  const [s, setS] = useState<State>(initial);
  const [result, setResult] = useState(false);
  const [error, setError] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [numericDrafts, setNumericDrafts] = useState<Partial<Record<NumericKey, string>>>({});
  const [currentPrices, setCurrentPrices] = useState<PriceCatalog | null>(null);
  const [savedPrices, setSavedPrices] = useState<PriceCatalog | null>(null);
  const prices = savedPrices ?? currentPrices;
  const [priceError, setPriceError] = useState('');
  const [library, setLibrary] = useState<SavedCalculation[]>([]);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  const [deleted, setDeleted] = useState<SavedCalculation | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      const legacy = localStorage.getItem('fence-estimate');
      const draft = raw ? JSON.parse(raw) : null;
      if (draft?.state?.material in materials) {
        setS({ ...initial, ...draft.state }); setSavedPrices(draft.prices ?? null);
        setActiveId(draft.activeId ?? null); setSaveName(draft.name ?? '');
      } else if (legacy) {
        const state = JSON.parse(legacy);
        if (state.material in materials) setS({ ...initial, ...state });
      }
      const items = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
      if (Array.isArray(items)) setLibrary(items.filter(item => typeof item?.id === 'string' && typeof item?.name === 'string' && item?.state?.material in materials && Array.isArray(item.state.extraSections) && item.prices && Number.isFinite(item.total)));
    } catch { setStorageMessage('Не удалось прочитать сохранённые данные. Можно продолжить новый расчёт.'); }
    setReady(true);
    if (!['localhost', '127.0.0.1'].includes(location.hostname)) navigator.serviceWorker?.register('./sw.js', { updateViaCache: 'none' }).then(registration => registration.update()).catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    fetch(PRICE_API, { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('price_source_unavailable'); return response.json() as Promise<PriceCatalog>; })
      .then(catalog => { if (active) { setCurrentPrices(catalog); setPriceError(''); } })
      .catch(() => { if (active) setPriceError('Прайс «Цены для Авито» временно недоступен. Расчёт не сформирован.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ state: s, prices: savedPrices, activeId, name: saveName })); }
    catch { setStorageMessage('Не удалось сохранить черновик на устройстве. Проверьте свободное место или настройки браузера.'); }
  }, [s, savedPrices, activeId, saveName, ready]);
  const set = <K extends keyof State>(key: K, value: State[K]) => setS(previous => ({ ...previous, [key]: value }));
  const updateSection = (id: string, changes: Partial<FenceSection>) => setS(previous => ({ ...previous, extraSections: previous.extraSections.map(section => section.id === id ? { ...section, ...changes } : section) }));
  const quote = useMemo(() => {
    const list: Line[] = [];
    const sections = sectionsFor(s);
    for (const section of sections) {
      const fence = fenceSpec(section.material, section.height);
      const unit = sectionUnit(section, prices);
      list.push({ ...fence, unit: 'м.п.', quantity: Number(section.length), unitPrice: unit, amount: Number(section.length) * unit, manual: Number(section.fencePrice) > 0 });
    }
    if (s.mode === 'standard') {
      if (s.swingEnabled) {
        const unit = s.swingPrice > 0 ? s.swingPrice : s.swingWidth === '5' ? rate(prices, 'swing_5') : ['3', '3.5', '4'].includes(s.swingWidth) ? rate(prices, 'swing_3_4') : null;
        if (unit !== null) list.push({ title: 'Каркас распашных ворот ' + s.swingWidth.replace('.', ',') + '×' + s.height.replace('.', ',') + ' м, открывается наружу.', details: ['каркас из профтрубы 40×20, толщина стенки 1,5 мм;', 'столбы 80×80, толщина стенки 3 мм;', 'заглубление на 1,5 м;', 'изнутри запирающее устройство «гусь» с проушинами для замка;', '2 нижних стопора;', 'петли 25×120 мм.'], unit: 'шт.', quantity: gateCount(s.swingCount), unitPrice: unit, amount: unit * gateCount(s.swingCount), manual: s.swingPrice > 0, requiresReview: s.swingPrice > 0 || Number(s.swingWidth) > 5 });
      }
      if (s.slidingEnabled) {
        const unit = slidingUnitFor(s, prices);
        if (unit !== null) list.push({ title: 'Откатные ворота ' + s.slidingWidth.replace('.', ',') + '×' + s.height.replace('.', ',') + (s.slidingAutomation ? ' м, с автоматическим приводом RTech 1000.' : ' м, с ручным механизмом.'), details: [...(s.slidingAutomation ? ['Автоматика RTech 1000: мотор, 2 пульта, сигнальная лампа;'] : []), 'рама из профтрубы 60×40, толщина стенки 1,5 мм; несущая балка; роликовые каретки;', 'концевой разгрузочный ролик; нижний улавливатель;', 'направляющая с роликами; верхний улавливатель; заглушки;', 'опорный столб; ответный столб;', s.slidingAutomation ? 'фундамент для роликовых кареток: сваи 89 мм, длина 2 м, 2 шт. на тумбу.' : 'фундамент для роликовых кареток: сваи 89, 2 шт. на тумбу.'], unit: 'шт.', quantity: gateCount(s.slidingCount), unitPrice: unit, amount: unit * gateCount(s.slidingCount), manual: s.slidingPrice > 0, requiresReview: s.slidingPrice > 0 || Number(s.slidingWidth) > 5 });
      }
      if (s.wicket !== 'none') {
        const unit = s.wicketPrice > 0 ? s.wicketPrice : s.wicket === 'separate' ? rate(prices, 'wicket_separate') : rate(prices, 'wicket_adjacent');
        const separate = s.wicket === 'separate';
        list.push({ title: separate ? 'Каркас отдельно стоящей калитки 1×' + s.height.replace('.', ',') + ' м, на двух столбах, открывается наружу.' : 'Каркас рядом стоящей калитки 1×' + s.height.replace('.', ',') + ' м, на одном столбе, открывается наружу.', details: ['каркас из профтрубы 40×20, толщина стенки 1,5 мм;', separate ? 'два столба 80×80, толщина стенки 3 мм;' : 'один столб 80×80, толщина стенки 3 мм;', 'заглубление на 1,5 м;', 'петли 25×120 мм;', 'врезной замок в подарок 🎁.'], unit: 'шт.', quantity: Math.max(1, s.wicketCount), unitPrice: unit, amount: unit * Math.max(1, s.wicketCount), manual: s.wicketPrice > 0, requiresReview: s.wicketPrice > 0 });
      }
      if (s.extension) list.push({ title: 'Удлинение столбов до 1,5 м', details: [], unit: 'м.п.', quantity: s.extension, unitPrice: 300, amount: s.extension * 300, requiresReview: true });
      if (s.paint) list.push({ title: 'Покраска каркаса Эмаль 3в1 по металлу', details: [], unit: 'м.п.', quantity: s.paint, unitPrice: 300, amount: s.paint * 300, requiresReview: true });
      if (s.gravel) list.push({ title: 'Забутовка щебнем на всю глубину', details: [], unit: 'м.п.', quantity: s.gravel, unitPrice: 300, amount: s.gravel * 300 });
      if (s.pTrim) list.push({ title: 'Декоративная П-планка', details: [], unit: 'м.п.', quantity: s.pTrim, unitPrice: 250, amount: s.pTrim * 250 });
    }
    const totalLength = totalLengthFor(s);
    const automaticDelivery = totalLength <= 60 ? rate(prices, 'delivery_0_60') : totalLength <= 120 ? rate(prices, 'delivery_61_120') : rate(prices, 'delivery_121_plus');
    const delivery = s.deliveryPrice > 0 ? s.deliveryPrice : automaticDelivery;
    list.push({ title: 'Доставка', details: [], unit: 'шт.', quantity: 1, unitPrice: delivery, amount: delivery, manual: s.deliveryPrice > 0, requiresReview: s.deliveryPrice > 0 });
    const fixedTotal = list.slice(sections.length).reduce((sum, item) => sum + item.amount, 0);
    let targetError = '';
    let targetApplied = false;
    if (s.targetTotal > 0) {
      const target = targetFor(s, fixedTotal, prices);
      if (target.ok) {
        const fenceLine = list[Math.max(0, sections.findIndex(section => section.id === s.targetSection))];
        fenceLine.unitPrice = target.unitPrice!;
        fenceLine.amount = target.fenceAmount!;
        fenceLine.manual = false;
        fenceLine.requiresReview = false;
        targetApplied = true;
      } else targetError = target.message ?? '';
    }
    return { list, total: list.reduce((sum, item) => sum + item.amount, 0), targetError, targetApplied, targetLineIndex: Math.max(0, sections.findIndex(section => section.id === s.targetSection)) };
  }, [s, prices]);
  const quoteImage = () => {
    const canvas = document.createElement('canvas');
    const scale = 2;
    const width = 1400;
    const padding = 40;
    const tableWidth = width - padding * 2;
    const columns = [660, 130, 120, 190, 220];
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas недоступен');
    const wrap = (text: string, maxWidth: number, font: string) => {
      context.font = font;
      const words = text.split(' ');
      const lines: string[] = [];
      let line = '';
      words.forEach(word => {
        const next = line ? `${line} ${word}` : word;
        if (line && context.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next;
      });
      if (line) lines.push(line);
      return lines;
    };
    const rows = quote.list.map(item => {
      const title = wrap(item.title, columns[0] - 28, '700 18px Arial');
      const details = item.details.flatMap(detail => wrap(`— ${detail}`, columns[0] - 42, '15px Arial'));
      const leftHeight = 20 + title.length * 23 + (details.length ? 7 + details.length * 19 : 0) + 18;
      return { item, title, details, height: Math.max(68, leftHeight) };
    });
    const headerHeight = 54;
    const footerHeight = 110;
    const height = 166 + headerHeight + rows.reduce((sum, row) => sum + row.height, 0) + 72 + footerHeight;
    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);
    context.fillStyle = '#f7fbff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    context.fillRect(padding, 28, tableWidth, height - 56);
    context.strokeStyle = '#d8eafe';
    context.lineWidth = 2;
    context.strokeRect(padding, 28, tableWidth, height - 56);
    context.fillStyle = '#f7fbff';
    context.fillRect(padding, 28, tableWidth, 138);
    context.strokeStyle = '#d8eafe';
    context.beginPath(); context.moveTo(padding, 166); context.lineTo(padding + tableWidth, 166); context.stroke();
    context.fillStyle = '#34537d'; context.font = '700 15px Arial'; context.fillText('ПРЕДВАРИТЕЛЬНЫЙ РАСЧЁТ', padding + 24, 66);
    context.fillStyle = '#071d55'; context.font = '700 31px Arial'; context.fillText('Смета на устройство забора', padding + 24, 108);
    context.fillStyle = '#34537d'; context.font = '16px Arial'; context.fillText(`от ${new Date().toLocaleDateString('ru-RU')}`, padding + 24, 138);
    let y = 166;
    context.fillStyle = '#d8eafe'; context.fillRect(padding, y, tableWidth, headerHeight);
    context.fillStyle = '#071d55'; context.font = '700 14px Arial';
    const labels = ['Работы и материалы', 'Ед. изм.', 'Кол-во', 'Цена, руб.', 'Сумма, руб.'];
    let x = padding;
    labels.forEach((label, index) => { context.textAlign = index === 0 ? 'left' : 'center'; context.fillText(label, x + (index === 0 ? 12 : columns[index] / 2), y + 32); x += columns[index]; });
    y += headerHeight;
    const drawCellLines = (lines: string[], xPos: number, yPos: number, font: string, color: string, align: CanvasTextAlign = 'left', lineHeight = 20) => {
      context.font = font; context.fillStyle = color; context.textAlign = align;
      lines.forEach((line, index) => context.fillText(line, xPos, yPos + index * lineHeight));
    };
    rows.forEach(({ item, title, details, height: rowHeight }) => {
      context.fillStyle = '#ffffff'; context.fillRect(padding, y, tableWidth, rowHeight);
      context.strokeStyle = '#d8eafe'; context.beginPath(); context.moveTo(padding, y + rowHeight); context.lineTo(padding + tableWidth, y + rowHeight); context.stroke();
      let lineX = padding;
      columns.slice(0, -1).forEach(column => { lineX += column; context.beginPath(); context.moveTo(lineX, y); context.lineTo(lineX, y + rowHeight); context.stroke(); });
      drawCellLines(title, padding + 14, y + 25, '700 18px Arial', '#071d55', 'left', 23);
      drawCellLines(details, padding + 22, y + 31 + title.length * 23, '15px Arial', '#34537d', 'left', 19);
      const values = [item.unit, String(item.quantity), money(item.unitPrice), money(item.amount)];
      let valueX = padding + columns[0];
      values.forEach((value, index) => {
        const columnWidth = columns[index + 1];
        drawCellLines([value], valueX + columnWidth / 2, y + rowHeight / 2 + 5, index === 3 ? '700 15px Arial' : '15px Arial', '#071d55', 'center');
        valueX += columnWidth;
      });
      y += rowHeight;
    });
    context.fillStyle = '#d8eafe'; context.fillRect(padding, y, tableWidth, 72);
    const totalBaseline = y + 43;
    context.font = '700 21px Arial'; const totalLabelWidth = context.measureText('Итого').width;
    context.font = '15px Arial'; const totalNoteWidth = context.measureText('Включая материалы и работы').width;
    context.font = '700 23px Arial'; const totalValueWidth = context.measureText(money(quote.total)).width;
    const totalGap = 18;
    let totalX = padding + (tableWidth - totalLabelWidth - totalNoteWidth - totalValueWidth - totalGap * 2) / 2;
    context.fillStyle = '#071d55'; context.textAlign = 'left'; context.font = '700 21px Arial'; context.fillText('Итого', totalX, totalBaseline);
    totalX += totalLabelWidth + totalGap;
    context.font = '15px Arial'; context.fillText('Включая материалы и работы', totalX, totalBaseline);
    totalX += totalNoteWidth + totalGap;
    context.font = '700 23px Arial'; context.fillText(money(quote.total), totalX, totalBaseline);
    y += 72;
    context.fillStyle = '#f7fbff'; context.fillRect(padding, y, tableWidth, footerHeight);
    context.fillStyle = '#071d55'; context.textAlign = 'left'; context.font = '700 16px Arial'; context.fillText('Предварительная смета', padding + 18, y + 37);
    context.fillStyle = '#34537d'; context.font = '15px Arial'; context.fillText('Действует 7 календарных дней. Окончательная стоимость уточняется после выезда на объект.', padding + 18, y + 66);
    const data = canvas.toDataURL('image/png').split(',')[1];
    const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
    return new File([bytes], 'smeta-zabora.png', { type: 'image/png' });
  };
  const downloadQuoteImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url; link.download = file.name; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const shareQuoteImage = () => {
    try {
      const file = quoteImage();
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        setShareMessage('');
        void navigator.share({ title: 'Смета забора', files: [file] }).catch(shareError => {
          if ((shareError as DOMException).name !== 'AbortError') { downloadQuoteImage(file); setShareMessage('Не удалось открыть меню отправки: изображение сметы скачано.'); }
        });
      } else {
        downloadQuoteImage(file);
        setShareMessage('В этом браузере файл сметы скачан: его можно приложить к сообщению вручную.');
      }
    } catch {
      setShareMessage('Не удалось подготовить изображение сметы. Попробуйте ещё раз.');
    }
  };
  const normalizeNumber = (key: NumericKey, raw: string) => {
    const rule = numericRules[key];
    const value = Number(raw);
    if (!Number.isFinite(value)) return rule.min;
    return Math.max(rule.min, rule.integer ? Math.trunc(value) : value);
  };
  const numericValue = (key: NumericKey) => {
    if (numericDrafts[key] !== undefined) return numericDrafts[key];
    const value = Number(s[key]);
    return numericRules[key].blankWhenZero && value === 0 ? '' : String(value);
  };
  const updateNumber = (key: NumericKey, raw: string) => {
    setNumericDrafts(previous => ({ ...previous, [key]: raw }));
    if (raw !== '' && Number.isFinite(Number(raw))) set(key, Number(raw) as State[typeof key]);
  };
  const normalizeInput = (key: NumericKey) => {
    const raw = numericDrafts[key];
    if (raw === undefined) return;
    set(key, normalizeNumber(key, raw) as State[typeof key]);
    setNumericDrafts(previous => { const next = { ...previous }; delete next[key]; return next; });
  };
  const normalizedState = () => {
    const next = { ...s };
    (Object.keys(numericRules) as NumericKey[]).forEach(key => {
      if (numericDrafts[key] !== undefined) next[key] = normalizeNumber(key, numericDrafts[key]!) as never;
    });
    return next;
  };
  const numericInput = (label: string, key: NumericKey, placeholder?: string) => <label>{label}<input id={'field-' + key} type="number" min={numericRules[key].min} step={numericRules[key].integer ? '1' : 'any'} inputMode={numericRules[key].integer ? 'numeric' : 'decimal'} placeholder={placeholder} value={numericValue(key)} onChange={event => updateNumber(key, event.target.value)} onBlur={() => normalizeInput(key)} /></label>;
  const price = (label: string, key: 'fencePrice' | 'swingPrice' | 'slidingPrice' | 'wicketPrice' | 'deliveryPrice', placeholder: string) => <label>{label}<input id={'field-' + key} type="number" min="0" step="any" inputMode="decimal" placeholder={placeholder} value={numericValue(key)} onChange={event => updateNumber(key, event.target.value)} onBlur={() => normalizeInput(key)} /><span className="hint">Необязательно: пустое поле использует цену прайса или правило расчёта.</span></label>;
  const needsManualPrice = (width: string, value: number) => !['3', '3.5', '4', '5'].includes(width) && value <= 0;
  const validationMessage = (next: State) => {
    if (!prices) return priceError || 'Загружаем прайс. Повторите расчёт через секунду.';
    if (sectionsFor(next).some(section => !Number.isFinite(Number(section.length)) || Number(section.length) <= 0)) return 'Введите длину каждого участка забора больше нуля.';
    if (sectionsFor(next).some(section => sectionUnit(section, prices) <= 0)) return 'Для выбранного материала нет утверждённой цены. Укажите свою цену за метр.';
    if (next.targetTotal > 0) {
      const target = targetFor(next, fixedTotalFor(next, prices), prices);
      if (!target.ok) return target.message;
    }
    if (next.mode === 'standard' && next.swingEnabled && needsManualPrice(next.swingWidth, next.swingPrice)) return `Для распашных ворот шириной ${next.swingWidth.replace('.', ',')} м укажите свою цену за комплект.`;
    if (next.mode === 'standard' && next.slidingEnabled && slidingUnitFor(next, prices) === null) return `Для откатных ворот шириной ${next.slidingWidth.replace('.', ',')} м укажите свою цену за комплект.`;
    return '';
  };
  const persistLibrary = (items: SavedCalculation[]) => {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(items)); setLibrary(items); return true; }
    catch { setStorageMessage('Не удалось сохранить расчёт. Проверьте свободное место или настройки браузера.'); return false; }
  };
  const saveCalculation = () => {
    const next = normalizedState();
    const message = validationMessage(next);
    if (message) { setError(message); return; }
    if (!saveName.trim()) { setStorageMessage('Укажите название расчёта.'); document.getElementById('calculation-name')?.focus(); return; }
    const entry: SavedCalculation = { id: activeId ?? crypto.randomUUID(), name: saveName.trim(), updatedAt: new Date().toISOString(), state: structuredClone(next), prices: { ...prices! }, total: quote.total };
    if (!persistLibrary([entry, ...library.filter(item => item.id !== entry.id)])) return;
    setS(next); setNumericDrafts({}); setActiveId(entry.id); setSavedPrices(entry.prices);
    setSaveName(entry.name); setSaveOpen(false); setError(''); setLibraryOpen(true); setStorageMessage(`«${entry.name}» сохранён на этом устройстве.`);
    requestAnimationFrame(() => document.getElementById('saved-calculations')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const openCalculation = (entry: SavedCalculation, copy = false) => {
    setS(structuredClone(entry.state)); setSavedPrices({ ...entry.prices }); setNumericDrafts({});
    setActiveId(copy ? null : entry.id); setSaveName(copy ? entry.name + ' — копия' : entry.name);
    setError(''); setResult(false); setSaveOpen(false); setLibraryOpen(false);
    setStorageMessage(copy ? 'Копия открыта. Исходный расчёт сохранён.' : `Открыт «${entry.name}». Используются сохранённые цены.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const deleteCalculation = (entry: SavedCalculation) => {
    if (!persistLibrary(library.filter(item => item.id !== entry.id))) return;
    setDeleted(entry); if (activeId === entry.id) setActiveId(null);
    setStorageMessage(`«${entry.name}» удалён. Можно восстановить.`);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = normalizedState();
    setS(next); setNumericDrafts({});
    const message = validationMessage(next);
    if (message) { setError(message); return; }
    setError(''); setResult(true);
  };
  const widths = (value: string, key: 'swingWidth' | 'slidingWidth') => <label><span>Ширина, м</span><select id={'field-' + key} value={value} onChange={event => set(key, event.target.value)}>{['3', '3.5', '4', '4.5', '5', '5.5', '6'].map(width => <option key={width} value={width}>{width.replace('.', ',')}</option>)}</select></label>;

  const savedArea = <section id="saved-calculations" className="calculation-footer" aria-label="Сохранённые расчёты">
    <details className="calculation-library" open={libraryOpen} onToggle={event => setLibraryOpen(event.currentTarget.open)}>
      <summary>Мои расчёты <span>{library.length}</span></summary>
      <p className="hint">Сохраняются в этом браузере. На другом устройстве список будет отдельным.</p>
      {library.length === 0 ? <p className="library-empty">Здесь появятся ваши сметы. Сначала покажите результат, затем нажмите «Сохранить расчёт».</p> : <ul className="saved-list">{library.map(entry => <li key={entry.id}>
        <button type="button" className="saved-open" onClick={() => openCalculation(entry)}><strong>{entry.name}</strong><span>{new Date(entry.updatedAt).toLocaleDateString('ru-RU')} · {totalLengthFor(entry.state)} м</span><b>{money(entry.total)}</b></button>
        <div className="saved-actions"><button type="button" onClick={() => openCalculation(entry)}>Открыть</button><button type="button" onClick={() => openCalculation(entry, true)}>Создать копию</button><button type="button" className="delete-action" aria-label={`Удалить расчёт ${entry.name}`} onClick={() => deleteCalculation(entry)}>Удалить</button></div>
      </li>)}</ul>}
    </details>
    {storageMessage && <p className="storage-status" role="status">{storageMessage} {deleted && <button type="button" onClick={() => { if (persistLibrary([deleted, ...library])) { setDeleted(null); setStorageMessage('Расчёт восстановлен.'); } }}>Восстановить</button>}</p>}
    {savedPrices && <aside className="saved-price-note"><strong>{saveName || 'Сохранённый расчёт'}</strong><p>Цены зафиксированы при сохранении. Сохранить изменения можно на экране готовой сметы.</p><button type="button" disabled={!currentPrices} onClick={() => { setSavedPrices(null); setStorageMessage('Применён текущий прайс. Проверьте итог и сохраните изменения.'); }}>{currentPrices ? 'Пересчитать по текущему прайсу' : 'Загружаем текущий прайс…'}</button></aside>}
  </section>;
  const saveControls = <div className="result-save">
    <button type="button" className="reset save-trigger" onClick={() => { setSaveOpen(previous => !previous); if (!saveName) setSaveName('Расчёт от ' + new Date().toLocaleDateString('ru-RU')); }}>Сохранить расчёт</button>
    {saveOpen && <section className="save-editor" aria-label="Сохранение расчёта"><h2>{activeId ? 'Сохранить изменения' : 'Новый сохранённый расчёт'}</h2><label htmlFor="calculation-name">Клиент или адрес<input id="calculation-name" type="text" maxLength={120} placeholder="Например, Иван — забор в Истре" value={saveName} onChange={event => setSaveName(event.target.value)} /></label><p className="hint">Сохраним параметры и цены. Название можно изменить при следующем сохранении.</p><div className="save-editor-actions"><button type="button" className="primary" onClick={saveCalculation}>{activeId ? 'Обновить сохранённый расчёт' : 'Сохранить на устройстве'}</button><button type="button" className="text-button" onClick={() => setSaveOpen(false)}>Отмена</button></div></section>}
    {error && <p className="error" role="alert">{error}</p>}
  </div>;

  if (result) return <main className="result"><button className="back" onClick={() => setResult(false)}>‹ Изменить расчёт</button><article className="quote quote-table"><header><div><small>Предварительный расчёт</small><strong>Смета на устройство забора</strong><span>от {new Date().toLocaleDateString('ru-RU')}</span></div></header><div className="estimate-table" role="table" aria-label="Подробная смета"><div className="estimate-head" role="row"><span>Работы и материалы</span><span>Ед. изм.</span><span>Кол-во</span><span>Цена, руб.</span><span>Сумма, руб.</span></div>{quote.list.map((item, index) => <div className="estimate-row" role="row" key={index}><div><b>{item.title}</b>{item.details.length > 0 && <ul className="estimate-details">{item.details.map(detail => <li key={detail}>{detail}</li>)}</ul>}</div><span>{item.unit}</span><span>{item.quantity}</span><span>{money(item.unitPrice, quote.targetApplied && index === quote.targetLineIndex)}</span><b>{money(item.amount)}</b></div>)}<div className="estimate-total" role="row"><b>Итого</b><span>Включая материалы и работы</span><b>{money(quote.total)}</b></div></div><footer><b>Предварительная смета</b><p>Действует 7 календарных дней. Окончательная стоимость уточняется после выезда на объект.</p></footer></article><button className="primary" onClick={shareQuoteImage}>Поделиться сметой</button>{shareMessage && <p className="share-message" role="status">{shareMessage}</p>}<p>Смета использует прайс «Цены для Авито».</p>{saveControls}{savedArea}</main>;
  return <main className="app"><header className="head"><span className="mark">⌁</span><div><small>Локальный расчёт</small><h1>Смета забора</h1></div></header>
    <section className="hero"><span>Предварительная смета</span><b>{prices ? money(quote.total) : 'Загрузка…'}</b></section><form onSubmit={submit}>
    <section className="card mode-card"><small>Режим расчёта</small><label>Выберите режим<select value={s.mode} onChange={event => set('mode', event.target.value as State['mode'])}><option value="standard">Полная смета</option><option value="fence">Только забор</option></select></label><p className="hint">{s.mode === 'fence' ? 'В этом режиме не учитываются ворота, калитка и допработы. Доставка рассчитывается по длине участка.' : 'Настройте состав и при необходимости замените цены прайса своими.'}</p></section>
    <section className="card fence-card"><small>01 · Участок забора</small><label>Материал<select value={s.material} onChange={event => { const material = event.target.value as Material; set('material', material); set('height', materials[material].heights[0]); }}>{Object.entries(materials).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label><div className="grid"><label>Высота, м<select value={s.height} onChange={event => set('height', event.target.value)}>{materials[s.material].heights.map(height => <option key={height} value={height}>{height.replace('.', ',')}</option>)}</select></label>{numericInput('Длина, м', 'length')}</div>{priceError && !savedPrices && <p className="error">{priceError}</p>}{price('Своя цена забора за метр, ₽', 'fencePrice', 'Например, 2800')}</section>
    {s.extraSections.map((section, index) => <section className="card fence-card" key={section.id}>
      <small>01 · Участок забора {index + 2}</small>
      <label>Материал<select value={section.material} onChange={event => { const material = event.target.value as Material; updateSection(section.id, { material, height: materials[material].heights.includes(section.height as never) ? section.height : materials[material].heights[0] }); }}>{Object.entries(materials).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
      <div className="grid">
        <label>Высота, м<select value={section.height} onChange={event => updateSection(section.id, { height: event.target.value })}>{materials[section.material].heights.map(height => <option key={height} value={height}>{height.replace('.', ',')}</option>)}</select></label>
        <label>Длина, м<input type="number" min="1" step="1" inputMode="numeric" required value={section.length} onChange={event => updateSection(section.id, { length: event.target.value === '' ? '' : Number(event.target.value) })} /></label>
      </div>
      <label>Своя цена забора за метр, ₽<input type="number" min="0" step="any" inputMode="decimal" placeholder="По прайсу" value={section.fencePrice || ''} onChange={event => updateSection(section.id, { fencePrice: event.target.value === '' ? '' : Number(event.target.value) })} /><span className="hint">Необязательно: пустое поле использует цену прайса.</span></label>
      <button type="button" className="reset" onClick={() => setS(previous => ({ ...previous, extraSections: previous.extraSections.filter(item => item.id !== section.id), targetSection: previous.targetSection === section.id ? 'first' : previous.targetSection }))}>Удалить участок {index + 2}</button>
    </section>)}
    <button type="button" className="reset" onClick={() => setS(previous => ({ ...previous, extraSections: [...previous.extraSections, { id: crypto.randomUUID(), material: 'picket_single', height: '2', length: '', fencePrice: '' }] }))}>+ Добавить участок забора</button>
    <section className="card total-card"><small>Общий расчёт</small><p className="hint">Общая длина: {totalLengthFor(s)} м. Доставка рассчитывается один раз на все участки.</p>
      {numericInput('Желаемый итог всей сметы, ₽', 'targetTotal', 'Например, 100000')}
      {s.targetTotal > 0 && <>
        {s.extraSections.length > 0 && <label>Рассчитать цену за метр для участка<select value={s.targetSection} onChange={event => set('targetSection', event.target.value)}>{sectionsFor(s).map((section, index) => <option key={section.id} value={section.id}>Участок {index + 1} — {materials[section.material].label}</option>)}</select></label>}
        <p className="hint">Цена выбранного участка рассчитывается из остатка желаемого итога. Цены остальных участков сохраняются.</p>
      </>}
      {quote.targetError && <p className="error">{quote.targetError}</p>}
    </section>
    {s.mode === 'standard' && <><section className="card gates-card"><small>02 · Ворота и калитка</small>
      <label className="toggle-line"><input type="checkbox" checked={s.swingEnabled} onChange={event => { set('swingEnabled', event.target.checked); if (event.target.checked) set('swingWidth', '4'); }} /><span>Добавить распашные ворота</span></label>
      {s.swingEnabled && <><div className="grid gate-grid">{widths(s.swingWidth, 'swingWidth')}{numericInput('Количество распашных ворот', 'swingCount')}</div>{price('Своя цена распашных ворот за комплект, ₽', 'swingPrice', 'По прайсу')}{needsManualPrice(s.swingWidth, s.swingPrice) && <p className="price-warning">Для ширины {s.swingWidth.replace('.', ',')} м назначьте свою цену за комплект: автоматической цены нет.</p>}</>}
      <label className="toggle-line"><input type="checkbox" checked={s.slidingEnabled} onChange={event => { set('slidingEnabled', event.target.checked); if (event.target.checked) set('slidingWidth', '4'); }} /><span>Добавить откатные ворота</span></label>
      {s.slidingEnabled && <><label className="toggle-line"><input type="checkbox" checked={s.slidingAutomation} onChange={event => set('slidingAutomation', event.target.checked)} /><span>Автоматика RTech 1000</span></label>{s.slidingAutomation && <p className="hint">Ворота с автоматикой: 4 м — 100 000 ₽, 5 м — 110 000 ₽ за штуку.</p>}<div className="grid gate-grid">{widths(s.slidingWidth, 'slidingWidth')}{numericInput('Количество откатных ворот', 'slidingCount')}</div>{price('Своя цена откатных ворот за комплект, ₽', 'slidingPrice', 'По прайсу')}{slidingUnitFor(s, prices) === null && <p className="price-warning">Для ширины {s.slidingWidth.replace('.', ',')} м назначьте свою цену за комплект: автоматической цены нет.</p>}</>}
      <label>Калитка<select id="field-wicket" value={s.wicket} onChange={event => set('wicket', event.target.value as Wicket)}><option value="adjacent">Калитка рядом с воротами</option><option value="separate">Калитка отдельно стоящая</option><option value="none">Нет калитки</option></select></label>
      {s.wicket !== 'none' && <>{numericInput('Количество калиток', 'wicketCount')}{price('Своя цена калитки за единицу, ₽', 'wicketPrice', 'По прайсу')}</>}
    </section><section className="card extras-card"><small>03 · Дополнительно</small><div className="grid additional-grid">{numericInput('Удлинение столбов, м', 'extension')}{numericInput('Покраска каркаса, м', 'paint')}{numericInput('Забутовка щебнем на всю глубину, м', 'gravel')}{numericInput('Декоративная П-планка, м', 'pTrim')}</div>{price('Своя стоимость доставки, ₽', 'deliveryPrice', 'По метражу')}</section></>}
    {s.mode === 'fence' && <section className="card delivery-card"><small>02 · Доставка</small>{price('Своя стоимость доставки, ₽', 'deliveryPrice', 'По метражу')}</section>}
    {error && <p className="error" role="alert">{error}</p>}<button className="primary calc-submit">Показать результат →</button><button type="button" className="reset" onClick={() => { setS(initial); setNumericDrafts({}); setActiveId(null); setSavedPrices(null); setSaveName(''); setSaveOpen(false); setError(''); setStorageMessage(''); setDeleted(null); }}>Сбросить параметры</button><p className="hint reset-explanation">Вернуть начальные значения полей. Сохранённые сметы останутся.</p>
  </form>{savedArea}<p className="note">Цены загружаются из таблицы «Цены для Авито». Данные расчёта остаются на устройстве.</p><details><summary>Как установить на iPhone</summary><p>Откройте сайт в Safari → «Поделиться» → «На экран Домой».</p></details></main>;
}
