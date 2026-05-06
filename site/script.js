const isKorean = document.documentElement.lang === 'ko';
const steps = [...document.querySelectorAll('.step')];
const preview = document.querySelector('#excelPreview');
const previewKind = document.querySelector('#previewKind');
const previewTitle = document.querySelector('#previewTitle');
const previewNotes = document.querySelector('#previewNotes');
const converterForm = document.querySelector('#converterForm');
const rawFileInput = document.querySelector('#rawFile');
const templateFileInput = document.querySelector('#templateFile');
const convertButton = document.querySelector('#convertButton');
const converterStatus = document.querySelector('#converterStatus');
const converterPreview = document.querySelector('#converterPreview');
const xl3ModuleUrl = isKorean ? '../dist/index.js' : './dist/index.js';
const exampleBaseUrl = isKorean ? '../examples/' : './examples/';
const exampleRawUrl = `${exampleBaseUrl}sample-raw.xlsx`;
const exampleTemplateUrl = `${exampleBaseUrl}sample-template.xlsx`;

const copy = {
  en: {
    dataTitle: 'The template declares the source shape.',
    dataNote: 'source_table tells the engine where the raw table starts and which columns belong to it.',
    templateTitle: 'Operators get a file-based workflow.',
    templateNote: 'The UI can stay simple: raw workbook in, template workbook in, result workbook out.',
    renderTitle: 'The output is a finished workbook.',
    renderNote: 'Values change while workbook layout, styles, formats, and merges remain useful.',
    conformanceTitle: 'The workflow is archived in the template.',
    conformanceNote: 'The workbook captures the recurring job so teams can review, version, and hand it over.',
    exampleReady: 'Example files are attached. Run as-is, or replace either file.',
    loadingExamples: 'Loading attached example files...',
    loadingEngine: 'Loading the xl3 browser engine...',
    converting: 'Converting workbook...',
    noOutputs: 'Conversion finished, but the template did not produce an output file.',
    downloadedOne: 'Downloaded result workbook.',
    downloadedMany: (count) => `Downloaded ${count} result workbooks as a ZIP.`,
    failed: (message) => `Conversion failed: ${message}`,
    previewLoading: 'Previewing the selected workflow...',
    previewFailed: (message) => `Preview failed: ${message}`,
    previewTitle: 'Before download',
    previewSource: 'Source contract',
    previewOutputs: 'Expected output',
    previewWarnings: 'Warnings',
    previewNoOutputs: 'No output files will be generated.',
    previewSheetRows: (count) => `${count} row${count === 1 ? '' : 's'}`,
  },
  ko: {
    dataTitle: '템플릿이 원본 데이터의 모양을 지정합니다.',
    dataNote: '`source_table`이 원본 테이블의 시작 위치와 포함할 컬럼을 엔진에 알려줍니다.',
    templateTitle: '실무자는 파일을 올리고 결과를 받습니다.',
    templateNote: 'UI는 단순하게 유지할 수 있습니다. 원본 엑셀 파일과 엑셀 템플릿을 넣고 결과를 받습니다.',
    renderTitle: '결과는 완성된 엑셀 파일입니다.',
    renderNote: '값은 바뀌지만 레이아웃, 스타일, 숫자 형식, 병합 셀은 그대로 유지됩니다.',
    conformanceTitle: '업무 흐름은 템플릿에 아카이빙됩니다.',
    conformanceNote: '반복 작업을 엑셀 파일이 담고 있어, 검토와 버전 관리, 인수인계가 쉬워집니다.',
    exampleReady: '예시 파일이 첨부되어 있습니다. 그대로 실행하거나 원하는 파일로 교체하세요.',
    loadingExamples: '첨부된 예시 파일을 불러오는 중입니다...',
    loadingEngine: 'xl3 브라우저 엔진을 불러오는 중입니다...',
    converting: '엑셀 파일을 변환하는 중입니다...',
    noOutputs: '변환은 끝났지만 템플릿이 출력 파일을 만들지 않았습니다.',
    downloadedOne: '결과 파일을 다운로드했습니다.',
    downloadedMany: (count) => `결과 파일 ${count}개를 ZIP으로 다운로드했습니다.`,
    failed: (message) => `변환 실패: ${message}`,
    previewLoading: '선택한 흐름을 미리보는 중입니다...',
    previewFailed: (message) => `미리보기 실패: ${message}`,
    previewTitle: '다운로드 전 확인',
    previewSource: 'Source contract',
    previewOutputs: '예상 결과',
    previewWarnings: 'Warnings',
    previewNoOutputs: '생성될 결과 파일이 없습니다.',
    previewSheetRows: (count) => `${count}행`,
  },
};

