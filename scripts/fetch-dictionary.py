"""Stream the official Kaikki raw extract. Never load the whole dump into RAM."""
import requests, gzip, json, hashlib, pathlib, time, re

root = pathlib.Path(__file__).resolve().parents[1]
out = root / 'data' / 'work'
out.mkdir(parents=True, exist_ok=True)
url = 'https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz'
response = requests.get(url, stream=True, timeout=(30, 120))
response.raise_for_status()
start = time.time()
count = 0
rows = 0
blocked = {'obsolete', 'archaic', 'historical', 'offensive', 'vulgar', 'derogatory', 'slur', 'taxonomic', 'extinct'}
with gzip.GzipFile(fileobj=response.raw) as stream, (out / 'dictionary.ndjson.partial').open('w', encoding='utf-8') as dest:
    for line in stream:
        entry = json.loads(line)
        rows += 1
        if entry.get('lang_code') != 'en': continue
        if entry.get('pos') not in {'noun','verb','adj','adv','phrase','prep','conj','intj','pron','det','num'}: continue
        word = entry.get('word', '')
        if len(word) > 70 or not re.match(r"^[A-Za-z][A-Za-z '\-’]+$", word): continue
        translations = [t for t in entry.get('translations', []) if t.get('code') == 'de']
        for sense in entry.get('senses', []):
            tags = sense.get('tags', [])
            if sense.get('form_of') or sense.get('alt_of') or blocked.intersection(tags): continue
            glosses = sense.get('glosses', [])
            if not glosses: continue
            gloss = glosses[-1]
            if len(gloss) > 700: continue
            # Match translation sense explicitly; do not attach every translation to every meaning.
            norm = lambda s: re.sub(r'[^a-z0-9 ]', '', s.lower()).strip()
            matched = [t['word'] for t in translations if t.get('word') and t.get('sense') and (norm(t['sense']) == norm(gloss) or (len(entry.get('senses', [])) == 1))]
            for t in sense.get('translations', []):
                if t.get('code') == 'de' and t.get('word'): matched.append(t['word'])
            key = hashlib.sha256((word+'|'+entry['pos']+'|'+gloss).encode()).hexdigest()[:20]
            examples = [e.get('text') for e in sense.get('examples', []) if e.get('text') and len(e.get('text','')) < 220 and not e.get('ref')]
            item = {'id':'wkt-'+key, 'word':word, 'pos':entry['pos'], 'gloss':gloss, 'de':list(dict.fromkeys(matched)), 'tags':tags, 'topics':sense.get('topics', []), 'example':examples[0] if examples else None}
            dest.write(json.dumps(item, ensure_ascii=False, separators=(',',':'))+'\n')
            count += 1
        if rows % 10000 == 0: print(f'{rows:,} source records; {count:,} English senses; {time.time()-start:.0f}s', flush=True)
(out / 'dictionary.ndjson.partial').replace(out / 'dictionary.ndjson')
(out / 'source.json').write_text(json.dumps({'source':'Wiktionary via Kaikki raw Wiktextract','url':url,'retrievedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'lastModified':response.headers.get('Last-Modified'),'etag':response.headers.get('ETag'),'records':count,'license':'CC-BY-SA-4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/'},indent=2),encoding='utf-8')
print(f'Complete: {count:,} English senses in {time.time()-start:.0f}s', flush=True)
