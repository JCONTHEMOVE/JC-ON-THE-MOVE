import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { cryptoService } from "./services/crypto";

// Gracefully handle missing REPLIT_DOMAINS - warn but don't crash
if (!process.env.REPLIT_DOMAINS) {
  console.warn("⚠️  WARNING: Environment variable REPLIT_DOMAINS not provided");
  console.warn("⚠️  Authentication may not work correctly without proper domain configuration");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Allow auto-creation for production safety
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  // Cookie security configuration
  // In production, always use secure cookies
  // In development, only use secure: false for actual localhost (not replit.app domains)
  const useSecureCookies = process.env.NODE_ENV === 'production' || 
                           !process.env.REPLIT_DOMAINS?.includes('localhost');
  
  console.log(`[SESSION] Cookie configuration: secure=${useSecureCookies}, environment=${process.env.NODE_ENV}`);
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: true, // Changed to true to ensure cookies are sent even for new sessions
    cookie: {
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: 'lax',
      maxAge: sessionTtl,
      domain: undefined,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  try {
    // Simplified user creation during authentication
    // Crypto API calls are moved to background/separate processes to prevent login failures
    await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    });
    
    // Note: Crypto price checks and risk assessment are now handled separately
    // to prevent authentication failures when external APIs are down
    console.log(`User authenticated successfully: ${claims["email"]}`);
    
  } catch (error) {
    console.error("Failed to upsert user during authentication:", error);
    // Re-throw the error to properly handle authentication failure
    throw error;
  }
}

