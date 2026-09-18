"""The shared simulation layer: what every mode of play simulates the same way.

Three things live here and nothing else — uniform-price market clearing
(:mod:`~energetica.sim.market`), the demand-shape function
(:mod:`~energetica.sim.demand_shape`), and the facility-status vocabulary
(:mod:`~energetica.sim.facility_statuses`). That is exactly the surface the
Workshop Mode spec (#992) names as reused from the persistent world.

The layer is a leaf: no module in it imports from another layer, and none of them
knows about players, maps, or the game engine. Anything that needs the persistent
world's tech tree, its facility taxonomy, or its stored state belongs in that
mode's own package instead.

The layer stays small deliberately. "Does this piece transfer to another mode?" is
then answered by whether the piece is in this directory (#1054).
"""
