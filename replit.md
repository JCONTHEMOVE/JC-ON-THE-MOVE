# Overview

This is a full-stack moving and junk removal service website built with React, TypeScript, Express.js, and Drizzle ORM. The application allows customers to request quotes for residential moving, commercial moving, and junk removal services, while providing a comprehensive dashboard system for business operations. The system includes automated email notifications, role-based authentication, employee job assignment capabilities, and features a modern, responsive design using shadcn/ui components.

# Recent Changes

## Comprehensive Lead Editing & Workflow System (October 15, 2025)
- **Full Lead Editing**: Implemented comprehensive lead editing system allowing modification of all lead fields (customer info, service details, pricing, special items, status)
- **Workflow Enhancement**: Added 'edited' status to lead progression (New → Edited → Contacted → Quoted → Confirmed → Available → Accepted → In Progress → Completed)
- **Lead Edit Dialog**: Built LeadEditDialog component with complete form validation for all 40+ lead fields
  - Form uses z.coerce.number() for numeric fields to handle string-to-number conversion
  - Component remounts via key={lead?.id} to prevent stale values in Select components
  - useEffect hook resets form when lead changes to ensure clean state
- **API Endpoints**: Created PATCH `/api/leads/:id/edit` endpoint with comprehensive field updates and price calculations
- **Crew Acceptance System**: Enhanced crew acceptance tracking to require all crew members to accept before job can start
  - Added `crewAcceptances` field to track which employees have accepted
  - Job start endpoint validates full crew acceptance before allowing status change to 'in_progress'
- **Job Completion Workflow**: Implemented automatic rewards distribution on job completion
  - Base rewards: 100 points + 500 JCMOVES tokens per crew member
  - On-time bonus: +20% additional rewards
  - Customer rating bonus (4.0+): +30% additional rewards
  - Creator bonus: 50% of each completing employee's rewards (stacks for multiple crew members)
- **UI Enhancements**: Added edit buttons, status badges, and workflow controls to leads management interface
- **Production Ready**: Architect-approved implementation with all critical issues resolved (duplicate imports, numeric validation, stale form values)

## Live Token Pricing Integration (October 14, 2025)
- **Real-Time Price API**: Created `/api/crypto/live-price` endpoint for live JCMOVES pricing data
- **Auto-Refresh System**: Frontend polls price every 5 seconds for real-time updates
- **DexScreener Integration**: Switched from Moonshot API to DexScreener API for broader DEX coverage
- **Price Display**: Shows current price, 24h change %, volume, and trend indicators (↑/↓)
- **Fallback Mechanism**: Uses hardcoded price ($0.00000508432) when APIs unavailable
- **UI Enhancement**: Live price card with gradient background, trend icons, and timestamp
- **Token Status**: JCMOVES currently uses fallback price (token may be Moonshot-exclusive, not yet on public DEXes)

## Unified Mining System with Streak Bonuses (October 14, 2025)
- **System Consolidation**: Merged separate daily check-in and passive mining systems into one unified mining reward system
- **Linear Streak Bonuses**: Implemented 1% bonus per consecutive day of claims with no cap (Day 1=1.0x, Day 2=1.01x, Day 3=1.02x, etc.)
- **Database Schema**: Added `lastClaimDate` and `streakCount` fields to `mining_sessions` table for streak tracking
- **Unlimited Growth**: Removed 3x multiplier cap - users can build unlimited streaks (e.g., Day 2,150 = 22.49x multiplier)
- **Backend Changes**:
  - Updated `MiningService.calculateStreakBonus()` with linear scaling formula
  - Removed daily check-in API routes (`/api/rewards/checkin/*`)
  - Updated admin stats endpoint to query `miningClaims` instead of `dailyCheckins`
- **Frontend Changes**:
  - Mining dashboard displays current streak count and bonus preview
  - Claim success toast shows streak bonus breakdown
  - Removed CheckinStatus interface and check-in UI components
- **Legacy Data**: `daily_checkins` table preserved for historical data but marked as deprecated

## Employee Job Creation Feature (October 7, 2025)
- **Employee Job Submission**: Added "Add a Job" button to Employee Dashboard Jobs tab for employees to submit job requests on behalf of customers
- **Job Tracking**: Added `createdByUserId` field to leads table to track which employee created each job
- **Reward System**: Employees earn 50% bonus rewards when jobs they created are confirmed and completed by other employees
  - Base completion reward: 100 points + 500 JCMOVES tokens
  - On-time bonus: +20% (120 points, 600 tokens)
  - Customer rating bonus (4.0+): +30% (130 points, 650 tokens)
  - Both bonuses: 150 points, 750 tokens
  - Creator receives 50% of each completing employee's rewards (stacks for multiple crew members)
- **API Endpoint**: Created `/api/leads/employee` endpoint for employee job submissions with proper tracking
- **Email Notifications**: Email alerts indicate when jobs are employee-created with creator information
- **Cache Management**: Updated query invalidation to refresh available jobs list after employee job submission
- **Route Addition**: Added `/employee/add-job` page with full quote form for employee use
- **Mobile Support**: Added "Add a Job" button to mobile dashboard for on-the-go job creation

