import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAPTER_FILES, buildCorpus, selectEntries } from '../src/corpus.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('manifest matches exactly all shipped JSON chapters and builds complete corpus', () => {
  const dir = resolve(root, 'jsons');
  const files = readdirSync(dir).filter(name => name.endsWith('.json'));
  assert.deepEqual([...CHAPTER_FILES].sort(), files.sort(), 'update the explicit manifest whenever source files change');
  const chapters = CHAPTER_FILES.map(file => JSON.parse(readFileSync(resolve(dir, file), 'utf8')));
  const corpus = buildCorpus(chapters);
  assert.equal(corpus.chapters.length, 35);
  assert.ok(corpus.entries.length > 33, 'every chapter can contain multiple separately attributed records');
  assert.equal(new Set(corpus.entries.map(entry => entry.id)).size, corpus.entries.length);
  assert.ok(corpus.entries.every(entry => entry.text.length > 0));
  assert.ok(corpus.entries.every(entry => entry.chapterId !== 'chapter_01' && entry.chapterId !== 'chapter_02'));
  assert.equal(selectEntries(corpus.entries, { query: 'unmatched-fixture-9999' }).length, 0);
});
