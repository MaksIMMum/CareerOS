import { describe, expect, it } from 'vitest';
import { guessVacancyTitle } from './vacancyPdf.js';

describe('guessVacancyTitle', () => {
  it('uses a short first line as the title', () => {
    expect(guessVacancyTitle('\n  Junior Node.js Developer\nAcme\nВимоги: …', 'x.pdf')).toBe('Junior Node.js Developer');
  });

  it('falls back to the file name for sentences, links and long lines', () => {
    expect(guessVacancyTitle('We are looking for a developer to join us.', 'Junior_QA.pdf')).toBe('Junior QA');
    expect(guessVacancyTitle('https://djinni.co/jobs/1/', 'vacancy.PDF')).toBe('vacancy');
    expect(guessVacancyTitle('word '.repeat(30), 'job.pdf')).toBe('job');
    expect(guessVacancyTitle('', 'job.pdf')).toBe('job');
  });
});
