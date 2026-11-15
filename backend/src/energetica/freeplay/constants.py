"""Constants of the persistent world's rules."""

NETWORK_MEMBER_LIMIT = 15

#: The lowest price an offer can carry. Generation that must run regardless of price (renewables, the minimum
#: output a controllable facility cannot ramp below) is offered here so it always sits first in the merit
#: order. Players' own prices must stay above it.
MIN_PRICE = -5
#: What dumping unsold must-run power costs its owner, per MWh. It equals selling at :data:`MIN_PRICE`.
DUMP_COST = -MIN_PRICE
