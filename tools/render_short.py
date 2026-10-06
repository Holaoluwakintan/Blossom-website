#!/usr/bin/env python3
"""render_short.py in.jpg out.mp4 : 12 s 1080x1920 Ken Burns (slow 7% zoom-out, subpixel-smooth) + fades, silent AAC."""
import sys, subprocess
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
W, H, FPS, D, Z = 1080, 1920, 30, 12, 0.07
im = Image.open(src).convert('RGB')
if im.size != (W, H): im = im.resize((W, H), Image.LANCZOS)
N = FPS * D
cmd = ['nice', '-n', '10', 'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
       '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
       '-f', 'lavfi', '-t', str(D), '-i', 'anullsrc=r=44100:cl=stereo',
       '-vf', f'fade=t=in:st=0:d=0.7,fade=t=out:st={D-1}:d=1,format=yuv420p',
       '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-maxrate', '2.5M', '-bufsize', '5M',
       '-threads', '2', '-c:a', 'aac', '-b:a', '32k', '-shortest', '-movflags', '+faststart', out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for i in range(N):
    t = i / (N - 1)
    e = t * t * (3 - 2 * t)          # ease in-out
    s = 1 + Z * (1 - e)               # slow zoom OUT: ends on the full frame (signature visible)
    cw, ch = W / s, H / s
    x0, y0 = (W - cw) / 2, (H - ch) * 0.4
    fr = im.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch))
    p.stdin.write(fr.tobytes())
p.stdin.close(); sys.exit(p.wait())
