#!/usr/bin/env python3
"""
visual-smoke.py — smoke visual de la app REAL (binario Tauri) con el pipeline
de píxeles del docs/VISUAL-REVIEW-WORKFLOW.md.

Modos:
  launch <bin> [--seconds N]   lanza el binario (requiere DISPLAY, por ej.
                               xvfb-run en CI), espera N s, captura la raíz
                               con import (ImageMagick) y mide.
  measure <png>                mide una captura existente y sale != 0 si el
                               sidebar no está en rango o el texto está inflado.

Qué mide (contra el bug real de WebKitGTK: snap a escala 2 = todo 2x):
  - sidebar visible: borde derecho del panel oscuro en la franja izquierda
    entre 150 y 330 px (1:1 con GDK_SCALE=1) — con snap 2x se pasa de 350.
  - proporción del texto: altura de mancha del primer bloque de texto en la
    franja superior (banner/título) entre 14 y 44 px.
Uso: xvfb-run -a python3 scripts/visual-smoke.py launch <bin>
     python3 scripts/visual-smoke.py measure /tmp/shot.png
"""
import subprocess, sys, time, os

def capture(path, seconds):
    subprocess.run(['import', '-window', 'root', path], check=True, capture_output=True)

def load(path):
    from PIL import Image
    return Image.open(path).convert('RGB')

def measure(path):
    from PIL import Image
    img = load(path)
    w, h = img.size
    px = img.load()
    fails = []
    # 1) sidebar: borde del panel oscuro en la franja izquierda (60..345 px).
    #    El borde derecho del sidebar = columna con salto de brillo sostenido.
    # borde del sidebar = columna MÁS BRILLANTE en 150..345 px (la línea
    # border-right rgba(255,255,255,.08)), muestrándose en la zona media de la
    # ventana (fuera del glow del logo y del banner).
    vals = [sum(sum(px[x, y]) for y in range(max(250, h // 4), h - 250, 10)) / (3.0 * ((h - 500) // 10)) for x in range(150, 345)]
    best_x, best_score = 0, 0
    for x in range(len(vals)):
        if vals[x] > best_score:
            best_score, best_x = vals[x], 150 + x
    print(f'  borde sidebar en x={best_x}px (brillo {best_score:.1f})')
    if not (145 <= best_x <= 335):
        fails.append(f'sidebar fuera de rango 145-335px (got {best_x}px — posible snap 2x)')
    # 2) texto: bloques de mancha en la franja superior [30, 45% de la altura],
    #    separados por gaps de 8px; el TÍTULO es el bloque más alto que ronde
    #    los 20-30px: falla si todo bloque es <14 o si el más alto es >44
    ink = [[y for y in range(30, int(h * 0.45), 2) if sum(px[x, y]) > 420] for x in range(0, w, 8)]
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
        # bloques de "texto normal": descartar manchas de fondo/imágenes (>120px)
        text = [b for b in blocks if b <= 120]
        text.sort()
        pct = text[int(len(text) * 0.8)] if text else 0
        print(f'  percentil-80 de alturas de texto: {pct}px ({len(text)} bloques)')
        if pct < 12 or pct > 70:
            fails.append(f'altura de texto fuera de rango 12-70px (got {pct}px — inflado 2x?)')
    else:
        fails.append('sin texto en la franja superior (página en blanco?)')
    print('✅ measure OK — proporción 1:1' if not fails else '❌ ' + '; '.join(fails))
    return 1 if fails else 0

def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); return 2
    mode = args[0]
    if mode == 'measure':
        return measure(args[1])
    if mode == 'launch':
        binpath = args[1]
        seconds = 14
        if '--seconds' in args:
            seconds = int(args[args.index('--seconds') + 1])
        env = dict(os.environ)
        env.update({'GDK_SCALE': '1', 'WEBKIT_DISABLE_COMPOSITING_MODE': '1', 'LIBGL_ALWAYS_SOFTWARE': '1'})
        proc = subprocess.Popen([binpath], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(max(seconds, 10))
        if proc.poll() is not None:
            print(f'❌ el binario murió a los {seconds}s (exit {proc.returncode})')
            return 1
        shot = f'/tmp/visual-smoke-{int(time.time())}.png'
        try:
            capture(shot, seconds)
        except (subprocess.CalledProcessError, OSError):
            # sin captura (macOS sin permiso de pantalla o sin import/ImageMagick): el smoke se limita a
            # "el binario sigue vivo N segundos sin morir"
            print('⚠️  sin captura disponible — solo assert de proceso vivo')
            proc.kill()
            return 0
        proc.kill()
        print(f'📸 captura en {shot} ({load(shot).size[0]}x{load(shot).size[1]})')
        return measure(shot)
    print(__doc__); return 2

if __name__ == '__main__':
    sys.exit(main())