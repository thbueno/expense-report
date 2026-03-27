import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users } from '../db/schema';
import { signToken } from '../lib/jwt';
import { SignupBody, LoginBody } from '@expense-report/shared';

export const authRouter = new Hono();

authRouter.post('/signup', zValidator('json', SignupBody), async (c) => {
  const { email, password, role } = c.req.valid('json');

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return c.json({ success: false, error: 'Email already registered' }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, role: role ?? 'user' })
    .returning({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt });

  const token = await signToken({ sub: user.id, email: user.email, role: user.role });

  return c.json(
    {
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt.toISOString() },
      },
    },
    201
  );
});

authRouter.post('/login', zValidator('json', LoginBody), async (c) => {
  const { email, password } = c.req.valid('json');

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  const token = await signToken({ sub: user.id, email: user.email, role: user.role });

  return c.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt.toISOString() },
    },
  });
});
