import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAPTER_FILES, buildCorpus, selectEntries } from '../src/corpus.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('manifest matches numbered JSON chapters and builds the complete corpus', () => {
  const dir = resolve(root, 'jsons');
  const files = readdirSync(dir).filter(name => /^\d{2}_.+\.json$/.test(name));
  assert.deepEqual([...CHAPTER_FILES].sort(), files.sort(), 'update the explicit chapter manifest whenever a chapter file changes');
  const chapters = CHAPTER_FILES.map(file => JSON.parse(readFileSync(resolve(dir, file), 'utf8')));
  const corpus = buildCorpus(chapters);
  assert.equal(corpus.chapters.length, 35);
  assert.ok(corpus.entries.length > 33, 'one raw contentList element may contain multiple distinct attributed passages');
  assert.equal(new Set(corpus.entries.map(entry => entry.id)).size, corpus.entries.length);
  assert.ok(corpus.entries.every(entry => entry.text.length > 0));
  assert.ok(corpus.entries.every(entry => entry.chapterId !== 'chapter_01' && entry.chapterId !== 'chapter_02'));
  assert.equal(selectEntries(corpus.entries, { query: 'unmatched-fixture-9999' }).length, 0);
  // The repository also has metadata.json, which is not a chapter and must never be counted as one.
  assert.ok(readdirSync(dir).includes('metadata.json'));
});
