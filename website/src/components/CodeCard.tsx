import React from 'react';
import styles from './CodeCard.module.css';

export type Token =
  | { kind: 'plain'; text: string }
  | { kind: 'kw'; text: string }      // keyword
  | { kind: 'string'; text: string }   // string literal
  | { kind: 'fn'; text: string }       // function name
  | { kind: 'const'; text: string }    // constant
  | { kind: 'var'; text: string }      // variable name
  | { kind: 'comment'; text: string }  // comment
  | { kind: 'prompt'; text: string };  // shell prompt $

const CLASS_FOR: Record<Token['kind'], string> = {
  plain: '',
  kw: styles.tokKw,
  string: styles.tokString,
  fn: styles.tokFn,
  const: styles.tokConst,
  var: styles.tokVar,
  comment: styles.tokComment,
  prompt: styles.tokPrompt,
};

export type Line = Token[];

export function CodeCard({
  name,
  lines,
}: {
  name: string;
  lines: Line[];
}) {
  return (
    <figure className={styles.card}>
      <figcaption className={styles.head}>
        <span className={styles.dots} aria-hidden="true">
          <span /><span /><span />
        </span>
        <span className={styles.name}>{name}</span>
      </figcaption>
      <pre className={styles.block}>
        <code>
          {lines.map((line, lineIdx) => (
            <React.Fragment key={lineIdx}>
              {line.map((tok, i) => {
                const cls = CLASS_FOR[tok.kind];
                return cls ? (
                  <span key={i} className={cls}>{tok.text}</span>
                ) : (
                  <React.Fragment key={i}>{tok.text}</React.Fragment>
                );
              })}
              {lineIdx < lines.length - 1 && '\n'}
            </React.Fragment>
          ))}
        </code>
      </pre>
    </figure>
  );
}
