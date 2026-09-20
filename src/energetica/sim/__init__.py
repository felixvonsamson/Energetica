"""The shared simulation layer: what every mode of play simulates the same way.

Uniform-price market clearing (:mod:`~energetica.sim.market`), the arithmetic that settles a clearing
into money (:mod:`~energetica.sim.settlement`), the demand-shape function
(:mod:`~energetica.sim.demand_shape`), and the facility-status vocabulary
(:mod:`~energetica.sim.facility_statuses`) live here. Together they are the rules the
Workshop Mode spec (#992) names as shared with the persistent world (see #1054).

The layer is a leaf: no module in it imports from another layer, and none of them
knows about players, maps, or the game engine. Anything that needs the persistent
world's tech tree, its facility taxonomy, or its stored state belongs in that
mode's own package instead.

The layer stays small deliberately. "Does this piece transfer to another mode?" is
then answered by whether the piece is in this directory (#1054).
"""
