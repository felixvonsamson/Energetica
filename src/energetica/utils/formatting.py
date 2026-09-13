"""Utility functions for formatting things into text."""


def display_money(price: float) -> str:
    """Format for price display."""
    # The label is derived from the rendered digits, not from `price`, so it can never
    # disagree with what is printed (a price of 1.4 renders "1" and must read "1 coin").
    formatted = f"{price:,.0f}".replace(",", "'")
    return formatted + (" coin" if formatted == "1" else " coins")


def format_mass(mass: float) -> str:
    """Format mass in kg into a string with corresponding unit."""
    if mass < 50_000:
        formatted_mass = f"{int(mass):,d}".replace(",", "'") + " kg"
    else:
        formatted_mass = f"{mass / 1000:,.0f}".replace(",", "'") + " t"
    return formatted_mass
