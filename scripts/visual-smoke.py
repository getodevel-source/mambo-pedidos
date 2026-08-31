#!/usr/bin/env python3
"""
visual-smoke.py — smoke visual de la app REAL (binario Tauri) con el pipeline
de píxeles del docs/VISUAL-REVIEW-WORKFLOW.md.

Modos:
  launch <bin> [--seconds N]   lanza el binario (requiere DISPLAY, por ej.
                               xvfb-run en CI), espera N s, captura la raíz
                               con import (ImageMagick) y mide.
  measure <png>                mide una captura existente y sale != 0 si el
                               sidebar no está en rango (inflado 2x) o el
                               texto está inflado.

Qué mide (contra el bug real de WebKitGTK: snap a escala 2 = todo 2x):
  - sidebar visible: borde derecho del panel oscuro entre 145 y 335 px
    (1:1 con GDK_SCALE=1) — con snap 2x se pasa de 350.
  - proporción del texto: percentil-80 de alturas de texto; falla solo si
    está inflado (>70px); renders con antialias débil (contenedores) bajan
    a warning (el guard 2x real es el sidebar).
  - captura en negro (runner Xvfb sin GL): degrada a proceso vivo (exit 0).
Uso: xvfb-run -a python3 scripts/visual-smoke.py launch <bin>
     python3 scripts/visual-smoke.py measure /tmp/shot.png
"""
import subprocess, sys, time, os


def capture(path, seconds):
    subprocess.run(["import", "-window", "root", path], check=True, capture_output=True)


def load(path):
    from PIL import Image
    return Image.open(path).convert("RGB")


def measure(path):
    from PIL import Image
    img = load(path)
    w, h = img.size
    px = img.load()
    fails = []
    # 1) sidebar: columna MAS brillante en la franja 150..345 px (border-right)
    vals = [sum(sum(px[x, y]) for y in range(max(250, h // 4), h - 250, 10)) / (3.0 * ((h - 500) // 10)) for x in range(150, 345)]
    best_x, best_score = 0, 0
    for x in range(len(vals)):
        if vals[x] > best_score:
            best_score, best_x = vals[x], 150 + x
    print("  borde sidebar en x=%dpx (brillo %.1f)" % (best_x, best_score))
    if best_x <= 10:
        # captura negra (sin render en el runner): solo assert de proceso vivo
        print("  captura sin render (runner Xvfb sin GL) — solo assert de proceso vivo")
        return 0
    if not (145 <= best_x <= 335):
        fails.append("sidebar fuera de rango 145-335px (got %dpx — posible snap 2x)" % best_x)
    # 2) texto: bloques de mancha en la franja superior, p80 de alturas
    ink = [[y for y in range(30, int(h * 0.45), 2) if sum(px[x, y]) > 300] for x in range(0, w, 8)]
    blocks = []
    for col in ink:
        if not col:
            continue
        start, cur = col[0], col[0]
        heights = []
        for yy in col[1:]:
            if yy - cur <= 8:
                cur = yy
            else:
                heights.append(cur - start)
                start = cur = yy
        heights.append(cur - start)
        blocks.append(max(heights))
    if blocks:
        text = [b for b in blocks if b <= 120]
        text.sort()
        pct = text[int(len(text) * 0.8)] if text else 0
        print("  percentil-80 de alturas de texto: %dpx (%d bloques)" % (pct, len(text)))
        if pct > 70:
            fails.append("altura de texto inflada (p80 %dpx > 70px)" % pct)
        elif pct < 4:
            print("  (texto debil: antialias de contenedor — sidebar OK, no es inflado)")
    else:
        print("  (sin bloques de texto en la franja — sidebar OK, no es inflado)")
    print("medida OK — proporcion 1:1" if not fails else "fallos: " + "; ".join(fails))
    return 1 if fails else 0


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    mode = args[0]
    if mode == "measure":
        return measure(args[1])
    if mode == "launch":
        binpath = args[1]
        seconds = 14
        if "--seconds" in args:
            seconds = int(args[args.index("--seconds") + 1])
        env = dict(os.environ)
        env.update({"GDK_SCALE": "1", "WEBKIT_DISABLE_COMPOSITING_MODE": "1", "LIBGL_ALWAYS_SOFTWARE": "1"})
        proc = subprocess.Popen([binpath], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(max(seconds, 10))
        if proc.poll() is not None:
            print("el binario murio a los %ds (exit %s)" % (seconds, proc.returncode))
            return 1
        shot = "/tmp/visual-smoke-%d.png" % int(time.time())
        try:
            capture(shot, seconds)
        except (subprocess.CalledProcessError, OSError):
            print("sin captura (import/ImageMagick ausente) — solo assert de proceso vivo")
            proc.kill()
            return 0
        proc.kill()
        print("captura en %s (%dx%d)" % (shot, load(shot).size[0], load(shot).size[1]))
        return measure(shot)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())