export async function setupAuth(app: Express) {
  try {
    // Validate required environment variables
    if (!process.env.REPLIT_DOMAINS) {
      throw new Error("REPLIT_DOMAINS environment variable is required for authentication");
    }
    
    app.set("trust proxy", 1);
    app.use(getSession());
    app.use(passport.initialize());
    app.use(passport.session());

    const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(tokens.claims());
      verified(null, user);
    } catch (error) {
      console.error('Authentication verification failed:', error);
      verified(error);
    }
  };

  // Get domains from environment and add localhost for development
  const domains = process.env.REPLIT_DOMAINS!.split(",").map(d => d.trim());
  
  // Add localhost for development if not already present
  if (process.env.NODE_ENV === 'development' && !domains.includes('localhost:5000')) {
    domains.push('localhost:5000');
  }
  
  // Add the actual Replit domains for this app
  const replitDomain = `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  if (!domains.includes(replitDomain)) {
    domains.push(replitDomain);
  }
  
  // Also add the .replit.app domain which is commonly used
  const replitAppDomain = 'jconthemove.replit.app';
  if (!domains.includes(replitAppDomain)) {
    domains.push(replitAppDomain);
  }
  
  console.log('Configured authentication domains:', domains);
  
  // Add custom domain if not already included (for production)
  if (!domains.includes('jconthemove.com') && !domains.includes('www.jconthemove.com')) {
    domains.push('jconthemove.com');
    domains.push('www.jconthemove.com');
    console.log('Added custom domains: jconthemove.com, www.jconthemove.com');
  }
  
  for (const domain of domains) {
    const protocol = domain.includes('localhost') ? 'http' : 'https';
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `${protocol}://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => {
    cb(null, user);
  });
  passport.deserializeUser((user: Express.User, cb) => {
    cb(null, user);
  });

  app.get("/api/login", (req, res, next) => {
    // Define canonical domain for consistent session cookies
    const canonicalDomain = process.env.NODE_ENV === 'development' 
      ? 'localhost:5000' 
      : 'jconthemove.replit.app';
    
    // Handle localhost with port for development
    const hostname = req.hostname === 'localhost' ? 'localhost:5000' : req.hostname;
    
    // Redirect to canonical domain if accessing from a different domain
    if (hostname !== canonicalDomain) {
      const protocol = hostname.includes('localhost') ? 'http' : 'https';
      const roleParam = req.query.role ? `?role=${req.query.role}` : '';
      const canonicalUrl = `${protocol === 'http' ? 'http' : 'https'}://${canonicalDomain}/api/login${roleParam}`;
      console.log(`Redirecting from ${hostname} to canonical domain ${canonicalDomain} for consistent session`);
      return res.redirect(canonicalUrl);
    }
    
    // Store the requested role in session before authentication
    const requestedRole = req.query.role as string;
    if (requestedRole === 'customer' || requestedRole === 'employee') {
      (req.session as any).requestedRole = requestedRole;
      console.log(`Login attempt for hostname: ${hostname}, requested role: ${requestedRole}`);
    } else {
      console.log(`Login attempt for hostname: ${hostname}, no role specified (defaulting to employee)`);
    }
    
    // Check if user has previously consented (has existing session)
    const hasConsented = (req.session as any).hasConsented || false;
    
    passport.authenticate(`replitauth:${hostname}`, {
      scope: ["openid", "email", "profile", "offline_access"],
      // Don't force consent prompt if user has already consented
      prompt: hasConsented ? undefined : 'consent',
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Handle localhost with port for development
    const hostname = req.hostname === 'localhost' ? 'localhost:5000' : req.hostname;
    console.log(`Callback for hostname: ${hostname}, original: ${req.hostname}`);
    
    passport.authenticate(`replitauth:${hostname}`, async (err: any, user: any, info: any) => {
      if (err) {
        console.error('Authentication error:', err);
        return res.redirect("/api/login");
      }
      if (!user) {
        console.error('No user returned from authentication');
        return res.redirect("/api/login");
      }

      // Log in the user
      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          console.error('Login error:', loginErr);
          return res.redirect("/api/login");
        }

        // Mark that user has consented to save OAuth permissions
        (req.session as any).hasConsented = true;
        
        // Check if there's a requested role in the session
        const requestedRole = (req.session as any).requestedRole;
        const userClaims = (req.user as any)?.claims;
        if (requestedRole && userClaims?.sub) {
          try {
            const userId = userClaims.sub;
            const existingUser = await storage.getUser(userId);
            
            // Only update role if this is a new user (created in the last 5 seconds)
            // This prevents changing existing users' roles
            if (existingUser && existingUser.createdAt) {
              const userAge = Date.now() - new Date(existingUser.createdAt).getTime();
              if (userAge < 5000) { // Less than 5 seconds old = new user
                await storage.updateUserRole(userId, requestedRole);
                console.log(`Set role for new user ${existingUser.email}: ${requestedRole}`);
              }
            }
            
            // Clear the requested role from session
            delete (req.session as any).requestedRole;
          } catch (error) {
            console.error('Error setting user role:', error);
          }
        }

        res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
  
  console.log('✅ Authentication setup completed successfully');
  } catch (error) {
    console.error('❌ Authentication setup failed:', error);
    console.error('⚠️  Server will continue but authentication features will not work');
    console.error('⚠️  Please ensure REPLIT_DOMAINS environment variable is set correctly');
    
    // Setup basic routes that return errors when auth is not configured
    app.get("/api/login", (req, res) => {
      res.status(503).json({ 
        message: "Authentication not configured. Please set REPLIT_DOMAINS environment variable." 
      });
    });
    
    app.get("/api/callback", (req, res) => {
      res.status(503).json({ 
        message: "Authentication not configured." 
      });
    });
    
    app.get("/api/logout", (req, res) => {
      res.status(503).json({ 
        message: "Authentication not configured." 
      });
    });
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  
  console.log('[AUTH CHECK] Path:', req.path);
  console.log('[AUTH CHECK] Session ID:', req.sessionID || 'No session ID');
  console.log('[AUTH CHECK] req.isAuthenticated():', req.isAuthenticated());
  console.log('[AUTH CHECK] User object exists:', !!user);
  console.log('[AUTH CHECK] User expires_at:', user?.expires_at || 'No expires_at');
  console.log('[AUTH CHECK] Cookie header:', req.headers.cookie ? 'Present' : 'Missing');

  if (!req.isAuthenticated() || !user.expires_at) {
    console.log('[AUTH CHECK] ❌ Authentication failed');
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  console.log('[AUTH CHECK] ✅ User is authenticated');
  
  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    console.log('[AUTH CHECK] ✅ Token is valid, proceeding');
    return next();
  }
  
  console.log('[AUTH CHECK] Token expired, attempting refresh');

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    
    // Explicitly save session after token refresh to persist changes
    req.session.save((err) => {
      if (err) {
        console.error('Session save error after token refresh:', err);
        return res.status(401).json({ message: "Unauthorized" });
      }
      return next();
    });
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};