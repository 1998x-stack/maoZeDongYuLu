import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_RATIOS, CARD_THEMES, DEFAULT_CARD_OPTIONS, wrapText, layoutCard, drawCard } from '../src/card.mjs';

const measure = text => Array.from(text).length * 10;
function fakeCanvas() {
  const text = [];
  const context = {
    font: '', textBaseline: '', textAlign: 'left', fillStyle: '',
    measureText: value => ({ width: measure(value) }),
    fillText: (value, x, y) => { text.push({ value, x, y }); },
    fillRect() {},
  };
  return { width: 0, height: 0, getContext: () => context, context, text };
}
const record = text => ({ id: 'chapter_03:1:1', chapter: '第一章', text, source: '——来源说明' });

test('wrapping retains Unicode code points and explicit blank paragraphs', () => {
  assert.deepEqual(wrapText('甲😀乙', 10, measure), ['甲', '😀', '乙']);
  assert.deepEqual(wrapText('第一段\n\n第二段', 300, measure), ['第一段', '', '第二段']);
});

test('all themes and supported dimensions have distinct valid configurations', () => {
  assert.equal(Object.keys(CARD_THEMES).length, 3);
  assert.deepEqual(Object.values(CARD_RATIOS).map(item => item.height), [1440, 1350, 1080]);
  assert.ok(Object.values(CARD_THEMES).every(item => item.bg && item.ink));
});

test('long unbroken content paginates without loss or overlapping footer', () => {
  const text = '文献排版测试。'.repeat(1000);
  for (const ratio of Object.keys(CARD_RATIOS)) {
    for (const fontSize of [32, 48, 68]) {
      const canvas = fakeCanvas();
      const options = { ...DEFAULT_CARD_OPTIONS, ratio, fontSize };
      const layout = layoutCard(canvas.context, text, options);
      assert.ok(layout.pages.length > 1, `${ratio} ${fontSize}`);
      assert.deepEqual(layout.pages.flat(), layout.lines);
      assert.equal(layout.lines.join(''), text);
      assert.ok(layout.pages.every(page => page.length <= layout.pageCapacity));
      const lastTop = 250 + (layout.pageCapacity - 1) * layout.lineHeight;
      assert.ok(lastTop + layout.lineHeight < layout.height - 245, `${ratio} ${fontSize}: footer collision`);
    }
  }
});

test('renderer exports same page text, page indicator, and recorded attribution', () => {
  const canvas = fakeCanvas();
  const layout = drawCard(canvas, record('文献排版测试。'.repeat(500)), DEFAULT_CARD_OPTIONS, 1);
  assert.ok(layout.pages.length > 1);
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1440);
  assert.ok(canvas.text.some(item => item.value === `2 / ${layout.pages.length}`));
  assert.ok(canvas.text.some(item => item.value === layout.pages[1][0]));
  assert.ok(canvas.text.some(item => item.value === '——来源说明'));
});

test('long citation shows explicit reading-page pointer instead of a truncated quotation', () => {
  const canvas = fakeCanvas();
  drawCard(canvas, { ...record('正文'), source: '——非常长的出处'.repeat(100) });
  assert.ok(canvas.text.some(item => item.value.includes('阅读页查看完整出处')));
});

test('invalid font size or aspect ratio is rejected', () => {
  for (const size of [0, 31, 69, Infinity]) {
    assert.throws(() => layoutCard(fakeCanvas().context, '文本', { ...DEFAULT_CARD_OPTIONS, fontSize: size }));
  }
  assert.throws(() => drawCard(fakeCanvas(), record('文本'), { ...DEFAULT_CARD_OPTIONS, theme: 'invalid' }));
});
