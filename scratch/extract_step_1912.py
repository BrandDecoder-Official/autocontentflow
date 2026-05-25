import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

log_path = r"C:\Users\kclun\.gemini\antigravity\brain\0759604c-9c9d-4779-9368-cf8bdb4c6d3a\.system_generated\logs\transcript.jsonl"

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        if not line.strip():
            continue
        try:
            data = json.loads(line)
            if data.get('step_index') == 1912:
                print(json.dumps(data, indent=2, ensure_ascii=False)[:3000])
                break
        except Exception as e:
            pass
