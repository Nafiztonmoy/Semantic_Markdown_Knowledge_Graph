import hashlib
import re
from typing import Dict, List, Optional
from markdown_it import MarkdownIt

md_engine = MarkdownIt("commonmark", {"breaks": True, "html": False})


class SectionChunk:
    def __init__(
        self,
        heading_path: str,
        heading_level: int,
        content_text: str,
        ordinal: int,
    ):
        self.heading_path = heading_path
        self.heading_level = heading_level
        self.content_text = content_text.strip()
        self.ordinal = ordinal
        self.token_count = max(1, len(self.content_text.split()))
        self.content_hash = hashlib.sha256(self.content_text.encode("utf-8")).hexdigest()

    def to_dict(self) -> Dict:
        return {
            "heading_path": self.heading_path,
            "heading_level": self.heading_level,
            "content_text": self.content_text,
            "ordinal": self.ordinal,
            "token_count": self.token_count,
            "content_hash": self.content_hash,
        }


class WikiLink:
    def __init__(self, raw: str, target_title: str, target_heading: Optional[str] = None):
        self.raw = raw
        self.target_title = target_title.strip()
        self.target_heading = target_heading.strip() if target_heading else None


def parse_wiki_links(markdown: str) -> List[WikiLink]:
    """
    Parses wiki links matching [[Target Title]] or [[Target Title#Target Heading]].
    """
    pattern = re.compile(r"\[\[([^\]]+)\]\]")
    links: List[WikiLink] = []
    seen = set()

    for match in pattern.finditer(markdown):
        content = match.group(1).strip()
        if not content:
            continue

        if "#" in content:
            parts = content.split("#", 1)
            target_title = parts[0].strip()
            target_heading = parts[1].strip()
        else:
            target_title = content
            target_heading = None

        key = (target_title.lower(), (target_heading or "").lower())
        if key not in seen:
            seen.add(key)
            links.append(WikiLink(raw=match.group(0), target_title=target_title, target_heading=target_heading))

    return links


def extract_plain_text(markdown: str) -> str:
    """
    Converts markdown to plain text by stripping markdown syntax.
    """
    text = markdown
    # Remove code blocks
    text = re.sub(r"```[\s\S]*?```", " ", text)
    # Remove inline code
    text = re.sub(r"`[^`]*`", " ", text)
    # Remove wiki links brackets
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    # Remove markdown links [text](url) -> text
    text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
    # Remove images ![alt](url) -> alt
    text = re.sub(r"!\[([^\]]*)\]\([^\)]+\)", r"\1", text)
    # Remove headers #
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Remove bold/italic * or _
    text = re.sub(r"[\*_]{1,3}", "", text)
    # Remove blockquotes >
    text = re.sub(r"^>\s+", "", text, flags=re.MULTILINE)
    # Remove horizontal rules
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_markdown_sections(markdown: str, doc_title: str = "Document") -> List[SectionChunk]:
    """
    Splits markdown into sections by heading hierarchy (#, ##, ###, etc.)
    Preserves heading_path (e.g. "Root > Overview > Background").
    """
    lines = markdown.splitlines()
    sections: List[SectionChunk] = []

    heading_regex = re.compile(r"^(#{1,6})\s+(.*)$")

    current_headings: Dict[int, str] = {}
    current_level = 0
    current_lines: List[str] = []
    ordinal = 0

    def current_heading_path() -> str:
        if not current_headings:
            return doc_title
        parts = [current_headings[k] for k in sorted(current_headings.keys()) if k <= current_level]
        return " > ".join(parts) if parts else doc_title

    for line in lines:
        match = heading_regex.match(line.strip())
        if match:
            level = len(match.group(1))
            heading_title = match.group(2).strip()

            if current_lines:
                content = "\n".join(current_lines).strip()
                if content:
                    sections.append(
                        SectionChunk(
                            heading_path=current_heading_path(),
                            heading_level=current_level if current_level > 0 else 1,
                            content_text=content,
                            ordinal=ordinal,
                        )
                    )
                    ordinal += 1
                current_lines = []

            # Update heading hierarchy
            current_level = level
            current_headings[level] = heading_title
            # Clear deeper levels
            keys_to_remove = [k for k in current_headings if k > level]
            for k in keys_to_remove:
                del current_headings[k]
        else:
            current_lines.append(line)

    # Flush last section
    if current_lines:
        content = "\n".join(current_lines).strip()
        if content:
            sections.append(
                SectionChunk(
                    heading_path=current_heading_path(),
                    heading_level=current_level if current_level > 0 else 1,
                    content_text=content,
                    ordinal=ordinal,
                )
            )

    # If the document had no content at all, create an empty section
    if not sections:
        sections.append(
            SectionChunk(
                heading_path=doc_title,
                heading_level=1,
                content_text=doc_title,
                ordinal=0,
            )
        )

    return sections


def extract_headings(markdown: str) -> List[Dict]:
    """
    Extracts all headings for Table of Contents generation.
    """
    heading_regex = re.compile(r"^(#{1,6})\s+(.*)$")
    toc = []
    for line in markdown.splitlines():
        match = heading_regex.match(line.strip())
        if match:
            level = len(match.group(1))
            title = match.group(2).strip()
            slug = re.sub(r"[^\w\s-]", "", title).strip().lower()
            slug = re.sub(r"[\s_-]+", "-", slug)
            toc.append({"level": level, "title": title, "slug": slug})
    return toc
