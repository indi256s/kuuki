"""Build the pinned, tile-less country asset from world-atlas and ISO country codes.

Inputs are supplied explicitly so this script never fetches changing data silently.

    python3 scripts/map-build-geometry.py <countries-110m.json> <country-codes.csv> <output.geojson>
    python3 scripts/map-build-geometry.py --rebuild apps/next/public/maps/countries-110m-2.0.2.geojson

`--rebuild` re-derives the SVG outline and centers from the pinned GeoJSON (and re-applies the
antimeridian split, which is idempotent) when the original inputs are not at hand.
"""
import csv
import json
import re
import sys
from pathlib import Path


def split_antimeridian(ring):
    """Split a closed lon/lat ring that crosses the antimeridian into closed rings on either side.

    world-atlas keeps Fiji and Chukotka as single rings whose consecutive points jump between +180 and
    -180. Planar renderers (MapLibre in Web Mercator, the equirectangular SVG preview) join those points
    straight across the whole map, which draws a horizontal stripe. Each crossing gets an interpolated
    seam point on both sides; the pieces are closed along the seam meridian. A ring with an odd number of
    crossings encircles a pole (Antarctica) and is already drawable, so it is returned unchanged.
    """
    pieces, current, crossings = [], [ring[0]], 0
    for previous, point in zip(ring, ring[1:]):
        if abs(point[0] - previous[0]) > 180:
            crossings += 1
            seam = 180 if previous[0] > 0 else -180
            unwrapped = point[0] + (360 if seam > 0 else -360)
            fraction = 0 if unwrapped == previous[0] else (seam - previous[0]) / (unwrapped - previous[0])
            latitude = round(previous[1] + fraction * (point[1] - previous[1]), 5)
            if previous[0] != seam:
                current.append([seam, latitude])
            pieces.append(current)
            current = [[-seam, latitude]]
            if point[0] != -seam or point[1] != latitude:
                current.append(point)
        else:
            current.append(point)
    pieces.append(current)
    if crossings == 0 or crossings % 2 == 1:
        return [ring]
    if crossings != 2:
        raise ValueError(f'unsupported ring with {crossings} antimeridian crossings')
    # The closing piece continues into the opening one (the ring is closed): join them.
    first = pieces[-1] + pieces[0][1:]
    result = []
    for piece in [first] + pieces[1:-1]:
        if len(piece) >= 3:
            result.append(piece + [piece[0]] if piece[0] != piece[-1] else piece)
    return result


def split_geometry(geometry):
    polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    out = []
    for polygon in polygons:
        outer = split_antimeridian(polygon[0])
        if len(outer) == 1:
            out.append([outer[0]] + polygon[1:])
            continue
        if len(polygon) > 1:
            raise ValueError('antimeridian split of a polygon with holes is not supported')
        out.extend([ring] for ring in outer)
    return {'type': 'Polygon', 'coordinates': out[0]} if len(out) == 1 else {'type': 'MultiPolygon', 'coordinates': out}


def main(topology_path, codes_path, output_path):
    topology = json.loads(Path(topology_path).read_text())
    with Path(codes_path).open(newline='') as source:
        codes = {row['ISO3166-1-numeric'].zfill(3): row['ISO3166-1-Alpha-2']
                 for row in csv.DictReader(source) if row['ISO3166-1-numeric'] and row['ISO3166-1-Alpha-2']}
    transform = topology['transform']
    scale, translate = transform['scale'], transform['translate']
    decoded = []
    for arc in topology['arcs']:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append([round(x * scale[0] + translate[0], 5), round(y * scale[1] + translate[1], 5)])
        decoded.append(points)

    def ring(indices):
        points = []
        for index in indices:
            segment = decoded[index] if index >= 0 else list(reversed(decoded[~index]))
            points.extend(segment if not points else segment[1:])
        return points

    features = []
    omitted = []
    for item in topology['objects']['countries']['geometries']:
        code = codes.get(str(item.get('id', '')).zfill(3))
        if not code:
            omitted.append({'numeric': item.get('id'), 'name': item.get('properties', {}).get('name')})
            continue
        arcs = item['arcs']
        geometry = {'type': item['type'], 'coordinates':
                    [ring(part) for part in arcs] if item['type'] == 'Polygon'
                    else [[ring(part) for part in polygon] for polygon in arcs]}
        features.append({'type': 'Feature', 'id': code,
                         'properties': {'id': code, 'name': item.get('properties', {}).get('name', code)},
                         'geometry': geometry})
    write_outputs(features, output_path)
    print(f'{len(features)} ISO countries, {len(omitted)} unmapped: {omitted}')


def write_outputs(features, output_path):
    for feature in features:
        feature['geometry'] = split_geometry(feature['geometry'])
    output = {'type': 'FeatureCollection', 'features': features}
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(json.dumps(output, separators=(',', ':')))
    def project(point):
        return round((point[0] + 180) * 2, 2), round((90 - point[1]) * 2, 2)

    def polygon_rings(feature):
        geometry = feature['geometry']
        return geometry['coordinates'] if geometry['type'] == 'Polygon' else [ring for polygon in geometry['coordinates'] for ring in polygon]

    paths = []
    centers = {}
    for feature in features:
        rings = polygon_rings(feature)
        path_parts = []
        longest = max(rings, key=len)
        centers[feature['id']] = project([sum(p[0] for p in longest) / len(longest),
                                           sum(p[1] for p in longest) / len(longest)])
        for points in rings:
            if len(points) < 3:
                continue
            path_parts.append('M' + 'L'.join(f'{x},{y}' for x, y in map(project, points)) + 'Z')
        paths.append(f'<path d="{"".join(path_parts)}"/>')
    css = (Path(__file__).resolve().parents[1] / 'apps/next/src/app/styles.css').read_text()
    light = dict(re.findall(r'(--[\w-]+):([^;}]*)', re.search(r':root\{([^}]*)\}', css).group(1)))
    dark = {**light, **dict(re.findall(r'(--[\w-]+):([^;}]*)', re.search(r':root\[data-theme=dark\]\{([^}]*)\}', css).group(1)))}
    for theme, tokens in [('light', light), ('dark', dark)]:
        def color(name):
            value = tokens[name].strip()
            while value.startswith('var('):
                value = tokens[value[4:-1]].strip()
            if not re.fullmatch(r'#[0-9a-fA-F]{6}', value):
                raise ValueError(f'{theme} {name} is not a hex color: {value}')
            return value
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 360" fill="{color("--map-land")}" stroke="{color("--map-border")}" stroke-width=".35">' + ''.join(paths) + '</svg>'
        Path(output_path).with_name(f'world-outline-110m-2.0.2-{theme}.svg').write_text(svg)
    Path(output_path).with_name('country-centers-110m-2.0.2.json').write_text(json.dumps(centers, separators=(',', ':')))


def rebuild(geojson_path):
    features = json.loads(Path(geojson_path).read_text())['features']
    write_outputs(features, geojson_path)
    print(f'{len(features)} ISO countries rebuilt from {geojson_path}')


if __name__ == '__main__':
    if sys.argv[1:2] == ['--rebuild']:
        rebuild(sys.argv[2])
    else:
        main(*sys.argv[1:])
