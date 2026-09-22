import { readFileSync } from 'node:fs';
import { CHAPTER_FILES, buildCorpus, corpusSummary } from '../src/corpus.mjs';

const root = new URL('../jsons/', import.meta.url);
const chapters = CHAPTER_FILES.map(file => JSON.parse(readFileSync(new URL(encodeURIComponent(file), root), 'utf8')));
const corpus = buildCorpus(chapters);
const summary = corpusSummary(corpus.entries);
const emptySources = corpus.entries.filter(entry => !entry.source);
const editorialNotes = corpus.entries.filter(entry => entry.sourceIsNote);
const irregularSources = corpus.entries.filter(entry => entry.sourceNeedsReview);
const boilerplate = chapters.flatMap(chapter => (chapter.analysisList || [])
  .filter(text => /核心观点阐述|内容索引|\d+字。/u.test(text))
  .map(() => chapter.id));
const suspect = corpus.entries.filter(entry =>
  /(?:^|\n)\s*《[^》\n]+》[^\n]{0,80}(?:出版社|第[^\n]{1,16}页|[（(][^\n)]{0,40}年)/u.test(entry.text)
);

const pointer = entry => `${entry.id} ${entry.sourceFile} contentList[${entry.blockIndex - 1}]`;
console.log('整理语料审计 / Corpus audit (repository-local parser output, NOT verified bibliographic records)');
console.log(`正文篇章 ${summary.chapters}；解析后记录 ${summary.records}；附有出处或说明 ${summary.sourceSupplied}；未识别独立出处 ${summary.sourceMissing}`);
console.log(`其中非书目来源说明 ${editorialNotes.length} 条；来源书名号格式疑点 ${irregularSources.length} 条（均需人工校勘）`);
console.log(`模板式 analysisList 项 ${boilerplate.length}（不可呈现为经核验的文献分析）`);
console.log(`可由本脚本模式识别的正文内书目行 ${suspect.length}（0 不代表原文或出处已获核实）`);
for (const chapter of corpus.chapters.filter(item => corpus.chapterEntries.has(item.id))) {
  const entries = corpus.chapterEntries.get(chapter.id);
  const sourceMissing = entries.filter(item => !item.source).length;
  console.log(`${chapter.id}\t${entries.length} 条\t未识别独立出处 ${sourceMissing}\t${chapter.chapter}`);
}
for (const [description, items] of [
  ['未识别独立出处', emptySources],
  ['非书目来源说明', editorialNotes],
  ['来源书名号不规范', irregularSources],
  ['可能残留在正文内的书目行', suspect],
]) {
  if (!items.length) continue;
  console.log(`${description}的原始位置（最多 40 条，仅列索引，不改动原文）：`);
  items.slice(0, 40).forEach(entry => console.log(`  ${pointer(entry)}`));
}

// Editorial diagnostics are not independent provenance verification. Structural
// regressions are CI blockers; bibliographic collation remains manual.
