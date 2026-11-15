"""Unit tests for Workshop's policy votes (#1014): the tally, and when a carbon tax is in force."""

from __future__ import annotations

from energetica.workshop.votes import VoteOutcome, carbon_tax_since, passes, vote_held


def test_a_vote_passes_with_more_yes_than_no_among_those_who_voted() -> None:
    assert passes(["yes", "yes", "no"])
    assert not passes(["yes", "no", "no"])


def test_a_tie_fails() -> None:
    assert not passes(["yes", "no"])


def test_a_vote_nobody_cast_a_ballot_in_fails() -> None:
    assert not passes([])


def test_no_carbon_tax_is_in_force_until_a_vote_passes() -> None:
    assert carbon_tax_since([]) is None
    assert carbon_tax_since([VoteOutcome(round=2, passed=False)]) is None


def test_a_carbon_tax_is_in_force_from_the_round_its_vote_passed() -> None:
    outcomes = [VoteOutcome(round=1, passed=False), VoteOutcome(round=3, passed=True)]

    assert carbon_tax_since(outcomes) == 3


def test_a_round_holds_a_vote_when_its_lever_is_on() -> None:
    assert vote_held(lever=True, round_number=2, outcomes=[VoteOutcome(round=1, passed=False)])
    assert not vote_held(lever=False, round_number=2, outcomes=[])


def test_no_round_holds_a_vote_once_a_carbon_tax_passed_before_it() -> None:
    assert not vote_held(lever=True, round_number=3, outcomes=[VoteOutcome(round=2, passed=True)])


def test_a_round_still_holds_its_own_vote_once_it_passed() -> None:
    # The outcome is recorded when the Investment phase closes, but it is still that Round's vote.
    assert vote_held(lever=True, round_number=2, outcomes=[VoteOutcome(round=2, passed=True)])
