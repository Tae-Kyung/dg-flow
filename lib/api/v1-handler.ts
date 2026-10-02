import { NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse, type ApiKeyUser } from '@/lib/auth/api-key';

export async function withApiKey(
  request: Request,
  handler: (user: ApiKeyUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await validateApiKey(request);
  if (!user) {
    return unauthorizedResponse('Invalid or expired API key');
  }

  const response = await handler(user);

  // Add CORS headers for external access
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  return response;
}
