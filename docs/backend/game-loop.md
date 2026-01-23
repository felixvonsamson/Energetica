# Game Loop: Tick Execution

## Tick Scheduling

By default, ticks are scheduled to happen every minute, on the minute. This is controlled by the `--clock_time` flag. The `create_app` function in `__init__.py` sets up the tick scheduler, using the `apscheduler` library.

## Tick Execution Steps

1. The `total_t` counter is incremented.
2. Database is checked for completion of projects and shipments.
3. Climate events are ran, with deterministic randomness.
4. Production update recalculates generation, storage charge/discharge, consumption.

## Locking Mechanism

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

## Error Handling

-   Domain errors: custom [`GameError`](/energetica/game_error.py) exception (e.g. `NOT_ENOUGH_MONEY`, `FACILITY_NOT_UPGRADABLE`).
-   When raised in an API call, these are automatically converted to HTTP responses with `400` status codes.
-   Validate player actions early (API layer) with Pydantic schemas.

See also the middleware - this catches game errors when these happen during an API call

<!-- TODO: Diagram - Application Startup & Configuration Flow
     Show flow of how command line args are parsed, configuration is loaded, and the tick loop + API server are started.
-->
