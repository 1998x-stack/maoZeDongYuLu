import { CHAPTER_FILES, buildCorpus, chapterCounts, corpusSummary, selectEntries } from './corpus.mjs';
import { CARD_THEMES, CARD_RATIOS, DEFAULT_CARD_OPTIONS, drawCard, downloadCard } from './card.mjs';

const $ = id => document.getElementById(id);
const view = {
  search: $('search'), sourceFilter: $('sourceFilter'), nav: $('chapterNav'), entries: $('entries'),
  title: $('resultTitle'), sub: $('resultSub'), count: $('corpusCount'),
  scope: $('scope'), overview: $('overview'), more: $('more'), reset: $('reset'),
  studio: $('studio'), canvas: $('cardCanvas'), page: $('pageLabel'),
  source: $('studioSource'), studioStatus: $('studioStatus'),
};
const state = {
  corpus: null, chapterId: 'all', query: '', sourceFilter: 'all', limit: 36,
  selected: null, cardPage: 0, cardOptions: { ...DEFAULT_CARD_OPTIONS }, layout: null,
};
let searchTimer;
let previewVersion = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendHighlighted(parent, text, query) {
  const needle = query.trim();
  if (!needle) { parent.textContent = text; return; }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, 'giu');
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset) parent.append(document.createTextNode(text.slice(offset, match.index)));
    parent.append(el('mark', '', match[0]));
    offset = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(offset)));
}

function showError(error) {
  view.title.textContent = '资料加载失败';
  view.sub.textContent = '章节未全部加载，已停止生成不完整的检索结果。';
  view.entries.replaceChildren(el('p', 'notice', String(error?.message || error)));
  view.overview.replaceChildren(el('p', 'notice', '无法根据不完整数据计算语料统计。'));
  view.entries.setAttribute('aria-busy', 'false');
  view.scope.textContent = '加载失败';
}

function overviewStat(value, label, note) {
  const item = el('div', 'overview-stat');
  item.append(el('strong', '', String(value)), el('span', '', label), el('small', '', note));
  return item;
}

function renderOverview() {
  const summary = corpusSummary(state.corpus.entries);
  view.overview.replaceChildren(
    overviewStat(summary.chapters, '正文篇章', '目录、再版前言另列'),
    overviewStat(summary.records, '整理记录', '由原始文本逐段解析'),
    overviewStat(summary.sourceSupplied, '附有出处文字', `另有 ${summary.sourceMissing} 条未单独标注；均未外部核验`),
  );
  view.count.textContent = `${summary.chapters} 个正文篇章 · ${summary.records} 条整理记录 · ${summary.sourceSupplied} 条附有出处文字`;
}

async function load() {
  const chapters = await Promise.all(CHAPTER_FILES.map(async file => {
    const response = await fetch(`./jsons/${encodeURIComponent(file)}`);
    if (!response.ok) throw new Error(`${file} 加载失败（HTTP ${response.status}）`);
    try { return await response.json(); }
    catch { throw new Error(`${file} JSON 解析失败`); }
  }));
  state.corpus = buildCorpus(chapters);
  renderOverview();
  renderNavigation();
  followHash();
}

function renderNavigation() {
  const counts = chapterCounts(state.corpus.entries);
  const all = el('button', 'chapter-button', `全部引文 · ${state.corpus.entries.length}`);
  all.type = 'button';
  all.dataset.chapterId = 'all';
  all.addEventListener('click', () => chooseChapter('all'));
  const groups = new Map();
  for (const chapter of state.corpus.chapters) {
    const label = chapter.classify === '其他' ? '附录与资料' : chapter.classify;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(chapter);
  }
  const fragment = document.createDocumentFragment();
  fragment.append(all);
  for (const [groupName, chapters] of groups) {
    const section = el('section', 'chapter-group');
    section.append(el('h2', '', groupName));
    for (const chapter of chapters) {
      const button = el('button', 'chapter-button');
      button.type = 'button';
      button.dataset.chapterId = chapter.id;
      button.append(el('span', '', chapter.chapter));
      button.append(el('span', 'count',
        chapter.id === 'chapter_01' || chapter.id === 'chapter_02'
          ? '资料' : String(counts.get(chapter.id) || 0)));
      button.addEventListener('click', () => chooseChapter(chapter.id));
      section.append(button);
    }
    fragment.append(section);
  }
  view.nav.replaceChildren(fragment);
  syncNavigation();
}

function syncNavigation() {
  view.nav.querySelectorAll('button[data-chapter-id]').forEach(button => {
    button.setAttribute('aria-current', String(button.dataset.chapterId === state.chapterId));
  });
}

function chooseChapter(chapterId) {
  clearTimeout(searchTimer);
  state.chapterId = chapterId;
  state.query = '';
  state.sourceFilter = 'all';
  state.limit = 36;
  view.search.value = '';
  view.sourceFilter.value = 'all';
  history.replaceState(null, '', location.pathname + location.search);
  syncNavigation();
  render();
  $('results').scrollIntoView({ block: 'start' });
}

