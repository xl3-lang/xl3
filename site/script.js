const isKorean = document.documentElement.lang === 'ko';
const steps = [...document.querySelectorAll('.step')];
const preview = document.querySelector('#excelPreview');
const previewKind = document.querySelector('#previewKind');
const previewTitle = document.querySelector('#previewTitle');
const previewNotes = document.querySelector('#previewNotes');

const copy = {
  en: {
    dataTitle: 'A workbook supplies source rows.',
    dataNote: 'Header row fields become XTL source columns.',
    templateTitle: 'A workbook defines the output document.',
    templateNote: 'XTL expressions live inside ordinary Excel cells.',
    renderTitle: 'The rendered result is still Excel.',
    renderNote: 'Values change, while workbook structure and formatting remain part of the contract.',
    conformanceTitle: 'The behavior is checked by fixtures.',
    conformanceNote: 'Stage 2 compares canonical OOXML so style and structure regressions are visible.',
  },
  ko: {
    dataTitle: 'workbook이 원본 row를 제공합니다.',
    dataNote: 'Header row의 field가 XTL source column이 됩니다.',
    templateTitle: 'workbook이 출력 문서를 정의합니다.',
    templateNote: 'XTL 표현식은 일반 Excel 셀 안에 들어갑니다.',
    renderTitle: '렌더링 결과도 여전히 Excel입니다.',
    renderNote: '값은 바뀌지만 workbook 구조와 서식은 계약의 일부로 남습니다.',
    conformanceTitle: '동작은 fixture로 검증됩니다.',
    conformanceNote: 'Stage 2는 canonical OOXML을 비교해 스타일과 구조 회귀를 드러냅니다.',
  },
};

const t = isKorean ? copy.ko : copy.en;

const examples = {
  data: {
    kind: 'data.xlsx',
    title: t.dataTitle,
    note: t.dataNote,
    workbookTitle: 'data.xlsx',
    workbookSubtitle: isKorean ? '원본 row workbook' : 'source row workbook',
    formula: 'B2  1200',
    sheetName: 'Data',
    rows: [
      ['Customer', 'Amount', 'Region'],
      ['Acme', '1200', 'Seoul'],
      ['Beta', '350', 'Busan'],
    ],
    classes: [
      ['header-cell', 'header-cell', 'header-cell'],
      ['', 'selected currency-cell', ''],
      ['', 'currency-cell', ''],
    ],
  },
  template: {
    kind: 'template.xlsx',
    title: t.templateTitle,
    note: t.templateNote,
    workbookTitle: 'template.xlsx',
    workbookSubtitle: isKorean ? 'Excel에서 작성한 템플릿' : 'template authored in Excel',
    formula: 'B2  {{ TEXT([Amount], "#,##0.00") }}',
    sheetName: 'Report',
    rows: [
      ['Customer', 'Amount', 'Status'],
      ['{{ [Customer] }}', '{{ TEXT([Amount], "#,##0.00") }}', '{{ IF([Amount] > 1000, "VIP", "Standard") }}'],
      ['Prepared for finance review', '', ''],
    ],
    classes: [
      ['header-cell', 'header-cell', 'header-cell'],
      ['template-cell', 'template-cell selected', 'template-cell'],
      ['merged-note', 'merged-note', 'merged-note'],
    ],
    merges: [{ row: 2, col: 0, span: 3 }],
  },
  render: {
    kind: 'result.xlsx',
    title: t.renderTitle,
    note: t.renderNote,
    workbookTitle: 'result.xlsx',
    workbookSubtitle: isKorean ? '서식이 유지된 결과 workbook' : 'rendered workbook with formatting preserved',
    formula: 'B2  1,200.00',
    sheetName: 'Report',
    rows: [
      ['Customer', 'Amount', 'Status'],
      ['Acme', '1,200.00', 'VIP'],
      ['Prepared for finance review', '', ''],
      ['Beta', '350.00', 'Standard'],
    ],
    classes: [
      ['header-cell', 'header-cell', 'header-cell'],
      ['', 'selected currency-cell', 'status-cell'],
      ['merged-note', 'merged-note', 'merged-note'],
      ['', 'currency-cell', ''],
    ],
    merges: [{ row: 2, col: 0, span: 3 }],
  },
  conformance: {
    kind: 'conformance report',
    title: t.conformanceTitle,
    note: t.conformanceNote,
    workbookTitle: 'Stage 2',
    workbookSubtitle: isKorean ? 'canonical OOXML comparison' : 'canonical OOXML comparison',
    formula: '27 / 27 fixtures passed',
    sheetName: 'Report',
    rows: [
      ['Fixture', 'Stage', 'Result'],
      ['024 merge preservation', '2', 'PASS'],
      ['025 style numFmt', '2', 'PASS'],
      ['027 cross-writer canonicalization', '2', 'PASS'],
    ],
    classes: [
      ['header-cell', 'header-cell', 'header-cell'],
      ['', 'currency-cell', 'status-cell'],
      ['', 'currency-cell', 'status-cell'],
      ['', 'currency-cell', 'status-cell'],
    ],
  },
};

