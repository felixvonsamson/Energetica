# Energetica Architecture

## Project file structure

```mermaid
mindmap
     root((Energetica))
          ((frontend))
               src
                    routes
                    components
                    api
          ((energetica))
               config
               api
               database
               routers
               schemas
               utils
               templates
          ((tests))
               unit
               integration
          (map_generation)
          instance
          checkpoints
```

* The backend is built using FastAPI, and resides in the `energetica` directory.
* Tests for the backend are located in the `tests` directory.
* The frontend is a separate React application, located in the `frontend` directory.
* The `instance` and `checkpoints` directories store the current save and are not versioned.
* The `map_generation` directory contains code related to generating maps for the game.

## Python Backend Overview

### FastAPI Framework

* The main `FastAPI` app is created in `energetica/__init__.py`
* Routes are located in `energetica/routers/`
* Pydantic models for request validation and response serialization are located in `energetica/schemas/`

### Custom In-Memory Database
A custom in-memory database is used to store the game's runtime state. The rationale is there are frequent writes for each game tick. It is periodically persisted to disk in the `instance/` directory. This is done by the `GameEngine`'s `save` method. The `instance/` folder is periodically backed up to the `checkpoints/` folder.

### Top-Level Components
| Component | Purpose |
|----------|---------|
| `main.py` & `energetica/__init__.py` | Bootstrap: parse flags, configure FastAPI app, start tick loop with schedulers |
| `energetica/game_engine.py` | Store engine configuration, hold all game objects in  RAM |
| `energetica/database/` | All classes who's state is persisted |
| `energetica/production_update.py` | Tick logic, power production & consumption logic, market logic |
| `energetica/technology_effects.py` | Tech modifiers (efficiency, production, emissions) |
| `energetica/utils/` | Utility functions and helpers |
| `energetica/socketio.py` | Real‑time push (progress updates, player state) |
| `energetica/routers/` | HTTP endpoints / services |
| `energetica/schemas/` | Pydantic models for request validation and response serialization |
| `energetica/templates/` | Jinja2 templates for rendering HTML responses, legacy |

## Game Loop: Tick Execution

### Tick Scheduling
By default, ticks are scheduled to happen every minute, on the minute. This is controlled by the `--clock_time` flag. The `create_app` function in `__init__.py` sets up the tick scheduler, using the `apscheduler` library.

### Tick Execution Steps
1. The `total_t` counter is incremented.
2. Database is checked for completion of projects and shipments.
3. Climate events are ran, with deterministic randomness.
4. Production update recalculates generation, storage charge/discharge, consumption.

### Locking Mechanism

The game engine ensures state consistency with a lock. Write operations (e.g., ticks, POST, PUT, PATCH, and DELETE requests) acquire the lock, while read-only requests (e.g., GET) bypass it.

```mermaid
stateDiagram-v2
     [*] --> Tick
     state Tick {
          acquire_lock_: Acquire lock for game state
          acquire_lock_ --> tick_inc
          tick_inc: Increment total_t += 1
          tick_inc --> check_events
          check_events: Check construction/research completion
          check_events --> check_climate
          check_climate: Check climate events
          check_climate --> electricity_update
          electricity_update: Update electricity production/consumption
     }
     [*] --> HTTP_Request
     HTTP_Request: HTTP Request
     state HTTP_Request {
          state needs_lock_check <<choice>>
          needs_lock_check --> acquire_lock : POST
          acquire_lock: Acquire lock for game state
          acquire_lock --> process_request
          process_request: Process request, update game state
          process_request --> send_response
          send_response: Send HTTP response
          needs_lock_check --> serve_immediately : GET
          serve_immediately: Serve immediately without lock, read-only access
          serve_immediately --> send_response
     }
```

### Error Handling
- Domain errors: custom [`GameError`](energetica/game_error.py) exception (e.g. `NOT_ENOUGH_MONEY`, `FACILITY_NOT_UPGRADABLE`).
- When raised in an API call, these are automatically converted to HTTP responses with `400` status codes.
- Validate player actions early (API layer) with Pydantic schemas.


## API Flow

There are multiple components involved in processing an API request. Largely this is a standard FastAPI flow, with middleware, routers, and schemas working together to handle requests and responses. Of note is the custom middleware for logging actions, and the error handling middleware.

```mermaid
flowchart TB
     client[API Client]
     subgraph backend [Backend]
          subgraph fastapi [Routers]
               subgraph routers_init [Init]
                    error_middleware[/"`@app.exception_handler(GameError)`"/]
                    middleware[/"`@app.middleware('log_action')`"/]
                    actions_history[(Action History)]
               end
               direction BT
               routers@{label: "APIRouter", shape: processes}
               routes@{label: "FastAPI Route
               @router.post", shape: processes}
               schemas@{label: "Pydantic Schemas", shape: processes}
               get_current_user[/"`get_current_user`"/]
               routes<--Parses and validates request / Serializes and validates response-->schemas
               routers<--HTTP Request / Response-->routes
               routes<--Shares Cookies / Authed User--->get_current_user
          end
          subgraph game [Game Logic]
               utils[Utilities]
               db[(Database)]
               utils<--Reads  / Writes-->db
          end
          middleware<--HTTP Request / Response-->routers
          middleware--Logs Actions-->actions_history
          routes<--Calls / Returns-->utils
          utils--Catches GameError--->error_middleware
     end
     error_middleware--Creates 400 Response-->middleware
     client<--HTTP Request / Response-->middleware
```

<!-- TODO: Diagram - Application Startup & Configuration Flow
     Show flow of how command line args are parsed, configuration is loaded, and the tick loop + API server are started.
-->

---
See also: [CONTRIBUTING.md](CONTRIBUTING.md), [STYLEGUIDE.md](STYLEGUIDE.md).
