"""Build a compact headword catalogue. Word frequency is never sense/phrase frequency."""
import json
import math
import pathlib
import re
import unicodedata
from wordfreq import get_frequency_dict

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIN_ZIPF = 3.8
BLOCKED_TAGS = {
    'obsolete', 'archaic', 'historical', 'rare', 'uncommon', 'dated', 'dialectal',
    'nonstandard', 'misspelling', 'abbreviation', 'initialism', 'form-of',
}
SPECIALIST_TOPICS = {
    'medicine', 'pathology', 'organic-chemistry', 'inorganic-chemistry',
    'biochemistry', 'taxonomy', 'zoology', 'mathematics', 'particle-physics',
    'mineralogy', 'heraldry', 'genetics', 'mycology', 'microbiology',
    'crystallography', 'astrology', 'paleontology', 'mining',
}


def normalized(value):
    return ' '.join(unicodedata.normalize('NFKC', value).replace('’', "'").casefold().split())


def main():
    vocab = {normalized(line.split('|')[1]) for line in
             (ROOT / 'content/vocabulary.txt').read_text(encoding='utf-8').splitlines()
             if line and not line.startswith('#')}
    phrases = {normalized(line) for line in
               (ROOT / 'content/dictionary-phrases.txt').read_text(encoding='utf-8').splitlines()
               if line and not line.startswith('#')}
    explicit = vocab | phrases
    # Directly observed tokens only: zipf_frequency estimates unseen multiword strings
    # from their parts, making e.g. "to the" misleadingly frequent.
    observed = get_frequency_dict('en', wordlist='best')
    selected_sources = json.loads((ROOT / 'content/source-selection.json').read_text(encoding='utf-8'))
    pinned = {row['id'] for row in selected_sources}
    groups, seen_ids, seen_glosses, seed = {}, set(), set(), []
    with (ROOT / 'data/work/dictionary.ndjson').open(encoding='utf-8') as source:
        for line in source:
            row = json.loads(line)
            key = normalized(row['word'])
            if key in vocab:
                seed.append(row)
            frequency = round(math.log10(observed[key]) + 9, 2) if key in observed else 0
            if key not in explicit:
                if not re.fullmatch('[a-z]+', row['word']) or frequency < MIN_ZIPF:
                    continue
            if row['id'] not in pinned and (
                BLOCKED_TAGS.intersection(row['tags']) or SPECIALIST_TOPICS.intersection(row['topics'])
            ):
                continue
            gloss_key = (key, row['pos'], re.sub(r'[^\w\s]', '', normalized(row['gloss'])))
            if row['id'] in seen_ids or gloss_key in seen_glosses:
                continue
            seen_ids.add(row['id'])
            seen_glosses.add(gloss_key)
            group = groups.setdefault(key, {'word': row['word'], 'frequency': frequency, 'senses': []})
            group['senses'].append({k: row[k] for k in ('id', 'pos', 'gloss', 'de', 'tags', 'topics')})

    # Selected training meanings first; otherwise retain source order. Do not invent
    # a sense-frequency ranking or merge genuinely different meanings (bank/river bank).
    for group in groups.values():
        group['senses'].sort(key=lambda sense: sense['id'] not in pinned)
    words = sorted(groups.values(), key=lambda word: (-word['frequency'], normalized(word['word'])))
    dest = ROOT / 'public/dictionary'
    dest.mkdir(parents=True, exist_ok=True)
    files = []
    for start in range(0, len(words), 1000):
        name = f'part-{start // 1000:02d}.json'
        files.append('/dictionary/' + name)
        (dest / name).write_text(json.dumps(words[start:start + 1000], ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    # Only remove obsolete generated shards directly inside the verified output folder.
    for stale in dest.glob('part-*.json'):
        if '/dictionary/' + stale.name not in files:
            stale.unlink()
    manifest = {
        'schemaVersion': 2,
        'count': sum(len(word['senses']) for word in words),
        'words': len(words), 'phrases': sum(' ' in word['word'] for word in words), 'files': files,
        'status': 'compact-source-candidates',
        'selection': {'minObservedWordZipf': MIN_ZIPF, 'phrases': 'explicit-list-and-training-vocabulary',
                      'grouping': 'normalized-headword', 'senses': 'distinct-source-senses-preserved'},
        'frequencySource': 'wordfreq 3.1.1; data through approximately 2021',
        'source': 'https://kaikki.org/dictionary/rawdata.html', 'license': 'CC-BY-SA-4.0',
    }
    (dest / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'data/work/seed-candidates.json').write_text(json.dumps(seed, ensure_ascii=False), encoding='utf-8')
    print(f"Compact catalogue: {manifest['words']:,} headwords including {manifest['phrases']} phrases; {manifest['count']:,} nested senses; {len(files)} shards.")


if __name__ == '__main__':
    main()