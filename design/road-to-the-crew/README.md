# Road to the Crew identity assets

These are original concepts for the independent Road to the Crew fan site. The navy **R** combines a baseball seam with a barley sprig. The full logo uses outlined serif lettering, so no font installation is needed.

## Use

| File | Use |
| --- | --- |
| [mark.svg](../../public/brand/road-to-the-crew/mark.svg) | Standalone navy mark on a light background; transparent SVG. |
| [mark-light.svg](../../public/brand/road-to-the-crew/mark-light.svg) | Standalone cream mark on a navy or dark background; transparent SVG. |
| [avatar.svg](../../public/brand/road-to-the-crew/avatar.svg) | Square social profile image with cream background and crop-safe spacing. |
| [avatar-1024.png](../../public/brand/road-to-the-crew/avatar-1024.png), [avatar-512.png](../../public/brand/road-to-the-crew/avatar-512.png) | Raster exports for social sites that require PNG. |
| [lockup.svg](../../public/brand/road-to-the-crew/lockup.svg) | Navy mark and full wordmark for light backgrounds; transparent SVG. |
| [lockup-light.svg](../../public/brand/road-to-the-crew/lockup-light.svg) | Cream mark and full wordmark for dark backgrounds; transparent SVG. |
| [lockup-1600.png](../../public/brand/road-to-the-crew/lockup-1600.png) | Transparent PNG of the full navy lockup. |

The SVGs contain vector paths, not embedded bitmaps or live font text. They can scale to print sizes. Keep the standalone mark and wordmark proportions as supplied. For website usage, assets under `public/brand/road-to-the-crew/` are served from `/brand/road-to-the-crew/`.

Colors: navy `#12284B`; cream `#FAF4E7`. The avatar has a solid cream background. The other SVGs have transparent backgrounds.

## Source and regeneration

`source-social.png` and `source-lockup.png` are the approved raster concepts. `build-assets.py` thresholds and traces those sources into the SVG paths, then exports the PNGs. It requires Python plus `Pillow`, `numpy`, `vtracer`, `svgpathtools`, and `cairosvg`. Run it from the repository root:

```sh
python design/road-to-the-crew/build-assets.py
```

The trace is an editable vector starting point. If the design is revised for production, edit the SVG paths or source artwork and review the mark at avatar size before publishing. The identity should remain distinct from official Milwaukee Brewers or MLB marks.
