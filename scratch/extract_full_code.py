import json
import os

log_path = r"C:\Users\kclun\.gemini\antigravity\brain\0759604c-9c9d-4779-9368-cf8bdb4c6d3a\.system_generated\logs\transcript.jsonl"

steps_to_check = [2287, 2283, 2279, 2275, 2271, 2267, 2263, 2259, 2253]

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        if not line.strip():
            continue
        try:
            data = json.loads(line)
        except Exception:
            continue
        
        step = data.get('step_index')
        if step in steps_to_check:
            print(f"--- Step {step} ---")
            for i, call in enumerate(data.get('tool_calls', [])):
                args = call.get('args', {})
                tf = args.get('TargetFile', '')
                if 'v9_funnel_skills.js' in tf:
                    rc = args.get('ReplacementContent', '')
                    target = args.get('TargetContent', '')
                    start_line = args.get('StartLine')
                    end_line = args.get('EndLine')
                    print(f"  Call {i}: StartLine={start_line}, EndLine={end_line}")
                    print(f"  TargetContent length: {len(target)}")
                    print(f"  ReplacementContent length: {len(rc)}")
                    # Check if it ends with truncation hint or is complete
                    is_truncated = "[truncated" in rc or "... [truncated" in rc or "setTim\n" in rc
                    print(f"  Is truncated check: {is_truncated}")
                    if len(rc) > 100:
                        print("  Starts with:", repr(rc[:100]))
                        print("  Ends with:", repr(rc[-100:]))