const t = isKorean ? copy.ko : copy.en;

const examples = {
  data: {
    kind: '_config',
    title: t.dataTitle,
    note: t.dataNote,
    workbookTitle: 'template.xlsx',
    workbookSubtitle: isKorean ? '업무 규칙이 들어 있는 엑셀 파일' : 'workbook with transformation rules',
    formula: 'B2  source_table = 1',
    sheetName: '_config',
    rows: [
      ['key', 'value', 'notes'],
      ['source_sheet', 'Raw', 'worksheet to read'],
      ['source_table', '1', 'column names and data rows'],
    ],
    classes: [
      ['header-cell', 'header-cell', 'header-cell'],
      ['', 'selected currency-cell', ''],
      ['', 'currency-cell', ''],
    ],
  },
  template: {
    kind: 'operator flow',
    title: t.templateTitle,
    note: t.templateNote,
    workbookTitle: 'converter.html',
    workbookSubtitle: isKorean ? '비개발자용 변환 화면' : 'operator-facing converter',
    formula: 'raw.xlsx + template.xlsx',
    sheetName: 'Run',
    rows: [
      ['Input', 'Selected file', 'Owner'],
      ['Raw Excel', 'raw-may.xlsx', 'operator'],
      ['Template Excel', 'approved-report.xlsx', 'developer/team'],
      ['Action', 'Convert and download', 'operator'],
    ],
    classes: [
      ['header-cell', 'header-cell', 'header-cell'],
      ['', 'selected template-cell', ''],
      ['', 'template-cell', ''],
      ['merged-note', 'merged-note', 'merged-note'],
    ],
    merges: [{ row: 3, col: 0, span: 3 }],
  },
  render: {
    kind: 'result.xlsx',
    title: t.renderTitle,
    note: t.renderNote,
    workbookTitle: 'result.xlsx',
    workbookSubtitle: isKorean ? '서식까지 보존된 결과 엑셀 파일' : 'rendered workbook with formatting preserved',
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
    kind: 'handover artifact',
    title: t.conformanceTitle,
    note: t.conformanceNote,
    workbookTitle: 'template.xlsx',
    workbookSubtitle: isKorean ? '아카이빙 가능한 업무 규칙' : 'archivable workflow contract',
    formula: 'rules travel with the workbook',
    sheetName: 'Workflow',
    rows: [
      ['What is preserved', 'Where it lives', 'Why it matters'],
      ['Header mapping', '_config', 'repeatable runs'],
      ['Output layout', 'report sheets', 'operator handoff'],
      ['Transform rules', 'XTL cells', 'reviewable file'],
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

setActiveStep('data');

let xl3ModulePromise;

function loadXl3Module() {
  xl3ModulePromise ??= import(xl3ModuleUrl);
  return xl3ModulePromise;
}

function setConverterStatus(message, tone = 'muted') {
  if (!converterStatus) return;
  converterStatus.textContent = message;
  converterStatus.style.color = tone === 'error' ? 'var(--red)' : 'var(--muted)';
}

function setConverterBusy(isBusy) {
  if (!convertButton) return;
  convertButton.disabled = isBusy;
  convertButton.textContent = isBusy
    ? (isKorean ? '변환 중...' : 'Converting...')
    : (isKorean ? '예시 실행하고 다운로드' : 'Run example and download');
}

async function fileOrExampleBuffer(file, exampleUrl) {
  if (file) return file.arrayBuffer();
  const response = await fetch(exampleUrl);
  if (!response.ok) {
    throw new Error(`Could not load example file: ${exampleUrl}`);
  }
  return response.arrayBuffer();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function outputBlob(output) {
  return new Blob(
    [output.data],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
}

function renderConverterPreview({ meta, result }) {
  const sourceSheet = meta.source_sheet || (isKorean ? '첫 번째 worksheet' : 'first worksheet');
  const sourceTable = meta.source_table || '1';
  const files = result.files ?? [];
  const warnings = result.warnings ?? [];
  const outputMarkup = files.length
    ? files.map((file) => `
      <article class="preview-file">
        <strong>${escapeHtml(file.filename || 'result.xlsx')}</strong>
        <ul>
          ${file.sheets.map((sheet) => `
            <li>
              <span>${escapeHtml(sheet.name)}</span>
              <small>${escapeHtml(t.previewSheetRows(sheet.rowCount))}</small>
            </li>
          `).join('')}
        </ul>
      </article>
    `).join('')
    : `<div class="preview-empty">${escapeHtml(t.previewNoOutputs)}</div>`;
  const warningMarkup = warnings.length
    ? `<div class="preview-warnings">
        <strong>${escapeHtml(t.previewWarnings)}</strong>
        <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
      </div>`
    : '';

  return `
    <div class="preview-head">
      <span>${escapeHtml(t.previewTitle)}</span>
      <code>preview(template, raw)</code>
    </div>
    <div class="preview-grid">
      <div class="preview-contract">
        <strong>${escapeHtml(t.previewSource)}</strong>
        <dl>
          <div><dt>source_sheet</dt><dd>${escapeHtml(sourceSheet)}</dd></div>
          <div><dt>source_table</dt><dd>${escapeHtml(sourceTable)}</dd></div>
        </dl>
      </div>
      <div class="preview-output">
        <strong>${escapeHtml(t.previewOutputs)}</strong>
        ${outputMarkup}
      </div>
    </div>
    ${warningMarkup}
  `;
}

function setPreviewMessage(message, tone = 'muted') {
  if (!converterPreview) return;
  converterPreview.innerHTML = `<div class="preview-empty ${tone === 'error' ? 'is-error' : ''}">${escapeHtml(message)}</div>`;
}

let previewRunId = 0;

async function updateConverterPreview() {
  if (!converterPreview || !rawFileInput || !templateFileInput) return;
  const runId = ++previewRunId;
  setPreviewMessage(t.previewLoading);

  try {
    const { analyze, preview: previewWorkflow } = await loadXl3Module();
    const rawFile = rawFileInput.files?.[0];
    const templateFile = templateFileInput.files?.[0];
    const [templateBuffer, rawBuffer] = await Promise.all([
      fileOrExampleBuffer(templateFile, exampleTemplateUrl),
      fileOrExampleBuffer(rawFile, exampleRawUrl),
    ]);
    const [meta, result] = await Promise.all([
      analyze(templateBuffer),
      previewWorkflow(templateBuffer.slice(0), rawBuffer),
    ]);
    if (runId !== previewRunId) return;
    converterPreview.innerHTML = renderConverterPreview({ meta: meta.meta, result });
  } catch (error) {
    if (runId !== previewRunId) return;
    const message = error instanceof Error ? error.message : String(error);
    setPreviewMessage(t.previewFailed(message), 'error');
  }
}

if (converterForm && rawFileInput && templateFileInput) {
  rawFileInput.addEventListener('change', updateConverterPreview);
  templateFileInput.addEventListener('change', updateConverterPreview);

  converterForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const rawFile = rawFileInput.files?.[0];
    const templateFile = templateFileInput.files?.[0];
    setConverterBusy(true);
    try {
      setConverterStatus(t.loadingEngine);
      const { convert, packageZip } = await loadXl3Module();

      setConverterStatus(rawFile && templateFile ? t.converting : t.loadingExamples);
      const [templateBuffer, rawBuffer] = await Promise.all([
        fileOrExampleBuffer(templateFile, exampleTemplateUrl),
        fileOrExampleBuffer(rawFile, exampleRawUrl),
      ]);
      setConverterStatus(t.converting);
      const outputs = await convert(templateBuffer, rawBuffer);

      if (outputs.length === 0) {
        setConverterStatus(t.noOutputs, 'error');
      } else if (outputs.length === 1) {
        downloadBlob(outputBlob(outputs[0]), outputs[0].filename || 'result.xlsx');
        setConverterStatus(t.downloadedOne);
      } else {
        const zipBlob = await packageZip(outputs);
        downloadBlob(zipBlob, 'xl3-results.zip');
        setConverterStatus(t.downloadedMany(outputs.length));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setConverterStatus(t.failed(message), 'error');
    } finally {
      setConverterBusy(false);
    }
  });

  setConverterStatus(t.exampleReady);
  updateConverterPreview();
}
