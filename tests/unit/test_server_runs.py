import os
import signal
import subprocess
from time import sleep

import requests


def test_server_runs():
    process = subprocess.Popen(["python", "main.py", "--port", "5011", "--rm_instance"])

    trials = 0
    while True:
        try:
            response = requests.get("http://localhost:5011/wiki/introduction", timeout=1)
        except requests.exceptions.ConnectionError:
            trials += 1
            if trials == 10:
                assert False
            sleep(1)
        else:
            assert response.status_code == 200
            break
    os.kill(process.pid, signal.SIGTERM)
    process.wait()
