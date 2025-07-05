"""Utility functions for formatting things into text."""


def display_money(price: float) -> str:
    """Format for price display."""
    return f"{price:,.0f}<img src='/static/images/icons/coin.svg' class='coin' alt='coin'>".replace(",", "'")


def format_mass(mass: float) -> str:
    """Format mass in kg into a string with corresponding unit."""
    if mass < 50_000:
        formatted_mass = f"{int(mass):,d}".replace(",", "'") + " kg"
    else:
        formatted_mass = f"{mass / 1000:,.0f}".replace(",", "'") + " t"
    return formatted_mass
