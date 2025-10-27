import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// CRITICAL SECURITY: Handle webhook routes BEFORE global JSON parser
// This preserves raw body bytes needed for HMAC signature validation
app.use('/api/advertising/webhook', express.raw({ type: 'application/json' }));

// Increase body size limit to support video uploads (50MB videos become ~66MB as base64)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
      
      // Log cookie headers for debugging
      const setCookie = res.getHeader('Set-Cookie');
      if (setCookie) {
        console.log('[COOKIE] Set-Cookie header sent:', setCookie);
      }
    }
  });

  next();
});

(async () => {
  let server;
  try {
    // Initialize server with comprehensive error handling
    console.log('Initializing application server...');
    server = await registerRoutes(app);
    console.log('Application routes registered successfully');

    // Serve static files from attached_assets directory with proper video support
    app.use('/attached_assets', express.static(path.resolve(process.cwd(), 'attached_assets'), {
      setHeaders: (res, filePath) => {
        // Set proper MIME types and caching for video files
        if (filePath.endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        } else if (filePath.endsWith('.webm')) {
          res.setHeader('Content-Type', 'video/webm');
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
      }
    }));

    // Setup Vite for development or serve static files for production
    if (app.get("env") === "development") {
      console.log('Setting up Vite development server...');
      await setupVite(app, server);
      console.log('Vite development server configured successfully');
    } else {
      console.log('Configuring static file serving for production...');
      serveStatic(app);
      console.log('Static file serving configured successfully');
    }

    // Error handling middleware should be last to catch all errors
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      // If headers are already sent, pass to default Express error handler
      if (res.headersSent) {
        return next(err);
      }

      const status = err.status || err.statusCode || 500;
      
      // Sanitize error messages for production 5xx errors
      let message: string;
      if (status >= 500 && process.env.NODE_ENV === "production") {
        message = "Internal Server Error";
      } else {
        message = err.message || "Internal Server Error";
      }

      // Log the error for debugging and monitoring
      console.error(`Error ${status} on ${req.method} ${req.path}:`, err.message);
      
      // In development, log the full stack trace
      if (process.env.NODE_ENV === "development") {
        console.error("Full error stack:", err.stack);
      }

      res.status(status).json({ message });
    });

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    console.log(`Starting server on port ${port}...`);
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      console.log('✅ JC ON THE MOVE application started successfully');
      log(`serving on port ${port}`);
    });

  } catch (error) {
    console.error('❌ Failed to initialize JC ON THE MOVE application:');
    console.error('Error details:', error);
    
    // In deployment, log detailed error but continue gracefully
    if (process.env.NODE_ENV === 'production') {
      console.error('Application startup failed in production. Check configuration.');
      console.error('Common issues: Invalid environment variables, database connection, or service configurations');
    }
    
    // Don't exit in development for better debugging
    if (process.env.NODE_ENV !== 'development') {
      console.error('Exiting due to startup failure...');
      process.exit(1);
    }
  }
})();
