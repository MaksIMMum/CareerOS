import { createCrudHandler } from '../lib/crud.js';
import { vacancyRepo } from '../lib/repos.js';
import { vacancyInputSchema } from '../lib/validation.js';

export const handler = createCrudHandler(vacancyRepo, vacancyInputSchema);
