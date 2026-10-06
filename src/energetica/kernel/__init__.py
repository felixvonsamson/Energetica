"""The kernel layer: domain-neutral utilities at the bottom of the dependency order.

The game's error types (:mod:`~energetica.kernel.game_error`), session signing and cookie
handling (:mod:`~energetica.kernel.session`), stable hashing (:mod:`~energetica.kernel.hashing`),
deployed-version reporting (:mod:`~energetica.kernel.version`), number formatting
(:mod:`~energetica.kernel.formatting`), and the error envelope every app answers errors in
(:mod:`~energetica.kernel.error_envelope`) live here (see #1052, #1134).

The layer is a leaf: no module in it imports from another layer, so none of them can reach
the game model, the accounts store, or the game engine. Every other package may depend on it.
"""
