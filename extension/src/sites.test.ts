import { describe, expect, it } from 'vitest';
import { isVacancyUrl, readVacancy, siteOf, vacancyFromSelection } from './sites.js';
import { vacancyKey } from './chromeApi.js';

const JSON_LD_PAGE = `<script type="application/ld+json">${JSON.stringify({
  '@type': 'JobPosting',
  title: 'Junior Node.js Developer',
  hiringOrganization: { name: 'Acme' },
  description: '<p>Вимоги:</p><ul><li>Node.js</li><li>SQL</li></ul>',
})}</script>`;

describe('siteOf / isVacancyUrl', () => {
  it('recognises vacancy pages on the supported sites', () => {
    expect(isVacancyUrl('https://djinni.co/jobs/787644-intern-front-end-developer/')).toBe(true);
    expect(isVacancyUrl('https://jobs.dou.ua/companies/softjourn/vacancies/379833/')).toBe(true);
    expect(isVacancyUrl('https://www.work.ua/jobs/7000000/')).toBe(true);
    expect(isVacancyUrl('https://www.work.ua/ru/jobs/7000000/')).toBe(true);
  });

  it('ignores lists, other pages and other sites', () => {
    expect(isVacancyUrl('https://djinni.co/jobs/?primary_keyword=JavaScript')).toBe(false);
    expect(isVacancyUrl('https://jobs.dou.ua/vacancies/?category=Node.js')).toBe(false);
    expect(isVacancyUrl('https://www.work.ua/jobs-it/')).toBe(false);
    expect(isVacancyUrl('https://example.com/jobs/1')).toBe(false);
    expect(isVacancyUrl(undefined)).toBe(false);
    expect(siteOf('http://djinni.co/jobs/1/')).toBeNull();
    expect(siteOf('https://djinni.co.evil.com/jobs/1/')).toBeNull();
  });
});

describe('readVacancy', () => {
  it('reads the vacancy from the page HTML with the shared parsers', () => {
    expect(readVacancy({ url: 'https://djinni.co/jobs/1-x/', html: JSON_LD_PAGE })).toEqual({
      title: 'Junior Node.js Developer',
      company: 'Acme',
      url: 'https://djinni.co/jobs/1-x/',
      text: 'Вимоги:\n\n• Node.js\n• SQL',
      site: 'djinni.co',
    });
  });

  it('reads a Work.ua page by its HTML when there is no JSON-LD', () => {
    const html = '<h1 id="h1-name">Junior QA</h1><a href="/jobs/by-company/1/">Acme</a><div id="job-description"><p>Тестування</p><ul><li>Postman</li></ul></div>';
    expect(readVacancy({ url: 'https://www.work.ua/jobs/1/', html })).toMatchObject({ title: 'Junior QA', company: 'Acme', text: 'Тестування\n\n• Postman' });
  });

  it('returns null when the page has no vacancy or is not supported', () => {
    expect(readVacancy({ url: 'https://djinni.co/jobs/1/', html: '<html></html>' })).toBeNull();
    expect(readVacancy({ url: 'https://example.com/', html: JSON_LD_PAGE })).toBeNull();
  });

  it('clips long fields to the API limits', () => {
    const html = JSON_LD_PAGE.replace('Junior Node.js Developer', 'J'.repeat(400));
    expect(readVacancy({ url: 'https://djinni.co/jobs/1/', html })!.title).toHaveLength(150);
  });
});

describe('vacancyFromSelection', () => {
  it('uses the selected text and the page title without the site name', () => {
    const v = vacancyFromSelection({
      url: 'https://djinni.co/jobs/1/',
      title: 'Intern front-end developer в King Group – Djinni',
      selection: '  Вимоги: JavaScript, HTML, CSS. Бажано знання React або Vue.  ',
    });
    expect(v).toMatchObject({ title: 'Intern front-end developer в King Group', text: 'Вимоги: JavaScript, HTML, CSS. Бажано знання React або Vue.' });
  });

  it('needs a meaningful selection on a supported site', () => {
    expect(vacancyFromSelection({ url: 'https://djinni.co/jobs/1/', title: 'x', selection: 'short' })).toBeNull();
    expect(vacancyFromSelection({ url: 'https://example.com/', title: 'x', selection: 'x'.repeat(100) })).toBeNull();
  });
});

describe('vacancyKey', () => {
  it('maps the same vacancy to one key', () => {
    expect(vacancyKey('https://www.work.ua/jobs/1/?utm=x#top')).toBe('work.ua/jobs/1');
    expect(vacancyKey('https://djinni.co/jobs/1-x')).toBe(vacancyKey('https://djinni.co/jobs/1-x/'));
  });
});
