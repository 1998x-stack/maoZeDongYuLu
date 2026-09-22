import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHAPTER_FILES, buildCorpus, splitBlock, isBibliographicSourceLine,
  isUnprefixedSourceLine, isEditorialSourceNote,
} from '../src/corpus.mjs';

const chapters = CHAPTER_FILES.map(file => JSON.parse(readFileSync(new URL(`../jsons/${encodeURIComponent(file)}`, import.meta.url), 'utf8')));
const corpus = buildCorpus(chapters);

test('occasion/date/publication lines split passages without dropping or inventing source words', () => {
  const source = '在某次会议上的讲话（一九五八年九月八日），一九五八年九月九日《某日报》';
  assert.equal(isUnprefixedSourceLine(source), true);
  assert.equal(isUnprefixedSourceLine('在某次会议上讲话。随后继续讨论正文内容。'), false);
  assert.deepEqual(splitBlock(`甲正文\n${source}\n乙正文\n《参考作品》（一九五七年），出版社第一一页`), [
    { text: '甲正文', source },
    { text: '乙正文', source: '《参考作品》（一九五七年），出版社第一一页' },
  ]);
});

test('editorial source notes and visibly unmatched bibliographic brackets are reviewable', () => {
  const note = '为“某校”制定的校训';
  const irregular = '《某次讲话（一九四二年五月），〈选集〉第三卷第八五零页';
  assert.equal(isEditorialSourceNote(note), true);
  assert.equal(isUnprefixedSourceLine(note), true);
  assert.equal(isBibliographicSourceLine(irregular), true);
  assert.deepEqual(splitBlock(`正文甲\n${note}\n正文乙\n${irregular}`), [
    { text: '正文甲', source: note }, { text: '正文乙', source: irregular },
  ]);
  const group = buildCorpus([{ id: 'chapter_14', chapter: '测试篇章', classify: '测试',
    contentList: [`正文甲\n${note}\n正文乙\n${irregular}`] }]).entries;
  assert.equal(group[0].sourceIsNote, true);
  assert.equal(group[1].sourceNeedsReview, true);
});

test('actual chapter 08, 14 and 32 multi-record blocks stay individually navigable', () => {
  assert.equal(corpus.chapterEntries.get('chapter_08').length, 10);
  assert.equal(corpus.chapterEntries.get('chapter_14').length, 21);
  assert.equal(corpus.chapterEntries.get('chapter_32').length, 7);
  assert.ok(corpus.chapterEntries.get('chapter_14').some(entry => entry.sourceIsNote));
  assert.ok(corpus.chapterEntries.get('chapter_04').some(entry => entry.sourceNeedsReview));
  assert.ok(corpus.entries.every(entry => entry.source && entry.sourceFile && entry.ordinal > 0));
});

test('splitting conserves all non-whitespace source characters across every supplied block', () => {
  for (const chapter of chapters) {
    if (chapter.id === 'chapter_01' || chapter.id === 'chapter_02') continue;
    for (const block of chapter.contentList) {
      const reconstructed = splitBlock(block)
        .map(record => record.source ? `${record.text}\n${record.source}` : record.text)
        .join('\n');
      const condensed = value => value.replace(/\s/gu, '');
      assert.equal(condensed(reconstructed), condensed(block), `${chapter.id}: split must not drop non-whitespace text`);
    }
  }
});

test('no identifiable bibliography or occasion line remains embedded in a parsed body', () => {
  for (const entry of corpus.entries) {
    for (const line of entry.text.split('\n')) {
      assert.equal(isBibliographicSourceLine(line) || isUnprefixedSourceLine(line) || line.trimStart().startsWith('——'), false,
        `${entry.id}: recognizable source line was left in quotation body`);
    }
  }
});
