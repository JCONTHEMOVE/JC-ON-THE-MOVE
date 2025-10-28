# Overview

This full-stack application provides a comprehensive moving and junk removal service platform. It enables customers to request quotes for residential moving, commercial moving, and junk removal services. The system features a business operations dashboard, automated email notifications, role-based authentication, and employee job assignment capabilities. Built with React, TypeScript, Express.js, and Drizzle ORM, it utilizes a modern, responsive design with shadcn/ui components. The project integrates Solana blockchain for treasury management with the unified "IN GOD WE TRUST" dashboard consolidating all admin operations: token transfers, treasury deposits, live blockchain monitoring, and business analytics.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite.
- **Routing**: Wouter for lightweight client-side routing.
- **UI Components**: shadcn/ui built on Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables.
- **State Management**: TanStack Query for server state.
- **Forms**: React Hook Form with Zod validation.

## Backend Architecture
- **Server**: Express.js with TypeScript.
- **Database ORM**: Drizzle ORM with PostgreSQL dialect.
- **Session Management**: Express sessions with PostgreSQL store.
- **API Design**: RESTful API with error handling and logging.
- **Build System**: ESBuild for production bundling.

## Database Schema
- **Leads**: Stores quote requests, customer info, service details, status, and employee assignments.
- **Contacts**: Stores general contact form submissions.
- **Users**: Role-based authentication (admin, employee, customer).
- **Status Management**: Leads progress through defined states (new to completed).
- **Job Assignment**: Tracks employee job delegation.
- **Mining Sessions**: Tracks user mining activity, including `lastClaimDate` and `streakCount` for streak bonuses.

## Email Integration
- **Service**: SendGrid for transactional emails.
- **Notifications**: Automated alerts for new leads and contacts.
- **Templates**: HTML and text email templates.

## Authentication & Security
- **Replit Auth**: OIDC-based authentication.
- **Session Duration**: 90 days (3 months) for extended user sessions.
- **Role-Based Access Control**: Admin and employee roles with distinct permissions.
- **Route Protection**: Role-specific middleware.
- **Data Isolation**: Employees access available jobs and their own assignments.
- **CORS**: Express CORS middleware.
- **Input Validation**: Zod schemas.
- **Database Security**: Parameterized queries and atomic job assignment.
- **Compliance**: Mandatory age verification (18+) and Terms of Service acceptance.

## Deployment Architecture
- **Production Build**: Static asset generation with Express serving SPA.
- **Environment Variables**: Managed for database, SendGrid, and company email.
- **Database Migrations**: Drizzle Kit for schema management.
- **Graceful Startup**: Error handling prevents service failures from blocking server startup.
- **Production Configuration**: `NODE_ENV=production` for optimized builds.
- **Domain Configuration**: `REPLIT_DOMAINS` for multi-domain authentication.
- **Health Check Endpoint**: `/health` endpoint for Autoscale Deployment monitoring.
- **Media Asset Storage**: Large media files (>50MB) stored in Replit Object Storage to bypass deployment file size limits. Files uploaded to the `public` directory are served at `/public/<filename>` in both development and production.

### Required Environment Variables for Deployment
- **SENDGRID_API_KEY**: Must be a valid SendGrid API key starting with `SG.` (e.g., `SG.xxxxxxxxxxxxx`). If not provided or invalid, email notifications will be disabled but the app will continue to function.
- **VITE_SOLANA_RPC_URL**: Must be a valid HTTP/HTTPS URL pointing to a Solana RPC endpoint (e.g., `https://api.mainnet-beta.solana.com` or `https://api.devnet.solana.com`). This is a frontend environment variable bundled at build time.
- **DATABASE_URL**: PostgreSQL connection string (automatically provided by Replit).
- **NODE_ENV**: Set to `production` for deployment builds.
- **REPLIT_DOMAINS**: Comma-separated list of allowed authentication domains (automatically managed by Replit).

## UI/UX Decisions
- Modern, responsive design.
- Live price cards with gradient backgrounds and trend indicators.
- Unified mining dashboard displaying streak count and bonus previews.
- Non-dismissible modal for age and TOS compliance.
- "Add a Job" button for employees on mobile dashboard.
- **"IN GOD WE TRUST" Dashboard**: Unified admin interface replacing separate Treasury, Admin, and Moonshot pages with tabbed navigation (Operations, Transfers, Deposits, Analytics, Reconcile).
- **Gradient Navigation**: "IN GOD WE TRUST" link uses blue-to-purple gradient for visual prominence.
- **Clickable Users Card**: Orange "System" card with total users count is clickable, navigating to `/admin/users` with hover effects for better UX.
- **Simplified Navigation**: Removed redundant "Users" tab from header navigation; admins access user management via clickable card in "IN GOD WE TRUST" dashboard.

## Technical Implementations
- Consolidated daily check-in and passive mining into a unified system with linear streak bonuses.
- Implemented employee job creation with bonus rewards for creators.
- Integrated Solana blockchain for treasury management, including real-time balance verification, reconciliation, and deposit recording.
- Real-time JCMOVES token pricing via DexScreener API with fallback mechanism.
- **Token Transfer System**: `/api/treasury/transfer` endpoint enables wallet-to-wallet JCMOVES transfers with validation, balance checks, and database tracking.
- **Unified Admin Dashboard**: "IN GOD WE TRUST" page consolidates all admin features with tab-based navigation, live blockchain stats, and discrepancy alerts.
- **Dedicated Reconcile Tab**: Added "Reconcile" tab to "IN GOD WE TRUST" dashboard with side-by-side blockchain/database balance comparison and one-click reconciliation button.
- **Streamlined Navigation**: Removed legacy `/treasury`, `/admin`, and `/admin-moonshot` routes in favor of single unified entry point. Removed redundant "Users" navigation tab from header.
- **Total Earnings Fix**: Admin user details endpoint (`/api/admin/users/:id/details`) now correctly calculates total earnings from ALL rewards instead of only the last 10.
- **AI Crew Assignment Assistant**: Intelligent algorithm suggests optimal crew assignments based on employee workload, performance ratings, experience, and job requirements. Scoring system considers active jobs (-15 pts each), ratings (+20 max), experience (+30 max), and special items handling (+10).

# External Dependencies

## Database
- **Neon Database**: Serverless PostgreSQL database (`@neondatabase/serverless`).
- **Migration System**: Drizzle Kit.

## Email Service
- **SendGrid**: Email delivery service (`@sendgrid/mail`).

## UI Components
- **Radix UI**: Primitive component library.
- **Lucide React**: Icon library.
- **shadcn/ui**: Pre-built component system.

## Development Tools
- **Vite**: Development server and build tool.
- **TypeScript**: Static type checking.
- **ESLint/Prettier**: Code formatting and linting.
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer.

## Blockchain Integration
- **Solana Blockchain**: For JCMOVES token treasury and transaction history.
- **DexScreener API**: For live JCMOVES token pricing data.