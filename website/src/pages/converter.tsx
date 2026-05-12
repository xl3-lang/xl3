import React, { useCallback, useEffect, useRef, useState } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import BrowserOnly from '@docusaurus/BrowserOnly';
import clsx from 'clsx';
import styles from './converter.module.css';

// Sample files shipped under website/static/playground-samples/.
const SAMPLE_RAW_URL = '/playground-samples/sample-raw.xlsx';
const SAMPLE_TEMPLATE_URL = '/playground-samples/sample-template.xlsx';

type OutputFile = { filename: string; data: Uint8Array };
type Xl3Module = {
  convert(
    template: ArrayBuffer,
    data: ArrayBuffer,
    options?: { inputs?: Record<string, string | number | boolean> },
  ): Promise<OutputFile[]>;
  packageZip(files: OutputFile[]): Promise<Blob>;
  preview(
    template: ArrayBuffer,
    data: ArrayBuffer,
    options?: { inputs?: Record<string, string | number | boolean> },
  ): Promise<{
    files: Array<{ filename: string; sheets: Array<{ name: string; rowCount: number }> }>;
    inputs: Array<{ name: string; type: string; required?: boolean; default?: unknown; label?: string; description?: string }>;
    sources: Array<{ name: string; rowCount: number; headers: string[] }>;
    warnings: Array<{ message: string }>;
  }>;
  readTemplateInputs(template: ArrayBuffer): Promise<
    Array<{ name: string; type: string; required?: boolean; default?: unknown; label?: string }>
  >;
};

let xl3Promise: Promise<Xl3Module> | undefined;
function loadXl3(): Promise<Xl3Module> {
  if (!xl3Promise) {
    xl3Promise = import(/* webpackChunkName: 'xl3-engine' */ '@jinyoung4478/xl3') as Promise<Xl3Module>;
  }
  return xl3Promise;
}

