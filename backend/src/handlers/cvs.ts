import { createCrudHandler } from '../lib/crud.js';
import { createResourceRepo } from '../lib/items.js';
import { cvInputSchema, LIMITS, type CvInput } from '../lib/validation.js';

// Items: PK=USER#<sub>, SK=CV#<id>  { id, name, text, createdAt, updatedAt }
export const cvRepo = createResourceRepo<CvInput>({
  prefix: 'CV',
  listAttributes: ['id', 'name', 'createdAt', 'updatedAt'],
  maxItems: LIMITS.MAX_CVS_PER_USER,
});

export const handler = createCrudHandler(cvRepo, cvInputSchema);
