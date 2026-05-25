import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

log_path = r"C:\Users\kclun\.gemini\antigravity\brain\0759604c-9c9d-4779-9368-cf8bdb4c6d3a\.system_generated\logs\transcript.jsonl"

steps_to_inspect = [1983, 2017, 2018, 2019, 2025, 2033, 2036, 2051, 2054, 2071, 2077, 2093, 2107]

with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        if not line.strip():
            continue
        try:
            data = json.loads(line)
        except Exception:
            continue
        
        step = data.get('step_index')
        if step in steps_to_inspect:
            print(f"=== STEP {step} (type: {data.get('type')}, status: {data.get('status')}) ===")
            for call in data.get('tool_calls', []):
                print(f"  Tool: {call.get('name')}")
                args = call.get('args', {})
                print(f"    TargetFile: {args.get('TargetFile')}")
                # Print length of replacement content or code content if exists
                rc = args.get('ReplacementContent', '')
                cc = args.get('CodeContent', '')
                if rc:
                    print(f"    ReplacementContent len: {len(rc)}")
                if cc:
                    print(f"    CodeContent len: {len(cc)}")
            print("-" * 30)
