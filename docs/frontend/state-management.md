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
