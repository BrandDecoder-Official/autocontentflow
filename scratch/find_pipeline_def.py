import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

log_path = r"C:\Users\kclun\.gemini\antigravity\brain\0759604c-9c9d-4779-9368-cf8bdb4c6d3a\.system_generated\logs\transcript.jsonl"
out_dir = r"C:\Users\kclun\.gemini\antigravity\brain\0759604c-9c9d-4779-9368-cf8bdb4c6d3a\scratch"

with open(log_path, 'r', encoding='utf-8') as f:
    for line_num, line in enumerate(f):
        if 'runSmartExpressPipeline' in line:
            try:
                data = json.loads(line)
                step = data.get('step_index')
                print(f"Step {step} has runSmartExpressPipeline")
                for i, call in enumerate(data.get('tool_calls', [])):
                    args = call.get('args', {})
                    rc = args.get('ReplacementContent', '')
                    cc = args.get('CodeContent', '')
                    chunks = args.get('ReplacementChunks', [])
                    if rc:
                        out_path = os.path.join(out_dir, f"step_{step}_tool_{i}_rc.txt")
                        with open(out_path, 'w', encoding='utf-8') as out_f:
                            out_f.write(rc)
                        print(f"  Saved ReplacementContent to {out_path} (len: {len(rc)})")
                    if cc:
                        out_path = os.path.join(out_dir, f"step_{step}_tool_{i}_cc.txt")
                        with open(out_path, 'w', encoding='utf-8') as out_f:
                            out_f.write(cc)
                        print(f"  Saved CodeContent to {out_path} (len: {len(cc)})")
                    if chunks:
                        for idx, chunk in enumerate(chunks):
                            chunk_rc = chunk.get('ReplacementContent', '')
                            if chunk_rc:
                                out_path = os.path.join(out_dir, f"step_{step}_tool_{i}_chunk_{idx}_rc.txt")
                                with open(out_path, 'w', encoding='utf-8') as out_f:
                                    out_f.write(chunk_rc)
                                print(f"  Saved Chunk {idx} ReplacementContent to {out_path} (len: {len(chunk_rc)})")
            except Exception as e:
                pass
