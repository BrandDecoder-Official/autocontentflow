import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

log_path = r"C:\Users\kclun\.gemini\antigravity\brain\0759604c-9c9d-4779-9368-cf8bdb4c6d3a\.system_generated\logs\transcript.jsonl"
out_dir = r"C:\Users\kclun\.gemini\antigravity\brain\0759604c-9c9d-4779-9368-cf8bdb4c6d3a\scratch"

with open(log_path, 'r', encoding='utf-8') as f:
    for line_num, line in enumerate(f):
        if not line.strip():
            continue
        try:
            data = json.loads(line)
        except Exception:
            continue
        
        content = data.get('content', '')
        if content and 'renderSmartExpressReviewCard' in content:
            step = data.get('step_index')
            stype = data.get('type')
            if len(content) > 500:
                out_path = os.path.join(out_dir, f"raw_msg_step_{step}.txt")
                with open(out_path, 'w', encoding='utf-8') as out_f:
                    out_f.write(content)
                print(f"Dumped Step {step} message (len: {len(content)}) to {out_path}")
