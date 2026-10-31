"""Download original OpenArt game assets, preserving their actual image format."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request
import argparse
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input', type=Path, required=True, help='Private JSON object with portraits list')
parser.add_argument('--retry-input', type=Path, help='Optional private JSON list overriding records by id')
parser.add_argument('--output-dir', type=Path, required=True)
parser.add_argument('--report', type=Path, required=True)
parser.add_argument('--allow-download', action='store_true', help='Allow missing files to be fetched from the asset CDN')
args = parser.parse_args()
DEST = args.output_dir.resolve()
DEST.mkdir(parents=True, exist_ok=True)

def download(portrait):
    if not re.fullmatch(r'person-[0-3]-[0-5]', portrait['id']):
        raise ValueError('Unrecognized character identity')
    resource = next((r for r in portrait.get('resources', []) if r.get('url')), None)
    if portrait.get('status') != 'COMPLETED' or not resource:
        return {'id': portrait['id'], 'status': portrait.get('status', 'missing')}
    url = resource['url']
    if not url.startswith('https://cdn.openart.ai/'):
        raise ValueError('Unexpected asset host')
    target = DEST / (portrait['id'] + '.png')
    if not target.exists():
        if not args.allow_download:
            raise ValueError('Missing local image; downloading requires --allow-download')
        request = urllib.request.Request(url, headers={'User-Agent': 'OpenHistoria-AssetImport/1.0'})
        with urllib.request.urlopen(request, timeout=90) as response:
            data = response.read(20_000_001)
        if len(data) > 20_000_000 or not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError('Unexpected PNG payload')
        target.write_bytes(data)
    data = target.read_bytes()
    return {'id': portrait['id'], 'status': 'downloaded', 'file': str(target), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

data = json.loads(args.input.read_text(encoding='utf-8-sig'))
if args.retry_input:
    retries = {p['id']: p for p in json.loads(args.retry_input.read_text(encoding='utf-8-sig'))}
    data['portraits'] = [{**p, **retries.get(p['id'], {})} for p in data['portraits']]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(download, data['portraits']))
args.report.parent.mkdir(parents=True, exist_ok=True)
args.report.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'downloaded': sum(r['status']=='downloaded' for r in results), 'pending': [r['id'] for r in results if r['status']!='downloaded'], 'totalBytes': sum(r.get('bytes',0) for r in results)}, ensure_ascii=False))