function renderDocument(chapter) {
  const fragment = document.createDocumentFragment();
  fragment.append(el('p', 'notice', '此项属于附属资料，不计入引文统计，也不作为毛泽东原文导出。此处保留仓库整理文本。'));
  chapter.contentList.forEach(content => fragment.append(el('p', 'entry-text entry', content)));
  view.entries.replaceChildren(fragment);
  view.more.hidden = true;
  view.title.textContent = chapter.chapter;
  view.sub.textContent = '附属文献 · 保留原始整理内容与署名';
  view.scope.textContent = '附属文献';
}

async function copyText(button, content, defaultLabel) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(content);
    else {
      const textarea = el('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      const successful = document.execCommand('copy');
      textarea.remove();
      if (!successful) throw new Error('复制不可用');
    }
    button.textContent = '已复制';
    setTimeout(() => { if (button.isConnected) button.textContent = defaultLabel; }, 1700);
  } catch { button.textContent = '复制失败，请手动选择文本'; }
}

function entryCard(entry) {
  const article = el('article', 'entry');
  article.id = entry.id;
  const head = el('div', 'entry-top');
  const location = el('div');
  location.append(el('div', 'entry-index', `${entry.chapter} · 第 ${entry.ordinal} 条`));
  location.append(el('div', 'entry-location', `资料记录 ${entry.id}`));
  head.append(location, el('span', 'entry-chapter', entry.classify));
  article.append(head);

  const text = el('p', 'entry-text');
  appendHighlighted(text, entry.text, state.query);
  article.append(text);

  article.append(el('p', `source-heading${entry.source ? '' : ' unsupplied'}`,
    entry.source ? '原整理资料附有的出处 · 尚未独立核验' : '出处状态 · 本段未单独标注出处'));
  const source = el('p', `entry-source${entry.source ? '' : ' missing'}`);
  appendHighlighted(source, entry.source || '原整理资料未为这一段单独提供出处文字，请参照原始 JSON 核对上下文。', state.query);
  article.append(source);
  const trace = el('p', 'entry-trace', `资料定位：${entry.sourceFile || entry.chapterId} → contentList[${entry.blockIndex - 1}] → 第 ${entry.recordIndex} 段`);
  if (entry.sourceFile) {
    const original = el('a', '', '查看原始 JSON');
    original.href = `./jsons/${encodeURIComponent(entry.sourceFile)}`;
    original.target = '_blank';
    original.rel = 'noopener noreferrer';
    trace.append(' · ', original);
  }
  article.append(trace);

  const actions = el('div', 'entry-actions');
  const copy = el('button', 'action-button', '复制正文');
  copy.type = 'button';
  copy.addEventListener('click', () => copyText(copy, entry.text, '复制正文'));
  const copyWithSource = el('button', 'action-button', '复制正文与出处');
  copyWithSource.type = 'button';
  copyWithSource.addEventListener('click', () => copyText(copyWithSource,
    `${entry.text}\n\n${entry.source || '原整理资料未单独标注出处'}\n${entry.chapter} · ${entry.id}（出处未经独立核验）`,
    '复制正文与出处'));
  const image = el('button', 'action-button', '生成文献卡片');
  image.type = 'button';
  image.addEventListener('click', () => openStudio(entry));
  const permalink = el('a', 'action-button', '记录链接');
  permalink.href = `#${encodeURIComponent(entry.id)}`;
  actions.append(copy, copyWithSource, image, permalink);
  article.append(actions);
  return article;
}

function render() {
  if (!state.corpus) return;
  view.entries.setAttribute('aria-busy', 'true');
  const documentChapter = state.corpus.chapters.find(chapter =>
    chapter.id === state.chapterId && (chapter.id === 'chapter_01' || chapter.id === 'chapter_02'));
  if (documentChapter && !state.query) {
    renderDocument(documentChapter);
  } else {
    const results = selectEntries(state.corpus.entries, {
      query: state.query, chapterId: state.chapterId, sourceFilter: state.sourceFilter,
    });
    const chapter = state.corpus.chapters.find(item => item.id === state.chapterId);
    const supplied = results.filter(entry => Boolean(entry.source)).length;
    view.title.textContent = state.query ? '逐条检索结果' : chapter?.chapter || '全部引文';
    view.sub.textContent = `匹配 ${results.length} 条整理记录 · ${supplied} 条附有出处文字 · ${results.length - supplied} 条未单独标注出处。来源均未外部核验。`;
    view.scope.textContent = `${results.length} / ${state.corpus.entries.length} 条记录`;
    const fragment = document.createDocumentFragment();
    if (!results.length) fragment.append(el('p', 'notice', '没有符合当前条件的记录。可更换关键词、出处状态或章节。'));
    results.slice(0, state.limit).forEach(entry => fragment.append(entryCard(entry)));
    view.entries.replaceChildren(fragment);
    view.more.hidden = results.length <= state.limit;
    view.more.textContent = `显示更多记录（剩余 ${Math.max(0, results.length - state.limit)} 条）`;
  }
  view.entries.setAttribute('aria-busy', 'false');
}

