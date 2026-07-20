PARSING_INSTRUCTION_EN = "\n".join([
    "This is a medical/clinical document.",
    "Preserve all tables in full markdown table format — do not flatten them into paragraphs "
    "or bullet lists, and do not summarize or drop any rows or columns.",
    "Preserve section headings using markdown '#' syntax at their correct hierarchy level "
    "(e.g. main sections as '#', subsections as '##', etc.).",
    "Preserve numbered lists and clinical criteria exactly as structured in the original document, "
    "keeping list numbering and nesting intact.",
    "Do not merge distinct sections or headings into a single block of body text.",
    "If a page contains scanned or low-quality text, extract as much readable text as possible "
    "rather than leaving the page empty.",
])