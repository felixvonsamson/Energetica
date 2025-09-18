# Energetica

Energetica is a game focused on electricity and energy management, designed to be both compelling and educational.

Play online: **http://energetica.ethz.ch**

## Key Features
* TODO

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
* [ARCHITECTURE.md](ARCHITECTURE.md)
* [CONTRIBUTING.md](CONTRIBUTING.md)
* [STYLEGUIDE.md](STYLEGUIDE.md)

## License

Copyright (c) 2024 Felix von Samson, Maximilien Tirard, Yassir Akram.

Licensed under the GNU Affero General Public License (AGPL) – see [LICENSE](LICENSE).
