from typing import Any, Callable

from flask import current_app


def mixed_db(cls: object, data_fields: set[str], buffered_field: dict[str, Callable[[], Any]]):
    """
    This decorator, when applied to a class which inherits from an SQLAlchemy model, will allow the class to store
    certain fields on disk, rather than in the database. These are specified by the `disk_field` parameter. The data is
    stored in the `engine.data` dictionary, which is periodically saved to disk as a pck file.
    :param cls: class to mix
    :param data_field: list of fields to store in disk
    :param buffered_field: dictionary of fields to store in memory. keys are field names, values are functions which
    return or recalculate the value of the field
    :return: mixed class
    """

    def __getattr__(self, name):
        engine = current_app.config["engine"]
        if name in data_fields:
            return engine.data[cls.__name__][self.id][name]
        elif name in buffered_field:
            buffered_value = engine.buffered_data[cls.__name__][self.id][name]
            if buffered_value is None:
                buffered_value = buffered_field[name]()
                engine.buffered_data[cls.__name__][self.id][name] = buffered_value
            return buffered_value
        elif name in self.__dict__:
            return self.__dict__[name]
        else:
            raise AttributeError(f"'{cls.__name__}' object has no attribute '{name}'")

    original_setattr = cls.__setattr__

    def __setattr__(self, name, value):
        engine = current_app.config["engine"]
        if name in data_fields and self.id:
            engine.data[cls.__name__][self.id][name] = value
        elif name in buffered_field:
            engine.buffered_data[cls.__name__][self.id][name] = value
        else:
            original_setattr(self, name, value)

    cls.__getattr__ = __getattr__
    cls.__setattr__ = __setattr__
    return cls
