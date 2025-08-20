# Energetica Architecture

> High-level overview of the game engine, API surfaces, and extensibility points.

---

<!-- TODO: Diagram - Python Module Interaction
     Show how main.py, energetica/__init__.py, game_engine.py, production_update.py, technology_effects.py, socketio.py, api/, database/, and instance/ call/use each other.
-->

<!-- TODO: Diagram - Application Startup & Configuration Flow
     Show flow of how command line args are parsed, configuration is loaded, and the tick loop + API server are started.
-->

## Goals
- Fast tick-based energy system simulation
- Deterministic (optionally seeded) progression for testing & replay
- Clear separation between simulation core and delivery (HTTP / WebSocket)
- Extensible technology & event model without migrations every change

## Top-Level Components
| Component | Purpose |
|----------|---------|
| `main.py` & `energetica/__init__.py` | Bootstrap: parse flags, configure app, start tick loop + API server |
| `energetica/game_engine.py` | Root of all engine data in RAM, core engine helpers |
| `energetica/production_update.py` | Tick logic, power production & consumption logic, market logic |
| `energetica/technology_effects.py` | Tech modifiers (efficiency, production, emissions) |
| `energetica/socketio.py` | Real‑time push (progress updates, player state) |
| `energetica/api/` | HTTP endpoints / services |
| `energetica/database/` | Persistence model / serialized state |
| `instance/` | Runtime data (ephemeral, not versioned) |

<!-- TODO: Diagram - Tick Execution & API Flow
     Show the flow of tick execution, how API requests are handled (GET/POST), and how they interact with the tick loop and engine state.
-->

## Data Flow (Tick)
1. Tick scheduler triggers engine step.
2. Database is checked for completion of projects and shipments.
4. Climate events are ran, with deterministic randomness.
3. Production update recalculates generation, storage charge/discharge, consumption.
5. New state persisted (checkpoint logic if enabled).

## Persistence & Checkpoints
- Active state under `instance/engine_data.pck`.
- Checkpoints optionally compressed in `checkpoints/`.

## Concurrency Model
Single-threaded tick loop. API requests share this thread, if making changes (e.g. POST) (blocked until tick finishes); reads requests (GET) are concurrent.

## Error Handling
- Domain errors: custom exceptions in `game_error.py`.
- Validate player actions early (API layer) with Pydantic schemas.

---
See also: [CONTRIBUTING.md](CONTRIBUTING.md), [STYLEGUIDE.md](STYLEGUIDE.md).
