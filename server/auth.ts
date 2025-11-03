import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";

export function getSession() {
  const sessionTtl = 90 * 24 * 60 * 60 * 1000; // 90 days (3 months)
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  // Cookie security configuration
  const useSecureCookies = process.env.NODE_ENV === 'production';
  
  console.log(`[SESSION] Cookie configuration: secure=${useSecureCookies}, environment=${process.env.NODE_ENV}`);
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  
  console.log('✅ Session management setup completed');
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  console.log('[AUTH CHECK] Path:', req.path);
  console.log('[AUTH CHECK] Session ID:', req.sessionID || 'No session ID');
  
  // Check for email/password session
  const sessionUserId = (req.session as any).userId;
  
  if (!sessionUserId) {
    console.log('[AUTH CHECK] ❌ No session user ID found');
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // User authenticated via email/password - check status
  try {
    const { db } = await import('./db');
    const { users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, sessionUserId))
      .limit(1);

    if (!dbUser) {
      console.log('[AUTH CHECK] ❌ Session user not found in database');
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (dbUser.status === 'pending') {
      console.log('[AUTH CHECK] ❌ User status is pending');
      return res.status(403).json({ 
        message: "Account pending approval", 
        status: "pending" 
      });
    }

    if (dbUser.status !== 'approved') {
      console.log('[AUTH CHECK] ❌ User status is not approved:', dbUser.status);
      return res.status(403).json({ 
        message: "Account access restricted", 
        status: dbUser.status 
      });
    }

    console.log('[AUTH CHECK] ✅ User authenticated and approved');
    return next();
  } catch (error) {
    console.error('[AUTH CHECK] Database error:', error);
    return res.status(500).json({ message: "Authentication check failed" });
  }
};
