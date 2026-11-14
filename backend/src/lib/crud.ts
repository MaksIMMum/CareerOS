import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { z } from 'zod';
import { getSub, HttpError, json, parseId, parseJsonBody, withErrorHandling } from './http.js';
import type { ResourceRepo } from './items.js';

/**
 * One Lambda per resource:  GET /x · POST /x · GET /x/{id} · PUT /x/{id} · DELETE /x/{id}.
 * PUT replaces all editable fields (the body is validated with the same schema as POST).
 */
export function createCrudHandler<T extends Record<string, unknown>>(
  repo: ResourceRepo<T>,
  schema: z.ZodType<T>,
): (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2> {
  return withErrorHandling(async (event) => {
    const sub = getSub(event);
    const method = event.requestContext.http.method.toUpperCase();
    const hasId = event.pathParameters?.id !== undefined;

    if (!hasId && method === 'GET') return json(200, { items: await repo.list(sub) });
    if (!hasId && method === 'POST') {
      return json(201, { item: await repo.create(sub, parseJsonBody(event, schema)) });
    }
    if (hasId) {
      const id = parseId(event);
      if (method === 'GET') return json(200, { item: await repo.get(sub, id) });
      if (method === 'PUT') {
        return json(200, { item: await repo.update(sub, id, parseJsonBody(event, schema)) });
      }
      if (method === 'DELETE') {
        await repo.remove(sub, id);
        return json(204);
      }
    }
    throw new HttpError(405, 'method_not_allowed');
  });
}
