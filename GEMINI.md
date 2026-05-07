# Local Service Finder

## Project Overview
Local Service Finder is a full-stack web application designed to connect users with local services. The project is separated into a backend API and a frontend web application, both written in TypeScript, and orchestrated using Docker Compose.

**Main Technologies:**
*   **Backend:** NestJS (v11), Prisma ORM, PostgreSQL, Redis (for caching/queues), Socket.io (for real-time features like messages/notifications), TypeScript.
*   **Frontend:** Next.js (v16, React 19), Tailwind CSS (v4), Zustand (state management), React Hook Form + Zod, Socket.io-client, TypeScript.
*   **Infrastructure/Monitoring:** Docker Compose, Prometheus, Grafana.

## Directory Structure
*   `backend/`: Contains the NestJS REST API, WebSocket gateways, and Prisma database schema.
*   `frontend/`: Contains the Next.js application, UI components, and state management.
*   `docker/`: Contains configurations for monitoring tools (Prometheus, Grafana).

## Building and Running

The project relies on Docker Compose for development environment setup.

**Docker Compose Commands (Run from root directory):**
*   **Data Services Only (Recommended for local dev):** `docker compose up -d postgres redis`
*   **Full Stack (Backend + Frontend in containers):** `docker compose up -d`
*   **Full Stack + Monitoring (Prometheus & Grafana):** `docker compose --profile monitoring up -d`

**Backend (Run from `/backend` directory):**
*   **Install Dependencies:** `npm install`
*   **Development Server:** `npm run start:dev`
*   **Database Migrations:** `npm run prisma:migrate`
*   **Generate Prisma Client:** `npm run prisma:generate`
*   **Run Tests:** `npm run test` or `npm run test:e2e`
*   **Linting & Formatting:** `npm run lint` / `npm run format`

**Frontend (Run from `/frontend` directory):**
*   **Install Dependencies:** `npm install`
*   **Development Server:** `npm run dev`
*   **Build for Production:** `npm run build`
*   **Lint & Type-Check:** `npm run lint` / `npm run type-check`

## Development Conventions
*   **Type Safety:** Strict TypeScript is enforced across both backend and frontend. Prisma is used for end-to-end type safety with the database.
*   **Real-time Communication:** WebSockets (Socket.io) are used for live updates (e.g., messages, notifications).
*   **Frontend Architecture:** Next.js App Router (inferred from React 19 & Next 16 context). Uses Zustand for global state, React Hook Form with Zod for robust form handling, and Tailwind CSS for styling.
*   **Backend Architecture:** Standard NestJS modular architecture with decorators, dependency injection, controllers, services, and modules.
