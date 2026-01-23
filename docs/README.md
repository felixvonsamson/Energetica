# Energetica Documentation

Welcome to the Energetica documentation! This guide covers the full architecture, development setup, and patterns for both backend and frontend.

**New to the project?** Start with [**Getting Started**](getting-started/installation.md) below.

## Contents

### Getting Started

- [**Overview**](getting-started/installation.md) - Installation & Quick Reference

### Architecture

- [**Overview**](architecture/overview.md) - Project structure, file organization, game loop execution
- [**API**](architecture/api.md) - Route definitions and standards, Swagger & OpenAPI
- [**Authentication**](architecture/authentication.md) - Login flow, session management, user state
- [**Error Handling**](architecture/error-handling.md) - Error patterns, user-friendly messages, exception types
- [**Real-time Synchronisation**](architecture/real-time-sync.md) - WebSocket patterns, game tick synchronization, cache invalidation

### Backend

- [**Game Engine Startup**](backend/game-engine-startup.md) - Bootstrap process, scheduler setup, initialization
- [**Game Loop**](backend/game-loop.md) - Tick execution, state updates, climate events
- [**Style Guide**](backend/style-guide.md) - Python conventions, naming, type hints, docstrings

### Frontend

- [**Routing**](frontend/routing.md) - TanStack Router setup, route protection, navigation patterns
- [**State Management**](frontend/state-management.md) - useState, Context, TanStack Query, provider hierarchy
- [**Data Fetching**](frontend/data-fetching.md) - data fetching, caching, and synchronization
- [**Hooks**](frontend/hooks.md) - Custom hooks for data fetching, API calls, game state
- [**Component Library**](frontend/component-library.md) - Available UI components, usage examples, props
- [**Styling**](frontend/styling.md) - Tailwind CSS, theme colors, responsive design, dark mode
- [**Wiki Pages**](frontend/wiki-pages.md) - Wiki pages with markdown and React components
- [**Frontend Overview**](frontend/overview.md) - React foundation, provider hierarchy, tools setup
- [**Frontend Quick Start**](frontend/quickstart.md) - Local setup, first page creation, verification steps
- [**Best Practices**](frontend/best-practices.md) - Component structure, state management, file organization
- [**Animations**](frontend/animations.md) - Transitions, animations, performance best practices
- [**Style Guide**](frontend/style-guide.md) - TODO
- [**Capabilities System**](frontend/capabilities.md) - Feature flags, unlocking content
- [**Asset Colors**](frontend/asset-colours.md) - Facility and resource color system
- [**Offline Handling**](frontend/offline.md) - Progressive enhancement, offline mode
- [**Design Patterns**](frontend/design-patterns.md) - Rapid prototyping, dummy data patterns, Storybook

## Game Logic

- [**Electricity Markets**](game-logic/electricity-markets.md) - Logic & vocabulary for electricity markets

### Additional Resources

- **GitHub:** https://github.com/felixvonsamson/Energetica
- **Play online:** http://energetica.ethz.ch
- **Contributing:** [CONTRIBUTING.md](../CONTRIBUTING.md)

## Documentation Maintenance

If you find:

- Outdated information
- Missing sections
- Confusing explanations

Please let us know by opening an [issue](https://github.com/felixvonsamson/Energetica/issues/new/choose) or creating a PR.
