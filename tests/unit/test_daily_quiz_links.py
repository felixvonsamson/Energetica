"""Tests for daily quiz question links to ensure they're not stale or broken."""

import csv
from pathlib import Path
from urllib.parse import urlparse

import pytest
import requests


QUIZ_CSV_PATH = Path(__file__).parent.parent.parent / "energetica" / "static" / "data" / "daily_quiz_questions.csv"

# Timeout for HTTP requests in seconds
REQUEST_TIMEOUT = 10

# User agent to use in requests
USER_AGENT = "Mozilla/5.0 (compatible; Energetica-LinkChecker/1.0)"


def load_quiz_links() -> list[dict[str, str]]:
    """Load all learn_more_links from the quiz CSV file."""
    links = []
    with open(QUIZ_CSV_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):  # start=2 because headers are row 1
            link = row.get("learn_more_link", "").strip()
            if link:
                links.append({"url": link, "row": i, "question": row.get("question", "")[:50]})
    return links


def test_quiz_csv_exists() -> None:
    """Test that the quiz CSV file exists."""
    assert QUIZ_CSV_PATH.exists(), f"Quiz CSV file not found at {QUIZ_CSV_PATH}"


def test_quiz_has_links() -> None:
    """Test that the quiz CSV has at least some links."""
    links = load_quiz_links()
    assert len(links) > 0, "No links found in quiz CSV"


@pytest.mark.external_links
@pytest.mark.parametrize("link_data", load_quiz_links(), ids=lambda x: f"row_{x['row']}")
def test_quiz_link_accessible(link_data: dict[str, str]) -> None:
    """Test that each quiz link is accessible and doesn't return 4XX or 5XX errors."""
    url = link_data["url"]
    row = link_data["row"]
    question_preview = link_data["question"]

    # Validate URL format
    parsed = urlparse(url)
    assert parsed.scheme in ("http", "https"), f"Row {row}: Invalid URL scheme: {url}"
    assert parsed.netloc, f"Row {row}: Invalid URL (no domain): {url}"

    # Make request with timeout and user agent
    headers = {"User-Agent": USER_AGENT}

    try:
        # Use HEAD request first for efficiency, fall back to GET if needed
        response = requests.head(url, headers=headers, timeout=REQUEST_TIMEOUT, allow_redirects=True)

        # If HEAD fails with 405 (Method Not Allowed), try GET
        if response.status_code == 405:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT, allow_redirects=True)

        # Check for error status codes
        assert response.status_code < 400, (
            f"Row {row}: Link returned {response.status_code} ({response.reason})\n"
            f"URL: {url}\n"
            f"Question: {question_preview}..."
        )

    except requests.Timeout:
        pytest.fail(f"Row {row}: Request timeout after {REQUEST_TIMEOUT}s\nURL: {url}\nQuestion: {question_preview}...")
    except requests.RequestException as e:
        pytest.fail(
            f"Row {row}: Request failed with {type(e).__name__}: {e}\nURL: {url}\nQuestion: {question_preview}..."
        )


@pytest.mark.external_links
@pytest.mark.parametrize("link_data", load_quiz_links(), ids=lambda x: f"row_{x['row']}")
def test_quiz_link_url_valid(link_data: dict[str, str]) -> None:
    """Test that each URL is well-formed and parseable."""
    url = link_data["url"]
    row = link_data["row"]

    try:
        parsed = urlparse(url)
        assert parsed.scheme, f"Row {row}: URL missing scheme: {url}"
        assert parsed.netloc, f"Row {row}: URL missing domain: {url}"
    except Exception as e:
        pytest.fail(f"Row {row}: Failed to parse URL: {url}\nError: {e}")
