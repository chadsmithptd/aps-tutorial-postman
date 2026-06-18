#!/usr/bin/env python3
"""
Temporary ERP — Bootstrap

Usage:
    python bootstrap.py <url>
    python bootstrap.py https://www.acmemachineworks.com

Reads a business website, infers an ontology with Claude, creates the
directory structure and seed tools.
"""

import json
import os
import re
import sys
import textwrap
import datetime

try:
    import requests
    from bs4 import BeautifulSoup
    import anthropic
except ImportError:
    print("Run: pip install -r requirements.txt")
    sys.exit(1)

ROOT = os.path.dirname(os.path.abspath(__file__))
client = anthropic.Anthropic()


# ---------------------------------------------------------------------------
# Website fetching
# ---------------------------------------------------------------------------

def fetch_website(url: str) -> str:
    """Fetch a URL and return plain text, truncated to ~8000 chars."""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; TempERP/1.0)"}
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    return text[:8000]


# ---------------------------------------------------------------------------
# Claude: infer ontology
# ---------------------------------------------------------------------------

ONTOLOGY_PROMPT = """You are analyzing a business website to design a minimal tracking system.

Website content:
---
{website_text}
---

Based on this, return a JSON object describing the business ontology. Follow this exact structure:

{{
  "business_name": "...",
  "business_type": "short description",
  "inferred_from": "{url}",
  "entities": {{
    "<entity_name>": {{
      "description": "one sentence",
      "key_fields": ["field1", "field2", ...],
      "status_values": ["status1", "status2", ...],
      "workflows": ["status1 → status2 → status3"]
    }}
  }},
  "primary_workflow": "<entity_name that is the main thing they track>",
  "tracking_priorities": ["what matters most", "second priority", "third"],
  "generated_at": "{timestamp}"
}}

Rules:
- Include 2-5 entities (the things this business tracks day-to-day)
- key_fields should be 4-8 fields a person would actually fill in
- status_values should reflect the real lifecycle of that entity
- primary_workflow is the single entity type that drives the business
- tracking_priorities are the 3 most important things to stay on top of
- Keep it minimal — this is a starting point, not a full ERP spec
- Return ONLY the JSON, no explanation"""


def infer_ontology(url: str, website_text: str) -> dict:
    prompt = ONTOLOGY_PROMPT.format(
        website_text=website_text,
        url=url,
        timestamp=datetime.datetime.now().isoformat(timespec="seconds"),
    )
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    # strip markdown fences if present
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Claude: generate seed tools
# ---------------------------------------------------------------------------

TOOL_TEMPLATE = open(os.path.join(ROOT, "ai", "tool_template.py")).read() if os.path.exists(
    os.path.join(ROOT, "ai", "tool_template.py")
) else ""

SEED_TOOLS_PROMPT = """You are writing Python scripts for a file-based business ERP.

Business ontology:
{ontology}

Root directory layout:
- ontology.json          (the ontology above)
- config/settings.json   (business name, timezone, work hours)
- config/<entity>.json   (registry for each non-primary entity, e.g. machines, operators)
- <primary_entity>/      (one subfolder per status_value, e.g. active/, quoting/, completed/)
  └── <ID>/
      ├── record.json    (all key_fields for this entity)
      └── notes.md       (free-text log)
- tools/                 (all scripts live here)
- logs/audit.csv         (every tool invocation: timestamp, tool, args)

Tool convention (MUST follow exactly):
{template}

Generate exactly these 4 tools as separate files. For each file output:
=== FILENAME: tools/<name>.py ===
<complete script>
=== END ===

Tools to generate:
1. new_{primary}.py — interactive prompts (or --json flag) to create a new {primary} record; generates a unique ID like {PRIMARY}-YYYY-NNN; creates the folder and record.json; appends to audit.csv
2. status.py — prints a terminal summary: for each status bucket, list records with key fields and flag anything overdue or missing required fields; reads all record.json files
3. update.py — update any field on a record: `python tools/update.py <ID> --status active --field customer "Acme Corp"`; also supports --note "text" to append to notes.md
4. ask.py — AI advisor: `python tools/ask.py "question"` or `--interactive`; reads context_builder output, calls Claude, prints answer; detects fenced code blocks and offers to save as generated tool

Important:
- All paths relative to SHOP_ROOT (dirname of dirname of __file__ since tools/ is one level down)
- Atomic writes: write to .tmp file then os.replace()
- ID format: uppercase entity prefix + YYYY + zero-padded sequence from counting existing folders
- ask.py must import from ai.context_builder and use model claude-haiku-4-5-20251001
- Every tool appends to logs/audit.csv on each run
- No external dependencies beyond what's in requirements.txt (anthropic, requests, beautifulsoup4)
- Make the tools genuinely useful, not toy examples"""


def generate_seed_tools(ontology: dict) -> dict[str, str]:
    """Returns dict of filename → script content."""
    primary = ontology.get("primary_workflow", "record")
    prompt = SEED_TOOLS_PROMPT.format(
        ontology=json.dumps(ontology, indent=2),
        template=TOOL_TEMPLATE,
        primary=primary,
        PRIMARY=primary.upper(),
    )
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text
    tools = {}
    pattern = re.compile(
        r"=== FILENAME: (tools/[^\s]+\.py) ===\n(.*?)\n=== END ===",
        re.DOTALL,
    )
    for match in pattern.finditer(raw):
        filename = match.group(1)
        content = match.group(2).strip()
        tools[filename] = content
    return tools


# ---------------------------------------------------------------------------
# Claude: generate system prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT_TEMPLATE = """You are an experienced business advisor and operations expert for {business_name}, a {business_type}.

