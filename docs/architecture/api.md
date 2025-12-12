# Overview of API

APIs are defined in the backed using FastAPI + Pydantic. See `<URL>/docs` for Swagger docs and `<URL>/openapi.json` for an OpenAPI compliant definition of the HTTP APIs. On the frontend, requests are managed by Tanstack Query. The openapi json file is used to automatically generate typescript types for the frontend. Furthermore, since data regularly becomes stale, invalidation messages are sent using Socket.IO. See the socketio.md for more details.

Note that there is an intention for players to be able to use the API themselves directly. Hence swagger.

## Backend patterns

See routers/ see schemas/
See middleware, it does logging mechanism + checks auth
In a route, you have `depends` to get a player and the middleware does the checks. There's a specific file where that's defined.
See auth.md

## Frontend patterns

See the package json script for generating types. It's the .generated file. See frontend/src/types. See hooks.

See api_integration for more details.

## Error handling

see the dedicated file about this

## API Flow

This below is very complicated. Once the above is fleshed out, this can be simplified or removed.

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

### Other

API use AIP-136 style syntax, .i.e. POST requests with a verb, e.g. in energetica/routers/resource_market.py:
