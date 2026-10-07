"""tts_batch.py <job.json> — synthesize many lines with ONE model load.

Run with the mlx-audio tool's own interpreter (~/.local/share/uv/tools/mlx-audio/bin/python).
job.json: {"model": repo, "lang": "ar", "ref": "/abs/reference.wav", "out": "/abs/dir",
           "items": [{"id": "line-01-t1", "text": "…"}]}
Writes <out>/<id>.wav per item and prints a JSON list of {id, file, ok, error}.
The CLI reloads the 2.7 GB checkpoint per call; a tutorial has a dozen lines and up to three
retries each, so loading once is the difference between seconds and many minutes.
"""
import contextlib
import io
import json
import os
import sys

from mlx_audio.tts.generate import generate_audio
from mlx_audio.tts.utils import load_model

job = json.load(open(sys.argv[1]))
os.makedirs(job["out"], exist_ok=True)
model = load_model(model_path=job["model"])
results = []
for item in job["items"]:
    target = os.path.join(job["out"], f'{item["id"]}.wav')
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            generate_audio(
                text=item["text"],
                model=model,
                lang_code=job.get("lang", "ar"),
                ref_audio=job["ref"],
                output_path=job["out"],
                file_prefix=item["id"],
                audio_format="wav",
                join_audio=True,
                verbose=False,
            )
        results.append({"id": item["id"], "file": target, "ok": os.path.exists(target)})
    except Exception as e:  # one bad line must not sink the batch
        results.append({"id": item["id"], "file": target, "ok": False, "error": str(e)[:400]})
print(json.dumps(results))
