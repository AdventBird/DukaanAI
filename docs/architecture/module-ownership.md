# Module ownership

| Area | Owner | Boundary |
|---|---|---|
| Workspace, shared contracts, auth context, shell, dashboard, analytics, finance, CI | Dev 5 | Shared foundation and read aggregation |
| Products, categories, barcodes, stock and inventory | Dev 1 | Product and stock rules, writes, screens/APIs |
| POS, cart, checkout, tender recording and sales | Dev 2 | Sale lifecycle and screens/APIs |
| Suppliers, quotes, purchase orders, approvals and receipt | Dev 3 | Procurement lifecycle and mock portal |
| LLM, agent orchestration, AI tasks, voice and browser automation | Dev 4 | AI runtime and worker |

Dev 5 coordinates shared schema/migrations and integration boundaries. Dashboard code does not write to another domain's records. Domain API and component contracts must be proposed by their owner before replacing placeholders.