async function fileOrUrlBuffer(file: File | null, exampleUrl: string): Promise<ArrayBuffer> {
  if (file) return file.arrayBuffer();
  const response = await fetch(exampleUrl);
  if (!response.ok) {
    throw new Error(`Could not load example file at ${exampleUrl}`);
  }
  return response.arrayBuffer();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function outputBlob(output: OutputFile): Blob {
  return new Blob(
    [output.data],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
}

function Converter() {
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [inputDecls, setInputDecls] = useState<Xl3Module extends never ? never : Awaited<ReturnType<Xl3Module['readTemplateInputs']>>>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ message: string; tone: 'muted' | 'error' | 'success' }>({
    message: 'Sample files are pre-loaded. Press the button to convert as-is, or replace either file first.',
    tone: 'muted',
  });
  const [busy, setBusy] = useState(false);
  const [previewInfo, setPreviewInfo] = useState<{
    sources: Array<{ name: string; rowCount: number; headers: string[] }>;
    files: Array<{ filename: string; sheets: Array<{ name: string; rowCount: number }> }>;
    warnings: Array<{ message: string }>;
  } | null>(null);
  const inputDeclsLoadedFor = useRef<File | null>(null);

  // Re-read declared inputs whenever a new template file is supplied.
  useEffect(() => {
    let cancelled = false;
    async function refreshDecls() {
      if (inputDeclsLoadedFor.current === templateFile) return;
      try {
        const buf = await fileOrUrlBuffer(templateFile, SAMPLE_TEMPLATE_URL);
        const xl3 = await loadXl3();
        const decls = await xl3.readTemplateInputs(buf);
        if (cancelled) return;
        setInputDecls(decls);
        // Seed values from defaults.
        const seed: Record<string, string> = {};
        for (const d of decls) {
          if (d.default != null) seed[d.name] = String(d.default);
        }
        setInputValues((prev) => ({ ...seed, ...prev }));
        inputDeclsLoadedFor.current = templateFile;
      } catch {
        // Silent — template might fail to parse during file picking.
      }
    }
    refreshDecls();
    return () => { cancelled = true; };
  }, [templateFile]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus({ message: 'Converting workbook…', tone: 'muted' });
    setPreviewInfo(null);
    try {
      const templateBuf = await fileOrUrlBuffer(templateFile, SAMPLE_TEMPLATE_URL);
      const dataBuf = await fileOrUrlBuffer(rawFile, SAMPLE_RAW_URL);
      const xl3 = await loadXl3();

      // Preview first to populate the side panel.
      const previewResult = await xl3.preview(
        templateBuf.slice(0),
        dataBuf.slice(0),
        Object.keys(inputValues).length ? { inputs: inputValues } : undefined,
      );
      setPreviewInfo({
        sources: previewResult.sources,
        files: previewResult.files,
        warnings: previewResult.warnings,
      });

      const outputs = await xl3.convert(
        templateBuf,
        dataBuf,
        Object.keys(inputValues).length ? { inputs: inputValues } : undefined,
      );
      if (outputs.length === 0) {
        setStatus({ message: 'Conversion succeeded but produced no output files.', tone: 'error' });
        return;
      }
      if (outputs.length === 1) {
        downloadBlob(outputBlob(outputs[0]), outputs[0].filename);
        setStatus({ message: `Downloaded ${outputs[0].filename}.`, tone: 'success' });
      } else {
        const zip = await xl3.packageZip(outputs);
        downloadBlob(zip, 'xl3-outputs.zip');
        setStatus({ message: `Downloaded ${outputs.length} files as xl3-outputs.zip.`, tone: 'success' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ message: `Conversion failed: ${message}`, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }, [rawFile, templateFile, inputValues]);

  return (
    <div className={styles.converterWrap}>
      <form className={styles.converterForm} onSubmit={onSubmit} aria-label="Browser workbook converter">
        <p className={styles.kicker}>Browser converter</p>
        <h2 className={styles.heading}>Upload raw data and a template, then download the finished workbook.</h2>
        <p className={styles.hint}>
          To choose the raw workbook table, add <code>source_table</code> such
          as <code>1</code> or <code>A1:D</code> to the template workbook's
          hidden <code>__config__</code> sheet.
        </p>

        <label className={styles.field}>
          <span className={styles.fieldRow}>
            <span>Raw Excel file</span>
            <a href={SAMPLE_RAW_URL} download>Download sample</a>
          </span>
          <span className={styles.fieldHint}>Default sample is attached. Replace it only if you want.</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setRawFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldRow}>
            <span>Template Excel file</span>
            <a href={SAMPLE_TEMPLATE_URL} download>Download sample</a>
          </span>
          <span className={styles.fieldHint}>Includes <code>__config__.source_table = 1</code>.</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {inputDecls.length > 0 && (
          <fieldset className={styles.inputsBlock}>
            <legend>Template inputs</legend>
            {inputDecls.map((d) => (
              <label key={d.name} className={styles.inputField}>
                <span>
                  {d.label || d.name}
                  {d.required ? ' *' : ''}
                </span>
                <input
                  value={inputValues[d.name] ?? ''}
                  onChange={(e) => setInputValues((v) => ({ ...v, [d.name]: e.target.value }))}
                  placeholder={d.default != null ? String(d.default) : ''}
                />
              </label>
            ))}
          </fieldset>
        )}

        <button
          type="submit"
          className={clsx('button button--primary button--lg', styles.submit)}
          disabled={busy}
        >
          {busy ? 'Converting…' : 'Run and download'}
        </button>
        <p className={clsx(styles.status, styles[`status_${status.tone}`])}>{status.message}</p>
      </form>

      <aside className={styles.previewPanel} aria-label="Conversion preview">
        <h3>Preview</h3>
        {!previewInfo && (
          <p className={styles.previewEmpty}>Run the converter to see source counts, output filenames, and any warnings.</p>
        )}
        {previewInfo && (
          <>
            <section>
              <h4>Sources detected</h4>
              {previewInfo.sources.length === 0 && <p>None.</p>}
              <ul>
                {previewInfo.sources.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong>{' '}
                    <span className={styles.muted}>· {s.rowCount} rows · {s.headers.length} cols</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h4>Output files</h4>
              {previewInfo.files.length === 0 && <p>None.</p>}
              <ul>
                {previewInfo.files.map((f) => (
                  <li key={f.filename}>
                    <strong>{f.filename}</strong>
                    <ul>
                      {f.sheets.map((sh) => (
                        <li key={sh.name}>{sh.name} <span className={styles.muted}>· {sh.rowCount} rows</span></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
            {previewInfo.warnings.length > 0 && (
              <section>
                <h4>Warnings</h4>
                <ul>
                  {previewInfo.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

export default function ConverterPage() {
  return (
    <Layout
      title="xl3 converter — try Excel-to-Excel templates in the browser"
      description="Upload raw + template Excel files. xl3 runs convert() in the browser and downloads the rendered workbook. The interactive demo for xl3.io."
    >
      <main className={styles.pageMain}>
        <div className="container">
          <div className={styles.intro}>
            <p className={styles.kicker}>Use it</p>
            <h1 className={styles.title}>Try the operator flow, then wire it into your app.</h1>
            <p className={styles.lead}>
              Both files are pre-loaded with sample data. Press the button to
              convert as-is, or replace either file. Conversion runs entirely
              in your browser — nothing is uploaded.
            </p>
            <p className={styles.crosslinks}>
              <Link to="/">Home</Link>
              {' · '}
              <Link to="/cookbook/getting-started">Cookbook 01</Link>
              {' · '}
              <Link to="/spec/">Spec</Link>
              {' · '}
              <Link to="/PORTERS_GUIDE">Porter's Guide</Link>
            </p>
          </div>
          <BrowserOnly fallback={<div className={styles.previewEmpty}>Loading converter…</div>}>
            {() => <Converter />}
          </BrowserOnly>
        </div>
      </main>
    </Layout>
  );
}
