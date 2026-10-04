#!/usr/bin/env python3
"""Freeze the existing synthetic fixture build and load bundled airport references."""
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[3]
with tempfile.TemporaryDirectory(prefix="kuuki-atlas-") as directory:
    frozen = Path(directory)
    shutil.copytree(ROOT / "apps/web/dist", frozen / "dist")
    shutil.copytree(ROOT / ".wrangler/functions-build", frozen / "functions-build")
    (frozen / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
    source = (ROOT / "scripts/smoke-local-runtime.ts").read_text()
    replacements = {
        "  name: 'kuuki-fixture',": f"  rootPath: {str(frozen)!r},\n  modulesRoot: {str(frozen)!r},\n  name: 'kuuki-fixture',",
        "resolve('.wrangler/functions-build/index.js')": repr(str(frozen / "functions-build/index.js")),
        "resolve('apps/web/dist')": repr(str(frozen / "dist")),
    }
    for original, replacement in replacements.items():
        if original not in source:
            raise RuntimeError(f"Fixture source changed; missing expected expression: {original}")
        source = source.replace(original, replacement)
    if "from './_migrations'" in source:
        source = source.replace("from './_migrations'", f"from {str(ROOT / 'scripts/_migrations.ts')!r}")
    else:
        for original, replacement in {
            "readdirSync('db/migrations')": f"readdirSync({str(ROOT / 'db/migrations')!r})",
            "resolve('db/migrations', file)": f"resolve({str(ROOT / 'db/migrations')!r}, file)",
        }.items():
            if original not in source:
                raise RuntimeError(f"Fixture migration loader changed; missing expression: {original}")
            source = source.replace(original, replacement)
    source = "import { readFileSync as atlasReadFileSync } from 'node:fs'\n" + source
    needle = "  // Hashing and signup happen inside the compiled workerd API, rather than in Node."
    if needle not in source:
        raise RuntimeError("Fixture source changed; airport seed insertion point is absent")
    insert = f"""  const atlasAirports = JSON.parse(atlasReadFileSync({str(ROOT / 'packages/data/src/airports.json')!r}, 'utf8'))
  for (const a of atlasAirports) {{
    await db.prepare('INSERT OR REPLACE INTO airports_reference(iata,name,city,country,country_code,latitude,longitude) VALUES(?,?,?,?,?,?,?)').bind(a.iata,a.name,a.city,a.country,a.countryCode,a.latitude,a.longitude).run()
  }}
"""
    (frozen / "runtime.ts").write_text(source.replace(needle, insert + needle))
    process = subprocess.Popen([str(ROOT / "node_modules/.bin/tsx"), str(frozen / "runtime.ts")], cwd=ROOT)
    try:
        code = process.wait()
    except KeyboardInterrupt:
        process.send_signal(signal.SIGINT)
        try:
            code = process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.terminate()
            code = process.wait()
    raise SystemExit(code)