You have been given the current state of the business in JSON format.
Answer questions concisely and practically. When you recommend actions, explain the reason in one sentence.
When you see a potential problem (overdue item, missing data, underutilized resource), flag it proactively.
You can suggest new tracking fields or new tools if you think they'd help — output any tool suggestions as fenced Python code blocks.
Keep answers short and direct.

Key things to watch:
{priorities}
"""


def generate_system_prompt(ontology: dict) -> str:
    priorities = "\n".join(f"- {p}" for p in ontology.get("tracking_priorities", []))
    return SYSTEM_PROMPT_TEMPLATE.format(
        business_name=ontology.get("business_name", "the business"),
        business_type=ontology.get("business_type", "business"),
        priorities=priorities,
    )


# ---------------------------------------------------------------------------
# Directory structure creation
# ---------------------------------------------------------------------------

def create_structure(ontology: dict, base: str = ROOT):
    primary = ontology.get("primary_workflow", "records")
    entities = ontology.get("entities", {})

    dirs = [
        "config",
        "tools",
        "tools/generated",
        "ai",
        "ai/prompts",
        "logs",
    ]

    primary_entity = entities.get(primary, {})
    for status in primary_entity.get("status_values", ["active", "completed"]):
        dirs.append(f"{primary}/{status}")

    for d in dirs:
        os.makedirs(os.path.join(base, d), exist_ok=True)

    # audit log header
    audit_path = os.path.join(base, "logs", "audit.csv")
    if not os.path.exists(audit_path):
        with open(audit_path, "w") as f:
            f.write("timestamp,tool,args\n")

    # generated tools index
    gen_readme = os.path.join(base, "tools", "generated", "README.md")
    if not os.path.exists(gen_readme):
        with open(gen_readme, "w") as f:
            f.write("# Generated Tools\n\nTools created on demand by `make_tool.py`.\n\n| File | Purpose |\n|------|---------|  \n")


def write_seed_configs(ontology: dict, base: str = ROOT):
    primary = ontology.get("primary_workflow", "records")
    entities = ontology.get("entities", {})

    settings = {
        "business_name": ontology.get("business_name", "My Business"),
        "business_type": ontology.get("business_type", ""),
        "timezone": "America/Chicago",
        "work_hours": {"start": "08:00", "end": "17:00"},
    }
    _write_json(os.path.join(base, "config", "settings.json"), settings)

    for name, entity in entities.items():
        if name == primary:
            continue
        registry_path = os.path.join(base, "config", f"{name}.json")
        if not os.path.exists(registry_path):
            _write_json(registry_path, {f"{name}s": []})


def _write_json(path: str, data: dict):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# Print helpers
# ---------------------------------------------------------------------------

def print_ontology(ontology: dict):
    print("\n" + "=" * 60)
    print(f"  Business: {ontology.get('business_name')}")
    print(f"  Type:     {ontology.get('business_type')}")
    print(f"  Primary:  {ontology.get('primary_workflow')}")
    print()
    print("  Entities:")
    for name, entity in ontology.get("entities", {}).items():
        fields = ", ".join(entity.get("key_fields", []))
        print(f"    [{name}]  {entity.get('description', '')}")
        print(f"      fields:   {fields}")
        statuses = " → ".join(entity.get("status_values", []))
        if statuses:
            print(f"      statuses: {statuses}")
    print()
    print("  Tracking priorities:")
    for p in ontology.get("tracking_priorities", []):
        print(f"    • {p}")
    print("=" * 60 + "\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: python bootstrap.py <url>")
        sys.exit(1)

    url = sys.argv[1]

    print(f"\nFetching {url} ...")
    try:
        website_text = fetch_website(url)
    except Exception as e:
        print(f"Could not fetch website: {e}")
        sys.exit(1)

    print("Analyzing business with Claude ...")
    ontology = infer_ontology(url, website_text)

    print_ontology(ontology)

    answer = input("Does this look right? [Y/n/edit] ").strip().lower()
    if answer == "edit":
        print("\nPaste the edited ontology JSON, then press Ctrl-D (or Ctrl-Z on Windows):")
        lines = []
        try:
            while True:
                lines.append(input())
        except EOFError:
            pass
        ontology = json.loads("\n".join(lines))
        print_ontology(ontology)
    elif answer == "n":
        print("Exiting. Edit the URL or re-run.")
        sys.exit(0)

    print("\nCreating directory structure ...")
    create_structure(ontology)
    write_seed_configs(ontology)

    # Write ontology.json
    _write_json(os.path.join(ROOT, "ontology.json"), ontology)
    print("  ontology.json written")

    print("\nGenerating seed tools with Claude ...")
    tools = generate_seed_tools(ontology)
    for filename, content in tools.items():
        path = os.path.join(ROOT, filename)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write(content)
        os.chmod(path, 0o755)
        print(f"  {filename}")

    # Write system prompt (business-specific, so we generate it)
    system_prompt = generate_system_prompt(ontology)
    with open(os.path.join(ROOT, "ai", "prompts", "advisor_system.md"), "w") as f:
        f.write(system_prompt)
    print("  ai/prompts/advisor_system.md")

    primary = ontology.get("primary_workflow", "records")
    print(f"""
Done! Your temporary ERP is ready.

Quick start:
  python tools/new_{primary}.py          # create your first {primary}
  python tools/status.py                 # see what's happening
  python tools/ask.py "your question"    # ask the AI advisor
  python tools/make_tool.py "I need..." # generate a new tool on demand

Edit ontology.json anytime to adjust what gets tracked.
""")




if __name__ == "__main__":
    main()
