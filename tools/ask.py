#!/usr/bin/env python3
"""
TOOL: ask
PURPOSE: AI advisor — ask questions about the current business state
USAGE: python tools/ask.py "your question"
       python tools/ask.py --interactive
READS: ontology.json, config/, <primary>/, logs/
WRITES: tools/generated/<name>.py (optional, when Claude suggests a tool)
"""

# --- 1. IMPORTS ---
import json, os, sys, re, csv, datetime, argparse

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


def save_json(path: str, data: dict):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


def log_audit(tool: str, args: str = ""):
    path = os.path.join(SHOP_ROOT, "logs", "audit.csv")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", newline="") as f:
        csv.writer(f).writerow([datetime.datetime.now().isoformat(timespec="seconds"), tool, args])


def get_system_prompt() -> str:
    prompt_path = os.path.join(SHOP_ROOT, "ai", "prompts", "advisor_system.md")
    if os.path.exists(prompt_path):
        return open(prompt_path).read()
    ontology_path = os.path.join(SHOP_ROOT, "ontology.json")
    if os.path.exists(ontology_path):
        o = load_json(ontology_path)
        return (
            f"You are an experienced business advisor for {o.get('business_name', 'this business')}, "
            f"a {o.get('business_type', 'business')}. "
            "Answer questions concisely and practically. "
            "When you suggest a new tool, output complete Python code in a fenced block. "
            "Never write to any data file — only advise."
        )
    return (
        "You are an experienced business advisor. "
        "Answer questions concisely. "
        "AI suggestion — verify before acting."
    )


def build_context() -> str:
    context_builder = os.path.join(SHOP_ROOT, "ai", "context_builder.py")
    if os.path.exists(context_builder):
        import importlib.util
        spec = importlib.util.spec_from_file_location("context_builder", context_builder)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod.build_context(SHOP_ROOT)

    # fallback: read what we can
    parts = {}
    ontology_path = os.path.join(SHOP_ROOT, "ontology.json")
    if os.path.exists(ontology_path):
        parts["ontology"] = load_json(ontology_path)
    return json.dumps(parts, indent=2, default=str)


def extract_and_offer_tool(response_text: str):
    """If Claude embedded a fenced Python block, offer to save it as a tool."""
    matches = re.findall(r"```python\n(.*?)```", response_text, re.DOTALL)
    if not matches:
        return
    for i, code in enumerate(matches):
        print(f"\n[Claude suggested a tool (block {i+1}/{len(matches)})]")
        preview = code.strip()[:200]
        print(preview + ("..." if len(code) > 200 else ""))
        save = input("\nSave as a generated tool? [y/N] ").strip().lower()
        if save != "y":
            continue
        name = input("Tool name (without .py): ").strip() or f"generated_{i+1}"
        gen_dir = os.path.join(SHOP_ROOT, "tools", "generated")
        os.makedirs(gen_dir, exist_ok=True)
        path = os.path.join(gen_dir, f"{name}.py")
        with open(path, "w") as f:
            f.write(code.strip())
        os.chmod(path, 0o755)
        # append to generated README
        readme = os.path.join(gen_dir, "README.md")
        if os.path.exists(readme):
            with open(readme, "a") as f:
                f.write(f"| {name}.py | (from AI advisor session) |\n")
        print(f"Saved to tools/generated/{name}.py")


def ask_claude(question: str, conversation: list) -> str:
    context = build_context()
    system = get_system_prompt()

    messages = list(conversation)
    if not messages:
        # first message: include context
        content = f"Current business state:\n{context}\n\nQuestion: {question}"
    else:
        content = question

    messages.append({"role": "user", "content": content})

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system + "\n\nAI suggestion — verify before acting.",
        messages=messages,
    )
    answer = response.content[0].text
    messages.append({"role": "assistant", "content": answer})
    return answer, messages


# --- 3. MAIN LOGIC ---

def main():
    parser = argparse.ArgumentParser(description="AI advisor for your business ERP")
    parser.add_argument("question", nargs="*", help="Question to ask")
    parser.add_argument("--interactive", "-i", action="store_true", help="Interactive conversation mode")
    args = parser.parse_args()

    log_audit("ask", " ".join(args.question or []))

    if args.interactive or not args.question:
        print("\nAI Advisor — interactive mode (Ctrl-C to exit)\n")
        conversation = []
        while True:
            try:
                question = input("You: ").strip()
            except (KeyboardInterrupt, EOFError):
                print("\nGoodbye.")
                break
            if not question:
                continue
            try:
                answer, conversation = ask_claude(question, conversation)
            except Exception as e:
                print(f"Error: {e}")
                continue
            print(f"\nAdvisor: {answer}\n")
            extract_and_offer_tool(answer)
    else:
        question = " ".join(args.question)
        try:
            answer, _ = ask_claude(question, [])
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
        print(f"\n{answer}\n")
        extract_and_offer_tool(answer)


# --- 4. ENTRY POINT ---

if __name__ == "__main__":
    main()
