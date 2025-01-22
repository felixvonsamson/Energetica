class GameError(Exception):
    """Define the exception class for the game engine."""

    def __init__(self, exception_type, **kwargs):
        self.exception_type = exception_type
        self.kwargs = kwargs
        Exception.__init__(self, exception_type)
