import React from 'react';
import Translate from '@docusaurus/Translate';
import clsx from 'clsx';
import { PREVIEW_FIELDS } from './ExcelPreview';
import type { FieldInteraction } from './ExcelPreview';
import styles from './WorkbookFlow.module.css';

export function WorkbookFlow({
  interaction,
  onClear,
}: {
  interaction: FieldInteraction;
  onClear: () => void;
}) {
  const { activeField, pinnedField, onHover, onFocus, onPin } = interaction;
  return (
    <section className={styles.flow} aria-labelledby="workbook-flow-title">
      <div className={styles.toolbar}>
        <div>
          <h3 id="workbook-flow-title">
            <Translate id="homepage.flow.title">Follow a field</Translate>
          </h3>
          <p>
            <Translate id="homepage.flow.hint">
              Hover or focus a field to trace it. Click to pin; click again or press Esc to clear.
            </Translate>
          </p>
        </div>
        <button type="button" onClick={onClear} disabled={!activeField} className={styles.clear}>
          <Translate id="homepage.flow.clear">Clear</Translate>
        </button>
      </div>
      <div className={styles.fields}>
        {PREVIEW_FIELDS.map((field) => (
          <button
            key={field}
            type="button"
            className={clsx(styles.field, activeField === field && styles.activeField)}
            aria-pressed={pinnedField === field}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') onHover(field);
            }}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onFocus(field)}
            onBlur={() => onFocus(null)}
            onClick={() => onPin(field)}
          >
            {field}
            {pinnedField === field ? <span aria-hidden="true"> ●</span> : null}
          </button>
        ))}
        <span className={styles.status} role="status">
          {pinnedField ? (
            <Translate id="homepage.flow.pinned" values={{ field: pinnedField }}>
              {'{field} pinned'}
            </Translate>
          ) : (
            <Translate id="homepage.flow.explore">Explore a field</Translate>
          )}
        </span>
      </div>
    </section>
  );
}
