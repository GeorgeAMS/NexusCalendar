# Spec-Driven Development (SDD)

Este directorio es la **fuente de verdad operativa** para implementar Nexus Calendar.

La arquitectura de producto vive en [`/docs`](../docs). Los **specs** aquí traducen esa arquitectura en reglas, contratos y tareas ejecutables.

## Cómo trabajamos

1. **Leer** [`constitution.md`](constitution.md) — principios no negociables.
2. **Implementar** solo lo cubierto por un feature spec con criterios de aceptación.
3. **Contrato API primero** — la API no se dobla al UI; el front consume el contrato.
4. **Local primero** — sin GitHub ni Railway hasta que lo indiquemos.
5. **Una feature a la vez** — seguir el orden de [`tasks/backlog.md`](tasks/backlog.md).
6. **Definition of Done** = criterios de aceptación del spec en verde (manual o test).

## Mapa de specs

| Documento | Propósito |
|-----------|-----------|
| [constitution.md](constitution.md) | Principios, invariantes, anti-patrones |
| [product-spec.md](product-spec.md) | Qué construimos (alcance v1) |
| [technical-spec.md](technical-spec.md) | Cómo lo construimos (stack, repo, env) |
| [api-contract.md](api-contract.md) | Contrato REST para backend y cliente web |
| [frontend-brief.md](frontend-brief.md) | Pantallas, roles y reglas de UI |
| [local-development.md](local-development.md) | Arranque 100% local |
| [railway.md](railway.md) | Despliegue futuro en Railway (aún no) |
| [features/](features/) | Specs por capacidad + acceptance criteria |
| [tasks/backlog.md](tasks/backlog.md) | Orden de implementación |

## Relación con `/docs`

| Docs (arquitectura) | Specs (ejecución) |
|---------------------|-------------------|
| Visión, journeys, ER, RBAC | Criterios testeables, contratos, tasks |
| Decisiones de producto | Checklist de DoD por feature |

Si un spec contradice `/docs`, **actualizar el spec o el doc** en el mismo cambio; no dejar divergencia.

## Estado actual

- Arquitectura: aprobada.
- SDD: operativo (epics 1–7).
- Código: API + PWA en monorepo.
- GitHub: pendiente.
- Railway: pendiente (solo documentado).
- Frontend: PWA en `apps/web` (TanStack Start).
