import hashlib


def stable_hash(*args) -> int:
    """
    Generate a deterministic, positive integer hash from arbitrary input values for RNG seeding. (This function is used
    to create consistent random seeds across different runs of the program. Unlike Python's built-in `hash()`, which is
    randomized for security reasons, this function produces the same output every time for the same inputs.)
    """
    # Join the arguments into a single string with separators, encode and convert to an integer
    hash_input = "|".join(map(str, args))
    hash_hex = hashlib.sha256(hash_input.encode()).hexdigest()
    return int(hash_hex[:16], 16)
