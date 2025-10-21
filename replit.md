# Overview

This full-stack application provides a comprehensive solution for a moving and junk removal service. Built with React, TypeScript, Express.js, and Drizzle ORM, it enables customers to request quotes for residential moving, commercial moving, and junk removal. The system features a robust administrative dashboard for managing operations, including automated email notifications, role-based authentication, employee job assignment, and real-time monitoring of a treasury wallet via Solscan.io. Key business ambitions include streamlining service requests, optimizing internal workflows, and integrating blockchain-based token rewards for employees.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite.
- **Routing**: Wouter for lightweight client-side routing.
- **UI Components**: shadcn/ui library built on Radix UI primitives, styled with Tailwind CSS.
- **State Management**: TanStack Query (React Query) for server state.
- **Forms**: React Hook Form with Zod validation.

## Backend Architecture
- **Server**: Express.js with TypeScript.
- **Database ORM**: Drizzle ORM with PostgreSQL dialect.
- **Session Management**: Express sessions with PostgreSQL store (connect-pg-simple).
- **API Design**: RESTful API with error handling and request logging.
- **Build System**: ESBuild for production bundling.

## Database Schema
- **Data Models**: `leads` (quote requests, customer info, service details, employee assignments, status tracking), `contacts` (contact form submissions), `users` (role-based authentication: admin, employee, customer).
- **Status Management**: Leads progress through predefined states (e.g., new, contacted, quoted, confirmed, in_progress, completed).
- **Job Assignment**: Tracks employee assignments for jobs.
- **Mining Sessions**: Stores `lastClaimDate` and `streakCount` for unified mining rewards with linear streak bonuses.

## Core Features & Implementations
- **Quote Request System**: Allows customers to request various moving and junk removal services.
- **Lead Management**: Comprehensive lead editing, status tracking, and workflow progression (e.g., New → Edited → Contacted → Quoted → Confirmed → Available → Accepted → In Progress → Completed).
- **Employee Job Creation**: Employees can submit job requests on behalf of customers, with tracking of the `createdByUserId`.
- **Job Assignment & Acceptance**: Employees are assigned to jobs; jobs require all assigned crew members to accept before starting.
- **Reward System**: Automated rewards distribution on job completion, including base rewards, on-time bonuses, customer rating bonuses, and creator bonuses (50% of completing employee's rewards for the employee who created the job).
- **Unified Mining System**: Consolidates daily check-ins and passive mining into a single system with linear streak bonuses (1% per consecutive claim day, no cap).
- **Treasury Management**:
    - **Solscan.io Integration**: Real-time treasury wallet monitoring, balance synchronization, and transaction verification using the Solscan.io API.
    - **Verification Dashboard**: Admin page displaying live blockchain balance, transaction verification status, deposit history, and one-click balance sync.
    - **Data Integrity**: Compares on-chain deposits with database records to detect unrecorded transactions.
- **Database Migration Bridge**: Includes scripts for safe database backups, restores, interactive production synchronization, and schema comparison.
- **Authentication & Security**: OIDC-based Replit Auth, role-based access control (admin, employee, customer), route protection, input validation with Zod, and parameterized queries with Drizzle ORM.
- **Age Verification & TOS**: Mandatory age verification (18+) and Terms of Service acceptance with a non-dismissible modal and dedicated `/terms` page.
- **Deployment**: Static asset generation, environment variable configuration, Drizzle Kit for migrations, and graceful server startup.

## UI/UX Decisions
- Modern, responsive design using shadcn/ui components.
- Live token pricing display with auto-refresh and trend indicators.
- Visual indicators for job creator bonuses and lead statuses.

# External Dependencies

## Database
- **Neon Database**: Serverless PostgreSQL database.
- **Drizzle Kit**: For schema management and migrations.

## Email Service
- **SendGrid**: For transactional email delivery and notifications.

## UI Components
- **Radix UI**: Foundational component library.
- **Lucide React**: Icon library.
- **shadcn/ui**: Pre-built component system.

## External APIs
- **Solscan.io API**: For real-time Solana blockchain data (treasury monitoring, transaction verification).
- **DexScreener API**: For live JCMOVES token pricing data (with a fallback mechanism).

## Development Tools
- **Vite**: Development server and build tool.
- **TypeScript**: For static type checking.
- **ESLint/Prettier**: For code formatting and linting.
- **PostCSS**: For CSS processing (including Tailwind CSS and Autoprefixer).