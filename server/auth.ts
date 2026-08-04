import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";

const runtimeAuthSecret = randomBytes(48).toString("hex");

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET or SESSION_SECRET must be configured in production");
  }
  return runtimeAuthSecret;
}

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured in production");
  }
  console.warn("[session] SESSION_SECRET is not set; using a development-only fallback secret.");
  return "jcmoves-dev-session-secret";
}

export function getSession() {
  const sessionTtl = 90 * 24 * 60 * 60 * 1000; // 90 days (3 months)
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  console.log(`[SESSION] Cookie configuration: name=jc.sid, secure=auto, sameSite=lax, environment=${process.env.NODE_ENV}`);
  
  return session({
    name: 'jc.sid',
    secret: getSessionSecret(),
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: 'auto' as any,
      sameSite: 'lax',
      maxAge: sessionTtl,
      path: '/',
    },
  });
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  
  console.log('✅ Session management setup completed');
}

export function signJwt(userId: string, role: string): string {
  return jwt.sign({ userId, role }, getJwtSecret(), { expiresIn: "90d" });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, getJwtSecret(), { expiresIn: "180d" });
}

export function verifyRefreshToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as any;
    if (payload.type !== "refresh") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

async function lookupUserById(userId: string, res: any): Promise<any | null> {
  try {
    const { db } = await import('./db');
    const { users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!dbUser) {
      console.log('[AUTH CHECK] ❌ User not found in database');
      res.status(401).json({ message: "Unauthorized" });
      return null;
    }

    return dbUser;
  } catch (error) {
    console.error('[AUTH CHECK] Database error:', error);
    res.status(500).json({ message: "Authentication check failed" });
    return null;
  }
}

async function lookupSessionUser(req: any, res: any): Promise<any | null> {
  // 1. Try JWT Bearer token first (for mobile apps and cross-platform clients)
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, getJwtSecret()) as any;
      if (payload?.userId) {
        console.log('[AUTH CHECK] 🔑 JWT auth — userId:', payload.userId);
        return await lookupUserById(payload.userId, res);
      }
    } catch (err) {
      console.log('[AUTH CHECK] ❌ Invalid JWT token:', (err as Error).message);
      res.status(401).json({ message: "Invalid or expired token. Please log in again." });
      return null;
    }
  }

  // 2. Fall back to session cookie (for web browsers)
  const hasCookie = !!(req.cookies?.['jc.sid'] || req.headers.cookie?.includes('jc.sid'));
  console.log('[AUTH CHECK] Path:', req.path, '| Session ID:', req.sessionID?.slice(0, 8) || 'none', '| Has cookie:', hasCookie);
  
  const sessionUserId = (req.session as any).userId;
  
  if (!sessionUserId) {
    console.log('[AUTH CHECK] ❌ No session user ID found');
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }

  return await lookupUserById(sessionUserId, res);
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const dbUser = await lookupSessionUser(req, res);
  if (!dbUser) return;

  if (dbUser.status === 'pending') {
    console.log('[AUTH CHECK] ❌ User status is pending');
    return res.status(403).json({ 
      message: "Account pending approval", 
      status: "pending" 
    });
  }

  const validStatuses = ['approved', 'active'];
  if (!validStatuses.includes(dbUser.status || '')) {
    console.log('[AUTH CHECK] ❌ User status is not valid:', dbUser.status);
    return res.status(403).json({ 
      message: "Account access restricted", 
      status: dbUser.status 
    });
  }

  (req as any).user = dbUser;
  console.log('[AUTH CHECK] ✅ User authenticated and approved:', dbUser.role);
  return next();
};

export const isAuthenticatedAllowPending: RequestHandler = async (req, res, next) => {
  const dbUser = await lookupSessionUser(req, res);
  if (!dbUser) return;

  const validStatuses = ['approved', 'active', 'pending'];
  if (!validStatuses.includes(dbUser.status || '')) {
    console.log('[AUTH CHECK] ❌ User status is not valid:', dbUser.status);
    return res.status(403).json({ 
      message: "Account access restricted", 
      status: dbUser.status 
    });
  }

  (req as any).user = dbUser;
  console.log('[AUTH CHECK] ✅ User authenticated (allow pending):', dbUser.role, 'status:', dbUser.status);
  return next();
};