function setActiveStep(id) {
  const example = examples[id] ?? examples.data;
  steps.forEach((step) => {
    step.classList.toggle('is-active', step.dataset.step === id);
  });
  previewKind.textContent = example.kind;
  previewTitle.textContent = example.title;
  previewNotes.textContent = example.note;
  preview.innerHTML = renderWorkbook(example);
}

function renderWorkbook(example) {
  const maxCols = Math.max(...example.rows.map((row) => row.length));
  const merges = example.merges ?? [];
  const mergeAt = (rowIndex, colIndex) =>
    merges.find((merge) => merge.row === rowIndex && merge.col === colIndex);
  const hiddenByMerge = (rowIndex, colIndex) =>
    merges.some((merge) => merge.row === rowIndex && colIndex > merge.col && colIndex < merge.col + merge.span);

  const bodyRows = example.rows.map((row, rowIndex) => {
    const cells = [];
    for (let colIndex = 0; colIndex < maxCols; colIndex++) {
      if (hiddenByMerge(rowIndex, colIndex)) continue;
      const merge = mergeAt(rowIndex, colIndex);
      const value = row[colIndex] ?? '';
      const className = example.classes?.[rowIndex]?.[colIndex] ?? '';
      const colspan = merge ? ` colspan="${merge.span}"` : '';
      cells.push(`<td class="${className}"${colspan}>${escapeHtml(value)}</td>`);
    }
    return `<tr><th>${rowIndex + 1}</th>${cells.join('')}</tr>`;
  }).join('');

  const columns = Array.from({ length: maxCols }, (_, index) => `<th>${columnLabel(index)}</th>`).join('');

  return `
    <div class="excel-titlebar">
      <div class="window-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      <div>
        <strong>${escapeHtml(example.workbookTitle)}</strong>
        <small>${escapeHtml(example.workbookSubtitle)}</small>
      </div>
    </div>
    <div class="excel-ribbon">
      <span>Home</span><span>Insert</span><span>Formulas</span><span>Review</span>
    </div>
    <div class="formula-bar">
      <span class="name-box">B2</span>
      <span class="fx">fx</span>
      <span class="formula-text">${escapeHtml(example.formula)}</span>
    </div>
    <div class="sheet-wrap">
      <table class="sheet-grid">
        <thead><tr><th></th>${columns}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    <div class="sheet-tabs"><span class="sheet-tab">${escapeHtml(example.sheetName)}</span></div>
  `;
}

function columnLabel(index) {
  let value = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

steps.forEach((step) => {
  step.addEventListener('click', () => setActiveStep(step.dataset.step));
  step.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setActiveStep(step.dataset.step);
    }
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setActiveStep(visible.target.dataset.step);
  },
  { threshold: [0.45, 0.7] },
);

steps.forEach((step) => observer.observe(step));
setActiveStep('data');
