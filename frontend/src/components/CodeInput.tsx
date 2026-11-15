import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

const LEN = 6;

/** Six one-digit boxes for an email code; typing moves forward, Backspace back, paste fills all. */
export const CodeInput: React.FC<{ value: string; onChange: (v: string) => void; legend: string }> = ({ value, onChange, legend }) => {
  const { t } = useTranslation();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: LEN }, (_, i) => value[i] ?? '');

  const focus = (i: number) => refs.current[Math.max(0, Math.min(LEN - 1, i))]?.focus();

  const setAt = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join('').replace(/\s/g, ''));
  };

  const onInput = (i: number, raw: string) => {
    const only = raw.replace(/\D/g, '');
    if (only.length > 1) {
      // Pasted or auto-filled several digits into one box.
      onChange((digits.slice(0, i).join('') + only).slice(0, LEN));
      focus(i + only.length);
      return;
    }
    setAt(i, only);
    if (only) focus(i + 1);
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      setAt(i - 1, '');
      focus(i - 1);
    } else if (e.key === 'ArrowLeft') focus(i - 1);
    else if (e.key === 'ArrowRight') focus(i + 1);
  };

  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => onInput(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={t('auth.digit', { n: i + 1 })}
            className="w-full min-w-0 h-14 sm:h-16 border border-line-strong rounded-xl bg-white text-center font-mono font-bold text-2xl sm:text-[28px] text-ink focus:outline-none focus:border-2 focus:border-accent"
          />
        ))}
      </div>
    </fieldset>
  );
};
