import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAPTER_FILES, buildCorpus, selectEntries, corpusSummary } from '../src/corpus.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function readCorpus() {
  const dir = resolve(root, 'jsons');
  const files = readdirSync(dir).filter(name => /^\d{2}_.+\.json$/.test(name));
  assert.deepEqual([...CHAPTER_FILES].sort(), files.sort(), 'update the explicit chapter manifest whenever a chapter file changes');
  const chapters = CHAPTER_FILES.map(file => JSON.parse(readFileSync(resolve(dir, file), 'utf8')));
  return buildCorpus(chapters);
}

test('manifest matches numbered JSON chapters and builds the complete corpus', () => {
  const corpus = readCorpus();
  assert.equal(corpus.chapters.length, 35);
  assert.ok(corpus.entries.length > 33, 'one raw contentList element may contain multiple distinct attributed passages');
  assert.equal(new Set(corpus.entries.map(entry => entry.id)).size, corpus.entries.length);
  assert.ok(corpus.entries.every(entry => entry.text.length > 0));
  assert.ok(corpus.entries.every(entry => entry.chapterId !== 'chapter_01' && entry.chapterId !== 'chapter_02'));
  assert.equal(selectEntries(corpus.entries, { query: 'unmatched-fixture-9999' }).length, 0);
  assert.ok(readdirSync(resolve(root, 'jsons')).includes('metadata.json'), 'metadata is not a chapter');
});

test('real chapter records keep unprefixed source lines distinct from body text', () => {
  const corpus = readCorpus();
  const chapter19 = corpus.chapterEntries.get('chapter_19');
  const chapter35 = corpus.chapterEntries.get('chapter_35');
  assert.ok(chapter19?.length >= 9);
  assert.ok(chapter35?.length >= 10);
  for (const entry of [chapter19[0], chapter19[1], chapter35[0], chapter35[1]]) {
    assert.ok(entry.source.startsWith('《'), `${entry.id}: expected bibliography in source field`);
    assert.ok(!entry.text.includes(entry.source), `${entry.id}: bibliography must not remain in body`);
    assert.ok(entry.sourceFile.endsWith('.json'));
    assert.ok(entry.ordinal > 0 && entry.blockIndex > 0 && entry.recordIndex > 0);
  }
  const counts = corpusSummary(corpus.entries);
  assert.equal(counts.sourceSupplied + counts.sourceMissing, counts.records);
  assert.equal(counts.chapters, 33);
});
