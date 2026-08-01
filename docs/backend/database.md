# Database

Classes inheriting from `DBModel` are serialized as pickle files. When modifying data structures, ensure backward compatibility by setting sensible defaults in `__setstate__`.
