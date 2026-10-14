'use client';

import { useState } from 'react';
import './variants.css';

const Field = ({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) => (
  <label className={wide ? 'preview-field wide' : 'preview-field'}>
    <span>{label}</span>
    <input aria-label={label} value={value} readOnly />
  </label>
);

const Toggle = ({ title, note, active = true }: { title: string; note: string; active?: boolean }) => (
  <div className={active ? 'preview-toggle active' : 'preview-toggle'}>
    <span className="toggle-dot" aria-hidden="true" />
    <span><b>{title}</b><small>{note}</small></span>
  </div>
);

function OperationsPreview() {
  return <section className="preview-surface operations-preview">
    <div className="preview-top"><div><span className="preview-kicker">Вариант 1</span><h2>Рабочий калькулятор</h2><p>Акцент на разделах и быстром заполнении.</p></div><strong>185 000 ₽</strong></div>
    <div className="work-section fence"><div className="section-title"><span>01</span><b>Участок забора</b><small>основной расчёт</small></div><div className="field-grid"><Field label="Материал" value="Профлист односторонний" wide /><Field label="Высота" value="2 м" /><Field label="Длина" value="70 м" /></div></div>
    <div className="work-section gates"><div className="section-title"><span>02</span><b>Ворота и калитка</b><small>выбрано 2 позиции</small></div><div className="toggle-stack"><Toggle title="Распашные ворота" note="4 м · 17 000 ₽" /><Toggle title="Калитка рядом с воротами" note="1 шт. · 13 000 ₽" /></div></div>
    <div className="work-section extras"><div className="section-title"><span>03</span><b>Дополнительно</b><small>можно пропустить</small></div><div className="compact-choice"><span>Доставка</span><b>6 000 ₽</b><button type="button">Изменить</button></div></div>
    <button type="button" className="preview-primary">Показать смету <span>185 000 ₽</span></button>
  </section>;
}

function StepsPreview() {
  const [step, setStep] = useState(0);
  const steps = [
    { title: 'Забор', summary: '3D-сетка · 42 м · 1,8 м' },
    { title: 'Ворота', summary: 'Откатные · 4 м' },
    { title: 'Дополнительно', summary: 'Доставка · 6 000 ₽' },
    { title: 'Итог', summary: '121 400 ₽' },
  ];
  return <section className="preview-surface steps-preview">
    <div className="preview-top"><div><span className="preview-kicker">Вариант 2</span><h2>Расчёт по шагам</h2><p>На экране только то, что заполняется сейчас.</p></div><strong>Шаг {step + 1}/4</strong></div>
    <nav className="step-nav" aria-label="Этапы демо-расчёта">{steps.map((item, index) => <button key={item.title} type="button" className={index === step ? 'current' : index < step ? 'done' : ''} onClick={() => setStep(index)}><i>{index + 1}</i><span>{item.title}</span></button>)}</nav>
    {steps.map((item, index) => <button className={index === step ? 'step-row open' : 'step-row'} type="button" key={item.title} onClick={() => setStep(index)}><span><b>{item.title}</b><small>{item.summary}</small></span><i>{index === step ? '−' : '+'}</i></button>)}
    <div className="step-detail">{step === 0 && <><Field label="Материал" value="3D-сетка" wide /><div className="field-grid"><Field label="Высота" value="1,8 м" /><Field label="Длина" value="42 м" /></div></>}{step === 1 && <><Toggle title="Откатные ворота" note="4 м · 70 000 ₽" /><Field label="Количество" value="1 шт." wide /></>}{step === 2 && <><Toggle title="Доставка" note="По метражу · 6 000 ₽" /><Field label="Своя стоимость" value="По прайсу" wide /></>}{step === 3 && <div className="result-preview"><span>Предварительный итог</span><b>121 400 ₽</b><small>Включая материалы и работы</small></div>}</div>
    <button type="button" className="preview-primary" onClick={() => setStep(step === 3 ? 0 : step + 1)}>{step === 3 ? 'Начать заново' : 'Продолжить'} <span>→</span></button>
  </section>;
}

function CatalogPreview() {
  const [material, setMaterial] = useState('Профлист');
  const materials = ['Профлист', 'Евроштакетник', '3D-сетка', 'Рабица'];
  return <section className="preview-surface catalog-preview">
    <div className="preview-top"><div><span className="preview-kicker">Вариант 3</span><h2>Конструктор забора</h2><p>Сначала выбирается тип забора, затем — его параметры.</p></div><strong>1 из 4</strong></div>
    <p className="catalog-question">Какой забор нужен?</p><div className="material-grid">{materials.map(item => <button key={item} type="button" className={item === material ? 'material-card selected' : 'material-card'} onClick={() => setMaterial(item)}><span className="material-line" /><b>{item}</b><small>{item === 'Профлист' ? 'от 1 900 ₽/м' : item === 'Евроштакетник' ? 'от 2 150 ₽/м' : item === '3D-сетка' ? 'от 1 900 ₽/м' : 'от 900 ₽/м'}</small></button>)}</div>
    <div className="config-panel"><b>{material}</b><span>Параметры участка</span><div className="field-grid"><Field label="Высота" value="2 м" /><Field label="Длина" value="70 м" /></div></div>
    <div className="add-on-row"><span>Нужны ворота или калитка?</span><button type="button">Добавить</button></div>
    <button type="button" className="preview-primary">Перейти к составу <span>→</span></button>
  </section>;
}

export default function VariantsPage() {
  return <main className="variants-page"><header className="variants-header"><a href="../">← К калькулятору</a><h1>Три варианта интерфейса</h1><p>Это демонстрации внешнего вида. Расчёты здесь не сохраняются и не меняют основной калькулятор.</p></header><div className="variant-list"><OperationsPreview /><StepsPreview /><CatalogPreview /></div></main>;
}
