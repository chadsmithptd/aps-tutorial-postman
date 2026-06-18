"""
context_builder — assembles a structured snapshot of the business state
for use by the AI advisor. Reads ontology.json to know what to look for.
"""

import json
import os
import glob
import datetime


def load_json(path):
    with open(path) as f:
        return json.load(f)


def build_context(root: str) -> str:
    ontology_path = os.path.join(root, "ontology.json")
    if not os.path.exists(ontology_path):
        return json.dumps({"error": "ontology.json not found — run bootstrap.py first"})

    ontology = load_json(ontology_path)
    primary = ontology.get("primary_workflow", "records")
    entities = ontology.get("entities", {})
    primary_entity = entities.get(primary, {})
    status_values = primary_entity.get("status_values", [])

    # settings
    settings_path = os.path.join(root, "config", "settings.json")
    settings = load_json(settings_path) if os.path.exists(settings_path) else {}

    # registries (non-primary entities)
    registries = {}
    for name in entities:
        if name == primary:
            continue
        reg_path = os.path.join(root, "config", f"{name}.json")
        if os.path.exists(reg_path):
            registries[name] = load_json(reg_path)

    # primary entity records, grouped by status
    records_by_status = {}
    now = datetime.datetime.now()
    all_records = []

    for status in status_values:
        bucket_dir = os.path.join(root, primary, status)
        if not os.path.isdir(bucket_dir):
            continue
        bucket_records = []
        for record_dir in sorted(glob.glob(os.path.join(bucket_dir, "*"))):
            record_path = os.path.join(record_dir, "record.json")
            if not os.path.exists(record_path):
                continue
            rec = load_json(record_path)
            rec["_status"] = status
            rec["_id"] = os.path.basename(record_dir)

            due = rec.get("due_date")
            if due:
                try:
                    due_dt = datetime.datetime.fromisoformat(due)
                    rec["_days_until_due"] = (due_dt - now).days
                except Exception:
                    pass

            bucket_records.append(rec)
            all_records.append(rec)
        records_by_status[status] = bucket_records

    overdue = [r for r in all_records if r.get("_days_until_due", 999) < 0]
    urgent_soon = [r for r in all_records if 0 <= r.get("_days_until_due", 999) <= 2]

    context = {
        "as_of": now.isoformat(timespec="seconds"),
        "business": settings,
        "ontology_summary": {
            "primary_workflow": primary,
            "tracking_priorities": ontology.get("tracking_priorities", []),
        },
        "registries": registries,
        "records": records_by_status,
        "flags": {
            "overdue_count": len(overdue),
            "overdue": [r.get("_id") for r in overdue],
            "due_within_2_days": [r.get("_id") for r in urgent_soon],
        },
    }

    return json.dumps(context, indent=2, default=str)
