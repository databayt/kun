---
name: convert
description: Convert a file or URL to Markdown via MarkItDown (PDF, Office, images, audio, web)
when_to_use: "Use when a file or URL needs to become clean Markdown — PDFs, Office docs (DOCX/PPTX/XLSX), images, audio, web pages, YouTube transcripts — via the MarkItDown MCP, landing in docs/, a knowledge base, or printed to the session. Triggers on: convert <file|url>, markitdown, markdown this PDF, pull this page into docs, transcribe this video."
argument-hint: "<file-or-url> [out.md | -]"
---

# Convert to Markdown

Turn almost any document or web page into clean Markdown using Microsoft's
**MarkItDown** (`markitdown` MCP server). Useful for pulling external sources —
proposals, regulator PDFs, Office decks, web pages — into the repo's `docs/`,
a knowledge base, or the content pipeline as Markdown the model can read.

## Arguments

- `$1`: Source — a local file path **or** a URL.
  - Local: any format MarkItDown supports (PDF, DOCX, PPTX, XLSX/XLS, Outlook
    `.msg`, PNG/JPG, MP3/WAV, HTML, CSV/JSON/XML, EPub, ZIP).
  - URL: any `http(s)://…` page, including YouTube links.
- `$2` _(optional)_: Output target.
  - Omitted → write Markdown to `<source-basename>.md` next to a local source,
    or `<slug>.md` in the current directory for a URL.
  - A path → write there (creating parent dirs if needed).
  - `-` → print the Markdown to the session instead of writing a file.

## Examples

```
/convert proposal.pdf                      → proposal.md (next to source)
/convert deck.pptx docs/notes/deck.md      → writes to that path
/convert https://example.com/post -        → prints Markdown to the session
/convert https://youtu.be/abc123           → abc123.md (transcript) in CWD
```

## Process

1. **Resolve the URI** for `mcp__markitdown__convert_to_markdown`:
   - Local path → absolute path, prefixed `file://`.
   - URL → pass `http(s)://…` through unchanged.
   - (MarkItDown also accepts `data:` URIs if a caller supplies one.)
2. **Convert** — call `mcp__markitdown__convert_to_markdown` with that `uri`.
   It returns the Markdown text.
3. **Write or print**:
   - Default → resolve the output path per `$2` rules above and write the
     returned Markdown (create parent dirs as needed).
   - `-` → print the Markdown to the session.
4. **Summarize** — one line: `source → output` plus line/byte count. For local
   files, spot-check that headings/tables/lists survived; flag any section that
   came back empty (often an image-only PDF needing OCR, or audio without
   `ffmpeg` installed).

## Notes

- Runs via `uvx markitdown-mcp` (no API key). First invocation in a session may
  pause while `uv` provisions the cached environment.
- Plain-language requests like "convert this PDF to markdown: <path>" route to
  the same `markitdown` tool without typing `/convert`.
- Audio transcription needs `ffmpeg`; image EXIF needs `exiftool` (`brew install`).
- Image-only/scanned PDFs: upstream ships a `markitdown-ocr` plugin
  (`--use-plugins --llm-client … --llm-model …`) — it needs an OpenAI-compatible
  API key, which the subscription-only billing posture forbids; adopting it
  requires a `/decide`. Until then, flag scanned sections as unconverted.

Convert source: $ARGUMENTS
