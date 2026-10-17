"""Regression test for #1262: Runs that start at the same moment must not block each other."""

import socket
import sys

import pytest

from energetica.freeplay.app import create_app


@pytest.mark.skipif(sys.platform != "linux", reason="abstract Unix sockets exist only on Linux")
def test_create_app_starts_while_another_run_is_starting() -> None:
    # create_app used to bind the host-global abstract socket "\0energetica" as a startup lock, so
    # a second Run starting at the same moment crashed with "Address already in use". Hold that
    # name here, as another Run's startup would, and check that this app still starts.
    other_run = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
    try:
        other_run.bind("\0energetica")
        create_app(rm_instance=True, skip_adding_handlers=True, env="prod")
    finally:
        other_run.close()
