import hashlib
from apps.api.app.services.markdown_parser import (
    extract_headings,
    extract_plain_text,
    parse_markdown_sections,
    parse_wiki_links,
)
from apps.api.app.services.search_service import compute_rrf_score
from apps.api.app.api.deps import ROLE_HIERARCHY


def test_markdown_section_parser_hierarchy():
    markdown = """# Title
Root intro text.

## Architecture
Architecture overview.

### Storage
Postgres database details.

### Caching
Redis cache details.
"""
    sections = parse_markdown_sections(markdown, doc_title="Title")
    assert len(sections) == 4
    assert sections[0].heading_path == "Title"
    assert sections[0].content_text == "Root intro text."
    assert sections[1].heading_path == "Title > Architecture"
    assert sections[2].heading_path == "Title > Architecture > Storage"
    assert sections[3].heading_path == "Title > Architecture > Caching"


def test_section_content_hash_idempotency():
    markdown = "Some unchanged text for hashing."
    s1 = parse_markdown_sections(markdown, "Doc")[0]
    s2 = parse_markdown_sections(markdown, "Doc")[0]
    assert s1.content_hash == s2.content_hash
    assert s1.content_hash == hashlib.sha256(markdown.encode("utf-8")).hexdigest()


def test_wiki_link_parser():
    md = "Here is a link to [[System Architecture]] and [[Database Notes#Indexing Strategy]] and another [[System Architecture]]."
    links = parse_wiki_links(md)
    assert len(links) == 2
    assert links[0].target_title == "System Architecture"
    assert links[0].target_heading is None
    assert links[1].target_title == "Database Notes"
    assert links[1].target_heading == "Indexing Strategy"


def test_plain_text_extraction():
    md = "## Heading\nThis has **bold** text, `code snippet`, and [[A Link]]."
    plain = extract_plain_text(md)
    assert "bold" in plain
    assert "Heading" in plain
    assert "**" not in plain
    assert "[[" not in plain


def test_extract_headings_toc():
    md = "# First\nText\n## Second Sub\nMore text\n### Third"
    headings = extract_headings(md)
    assert len(headings) == 3
    assert headings[0] == {"level": 1, "title": "First", "slug": "first"}
    assert headings[1] == {"level": 2, "title": "Second Sub", "slug": "second-sub"}


def test_reciprocal_rank_fusion():
    # Document ranked 1 in both keyword and semantic
    score_both = compute_rrf_score(keyword_rank=1, semantic_rank=1, k=60)
    expected_both = (1.0 / 61) + (1.0 / 61)
    assert abs(score_both - expected_both) < 1e-6

    # Document ranked 1 in keyword, not in semantic
    score_k_only = compute_rrf_score(keyword_rank=1, semantic_rank=None, k=60)
    expected_k = 1.0 / 61
    assert abs(score_k_only - expected_k) < 1e-6

    # Both ranks strictly produce higher score than one rank
    assert score_both > score_k_only


def test_role_hierarchy_precedence():
    assert ROLE_HIERARCHY["owner"] > ROLE_HIERARCHY["editor"]
    assert ROLE_HIERARCHY["editor"] > ROLE_HIERARCHY["viewer"]
    assert ROLE_HIERARCHY["viewer"] >= 1
