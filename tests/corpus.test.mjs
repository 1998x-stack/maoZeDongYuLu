import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTER_FILES, splitBlock, buildCorpus, validateChapter, selectEntries, chapterCounts } from '../src/corpus.mjs';

const chapter = (id, contentList, classify = '阅读分类') => ({ id, chapter: `章节 ${id}`, classify, contentList });

test('all static chapter files are registered exactly once', () => {
  assert.equal(CHAPTER_FILES.length, 35);
  assert.equal(new Set(CHAPTER_FILES).size, CHAPTER_FILES.length);
});

test('splits several attributed passages in one JSON string without dropping text', () => {
  const content = '第一段正文\n第二行\n——来源一\n第二段正文\n——来源二';
  assert.deepEqual(splitBlock(content), [
    { text: '第一段正文\n第二行', source: '——来源一' },
    { text: '第二段正文', source: '——来源二' },
  ]);
});

test('retains unattributed and CRLF content without inventing citations', () => {
  assert.deepEqual(splitBlock('未标注内容\r\n第二行'), [{ text: '未标注内容\n第二行', source: '' }]);
  assert.deepEqual(splitBlock(''), []);
});

test('preface and contents remain documents, not author-attributed quotations', () => {
  const corpus = buildCorpus([
    chapter('chapter_01', ['目录']),
    chapter('chapter_02', ['再版前言，另有署名']),
    chapter('chapter_03', ['第一段\n——出处一\n第二段\n——出处二']),
  ]);
  assert.equal(corpus.chapters.length, 3);
  assert.equal(corpus.entries.length, 2);
  assert.deepEqual(corpus.entries.map(e => e.id), ['chapter_03:1:1', 'chapter_03:1:2']);
  assert.equal(chapterCounts(corpus.entries).get('chapter_03'), 2);
  assert.deepEqual(selectEntries(corpus.entries, { query: '出处二' }).map(e => e.text), ['第二段']);
  assert.equal(selectEntries(corpus.entries, { chapterId: 'chapter_02' }).length, 0);
});

test('search and chapter restrictions compose without mixing records', () => {
  const corpus = buildCorpus([
    chapter('chapter_03', ['关键词甲\n——来源甲']),
    chapter('chapter_04', ['关键词乙\n——来源乙']),
  ]);
  assert.equal(selectEntries(corpus.entries, { query: '关键词', chapterId: 'chapter_03' }).length, 1);
  assert.equal(selectEntries(corpus.entries, { query: '来源乙', chapterId: 'chapter_03' }).length, 0);
});

test('malformed chapter metadata and duplicate identifiers fail explicitly', () => {
  assert.throws(() => validateChapter(chapter('bad', ['text'])), /结构有误/);
  assert.throws(() => validateChapter(chapter('chapter_03', [false])), /结构有误/);
  assert.throws(() => buildCorpus([chapter('chapter_03', []), chapter('chapter_03', [])]), /重复/);
});
