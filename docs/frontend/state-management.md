# State Management

```
Application Root (QueryClientProvider)
  └─ AuthProvider (user state & cookies)
      └─ SocketProvider (WebSocket connection)
          └─ GameTickProvider (tick synchronization)
              └─ RouterProvider (TanStack Router)
                  └─ Your Components
```

and more that have been added since and are missing

**Should have (~150 lines):**

-   When to use useState vs Context vs TanStack Query
-   Provider hierarchy
-   Examples of each pattern
-   Common mistakes
-   The `TODO` comment indicates this was planned but not finished
