from flask import current_app


def mixed_db(cls, fields={}):
    def __getattr__(self, name):
        engine = current_app.config["engine"]
        if name in fields:
            return engine.data[cls.__name__][self.id][name]
        elif name in self.__dict__:
            return self.__dict__[name]
        else:
            raise AttributeError(f"'{cls.__name__}' object has no attribute '{name}'")

    original_setattr = cls.__setattr__

    def __setattr__(self, name, value):
        engine = current_app.config["engine"]
        if name in fields and self.id:
            engine.data[cls.__name__][self.id][name] = value
        else:
            original_setattr(self, name, value)

    cls.__getattr__ = __getattr__
    cls.__setattr__ = __setattr__
    return cls
