import { describe, expect, it } from 'vitest';
import { activeFlags, highlight } from './flagged.js';

describe('flagged terms', () => {
  const flagged = { skills: ['Docker', 'C#'], numbers: ['40%'] };

  it('keeps only flags still present after the user edits the text', () => {
    expect(activeFlags('Node.js, Docker, швидше на 40%', flagged)).toEqual(['Docker', '40%']);
    expect(activeFlags('Node.js, швидше', flagged)).toEqual([]);
  });

  it('does not treat substrings as hits (Dockerfile, C++)', () => {
    expect(activeFlags('Dockerfile, C++', flagged)).toEqual([]);
  });

  it('splits text into highlighted segments', () => {
    expect(highlight('Used docker and C# daily', ['Docker', 'C#'])).toEqual([
      { text: 'Used ', flagged: false },
      { text: 'docker', flagged: true },
      { text: ' and ', flagged: false },
      { text: 'C#', flagged: true },
      { text: ' daily', flagged: false },
    ]);
    expect(highlight('plain', [])).toEqual([{ text: 'plain', flagged: false }]);
  });
});
