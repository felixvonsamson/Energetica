# Energetica

Energetica is a game focused on electricity and energy management, designed to be both compelling and educational.

Play online: **http://energetica.ethz.ch**

## Key Features

-   TODO

## Getting Started (Local Development)

```bash
git clone https://github.com/felixvonsamson/Energetica
cd Energetica
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py --env dev
# Open http://127.0.0.1:5001
```

Frontend (optional):

```bash
cd frontend && npm install && npm run dev
```

## Tech Stack

Energetica uses a Python backend for the game engine and API (`energetica/`), with a modern frontend built using React (`frontend/`), and legacy Jinja templates. Persistent runtime state is stored under `instance/` (not committed). For architecture diagrams, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Contributing

Ready to hack? Read the full guidelines in [CONTRIBUTING.md](CONTRIBUTING.md) and style conventions in [STYLEGUIDE.md](STYLEGUIDE.md).

## Documentation Index

### Project Documentation

-   [ARCHITECTURE.md](ARCHITECTURE.md) - Project structure & data flow
-   [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
-   [STYLEGUIDE.md](STYLEGUIDE.md) - Code style conventions
-   [SOCKETIO.md](SOCKETIO.md) - SocketIO patterns (backend)

### Frontend Documentation

-   [frontend/QUICKSTART.md](frontend/QUICKSTART.md) - Fast setup guide
-   [frontend/FRONTEND.md](frontend/FRONTEND.md) - React foundation overview
-   [frontend/API.md](frontend/API.md) - API integration & types
-   [frontend/BEST_PRACTICES.md](frontend/BEST_PRACTICES.md) - React patterns & component standards
-   [frontend/STYLING.md](frontend/STYLING.md) - Tailwind patterns & theme colors
-   [frontend/ANIMATIONS.md](frontend/ANIMATIONS.md) - Animation & transition guidelines
-   [frontend/CAPABILITIES.md](frontend/CAPABILITIES.md) - Feature flag system
-   [frontend/ASSET_COLORS.md](frontend/ASSET_COLORS.md) - Asset color system
-   [frontend/OFFLINE.md](frontend/OFFLINE.md) - Offline handling

## License

Copyright (c) 2024 Felix von Samson, Maximilien Tirard, Yassir Akram.

Licensed under the GNU Affero General Public License (AGPL) – see [LICENSE](LICENSE).
