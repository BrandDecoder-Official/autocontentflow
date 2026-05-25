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
            parts = content.split("```")
            # Every odd index in parts is a code block
            for idx in range(1, len(parts), 2):
                block = parts[idx]
                # Strip language identifier if present
                if block.startswith("javascript\n"):
                    block = block[11:]
                elif block.startswith("js\n"):
                    block = block[3:]
                elif block.startswith("html\n"):
                    continue
                
                if 'renderSmartExpressReviewCard' in block:
                    out_path = os.path.join(out_dir, f"block_step_{step}_{idx}.js")
                    with open(out_path, 'w', encoding='utf-8') as out_f:
                        out_f.write(block)
                    print(f"Extracted Step {step} Block {idx} (len: {len(block)}) to {out_path}")
