"""Import untouched OpenArt atlases and measure their actual cell boundaries.

Pixel reads are analysis only: original image bytes are never cropped or edited.
The game uses SVG view boxes, so slight unequal AI-generated rows cannot distort faces.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import urllib.request
import argparse

import numpy as np
from PIL import Image

DEST = MANIFEST = REPORT = None
ALLOW_DOWNLOAD = False
BOUNDS = {}
STATES = ['healthy', 'smallpox', 'smallpox-recovering', 'smallpox-scars', 'fever', 'wounded', 'injury-recovering', 'injury-scars', 'frail', 'stressed', 'grieving', 'exiled']

def boundaries(pixels, axis):
    delta = np.abs(np.diff(pixels, axis=axis)).mean(axis=(1, 2) if axis == 0 else (0, 2))
    length = pixels.shape[axis]
    step = length / 6
    if axis == 0:
        # The model sometimes makes both child rows shorter. Their cumulative
        # displacement can exceed any narrow window around an equal grid.
        # Choose the five strongest widely separated full-width seams instead.
        seams = []
        for index in np.argsort(delta)[::-1]:
            point = int(index) + 1
            if point < step * 0.5 or point > length - step * 0.5:
                continue
            if all(abs(point - other) > step * 0.5 for other in seams):
                seams.append(point)
            if len(seams) == 5:
                break
        points = [0] + sorted(seams) + [length]
        confidence = [round(float(delta[p - 1] / max(float(np.median(delta[max(0, p - 80):min(len(delta), p + 80)])), 0.01)), 2) for p in points[1:-1]]
        return points, confidence
    radius = step * (0.38 if axis == 0 else 0.14)
    points, confidence = [0], []
    for cell in range(1, 6):
        start = max(0, int(cell * step - radius))
        end = min(len(delta), int(cell * step + radius))
        segment = delta[start:end]
        index = start + int(np.argmax(segment))
        points.append(index + 1)
        confidence.append(round(float(delta[index] / max(float(np.median(segment)), 0.01)), 2))
    points.append(length)
    if any(b <= a for a, b in zip(points, points[1:])):
        raise ValueError('Non-monotonic atlas boundaries')
    return points, confidence

def download(record):
    identity = record['id']
    if not re.fullmatch(r'person-[0-3]-[0-5]', identity):
        raise ValueError('Unrecognized character identity')
    result = record['result']
    resource = next((r for r in result.get('resources', []) if r.get('url')), None)
    if result.get('status') != 'COMPLETED' or not resource:
        return {'id': identity, 'status': result.get('status', 'missing')}
    url = resource['url']
    if not url.startswith('https://cdn.openart.ai/'):
        raise ValueError('Unexpected asset host')
    extension = '.webp' if '.webp' in url else '.png'
    target = DEST / (identity + extension)
    if not target.exists():
        if not ALLOW_DOWNLOAD:
            raise ValueError('Missing local atlas; downloading requires --allow-download')
        request = urllib.request.Request(url, headers={'User-Agent': 'OpenHistoria-AssetImport/1.0'})
        with urllib.request.urlopen(request, timeout=120) as response:
            data = response.read(40_000_001)
        valid = data.startswith(b'\x89PNG\r\n\x1a\n') or (data[:4] == b'RIFF' and data[8:12] == b'WEBP')
        if len(data) > 40_000_000 or not valid:
            raise ValueError('Unexpected image payload')
        target.write_bytes(data)
    data = target.read_bytes()
    with Image.open(target) as source:
        width, height = source.size
        pixels = np.asarray(source.convert('RGB'), dtype=np.float32)
    rows, row_confidence = boundaries(pixels, 0)
    columns, column_confidence = boundaries(pixels, 1)
    geometry_review = 'automatic-seams'
    override = BOUNDS.get(identity)
    if override:
        if override.get('sha256') != hashlib.sha256(data).hexdigest():
            raise ValueError('Reviewed geometry does not match this image hash')
        rows = override.get('rowBounds', rows)
        columns = override.get('columnBounds', columns)
        for points, limit in [(rows, height), (columns, width)]:
            if len(points) != 7 or points[0] != 0 or points[-1] != limit or any(not isinstance(p, int) for p in points) or any(b <= a for a, b in zip(points, points[1:])):
                raise ValueError('Invalid reviewed geometry')
        geometry_review = 'caller-reviewed-hash-matched'
    return {'id': identity, 'status': 'downloaded', 'src': '/dynasties/portraits/variants/' + target.name,
            'width': width, 'height': height, 'rowBounds': rows, 'columnBounds': columns,
            'rowConfidence': row_confidence, 'columnConfidence': column_confidence,
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'childMedicalDetail': record.get('childMedicalDetail', 'non-graphic'), 'file': str(target), 'geometryReview': geometry_review}

def main():
    global DEST, MANIFEST, REPORT, ALLOW_DOWNLOAD, BOUNDS
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True, help='Private JSON list with id and result records')
    parser.add_argument('--output-dir', type=Path, required=True, help='Atlas image destination')
    parser.add_argument('--manifest-output', type=Path, required=True, help='Explicit public atlas manifest destination')
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--bounds-input', type=Path, help='Optional reviewed geometry keyed by character id and sha256')
    parser.add_argument('--allow-download', action='store_true')
    args = parser.parse_args()
    DEST, MANIFEST, REPORT = args.output_dir.resolve(), args.manifest_output.resolve(), args.report.resolve()
    ALLOW_DOWNLOAD = args.allow_download
    BOUNDS = json.loads(args.bounds_input.read_text(encoding='utf-8-sig')) if args.bounds_input else {}
    DEST.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    records = json.loads(args.input.read_text(encoding='utf-8-sig'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        outputs = list(pool.map(download, records))
    manifest = {'version': 1, 'provider': 'OpenArt', 'layout': {'states': STATES, 'ageGroups': ['child', 'adult', 'elder']}, 'characters': {}}
    for row in outputs:
        if row['status'] == 'downloaded':
            manifest['characters'][row['id']] = {key: row[key] for key in ['src', 'width', 'height', 'rowBounds', 'columnBounds', 'childMedicalDetail']}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    REPORT.write_text(json.dumps(outputs, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'atlases': len(manifest['characters']), 'frames': len(manifest['characters']) * 36,
                      'bytes': sum(r.get('bytes', 0) for r in outputs),
                      'pending': [r['id'] for r in outputs if r['status'] != 'downloaded'],
                      'review': [{k: r[k] for k in ['id', 'rowConfidence', 'columnConfidence']} for r in outputs if r['status'] == 'downloaded' and r['geometryReview'] == 'automatic-seams' and min(r['rowConfidence'] + r['columnConfidence']) < 1.5]}, ensure_ascii=False))

if __name__ == '__main__':
    main()
