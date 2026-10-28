"""Makes the test vehicle for test_change_words.cjs: a delivery van zip whose
existing "Speedy" livery has words painted on it.

    python3 make_livery_test_vehicle.py <output folder>

Writes delivery_van.zip, delivery_skin.png (the livery picture) and
delivery_boxes.json (where the ink of each block of words is, in pixels):
  main      white bold "SPEEDY DELIVERY" on the blue panel
  mirrored  the same words stored backwards (the far side of the van)
  phone     yellow "CALL 555-0199" with a black outline on the red stripe
"""
import io
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
FONTS = Path("/usr/share/fonts/truetype/liberation")
SIZE = 1024
STRIPE = (200, 20, 30)


def ink_box(img, color_test):
    px = img.load()
    xs, ys = [], []
    for y in range(img.height):
        for x in range(img.width):
            if color_test(px[x, y]):
                xs.append(x)
                ys.append(y)
    return [min(xs), min(ys), max(xs) + 1, max(ys) + 1]


def words(text, font, fill, stroke=0, stroke_fill=None):
    """The words on their own transparent picture, cropped to the ink."""
    pad = 20
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    l, t, r, b = probe.textbbox((0, 0), text, font=font, stroke_width=stroke)
    im = Image.new("RGBA", (r - l + pad * 2, b - t + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((pad - l, pad - t), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return im.crop(im.getbbox())


# Body: a blue panel that gets a little darker toward the bottom, a red stripe, gray below.
skin = Image.new("RGB", (SIZE, SIZE))
d = ImageDraw.Draw(skin)
for y in range(SIZE):
    t = y / SIZE
    d.line([(0, y), (SIZE, y)], fill=(int(35 - 10 * t), int(95 - 25 * t), int(175 - 35 * t)))
d.rectangle([0, 340, SIZE, 420], fill=STRIPE)
d.rectangle([0, 760, SIZE, SIZE], fill=(150, 152, 158))

bold = ImageFont.truetype(str(FONTS / "LiberationSans-Bold.ttf"), 74)
main = words("SPEEDY DELIVERY", bold, (255, 255, 255, 255))
skin.paste(main, (90, 150), main)
mirrored = ImageOps.mirror(main)
skin.paste(mirrored, (SIZE - 90 - mirrored.width, 600), mirrored)

phone_font = ImageFont.truetype(str(FONTS / "LiberationSans-Bold.ttf"), 46)
phone = words("CALL 555-0199", phone_font, (255, 220, 0, 255), stroke=3, stroke_fill=(0, 0, 0, 255))
skin.paste(phone, (330, 380 - phone.height // 2), phone)

white = lambda p: p[0] > 200 and p[1] > 200 and p[2] > 200
boxes = {
    "main": ink_box(skin.crop((0, 100, SIZE, 300)), white),
    "mirrored": ink_box(skin.crop((0, 550, SIZE, 750)), white),
    "phone": ink_box(skin.crop((0, 341, SIZE, 420)), lambda p: p[0] > 150 and p[2] < 120 and p[1] > 90 or p[0] < 60 and p[1] < 60 and p[2] < 60),
}
boxes["main"][1] += 100; boxes["main"][3] += 100
boxes["mirrored"][1] += 550; boxes["mirrored"][3] += 550
boxes["phone"][1] += 341; boxes["phone"][3] += 341
skin.save(out / "delivery_skin.png")
(out / "delivery_boxes.json").write_text(json.dumps(boxes))

png = io.BytesIO()
skin.save(png, "PNG")
plain = io.BytesIO()
Image.new("RGB", (SIZE, SIZE), (240, 240, 240)).save(plain, "PNG")

V = "vehicles/deliveryvan/"
files = {
    V + "info.json": json.dumps({"Brand": "Gavril", "Name": "Delivery Van", "Type": "Truck"}),
    V + "deliveryvan_body.jbeam": json.dumps({"deliveryvan_body": {
        "information": {"name": "Delivery Van Body"}, "slotType": "deliveryvan_body",
        "slots": [["type", "default", "description"], ["paint_design", "", "Paint Design"]],
    }}),
    V + "deliveryvan.materials.json": json.dumps({"deliveryvan_main": {
        "name": "deliveryvan_main", "mapTo": "deliveryvan_main", "class": "Material",
        "Stages": [{"baseColorMap": V + "deliveryvan_c.png", "instanceDiffuse": True}, {}, {}, {}],
    }}),
    V + "deliveryvan_c.png": plain.getvalue(),
    V + "skin_speedy/deliveryvan_skin_speedy.jbeam": json.dumps({"deliveryvan_skin_speedy": {
        "information": {"name": "Speedy Delivery", "value": 500}, "slotType": "paint_design", "globalSkin": "speedy",
    }}),
    V + "skin_speedy/skin.materials.json": json.dumps({"deliveryvan_main.skin.speedy": {
        "name": "deliveryvan_main.skin.speedy", "mapTo": "deliveryvan_main.skin.speedy", "class": "Material",
        "Stages": [{"baseColorMap": V + "skin_speedy/deliveryvan_skin_speedy.color.png"}, {}, {}, {}],
    }}),
    V + "skin_speedy/deliveryvan_skin_speedy.color.png": png.getvalue(),
}
with zipfile.ZipFile(out / "delivery_van.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for name, data in files.items():
        z.writestr(name, data)
print(json.dumps(boxes))
