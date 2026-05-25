import json
import sys

# Ensure UTF-8 output to avoid cp950 errors
sys.stdout.reconfigure(encoding='utf-8')

log_path = r"C:\Users\kclun\.gemini\antigravity\brain\0759604c-9c9d-4779-9368-cf8bdb4c6d3a\.system_generated\logs\transcript.jsonl"

with open(log_path, 'r', encoding='utf-8') as f:
    for line_num, line in enumerate(f):
        if 'renderSmartExpressReviewCard' in line:
            try:
                data = json.loads(line)
                step = data.get('step_index')
                stype = data.get('type')
                print(f"Line {line_num} (Step {step}): type={stype}")
                # If there are tool calls, print their names and targets
                for call in data.get('tool_calls', []):
                    args = call.get('args', {})
                    print(f"  Tool: {call.get('name')}, TargetFile: {args.get('TargetFile')}")
            except Exception as e:
                print(f"Error parsing line {line_num}: {e}")
