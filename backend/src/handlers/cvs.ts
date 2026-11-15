import { createCrudHandler } from '../lib/crud.js';
import { cvRepo } from '../lib/repos.js';
import { cvInputSchema } from '../lib/validation.js';

export const handler = createCrudHandler(cvRepo, cvInputSchema);
