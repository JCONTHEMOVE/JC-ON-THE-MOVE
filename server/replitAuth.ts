import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { cryptoService } from "./services/crypto";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
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
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production with custom domains
      sameSite: 'lax', // CSRF protection
      maxAge: sessionTtl,
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
  // Get real-time JCMOVES price for signup bonus calculation
  let currentTokenPrice: number | undefined;
  let riskLimits: { shouldHaltDistributions: boolean; maxSafeTokens: number; riskLevel: string } | undefined;
  
  try {
    const priceData = await cryptoService.getCurrentPrice();
    currentTokenPrice = priceData.price;
    
    // CRITICAL: Get volatility and risk assessment for circuit breaker enforcement
    const volatilityCheck = await cryptoService.checkPriceVolatility();
    
    // Simple risk assessment logic (mirroring treasury service logic)
    let shouldHalt = false;
    let maxSafeTokens = 1000000; // Large default
    
    if (Math.abs(volatilityCheck.changePercent) > 20) {
      shouldHalt = true; // Extreme volatility
    } else if (Math.abs(volatilityCheck.changePercent) > 10) {
      maxSafeTokens = 500; // High volatility - reduce signup bonus if it exceeds this
    } else if (Math.abs(volatilityCheck.changePercent) > 5) {
      maxSafeTokens = 750; // Medium volatility - mild reduction
    }
    
    riskLimits = {
      shouldHaltDistributions: shouldHalt,
      maxSafeTokens,
      riskLevel: Math.abs(volatilityCheck.changePercent) > 20 ? 'extreme' : 
                Math.abs(volatilityCheck.changePercent) > 10 ? 'high' :
                Math.abs(volatilityCheck.changePercent) > 5 ? 'medium' : 'low'
    };
    
  } catch (error) {
    console.error("Failed to get real-time JCMOVES price/volatility for signup bonus:", error);
    
    // CRITICAL: Fail-safe behavior - HALT distributions when telemetry fails
    riskLimits = {
      shouldHaltDistributions: true,
      maxSafeTokens: 0,
      riskLevel: 'unknown_error'
    };
    console.warn("Circuit breaker activated due to telemetry failure - signup bonus will be halted as safety measure");
  }
  
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  }, currentTokenPrice, riskLimits);
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Get domains from environment and add localhost for development
  const domains = process.env.REPLIT_DOMAINS!.split(",").map(d => d.trim());
  
  // Add localhost for development if not already present
  if (process.env.NODE_ENV === 'development' && !domains.includes('localhost:5000')) {
    domains.push('localhost:5000');
  }
  
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

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Handle localhost with port for development
    const hostname = req.hostname === 'localhost' ? 'localhost:5000' : req.hostname;
    console.log(`Login attempt for hostname: ${hostname}, original: ${req.hostname}`);
    passport.authenticate(`replitauth:${hostname}`, {
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Handle localhost with port for development
    const hostname = req.hostname === 'localhost' ? 'localhost:5000' : req.hostname;
    console.log(`Callback for hostname: ${hostname}, original: ${req.hostname}`);
    passport.authenticate(`replitauth:${hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
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
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

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