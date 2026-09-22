// Original archival presentation, independent of a third-party design service.
export const CARD_RATIOS = {
  '3:4': { label: '3:4 竖版', width: 1080, height: 1440 },
  '4:5': { label: '4:5 竖版', width: 1080, height: 1350 },
  '1:1': { label: '1:1 方形', width: 1080, height: 1080 },
};
export const CARD_THEMES = {
  paper: { label: '纸本文献', bg: '#f7f4eb', ink: '#252b30', muted: '#667078', accent: '#3f6371', panel: '#e9e7de' },
  peach: { label: '柔和笔记', bg: '#fdf0eb', ink: '#503f42', muted: '#826d72', accent: '#ad6070', panel: '#f4ded8' },
  night: { label: '深色阅读', bg: '#202934', ink: '#f9f5ed', muted: '#c7cfda', accent: '#a8c8dd', panel: '#34404d' },
};
export const DEFAULT_CARD_OPTIONS = { ratio: '3:4', theme: 'paper', fontSize: 48 };
const FONT = '"Noto Serif SC", "Songti SC", "SimSun", serif';

export function wrapText(text, maxWidth, measure) {
  const result = [];
  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n');
  for (const paragraph of paragraphs) {
    if (!paragraph) { result.push(''); continue; }
    let line = '';
    for (const char of Array.from(paragraph)) {
      if (line && measure(line + char) > maxWidth) {
        result.push(line);
        line = char;
      } else {
        line += char;
      }
    }
    result.push(line);
  }
  return result;
}

export function layoutCard(ctx, text, options = DEFAULT_CARD_OPTIONS) {
  const ratio = CARD_RATIOS[options.ratio];
  if (!ratio) throw new Error('未知卡片尺寸');
  if (!Number.isFinite(options.fontSize) || options.fontSize < 32 || options.fontSize > 68) {
    throw new Error('字号超出允许范围');
  }
  ctx.font = `500 ${options.fontSize}px ${FONT}`;
  const lineHeight = Math.ceil(options.fontSize * 1.62);
  const lines = wrapText(text, ratio.width - 172, value => ctx.measureText(value).width);
  // Text starts at y=250. Reserve a large, non-overlapping footer for provenance.
  const pageCapacity = Math.max(1, Math.floor((ratio.height - 565) / lineHeight));
  const pages = [];
  for (let offset = 0; offset < lines.length; offset += pageCapacity) {
    pages.push(lines.slice(offset, offset + pageCapacity));
  }
  return { ...ratio, lines, pages, lineHeight, pageCapacity };
}

export function drawCard(canvas, entry, options = DEFAULT_CARD_OPTIONS, selectedPage = 0) {
  const ratio = CARD_RATIOS[options.ratio];
  if (!ratio || !CARD_THEMES[options.theme]) throw new Error('未知卡片主题或比例');
  canvas.width = ratio.width;
  canvas.height = ratio.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('浏览器不支持 Canvas 图片生成');
  const layout = layoutCard(ctx, entry.text, options);
  const page = Math.min(Math.max(0, selectedPage), layout.pages.length - 1);
  const colors = CARD_THEMES[options.theme];
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, ratio.width, ratio.height);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(72, 72, 72, 7);
  ctx.fillStyle = colors.muted;
  ctx.font = `500 25px ${FONT}`;
  ctx.textBaseline = 'top';
  ctx.fillText('历史文献 · 整理摘录', 72, 110);
  ctx.fillStyle = colors.ink;
  ctx.font = `600 37px ${FONT}`;
  const chapterLines = wrapText(entry.chapter, ratio.width - 144, value => ctx.measureText(value).width);
  ctx.fillText(chapterLines[0] || '', 72, 165);
  ctx.font = `500 ${options.fontSize}px ${FONT}`;
  let y = 250;
  for (const line of layout.pages[page]) {
    ctx.fillText(line, 86, y);
    y += layout.lineHeight;
  }
  const footerY = ratio.height - 245;
  ctx.fillStyle = colors.panel;
  ctx.fillRect(72, footerY, ratio.width - 144, 1);
  ctx.fillStyle = colors.muted;
  ctx.font = `400 23px ${FONT}`;
  const source = entry.source || '本条未标注来源';
  const sourceLines = wrapText(source, ratio.width - 144, value => ctx.measureText(value).width);
  if (sourceLines.length <= 2) {
    sourceLines.forEach((line, i) => ctx.fillText(line, 72, footerY + 25 + i * 34));
  } else {
    ctx.fillText('来源信息较长，请在阅读页查看完整出处', 72, footerY + 25);
  }
  ctx.fillStyle = colors.ink;
  ctx.font = `500 23px ${FONT}`;
  ctx.fillText(`记录 ${entry.id}`, 72, ratio.height - 73);
  ctx.textAlign = 'right';
  ctx.fillText(`${page + 1} / ${layout.pages.length}`, ratio.width - 72, ratio.height - 73);
  ctx.textAlign = 'left';
  return layout;
}

export async function downloadCard(canvas, entry, page, count) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG 编码失败')), 'image/png');
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `archive-${entry.id.replace(/[^\w-]/g, '-')}-${page + 1}-of-${count}.png`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
