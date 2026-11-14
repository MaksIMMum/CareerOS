import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

// Public health check: GET /health -> { ok: true }.
// CORS headers are added by API Gateway (allowed origins configured in infra/).
export const handler: APIGatewayProxyHandlerV2 = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
