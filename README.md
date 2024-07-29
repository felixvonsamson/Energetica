# Energetica

Energetica is a game focused on electricity and energy management, designed to be both compelling and educational.

Try out Energetica online at [http://energetica.ethz.ch](http://energetica.ethz.ch).

## Technology Stack

Energetica uses Flask and Python for its backend, SQL for its database, and Jinja, JavaScript, and p5.js for its frontend.

## Running a Local Instance

Make sure you have Python 3.10 or above installed.

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
usage: main.py [-h] [--clock_time {60,30,20,15,12,10,6,5,4,3,2,1}] [--run_init_test_players] [--rm_instance] [--repair_database]

options:
  -h, --help            show this help message and exit
  --clock_time {60,30,20,15,12,10,6,5,4,3,2,1}
                        Clock time interval in seconds (default is 60)
  --run_init_test_players
                        run the init_test_players function
  --rm_instance         remove the instance folder
  --repair_database     repair database in case of mismatch between construction lists
```

## Source Code Formatting and Linting

Use [Ruff](https://github.com/astral-sh/ruff), [Pylint](https://marketplace.visualstudio.com/items?itemName=ms-python.pylint) and [isort](https://marketplace.visualstudio.com/items?itemName=ms-python.isort) for Python.
Use [djLint](https://github.com/djlint/djLint) for Jinja.
Use [Better Jinja](https://marketplace.visualstudio.com/items?itemName=samuelcolvin.jinjahtml) for code highlighting in vscode.
Both specified through `pyproject.toml`.
Use [Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) for spell checking
