import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHAPTER_FILES, buildCorpus, corpusSummary } from '../src/corpus.mjs';

const root = new URL('../jsons/', import.meta.url);
const chapters = CHAPTER_FILES.map(file => JSON.parse(readFileSync(new URL(encodeURIComponent(file), root), 'utf8')));
const corpus = buildCorpus(chapters);
const summary = corpusSummary(corpus.entries);
const emptySources = corpus.entries.filter(entry => !entry.source);
const boilerplate = chapters.flatMap(chapter => (chapter.analysisList || [])
  .filter(text => /核心观点阐述|内容索引|\d+字。/u.test(text))
  .map(() => chapter.id));
const suspect = corpus.entries.filter(entry =>
  /(?:^|\n)\s*《[^》\n]+》[^\n]{0,80}(?:出版社|第[^\n]{1,16}页|[（(][^\n)]{0,40}年)/u.test(entry.text)
);

console.log('整理语料审计 / Corpus audit (counts are repository-local, not historical totals)');
console.log(`正文篇章 ${summary.chapters}；整理记录 ${summary.records}；附有出处 ${summary.sourceSupplied}；未单独标注出处 ${summary.sourceMissing}`);
console.log(`模板式 analysisList 项 ${boilerplate.length}（不应呈现为专家解读）`);
console.log(`正文内仍可能夹有书目信息的记录 ${suspect.length}（需要人工核对）`);
for (const chapter of corpus.chapters.filter(item => corpus.chapterEntries.has(item.id))) {
  const entries = corpus.chapterEntries.get(chapter.id);
  const sourceMissing = entries.filter(item => !item.source).length;
  console.log(`${chapter.id}\t${entries.length} 条\t未标出处 ${sourceMissing}\t${chapter.chapter}`);
}
if (emptySources.length) {
  console.log('未单独标注出处的记录位置（最多 40 条）：');
  emptySources.slice(0, 40).forEach(entry => console.log(`  ${entry.id} ${entry.sourceFile} contentList[${entry.blockIndex - 1}]`));
}
if (suspect.length) {
  console.log('疑似混入正文的书目行（最多 40 条；需人工审查，不自动修改）：');
  suspect.slice(0, 40).forEach(entry => console.log(`  ${entry.id} ${entry.sourceFile} contentList[${entry.blockIndex - 1}]`));
}

// Treat results as editorial diagnostics. Only structural errors and hard-coded
// regression fixtures are CI blockers; unverified source claims are never generated.
