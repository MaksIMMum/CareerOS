import { createResourceRepo } from './items.js';
import { LIMITS, type CvInput, type VacancyInput } from './validation.js';

// Items: PK=USER#<sub>, SK=CV#<id>  { id, name, text, createdAt, updatedAt }
export const cvConfig = {
  prefix: 'CV',
  listAttributes: ['id', 'name', 'createdAt', 'updatedAt'],
  maxItems: LIMITS.MAX_CVS_PER_USER,
};
export const cvRepo = createResourceRepo<CvInput>(cvConfig);

// Items: PK=USER#<sub>, SK=VACANCY#<id>  { id, title, company, url, text, createdAt, updatedAt }
export const vacancyConfig = {
  prefix: 'VACANCY',
  listAttributes: ['id', 'title', 'company', 'url', 'createdAt', 'updatedAt'],
  maxItems: LIMITS.MAX_VACANCIES_PER_USER,
};
export const vacancyRepo = createResourceRepo<VacancyInput>(vacancyConfig);
