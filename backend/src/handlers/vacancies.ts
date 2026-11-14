import { createCrudHandler } from '../lib/crud.js';
import { createResourceRepo } from '../lib/items.js';
import { vacancyInputSchema, LIMITS, type VacancyInput } from '../lib/validation.js';

// Items: PK=USER#<sub>, SK=VACANCY#<id>  { id, title, company, url, text, createdAt, updatedAt }
export const vacancyRepo = createResourceRepo<VacancyInput>({
  prefix: 'VACANCY',
  listAttributes: ['id', 'title', 'company', 'url', 'createdAt', 'updatedAt'],
  maxItems: LIMITS.MAX_VACANCIES_PER_USER,
});

export const handler = createCrudHandler(vacancyRepo, vacancyInputSchema);
