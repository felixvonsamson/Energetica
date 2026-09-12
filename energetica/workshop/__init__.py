"""Workshop Mode: a second, purpose-built Run format for moderated live sessions.

See issue #992 for the full implementation-ready spec. Per its explicit-reuse principle, nothing
in this package is assumed compatible with the persistent-world game domain (``energetica.database``,
``energetica.utils``) just because a same-named concept exists there — what Workshop reuses is
named explicitly at each call site, and everything else is built fresh, as Workshop's own code.
"""
