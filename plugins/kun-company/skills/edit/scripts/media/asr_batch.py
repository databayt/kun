"""asr_batch.py <job.json> — transcribe many clips with ONE whisper load.

Run with the mlx-whisper tool's interpreter (~/.local/share/uv/tools/mlx-whisper/bin/python).
job.json: {"model": repo, "lang": "ar", "files": ["/abs/a.wav", …]} → prints {"/abs/a.wav": "text", …}
The CLI's multi-file mode names every output after the first input, so the transcripts overwrite
each other — this keeps one result per file.
"""
import contextlib
import io
import json
import sys

import mlx_whisper

job = json.load(open(sys.argv[1]))
out = {}
for f in job["files"]:
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        r = mlx_whisper.transcribe(f, path_or_hf_repo=job["model"], language=job.get("lang"), condition_on_previous_text=False, verbose=None)
    out[f] = (r.get("text") or "").strip()
print(json.dumps(out, ensure_ascii=False))
