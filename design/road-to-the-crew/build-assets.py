from pathlib import Path
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape, quoteattr
import re
from svgpathtools import parse_path

import cairosvg
import numpy as np
from PIL import Image
import vtracer

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "design" / "road-to-the-crew"
OUTPUT = ROOT / "public" / "brand" / "road-to-the-crew"
NAVY = "#12284B"
CREAM = "#FAF4E7"
THRESHOLD = 170


def trace(source: Path):
    image = Image.open(source).convert("RGB")
    rgb = np.asarray(image)
    dark = np.max(rgb, axis=2) < THRESHOLD
    binary = np.repeat(np.where(dark[:, :, None], 0, 255).astype("uint8"), 3, axis=2)
    with TemporaryDirectory() as temp_dir:
        png = Path(temp_dir) / "binary.png"
        svg = Path(temp_dir) / "trace.svg"
        Image.fromarray(binary, "RGB").save(png)
        vtracer.convert_image_to_svg_py(str(png), str(svg))
        root = ET.parse(svg).getroot()
    paths = [element for element in root if element.tag.endswith("path")]
    assert paths and paths[0].get("fill") in {"#FFFFFF", "#FEFEFE"}
    return image.size, paths[1:]


def vector_svg(size, paths, title, background=None, ink=NAVY):
    width, height = size
    contours = []
    for element in paths:
        assert element.get("fill") in {"#000000", "#FFFFFF"}
        transform = element.get("transform", "translate(0,0)")
        match = re.fullmatch(r"translate\(([-0-9.]+),([-0-9.]+)\)", transform)
        assert match, transform
        offset = complex(float(match.group(1)), float(match.group(2)))
        contours.append(parse_path(element.get("d")).translated(offset).d())
    lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" role="img" aria-labelledby="title">' % size,
        '<title id="title">%s</title>' % escape(title),
    ]
    if background:
        lines.append('<path fill="%s" d="M0 0H%dV%dH0Z"/>' % (background, width, height))
    lines.append('<path fill="%s" fill-rule="evenodd" d=%s/>' % (ink, quoteattr(" ".join(contours))))
    lines.append("</svg>")
    return "\n".join(lines) + "\n"


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    mark_size, mark_paths = trace(SOURCE / "source-social.png")
    lockup_size, lockup_paths = trace(SOURCE / "source-lockup.png")
    (OUTPUT / "mark.svg").write_text(
        vector_svg(mark_size, mark_paths, "Road to the Crew barley R mark"),
        encoding="utf-8",
    )
    (OUTPUT / "mark-light.svg").write_text(
        vector_svg(mark_size, mark_paths, "Road to the Crew barley R mark", ink=CREAM),
        encoding="utf-8",
    )
    (OUTPUT / "avatar.svg").write_text(
        vector_svg(mark_size, mark_paths, "Road to the Crew social avatar", CREAM),
        encoding="utf-8",
    )
    (OUTPUT / "lockup.svg").write_text(
        vector_svg(lockup_size, lockup_paths, "Road to the Crew logo"),
        encoding="utf-8",
    )
    (OUTPUT / "lockup-light.svg").write_text(
        vector_svg(lockup_size, lockup_paths, "Road to the Crew logo", ink=CREAM),
        encoding="utf-8",
    )
    for size in (512, 1024):
        cairosvg.svg2png(
            url=str(OUTPUT / "avatar.svg"),
            write_to=str(OUTPUT / ("avatar-%d.png" % size)),
            output_width=size,
            output_height=size,
        )
    cairosvg.svg2png(
        url=str(OUTPUT / "lockup.svg"),
        write_to=str(OUTPUT / "lockup-1600.png"),
        output_width=1600,
        output_height=800,
    )


if __name__ == "__main__":
    main()
