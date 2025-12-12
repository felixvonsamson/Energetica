# Project Structure

```
Energetica/
├── docs/                 # This documentation
├── energetica/           # Python/FastAPI backend
├── tests/                # Backend unit/integration tests
├── frontend/             # React/TypeScript frontend
├── instance/             # Game saves
└── checkpoints/          # Game backups
```

## Backend

```
energetica/           # Python/FastAPI backend
├── routers/          # API endpoints
├── schemas/          # Pydantic models
├── database/         # Game state models
└── game_engine.py    # Core game logic
```

## Frontend

```
frontend/             # React/TypeScript frontend
├── src/
│   ├── routes/       # TanStack Router pages
│   ├── components/   # Reusable React components
│   ├── hooks/        # Custom React hooks
│   └── lib/          # Utilities, API client
└── package.json
```

### Key Technologies

| Component         | Tech                     | Purpose                              |
| ----------------- | ------------------------ | ------------------------------------ |
| **Game Engine**   | Custom Python            | Core game logic game, tick scheduler |
| **Database**      | In-memory + disk         | Game state, persistence              |
| **Backend**       | FastAPI                  | REST API                             |
| **Real-time**     | Socket.IO                | Live updates, game ticks             |
| **Frontend**      | React 18 + TypeScript    | Web UI                               |
| **UI Components** | Custom component library | Visually cohesive UI and UX          |
| **Routing**       | TanStack Router          | Client-side navigation               |
| **Data Fetching** | TanStack Query           | Server state management              |
| **Styling**       | Tailwind CSS             | Component styles                     |
