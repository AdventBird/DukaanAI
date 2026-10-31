# Repository map

- `apps/web`: shared React/Vite PWA shell and Dev 5 dashboard.
- `apps/api`: Express modular API bootstrap and Dev 5 aggregation routes.
- `apps/ai-worker`: Dev 4 workspace placeholder.
- `apps/mock-portal`: Dev 3 workspace placeholder.
- `packages/shared`: shared Zod contracts and DTOs.
- `database/prisma`: canonical Prisma schema and the one migration history.
- `docs`: architecture, contracts, modules, and runbooks.

Feature route placeholders are registered centrally by the shell. Dev 1 owns products/inventory; Dev 2 owns POS/sales; Dev 3 owns suppliers/purchases; Dev 4 owns AI feature content. Their domain APIs and screens are not present in this initial integration foundation.
