"""Gera os ícones PNG do PWA sem dependências (apenas biblioteca padrão).

Uso: python3 scripts/make-icons.py  (a partir de apps/mobile-pwa)
Desenho: fundo escuro, anel e ponto vermelho, identidade simples de câmera/gravação.
"""
import math
import os
import struct
import zlib

BG = (11, 14, 19)
RED = (229, 72, 77)
RING = (232, 236, 242)


def png(width: int, height: int, pixel) -> bytes:
    rows = bytearray()
    for y in range(height):
        rows.append(0)  # filtro "None" por linha
        for x in range(width):
            rows.extend(pixel(x, y, width, height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + chunk(b"IEND", b"")


def icon_pixel(x, y, w, h):
    cx, cy = w / 2, h / 2
    r = math.hypot(x - cx, y - cy)
    unit = min(w, h)
    if r <= unit * 0.30:
        return RED
    if unit * 0.36 <= r <= unit * 0.42:
        return RING
    return BG


def main():
    out = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
    os.makedirs(out, exist_ok=True)
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
        with open(os.path.join(out, name), "wb") as f:
            f.write(png(size, size, icon_pixel))
        print("gerado", os.path.normpath(os.path.join(out, name)))


if __name__ == "__main__":
    main()
