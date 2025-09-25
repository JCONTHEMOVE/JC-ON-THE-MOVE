# Overview

This is a full-stack moving and junk removal service website built with React, TypeScript, Express.js, and Drizzle ORM. The application allows customers to request quotes for residential moving, commercial moving, and junk removal services, while providing a comprehensive dashboard system for business operations. The system includes automated email notifications, role-based authentication, employee job assignment capabilities, and features a modern, responsive design using shadcn/ui components.

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