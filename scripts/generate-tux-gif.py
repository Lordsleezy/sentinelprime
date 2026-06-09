from PIL import Image, ImageDraw

W, H = 160, 160
frames = []


def draw_tux(draw, ox=0, lean=0, foot=0):
    cx, cy = W // 2 + ox, H // 2 + 8
    draw.ellipse((cx - 34, cy + 38, cx + 34, cy + 48), fill=(0, 0, 0, 60))
    foot_off = 6 if foot else -6
    draw.ellipse((cx - 28 + foot_off, cy + 30, cx - 8 + foot_off, cy + 44), fill="#F0A020")
    draw.ellipse((cx + 8 - foot_off, cy + 30, cx + 28 - foot_off, cy + 44), fill="#F0A020")
    draw.ellipse((cx - 38, cy - 10, cx + 38, cy + 42), fill="#111111")
    draw.ellipse((cx - 24, cy + 2, cx + 24, cy + 40), fill="#F5F5F5")
    draw.ellipse((cx - 34, cy - 52, cx + 34, cy + 2), fill="#111111")
    draw.ellipse((cx - 20, cy - 34, cx + 20, cy + 2), fill="#F5F5F5")
    ex = 10 + lean
    draw.ellipse((cx - ex - 6, cy - 24, cx - ex + 2, cy - 16), fill="#111111")
    draw.ellipse((cx + ex - 2, cy - 24, cx + ex + 6, cy - 16), fill="#111111")
    draw.ellipse((cx - ex - 4, cy - 22, cx - ex - 1, cy - 19), fill="#FFFFFF")
    draw.ellipse((cx + ex + 1, cy - 22, cx + ex + 4, cy - 19), fill="#FFFFFF")
    draw.polygon([(cx, cy - 14), (cx - 8, cy - 6), (cx + 8, cy - 6)], fill="#F0A020")
    wing_y = cy + 4 + (foot * 2)
    draw.ellipse((cx - 48, wing_y - 8, cx - 26, wing_y + 22), fill="#0A0A0A")
    draw.ellipse((cx + 26, wing_y - 4, cx + 48, wing_y + 26), fill="#0A0A0A")


for i in range(8):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    ox = int(8 * (1 if i % 2 == 0 else -1) * (0.6 + 0.4 * (i % 4 < 2)))
    lean = 2 if i % 2 == 0 else -2
    foot = i % 2
    draw_tux(draw, ox=ox, lean=lean, foot=foot)
    frames.append(img.convert("P", palette=Image.ADAPTIVE, colors=32))

frames[0].save(
    "assets/tux-penguin.gif",
    save_all=True,
    append_images=frames[1:],
    duration=140,
    loop=0,
    transparency=0,
    disposal=2,
)
print("saved assets/tux-penguin.gif")