## Age Verification & Terms of Service Compliance (October 6, 2025)
- **Legal Compliance**: Added mandatory age verification (18+) and Terms of Service acceptance for all users
- **Database Schema**: Added `dateOfBirth`, `tosAccepted`, and `tosAcceptedAt` fields to users table
- **Compliance Modal**: Non-dismissible modal enforces age and TOS requirements before app access
- **Age Validation**: Backend validates user is 18+ before accepting compliance
- **API Endpoint**: Created `/api/auth/user/compliance` for updating user compliance information
- **Terms Page**: Added `/terms` route with comprehensive Terms of Service document
- **Federal/State Compliance**: System meets legal requirements for all 50 US states

## Cash Out Feature Removal (October 7, 2025)
- **Feature Disabled**: Removed Cash Out Tokens feature from Rewards Dashboard
- **Future Implementation**: Feature will be re-enabled when Solana blockchain integration is completed
- **Backend**: Cashout API endpoints commented out in server/routes.ts
- **Frontend**: Removed cashout tab, form, and related UI components from rewards dashboard
- **Database**: cashoutRequests table schema preserved for future use

## Deployment Fixes (September 30, 2025)
- **Graceful Authentication Error Handling**: Modified `server/replitAuth.ts` to handle missing `REPLIT_DOMAINS` environment variable without crashing the server
- **Route Registration Error Handling**: Added try-catch in `server/routes.ts` to prevent authentication setup failures from blocking route registration
- **Environment Configuration**: Added `NODE_ENV` and `REPLIT_DOMAINS` documentation to `.env` file
- **Deployment Guide**: Created `DEPLOYMENT.md` with comprehensive instructions for configuring all required environment variables for production deployment
- **Server Resilience**: Application now starts successfully even when optional services (email, authentication) fail to initialize, with appropriate warning messages
- **JCMOVES Token Configuration**: Updated `MOONSHOT_TOKEN_ADDRESS` to correct Solana address `AY9NPebnvjcKSoUteYwNER3JHiJNPh6ptKmC8E4VGrxp` with fallback price $0.00000508432

## Treasury System Fixes (Previous Session)
- Fixed treasury distribution calculation to use `totalFunding - totalDistributed` instead of stored `availableFunding` field
- Resolved daily check-in distribution failures showing "Available: $0.00" despite actual balance
- Updated 7 methods across Treasury Service and Storage Layer for accurate fund tracking

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development/building
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Forms**: React Hook Form with Zod validation for type-safe form handling

## Backend Architecture
- **Server**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Session Management**: Express sessions with PostgreSQL store (connect-pg-simple)
- **API Design**: RESTful API with proper error handling and request logging
- **Build System**: ESBuild for production bundling

## Database Schema
- **leads**: Stores quote requests with customer info, service type, addresses, status tracking, and employee assignments
- **contacts**: Stores general contact form submissions
- **users**: Role-based user authentication system with admin, employee, and customer roles
- **Status Management**: Lead progression through states (new → contacted → quoted → confirmed → available → accepted → in_progress → completed)
- **Job Assignment**: Employee assignment tracking with assignedToUserId field for job delegation

## Email Integration
- **Service**: SendGrid for transactional email delivery
- **Notifications**: Automated email alerts for new leads and contact submissions
- **Templates**: HTML and text email templates for professional communication
- **Configuration**: Environment-based API key management with graceful fallback

## Development Environment
- **Hot Reload**: Vite middleware integrated with Express for seamless development
- **Error Handling**: Runtime error overlay for development debugging
- **Replit Integration**: Custom plugins for Cartographer and dev banner when running on Replit
- **Path Aliases**: TypeScript path mapping for clean imports (@/, @shared/, @assets/)

## Authentication & Security
- **Replit Auth**: OIDC-based authentication system with automatic session management
- **Role-Based Access Control**: Business owner and employee roles with distinct permissions
- **Route Protection**: Role-specific middleware (requireBusinessOwner, requireEmployee) for secure endpoints
- **Data Isolation**: Employees can only access available jobs and their own assignments
- **CORS**: Express CORS middleware for cross-origin requests
- **Input Validation**: Zod schemas for runtime type checking and validation
- **Database Security**: Parameterized queries through Drizzle ORM with atomic job assignment to prevent race conditions

## Deployment Architecture
- **Production Build**: Static asset generation with Express serving SPA
- **Environment Variables**: Database URL, SendGrid API key, and company email configuration
- **Database Migrations**: Drizzle Kit for schema management and migrations
- **Asset Serving**: Express static file serving for production builds
- **Graceful Startup**: Error handling prevents authentication/service failures from blocking server startup
- **Production Configuration**: NODE_ENV=production for optimized builds and error handling
- **Domain Configuration**: REPLIT_DOMAINS environment variable for multi-domain authentication support

# External Dependencies

## Database
- **Neon Database**: Serverless PostgreSQL database (@neondatabase/serverless)
- **Connection**: Environment variable `DATABASE_URL` for database connectivity
- **Migration System**: Drizzle Kit for schema versioning and deployment

## Email Service
- **SendGrid**: Email delivery service (@sendgrid/mail)
- **Configuration**: `SENDGRID_API_KEY` environment variable
- **Business Email**: `COMPANY_EMAIL` environment variable for notification routing

## UI Components
- **Radix UI**: Comprehensive primitive component library for accessibility
- **Lucide React**: Icon library for consistent iconography
- **shadcn/ui**: Pre-built component system with Tailwind CSS integration

## Development Tools
- **Vite**: Development server and build tool with React plugin
- **TypeScript**: Static type checking and enhanced development experience
- **ESLint/Prettier**: Code formatting and linting (configured via package.json)
- **PostCSS**: CSS processing with Tailwind CSS and Autoprefixer