// Static Pages hosting cannot list directories. Keep source order explicit and auditable.
export const CHAPTER_FILES = [
  '01_目录.json', '02_《毛主席语录》再版前言.json',
  '03_一、共产党.json', '04_二、阶级和阶级斗争.json',
  '05_三、社会主义和共产主义.json', '06_四、正确处理人民内部矛盾.json',
  '07_五、战争与和平.json', '08_六、帝国主义和一切反动派都是纸老虎.json',
  '09_七、敢于斗争，敢于胜利.json', '10_八、人民战争.json',
  '11_九、人民军队.json', '12_十、党委领导.json',
  '13_十一、群众路线.json', '14_十二、政治工作.json',
  '15_十三、官兵关系.json', '16_十四、军民关系.json',
  '17_十五、三大民主.json', '18_十六、教育和训练.json',
  '19_十七、为人民服务.json', '20_十八、爱国主义和国际主义.json',
  '21_十九、革命英雄主义.json', '22_二十、勤俭建国.json',
  '23_二十一、自力更生，艰苦奋斗.json', '24_二十二、思想方法和工作方法.json',
  '25_二十三、调查研究.json', '26_二十四、纠正错误思想.json',
  '27_二十五、团结.json', '28_二十六、纪律.json',
  '29_二十七、批评和自我批评.json', '30_二十八、共产党员.json',
  '31_二十九、干部.json', '32_三十、青年.json',
  '33_三十一、妇女.json', '34_三十二、文化艺术.json', '35_三十三、学习.json',
];

export function validateChapter(chapter, file = 'unknown') {
  if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter) ||
      typeof chapter.id !== 'string' || !/^chapter_\d+$/.test(chapter.id) ||
      typeof chapter.chapter !== 'string' || !chapter.chapter.trim() ||
      typeof chapter.classify !== 'string' || !chapter.classify.trim() ||
      !Array.isArray(chapter.contentList) ||
      !chapter.contentList.every(text => typeof text === 'string')) {
    throw new Error(`章节数据结构有误：${file}`);
  }
  return chapter;
}

/**
 * This is a conservative *format recognizer*, not a bibliography verifier.
 * The collected JSON contains both "——《作品》…" and "《作品》（日期）…".
 * A bare book title alone is NOT enough to classify a line as a citation.
 * Ambiguous lines remain in the body for manual editorial review.
 */
export function isBibliographicSourceLine(line) {
  const value = line.trim();
  const title = /^《[^》\n]{1,140}》/u.exec(value);
  if (!title) return false;
  const rest = value.slice(title[0].length);
  return /[（(][^）)]{0,40}(?:年|月|日)/u.test(rest) ||
    /(?:出版社|出版|第[一二三四五六七八九十百千万〇零\d—－-]+(?:卷|页))/u.test(rest);
}

export function splitBlock(block) {
  const lines = block.replace(/\r\n?/g, '\n').split('\n');
  const records = [];
  let body = [];
  for (const line of lines) {
    const sourceLine = line.trimStart().startsWith('——') || isBibliographicSourceLine(line);
    if (sourceLine && body.some(value => value.trim())) {
      records.push({ text: body.join('\n').trim(), source: line.trim() });
      body = [];
    } else {
      body.push(line);
    }
  }
  const remaining = body.join('\n').trim();
  if (remaining) records.push({ text: remaining, source: '' });
  return records;
}

export function buildCorpus(rawChapters) {
  const ids = new Set();
  const chapters = rawChapters.map((chapter, index) => {
    const checked = validateChapter(chapter, `index ${index}`);
    if (ids.has(checked.id)) throw new Error(`章节编号重复：${checked.id}`);
    ids.add(checked.id);
    return checked;
  });
  const entries = [];
  const chapterEntries = new Map();
  for (const chapter of chapters) {
    // The table of contents and separately authored preface are documents.
    if (chapter.id === 'chapter_01' || chapter.id === 'chapter_02') continue;
    const group = [];
    const chapterNumber = Number(chapter.id.slice('chapter_'.length));
    const sourceFile = CHAPTER_FILES.find(file => file.startsWith(`${String(chapterNumber).padStart(2, '0')}_`)) || '';
    chapter.contentList.forEach((block, blockIndex) => {
      splitBlock(block).forEach((record, recordIndex) => {
        const entry = {
          ...record,
          id: `${chapter.id}:${blockIndex + 1}:${recordIndex + 1}`,
          chapterId: chapter.id,
          chapter: chapter.chapter,
          classify: chapter.classify,
          ordinal: group.length + 1,
          blockIndex: blockIndex + 1,
          recordIndex: recordIndex + 1,
          sourceFile,
        };
        entries.push(entry);
        group.push(entry);
      });
    });
    chapterEntries.set(chapter.id, group);
  }
  return { chapters, entries, chapterEntries };
}

export function selectEntries(entries, { query = '', chapterId = 'all', sourceFilter = 'all' } = {}) {
  const term = query.trim().toLocaleLowerCase();
  return entries.filter(entry =>
    (chapterId === 'all' || entry.chapterId === chapterId) &&
    (sourceFilter === 'all' || (sourceFilter === 'supplied' ? Boolean(entry.source) : !entry.source)) &&
    (!term || [entry.text, entry.source, entry.chapter, entry.classify]
      .some(value => value.toLocaleLowerCase().includes(term)))
  );
}

export function chapterCounts(entries) {
  const counts = new Map();
  for (const entry of entries) counts.set(entry.chapterId, (counts.get(entry.chapterId) || 0) + 1);
  return counts;
}

/** Values describe this *repository extract*, not all texts or verified publication dates. */
export function corpusSummary(entries) {
  const sourceSupplied = entries.filter(entry => Boolean(entry.source)).length;
  return { records: entries.length, sourceSupplied, sourceMissing: entries.length - sourceSupplied,
    chapters: new Set(entries.map(entry => entry.chapterId)).size };
}
