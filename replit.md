# Overview

This full-stack application provides a comprehensive moving and junk removal service platform. It enables customers to request quotes for residential moving, commercial moving, and junk removal services. The system features a business operations dashboard, automated email notifications, role-based authentication, and employee job assignment capabilities. Built with React, TypeScript, Express.js, and Drizzle ORM, it utilizes a modern, responsive design with shadcn/ui components. The project also integrates Solana blockchain for treasury management, including live token pricing, balance verification, and reconciliation of JCMOVES tokens.

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

## UI/UX Decisions
- Modern, responsive design.
- Live price cards with gradient backgrounds and trend indicators.
- Unified mining dashboard displaying streak count and bonus previews.
- Non-dismissible modal for age and TOS compliance.
- "Add a Job" button for employees on mobile dashboard.

## Technical Implementations
- Consolidated daily check-in and passive mining into a unified system with linear streak bonuses.
- Implemented employee job creation with bonus rewards for creators.
- Integrated Solana blockchain for treasury management, including real-time balance verification, reconciliation, and deposit recording.
- Real-time JCMOVES token pricing via DexScreener API with fallback mechanism.

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