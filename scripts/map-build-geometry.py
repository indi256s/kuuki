"""Build the pinned, tile-less country asset from world-atlas and ISO country codes.

Inputs are supplied explicitly so this script never fetches changing data silently.
"""
import csv
import json
import sys
from pathlib import Path


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
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 360" fill="#d8d3cc" stroke="#fbfaf8" stroke-width=".35">' + ''.join(paths) + '</svg>'
    Path(output_path).with_name('world-outline-110m-2.0.2.svg').write_text(svg)
    Path(output_path).with_name('country-centers-110m-2.0.2.json').write_text(json.dumps(centers, separators=(',', ':')))
    print(f'{len(features)} ISO countries, {len(omitted)} unmapped: {omitted}')


if __name__ == '__main__':
    main(*sys.argv[1:])
