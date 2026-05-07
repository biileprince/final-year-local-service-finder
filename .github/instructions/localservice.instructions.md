---
description: Describe when these instructions should be loaded by the agent based on task context
# applyTo: 'Describe when these instructions should be loaded by the agent based on task context' # when provided, instructions will automatically be added to the request context when the pattern matches an attached file
---

---

description: Instructions loaded when working on implementing remaining features in this repo
applyTo: - "backend/**" - "frontend/**" - "src/**" - "prisma/**" - "Dockerfile" - "docker/\*\*"

---

Purpose
I should be loaded when the agent is asked to implement, extend, or review application features across the backend and frontend. My role is to guide the AI agent to work with the codebase safely, follow project conventions, propose small incremental changes, and coordinate verification steps.

When to load

- Feature implementation requests touching backend, frontend, or infra files.
- Requests to add API endpoints, business logic, database migrations, or frontend pages/components.

Agent responsibilities (high level)

- Explore and understand the repository layout before making changes.
- Propose small, testable tasks and present a short plan using the `manage_todo_list` tool.
- Make code edits using `apply_patch` only after confirming the plan with the user.
- Run or suggest commands to build, test, and lint when available and safe to run in the environment.

Coding conventions and expectations

- Backend: Use existing NestJS + TypeScript patterns: controllers, modules, services, DTOs, guards, interceptors, and Prisma for DB access.
- Frontend: Follow Next.js app router structure in `src/app` and existing component patterns in `src/components`.
- Database: Use Prisma schema and migrations. When making schema changes, generate a migration and update `prisma/seed.ts` if needed.
- Tests: Add focused unit/integration tests for new behavior where practical.

Workflow for implementing a feature

1. Ask clarifying questions if the feature spec is ambiguous (scope, edge cases, acceptance criteria).
2. Create a concise plan and track it with `manage_todo_list` (include small numbered steps).
3. For each code change, create a focused patch with `apply_patch`. Keep changes minimal and reversible.
4. Run or recommend running the minimal build/test/lint commands to verify (show exact terminal commands).
5. If DB schema changes are required, add a Prisma migration and explain how to apply it locally.
6. Prepare a short PR description and checklist for the user to use when opening a pull request.

Safety and scope rules

- Avoid large, risky refactors unless the user explicitly requests them.
- Do not commit or push changes to remote repositories without explicit user instruction.

Interaction guidance

- When uncertain about acceptance criteria, ask at most 3 concise clarifying questions.
- When making a code suggestion, show the patch and explain the intent in 1–2 sentences.

Developer tools & verification (examples)

- Start dev servers or run tests using commands provided in the repo (suggest commands; run only with user permission):
  - Backend dev: `cd backend && npm run start:dev`
  - Frontend dev: `cd frontend && npm run dev`
  - Run Prisma migrations: `npx prisma migrate dev`
  - Run tests: `npm test` (run in the respective package folder)

Commit & PR guidance

- Use small commits with descriptive messages. Prefer one logical change per commit.
- When preparing a PR, include: summary, implementation details, migration steps, verification steps, and any remaining TODOs.

Examples of useful prompts to the agent

- "Add an endpoint to create verification tokens for users in `backend/modules/auth` and return 201 on success."
- "Implement provider priority sorting in `backend/modules/providers/service` and add corresponding unit tests."

Iterate and follow up

- After applying a patch, update the `manage_todo_list` to reflect progress and next steps.
- If tests or dev servers show errors, stop and ask for permission to debug further; provide the error output and a short plan to fix.

If you need more context

- Search repository for patterns (e.g., existing endpoints, DTOs, or component patterns) before proposing code.
- When proposing changes to core behavior, reference specific files and lines where the change is implemented.

End
If anything in these instructions should only apply to a specific folder or file type, update the `applyTo` list at the top of this file.
