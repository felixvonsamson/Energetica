# Energetica

Energetica is a game focused on electricity and energy management, designed to be both compelling and educational.

Try out Energetica online at [http://energetica.ethz.ch](http://energetica.ethz.ch).

## Technology Stack

Energetica uses Flask and Python for its backend, SQL for its database, and Jinja, JavaScript, and p5.js for its frontend.

Make sure you have the latest version of Python installed.

```bash
git clone <repo-url>
```

```bash
pip install -r requirements.txt
```

or

```bash
conda install -c conda-forge --file requirements.txt
```

## Running The App

```bash
python main.py
```

Use python versions 3.10 and above.

Command line options are available to help with debugging:

```bash
python3.10 main.py --help
usage: main.py [-h] [--run_init_test_players] [--rm_instance]

options:
  -h, --help            show this help message and exit
  --run_init_test_players
                        run the init_test_players function
  --rm_instance         remvove the instance folder
```

## Viewing The App

Go to `http://127.0.0.1:5001`

## Source Code Formattting and Linting

Use [Ruff](https://github.com/astral-sh/ruff) for Python.
Use [djLint](https://github.com/djlint/djLint) for Jinja.
Both specified through `pyproject.toml`.
