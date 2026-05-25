import json
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

log_path = r"C:\Users\kclun\.gemini\antigravity\brain\0759604c-9c9d-4779-9368-cf8bdb4c6d3a\.system_generated\logs\transcript.jsonl"

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
            print(f"Found in Step {step} content! Type={stype}, length={len(content)}")
            # Search for JS code blocks
            code_blocks = re.findall(r"```javascript(.*?)```", content, re.DOTALL)
            if not code_blocks:
                code_blocks = re.findall(r"```js(.*?)```", content, re.DOTALL)
            
            for idx, block in enumerate(code_blocks):
                if 'renderSmartExpressReviewCard' in block:
                    out_path = f"C:\\Users\\kclun\\.gemini\\antigravity\\brain\\0759604c-9c9d-4779-9368-cf8bdb4c6d3a\\scratch\\recovered_code_step_{step}_{idx}.js"
                    with open(out_path, 'w', encoding='utf-8') as out_f:
                        out_f.write(block)
                    print(f"  Extracted block {idx} (len: {len(block)}) to {out_path}")
