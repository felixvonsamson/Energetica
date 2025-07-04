# Energetica

Energetica is a game focused on electricity and energy management, designed to be both compelling and educational.

Try out Energetica online at [http://energetica.ethz.ch](http://energetica.ethz.ch).

## License

Copyright (c) 2024 Felix von Samson, Maximilien Tirard, Yassir Akram.

This project is licensed under the GNU Affero General Public License (AGPL) - see the [LICENSE](LICENSE) file for details.

## Technology Stack

Backend: Flask and Python
Frontend: Jinja, JS, and p5.js

## Running a Local Instance

<!-- Using StrEnum requires >=3.11 -->
Make sure you have Python version 3.11 or 3.12 installed.

Clone the repository:

```bash
git clone https://github.com/felixvonsamson/Energetica
```

Install the required dependencies using pip:

```bash
pip install -r requirements.txt
```

Or using conda:

```bash
conda install -c conda-forge --file requirements.txt
```

To launch an instance of the server, run:

```bash
python main.py
```

The server will be accessible at [http://127.0.0.1:5001](http://127.0.0.1:5001)

Command line options are available to help with debugging:

```bash
python main.py --help
usage: main.py [-h] [--clock_time {60,30,20,15,12,10,6,5,4,3,2,1}] [--in_game_seconds_per_tick {3600, 1800, 1200, 900, 600, 540, 480, 420, 360, 300, 240, 180, 120,
60, 30}] [--random_seed] [--run_init_test_players] [--rm_instance] 

options:
  -h, --help            show this help message and exit
  --clock_time {60,30,20,15,12,10,6,5,4,3,2,1}
                        Clock time interval in seconds (default is 60)
  --in_game_seconds_per_tick {3600, 1800, 1200, 900, 600, 540, 480, 420, 360, 300, 240, 180, 120, 60, 30}
                        Number of in-game seconds in a game tick (default is 240)
  --random_seed         sets the random seed of the game
  --run_init_test_players
                        run the init_test_players function
  --rm_instance         remove the instance folder
```

## Building the frontend

We use npm.
```
npm install
```
```
npm run build
```
If using VSCode, a build task is configured, and can be invoked with `Tasks: Run Build Task`.

## Source Code Formatting and Linting

<!-- TODO: restructure the below information to be more readable -->

Use [Ruff](https://github.com/astral-sh/ruff), [Pylint](https://marketplace.visualstudio.com/items?itemName=ms-python.pylint) and [isort](https://marketplace.visualstudio.com/items?itemName=ms-python.isort) for Python.
Use vscode's built in formatter for Javascript.
Use [djLint](https://github.com/djlint/djLint) for Jinja.
Use [Better Jinja](https://marketplace.visualstudio.com/items?itemName=samuelcolvin.jinjahtml) for code highlighting in vscode.
Both specified through `pyproject.toml`.
Use [Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) for spell checking. 
Keep lines to a maximum of 120 characters.
For Python docstrings, fit the opening and closing triple double quotes on the same line as the docstring if it all fits in one line, otherwise keep both the opening and closing triple double quotes on their own line.
