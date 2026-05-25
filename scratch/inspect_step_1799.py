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
        except Exception:
            continue
        
        step = data.get('step_index')
        if step == 1799:
            print("Found Step 1799!")
            for i, call in enumerate(data.get('tool_calls', [])):
                print(f"Call {i}: name={call.get('name')}")
                args = call.get('args', {})
                for k, v in args.items():
                    if k in ['TargetFile', 'StartLine', 'EndLine']:
                        print(f"  {k}: {v}")
                    else:
                        print(f"  {k} length: {len(str(v))}")
                        # Print whether truncated
                        print(f"  {k} ends with: {str(v)[-150:]}")
