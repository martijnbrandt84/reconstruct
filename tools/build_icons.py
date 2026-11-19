"""Tekent het extensie-icoon met anti-aliasing (supersampling), exact naar logo.svg (favicon van de site)."""
import math
import pathlib
import struct
import zlib

OUT = pathlib.Path(r'C:\Users\BRANDT000\Scripts\reconstruct\extension\icons')
SS = 4  # supersampling per as


def rrect(px, py, x0, y0, x1, y1, r):
    cx = min(max(px, x0 + r), x1 - r)
    cy = min(max(py, y0 + r), y1 - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r and x0 <= px <= x1 and y0 <= py <= y1


def circle(px, py, cx, cy, r):
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


# zelfde kleuren en maten als logo.svg (viewBox 0 0 64 64)
START, END = (0x8B, 0x6F, 0xD6), (0x4F, 0x37, 0x8B)
WHITE = (255, 255, 255)
PINK = (0xFF, 0xD8, 0xE4)
DOTS = [(20, WHITE), (32, PINK), (44, WHITE)]
BARS = [(16, 24, WHITE), (28, 14, PINK), (40, 19, WHITE)]


def shade(u, v):
    """Kleur op genormaliseerde positie u,v in [0,1]; None = transparant."""
    x, y = u * 64, v * 64
    if not rrect(x, y, 0, 0, 64, 64, 16):
        return None
    bg = mix(START, END, (u + v) / 2)
    for cy, col in DOTS:
        if circle(x, y, 19, cy, 4.5):
            return col
    for top, width, col in BARS:
        if rrect(x, y, 27, top, 27 + width, top + 8, 4):
            return col
    # tijdas: wit met 40% dekking, ronde uiteinden
    if abs(x - 19) <= 1.5 and 13 <= y <= 51 or circle(x, y, 19, 13, 1.5) or circle(x, y, 19, 51, 1.5):
        return mix(bg, WHITE, .4)
    return bg


def png(size):
    global SIZE
    SIZE = size
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0.0, 0.0, 0.0]
            cover = 0
            for sy in range(SS):
                for sx in range(SS):
                    c = shade((x + (sx + .5) / SS) / size, (y + (sy + .5) / SS) / size)
                    if c is not None:
                        cover += 1
                        for i in range(3):
                            acc[i] += c[i]
            if cover:
                row += bytes([round(acc[0] / cover), round(acc[1] / cover), round(acc[2] / cover), round(255 * cover / SS ** 2)])
            else:
                row += bytes([0, 0, 0, 0])
        rows.append(bytes(row))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b''))


OUT.mkdir(parents=True, exist_ok=True)
for s in (16, 32, 48, 128):
    (OUT / f'icon{s}.png').write_bytes(png(s))
print('iconen geschreven')
