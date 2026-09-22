import { CHAPTER_FILES, buildCorpus, chapterCounts, selectEntries } from './corpus.mjs';
import { CARD_THEMES, CARD_RATIOS, DEFAULT_CARD_OPTIONS, drawCard, downloadCard } from './card.mjs';

const $ = id => document.getElementById(id);
const view = {
  search: $('search'), nav: $('chapterNav'), entries: $('entries'),
  title: $('resultTitle'), sub: $('resultSub'), count: $('corpusCount'),
  scope: $('scope'), more: $('more'), reset: $('reset'),
  studio: $('studio'), canvas: $('cardCanvas'), page: $('pageLabel'),
  source: $('studioSource'), studioStatus: $('studioStatus'),
};
const state = {
  corpus: null, chapterId: 'all', query: '', limit: 36,
  selected: null, cardPage: 0, cardOptions: { ...DEFAULT_CARD_OPTIONS },
  layout: null,
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendHighlighted(parent, text, query) {
  const needle = query.trim();
  if (!needle) { parent.textContent = text; return; }
  const lower = text.toLocaleLowerCase();
  const target = needle.toLocaleLowerCase();
  let offset = 0;
  while (offset < text.length) {
    const at = lower.indexOf(target, offset);
    if (at === -1) break;
    parent.append(document.createTextNode(text.slice(offset, at)));
    parent.append(el('mark', '', text.slice(at, at + needle.length)));
    offset = at + needle.length;
  }
  parent.append(document.createTextNode(text.slice(offset)));
}

function showError(error) {
  view.title.textContent = '资料加载失败';
  view.sub.textContent = '章节未全部加载，已停止生成不完整的检索结果。';
  view.entries.replaceChildren(el('p', 'notice', String(error?.message || error)));
  view.entries.setAttribute('aria-busy', 'false');
  view.scope.textContent = '加载失败';
}

async function load() {
  const chapters = await Promise.all(CHAPTER_FILES.map(async file => {
    const response = await fetch(`./jsons/${encodeURIComponent(file)}`);
    if (!response.ok) throw new Error(`${file} 加载失败（HTTP ${response.status}）`);
    try { return await response.json(); }
    catch { throw new Error(`${file} JSON 解析失败`); }
  }));
  state.corpus = buildCorpus(chapters);
  const quoteChapterCount = state.corpus.chapters.filter(chapter =>
    chapter.id !== 'chapter_01' && chapter.id !== 'chapter_02').length;
  view.count.textContent = `${quoteChapterCount} 个正文篇章 · ${state.corpus.entries.length} 条整理记录`;
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
  state.chapterId = chapterId;
  state.query = '';
  state.limit = 36;
  view.search.value = '';
  history.replaceState(null, '', location.pathname + location.search);
  syncNavigation();
  render();
  $('results').scrollIntoView({ block: 'start' });
}

function renderDocument(chapter) {
  const fragment = document.createDocumentFragment();
  fragment.append(el('p', 'notice', '此项为目录或再版前言，属于附属资料，不计入引文统计，也不作为毛泽东原文导出。'));
  chapter.contentList.forEach(content => fragment.append(el('p', 'entry-text entry', content)));
  view.entries.replaceChildren(fragment);
  view.more.hidden = true;
  view.title.textContent = chapter.chapter;
  view.sub.textContent = '附属文献 · 原样展示仓库整理文本';
  view.scope.textContent = '附属文献';
}

function entryCard(entry, position) {
  const article = el('article', 'entry');
  article.id = entry.id;
  const head = el('div', 'entry-top');
  head.append(el('span', 'entry-index', `记录 ${position + 1} · ${entry.id}`));
  head.append(el('span', 'entry-chapter', `${entry.classify} / ${entry.chapter}`));
  article.append(head);
  const text = el('p', 'entry-text');
  appendHighlighted(text, entry.text, state.query);
  article.append(text);
  const source = el('p', `entry-source${entry.source ? '' : ' missing'}`);
  appendHighlighted(source, entry.source || '整理文件未提供此段的独立出处。', state.query);
  article.append(source);
  const actions = el('div', 'entry-actions');
  const copy = el('button', 'action-button', '复制正文');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(entry.text);
      else {
        const textarea = el('textarea', '', entry.text);
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.append(textarea);
        textarea.select();
        const successful = document.execCommand('copy');
        textarea.remove();
        if (!successful) throw new Error('复制不可用');
      }
      copy.textContent = '已复制';
      setTimeout(() => { if (copy.isConnected) copy.textContent = '复制正文'; }, 1700);
    } catch { copy.textContent = '复制失败，请手动选择文本'; }
  });
  const image = el('button', 'action-button', '生成文献卡片');
  image.type = 'button';
  image.addEventListener('click', () => openStudio(entry));
  const permalink = el('a', 'action-button', '记录链接');
  permalink.href = `#${encodeURIComponent(entry.id)}`;
  actions.append(copy, image, permalink);
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
    const results = selectEntries(state.corpus.entries, { query: state.query, chapterId: state.chapterId });
    const chapter = state.corpus.chapters.find(item => item.id === state.chapterId);
    view.title.textContent = state.query ? '检索结果' : chapter?.chapter || '全部引文';
    view.sub.textContent = `匹配 ${results.length} 条记录 · ${state.query ? '包含正文、章节与出处' : '按资料原有顺序排列'}`;
    view.scope.textContent = `${results.length} / ${state.corpus.entries.length} 条`;
    const fragment = document.createDocumentFragment();
    if (!results.length) fragment.append(el('p', 'notice', '没有符合当前条件的记录。请尝试其他关键词或选择全部引文。'));
    results.slice(0, state.limit).forEach((entry, index) => fragment.append(entryCard(entry, index)));
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
  state.chapterId = state.corpus.entries[index].chapterId;
  state.query = '';
  view.search.value = '';
  const localIndex = state.corpus.entries.slice(0, index + 1)
    .filter(entry => entry.chapterId === state.chapterId).length - 1;
  state.limit = Math.max(36, localIndex + 1);
  syncNavigation();
  render();
  document.getElementById(id)?.scrollIntoView({ block: 'start' });
}

async function refreshPreview() {
  if (!state.selected) return;
  try {
    await document.fonts?.ready;
    const layout = drawCard(view.canvas, state.selected, state.cardOptions, state.cardPage);
    state.layout = layout;
    state.cardPage = Math.max(0, Math.min(state.cardPage, layout.pages.length - 1));
    view.page.textContent = `${state.cardPage + 1} / ${layout.pages.length}`;
    $('prev').disabled = state.cardPage === 0;
    $('next').disabled = state.cardPage === layout.pages.length - 1;
    view.studioStatus.textContent = `共 ${layout.pages.length} 页。图片完整保留正文的逐字顺序。`;
  } catch (error) { view.studioStatus.textContent = `预览失败：${error.message}`; }
}

function openStudio(entry) {
  state.selected = entry;
  state.cardPage = 0;
  view.source.textContent = entry.source || '整理文件未提供此段的独立出处。';
  view.studio.showModal();
  refreshPreview();
}

function setupEvents() {
  let searchTimer;
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
    if (event.key === 'Escape') { view.search.value = ''; state.query = ''; state.limit = 36; render(); }
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
  view.studio.addEventListener('close', () => { state.selected = null; state.layout = null; });
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