function followHash() {
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return render(); }
  const index = state.corpus.entries.findIndex(entry => entry.id === id);
  if (index < 0) { render(); return; }
  clearTimeout(searchTimer);
  state.chapterId = state.corpus.entries[index].chapterId;
  state.query = '';
  state.sourceFilter = 'all';
  view.search.value = '';
  view.sourceFilter.value = 'all';
  state.limit = Math.max(36, state.corpus.entries[index].ordinal);
  syncNavigation();
  render();
  document.getElementById(id)?.scrollIntoView({ block: 'start' });
}

async function refreshPreview() {
  if (!state.selected) return;
  const version = ++previewVersion;
  try {
    await document.fonts?.ready;
    if (version !== previewVersion || !state.selected || !view.studio.open) return;
    const layout = drawCard(view.canvas, state.selected, state.cardOptions, state.cardPage);
    state.layout = layout;
    state.cardPage = Math.max(0, Math.min(state.cardPage, layout.pages.length - 1));
    view.page.textContent = `${state.cardPage + 1} / ${layout.pages.length}`;
    $('prev').disabled = state.cardPage === 0;
    $('next').disabled = state.cardPage === layout.pages.length - 1;
    view.studioStatus.textContent = `共 ${layout.pages.length} 页。正文保持原整理文本顺序；出处请结合原始资料核对。`;
  } catch (error) { view.studioStatus.textContent = `预览失败：${error.message}`; }
}

function openStudio(entry) {
  state.selected = entry;
  state.cardPage = 0;
  view.source.textContent = entry.source || '原整理资料未为此段单独标注出处。';
  view.studio.showModal();
  refreshPreview();
}

function setupEvents() {
  view.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const value = view.search.value;
    searchTimer = setTimeout(() => {
      state.query = value;
      if (state.chapterId === 'chapter_01' || state.chapterId === 'chapter_02') {
        state.chapterId = 'all';
        syncNavigation();
      }
      state.limit = 36;
      render();
    }, 160);
  });
  view.search.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      clearTimeout(searchTimer);
      view.search.value = '';
      state.query = '';
      state.limit = 36;
      render();
    }
  });
  view.sourceFilter.addEventListener('change', () => {
    state.sourceFilter = view.sourceFilter.value;
    if (state.chapterId === 'chapter_01' || state.chapterId === 'chapter_02') {
      state.chapterId = 'all';
      syncNavigation();
    }
    state.limit = 36;
    render();
  });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !view.studio.open &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      event.preventDefault(); view.search.focus();
    }
  });
  view.reset.addEventListener('click', () => chooseChapter('all'));
  view.more.addEventListener('click', () => { state.limit += 36; render(); });
  window.addEventListener('hashchange', () => { if (state.corpus) followHash(); });
  $('closeStudio').addEventListener('click', () => view.studio.close());
  view.studio.addEventListener('click', event => { if (event.target === view.studio) view.studio.close(); });
  view.studio.addEventListener('close', () => { ++previewVersion; state.selected = null; state.layout = null; });
  document.querySelectorAll('input[name="cardTheme"]').forEach(input => input.addEventListener('change', () => {
    if (!input.checked || !CARD_THEMES[input.value]) return;
    state.cardOptions.theme = input.value; state.cardPage = 0; refreshPreview();
  }));
  $('cardRatio').addEventListener('change', event => {
    if (!CARD_RATIOS[event.target.value]) return;
    state.cardOptions.ratio = event.target.value; state.cardPage = 0; refreshPreview();
  });
  $('cardSize').addEventListener('input', event => {
    state.cardOptions.fontSize = Number(event.target.value);
    $('sizeValue').textContent = String(state.cardOptions.fontSize);
    state.cardPage = 0; refreshPreview();
  });
  $('prev').addEventListener('click', () => { state.cardPage--; refreshPreview(); });
  $('next').addEventListener('click', () => { state.cardPage++; refreshPreview(); });
  $('download').addEventListener('click', async () => {
    const button = $('download');
    if (!state.selected) return;
    button.disabled = true;
    try {
      await document.fonts?.ready;
      const layout = drawCard(view.canvas, state.selected, state.cardOptions, state.cardPage);
      await downloadCard(view.canvas, state.selected, state.cardPage, layout.pages.length);
      view.studioStatus.textContent = `已生成第 ${state.cardPage + 1} 页 PNG；请检查浏览器的下载列表。`;
    } catch (error) { view.studioStatus.textContent = `导出失败：${error.message}`; }
    finally { button.disabled = false; }
  });
}

setupEvents();
load().catch(showError);
