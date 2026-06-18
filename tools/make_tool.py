#!/usr/bin/env python3
"""
TOOL: make_tool
PURPOSE: Generate a new ERP tool on demand using Claude
USAGE: python tools/make_tool.py "description of what I need"
READS: ontology.json, ai/tool_template.py, tools/
WRITES: tools/generated/<name>.py, tools/generated/README.md, logs/audit.csv
"""

# --- 1. IMPORTS ---
import json, os, sys, re, csv, datetime

SHOP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

try:
    import anthropic
except ImportError:
    print("Run: pip install -r requirements.txt")
    sys.exit(1)

client = anthropic.Anthropic()


# --- 2. HELPERS ---

def load_json(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def log_audit(tool: str, args: str = ""):
    path = os.path.join(SHOP_ROOT, "logs", "audit.csv")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", newline="") as f:
        csv.writer(f).writerow([datetime.datetime.now().isoformat(timespec="seconds"), tool, args])


def list_existing_tools() -> list:
    tools_dir = os.path.join(SHOP_ROOT, "tools")
    result = []
    for f in sorted(os.listdir(tools_dir)):
        if f.endswith(".py"):
            result.append(f"tools/{f}")
    gen_dir = os.path.join(tools_dir, "generated")
    if os.path.isdir(gen_dir):
        for f in sorted(os.listdir(gen_dir)):
            if f.endswith(".py"):
                result.append(f"tools/generated/{f}")
    return result


def get_template() -> str:
    path = os.path.join(SHOP_ROOT, "ai", "tool_template.py")
    if os.path.exists(path):
        return open(path).read()
    return ""


def generate_tool(description: str) -> tuple:
    """Returns (filename, script_content)."""
    ontology_path = os.path.join(SHOP_ROOT, "ontology.json")
    ontology = load_json(ontology_path) if os.path.exists(ontology_path) else {}
    primary = ontology.get("primary_workflow", "records")

    existing = "\n".join(list_existing_tools())
    template = get_template()

    prompt = f"""You are writing a Python script for a file-based business ERP.

Business ontology:
{json.dumps(ontology, indent=2)}

Existing tools (do not duplicate their purpose):
{existing}

Directory layout (SHOP_ROOT is the root):
- ontology.json
- config/<entity>.json  (registries for non-primary entities)
- {primary}/<status>/<ID>/record.json
- {primary}/<status>/<ID>/notes.md
- logs/audit.csv

Tool convention (follow exactly):
{template}

Task: Write a complete, working Python script that does the following:
{description}

Output format — use exactly these delimiters:
=== FILENAME: tools/generated/<snake_case_name>.py ===
<complete script content>
=== END ===

Requirements:
- SHOP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
- Call log_audit() on every run
- Atomic writes: write .tmp then os.replace()
- Use only stdlib + anthropic (already imported elsewhere — do not call Claude from generated tools unless ask.py)
- The script must be complete and runnable as-is"""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text

    # try strict format first
    match = re.search(
        r"=== FILENAME: (tools/generated/[^\s\n]+\.py) ===\n(.*?)\n=== END ===",
        raw,
        re.DOTALL,
    )
    if match:
        return match.group(1), match.group(2).strip()

    # fallback: any fenced Python block
    code_match = re.search(r"```python\n(.*?)```", raw, re.DOTALL)
    if code_match:
        slug = re.sub(r"[^a-z0-9]+", "_", description[:40].lower()).strip("_")
        return f"tools/generated/{slug}.py", code_match.group(1).strip()

    raise ValueError(
        "Claude did not return a tool in the expected format.\n"
        "Response preview:\n" + raw[:600]
    )


def append_to_readme(filename: str, description: str):
    readme = os.path.join(SHOP_ROOT, "tools", "generated", "README.md")
    if not os.path.exists(readme):
        with open(readme, "w") as f:
            f.write("# Generated Tools\n\n| File | Purpose |\n|------|---------|  \n")
    with open(readme, "a") as f:
        name = os.path.basename(filename)
        f.write(f"| {name} | {description} |\n")


# --- 3. MAIN LOGIC ---

def main():
    if len(sys.argv) < 2:
        print('Usage: python tools/make_tool.py "description of what I need"')
        sys.exit(1)

    description = " ".join(sys.argv[1:])
    log_audit("make_tool", description)

    print(f"\nGenerating: {description}")
    print("Thinking ...")

    try:
        filename, content = generate_tool(description)
    except ValueError as e:
        print(f"\nError: {e}")
        sys.exit(1)

    print(f"\nProposed: {filename}\n")
    print("-" * 50)
    print(content[:600] + ("..." if len(content) > 600 else ""))
    print("-" * 50)

    save = input("\nSave this tool? [Y/n] ").strip().lower()
    if save == "n":
        print("Discarded.")
        return

    path = os.path.join(SHOP_ROOT, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    os.chmod(path, 0o755)
    append_to_readme(filename, description)
    print(f"\nSaved: {filename}")

    run = input("Run it now? [y/N] ").strip().lower()
    if run == "y":
        os.system(f"python {path}")


# --- 4. ENTRY POINT ---

if __name__ == "__main__":
    main()
