import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);

export interface JWTPayload {
  sub: string; // userId
  email: string;
  role: 'user' | 'admin';
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    role: payload.role as 'user' | 'admin',
  };
}
