import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { verifyToken, type JWTPayload } from '../lib/jwt';

type Variables = {
  user: JWTPayload;
};

// Attach verified user to context — used on all protected routes
export const jwtMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.slice(7);
    try {
      const payload = await verifyToken(token);
      c.set('user', payload);
      await next();
    } catch {
      throw new HTTPException(401, { message: 'Invalid or expired token' });
    }
  }
);

// Role guard — use after jwtMiddleware
export const requireRole = (role: 'admin' | 'user') =>
  createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.get('user');
    if (user.role !== role) {
      throw new HTTPException(403, { message: 'Forbidden: insufficient permissions' });
    }
    await next();
  });
