import json
import sys
import os

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
            print(f"Step {step} (Line {line_num}): type={stype}, len={len(content)}")
            # Try to find all code blocks
            idx = 0
            start = 0
            while True:
                pos = content.find("```", start)
                if pos == -1:
                    break
                # Find end of code block
                end = content.find("```", pos + 3)
                if end == -1:
                    break
                block = content[pos+3:end]
                if 'renderSmartExpressReviewCard' in block:
                    out_path = os.path.join(out_dir, f"block_recovered_step_{step}_{idx}.js")
                    with open(out_path, 'w', encoding='utf-8') as out_f:
                        out_f.write(block)
                    print(f"  Saved block {idx} (len: {len(block)}) to {out_path}")
                    idx += 1
                start = end + 3
