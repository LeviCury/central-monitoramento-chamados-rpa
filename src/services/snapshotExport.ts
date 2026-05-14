/**
 * Exportações visuais do dashboard:
 * - Snapshot PNG (download ou copiar para clipboard)
 * - Snapshot PDF (paginação automática multi-página em A4 retrato)
 * - Resumo Executivo PDF — relatório editorial denso, gerado dos dados
 *   (sem html2canvas), com estética "Annual Report + Magazine Editorial":
 *   capa hero massiva, tipografia mista (Times serif para títulos +
 *   Helvetica sans pra dados), cards com fundo cream sutil, gráficos
 *   stacked bar, cor pra sinalizar direção, densidade visual generosa.
 *
 * Tudo aqui é lazy-loaded (chamado dinamicamente) para não inflar o
 * bundle inicial.
 *
 * NOTA SOBRE GLIFOS: o jsPDF embute Helvetica Latin-1 padrão. Caracteres
 * fora desse range (U+2212 minus, ✓, ★, ⚡, etc.) renderizam como aspas
 * duplas ou retângulos vazios. Use SEMPRE ASCII puro pra sinais
 * matemáticos e dependa de `sanitizeForPdf` para textos de input.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  ActionItem,
  Insight,
  MetricsDelta,
  TicketMetrics,
} from './analytics';
import { saveAs } from 'file-saver';
// `ActionItem` ainda é importado porque o campo `actionItems` na interface
// `ExecutiveSummaryInput` é mantido por compatibilidade com callers existentes
// (Dashboard / ShareMenu), mesmo o PDF não renderizando mais a seção.

// ---------------------------------------------------------------------------
// Captura DOM → canvas (compartilhada por PNG/PDF snapshot)
// ---------------------------------------------------------------------------

interface CaptureOptions {
  backgroundColor?: string;
  scale?: number;
}

function detectThemeBackground(): string {
  if (typeof document === 'undefined') return '#fafafa';
  const root = document.documentElement;
  const dataTheme = root.getAttribute('data-theme');
  const isDark =
    dataTheme === 'dark' ||
    root.classList.contains('dark') ||
    (dataTheme !== 'light' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  return isDark ? '#09090b' : '#fafafa';
}

async function captureCanvas(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    backgroundColor: options.backgroundColor ?? detectThemeBackground(),
    scale: options.scale ?? 3,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });
}

function fileSafeStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export async function downloadDashboardPng(element: HTMLElement): Promise<void> {
  const canvas = await captureCanvas(element);
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Falha ao gerar PNG'));
        return;
      }
      saveAs(blob, `dashboard-rpa-${fileSafeStamp()}.png`);
      resolve();
    }, 'image/png');
  });
}

export async function copyDashboardPng(element: HTMLElement): Promise<void> {
  const canvas = await captureCanvas(element);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Falha ao gerar PNG');

  if (typeof navigator === 'undefined' || !navigator.clipboard || !window.ClipboardItem) {
    throw new Error('Clipboard de imagens não suportado neste navegador');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export async function downloadDashboardPdf(element: HTMLElement): Promise<void> {
  const canvas = await captureCanvas(element);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const headerHeight = 14;
  const footerHeight = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2 - headerHeight - footerHeight;

  const mmPerPx = usableWidth / canvas.width;
  const totalCanvasMm = canvas.height * mmPerPx;
  const pageCanvasMm = usableHeight;
  const pages = Math.max(1, Math.ceil(totalCanvasMm / pageCanvasMm));

  for (let i = 0; i < pages; i++) {
    if (i > 0) pdf.addPage();

    drawSnapshotHeader(pdf, pageWidth, headerHeight, margin);

    const pixelTop = Math.round((i * pageCanvasMm) / mmPerPx);
    const pixelBottom = Math.min(
      canvas.height,
      Math.round(((i + 1) * pageCanvasMm) / mmPerPx)
    );
    const sliceHeight = pixelBottom - pixelTop;
    if (sliceHeight <= 0) continue;

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext('2d');
    if (!ctx) throw new Error('Falha ao recortar canvas');
    ctx.drawImage(
      canvas,
      0,
      pixelTop,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    const sliceMm = sliceHeight * mmPerPx;
    pdf.addImage(
      slice.toDataURL('image/png'),
      'PNG',
      margin,
      margin + headerHeight,
      usableWidth,
      sliceMm
    );

    drawSnapshotFooter(pdf, pageWidth, pageHeight, margin, i + 1, pages);
  }

  pdf.save(`dashboard-rpa-${fileSafeStamp()}.pdf`);
}

function drawSnapshotHeader(pdf: jsPDF, pageWidth: number, h: number, margin: number) {
  setFill(pdf, ACCENT.brandRed);
  pdf.rect(0, 0, pageWidth, 1.2, 'F');
  setFill(pdf, INK.black);
  pdf.rect(0, 1.2, pageWidth, h - 1.2, 'F');

  setColor(pdf, INK.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('MINERVA FOODS', margin, 9, { charSpace: 0.4 });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  setColor(pdf, INK.silver);
  pdf.text('CENTRAL DE MONITORAMENTO RPA - SNAPSHOT', pageWidth - margin, 9, {
    align: 'right',
    charSpace: 0.4,
  });
}

function drawSnapshotFooter(
  pdf: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  page: number,
  total: number
) {
  setDraw(pdf, INK.silver);
  pdf.setLineWidth(0.15);
  pdf.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);
  setColor(pdf, INK.ash);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')} - Minerva Foods`,
    margin,
    pageHeight - 5
  );
  pdf.text(
    `${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
    pageWidth - margin,
    pageHeight - 5,
    { align: 'right', charSpace: 0.4 }
  );
}

// ===========================================================================
// RESUMO EXECUTIVO — design editorial denso (annual report + magazine)
// ===========================================================================

export interface ExecutiveSummaryInput {
  metrics: TicketMetrics;
  insights: Insight[];
  /**
   * Action items são aceitos por compatibilidade com callers existentes,
   * mas NÃO são mais renderizados no PDF (a pedido do usuário). O campo
   * permanece opcional pra não exigir mudança nos callsites.
   */
  actionItems?: ActionItem[];
  periodLabel: string;
  groupName?: string;
  delta?: MetricsDelta;
  statusBreakdown?: Array<{ status: string; count: number }>;
  technicianBreakdown?: Array<{ technician: string; count: number }>;
}

type RGB = [number, number, number];

const INK = {
  black: [10, 14, 22] as RGB,
  charcoal: [30, 38, 51] as RGB,
  graphite: [70, 80, 95] as RGB,
  ash: [120, 130, 145] as RGB,
  silver: [200, 207, 218] as RGB,
  cloud: [232, 236, 242] as RGB,
  cream: [248, 246, 240] as RGB,
  paper: [253, 252, 250] as RGB,
  white: [255, 255, 255] as RGB,
} as const;

const ACCENT = {
  brandRed: [236, 72, 86] as RGB,
  brandRedDark: [196, 38, 50] as RGB,
  good: [16, 138, 84] as RGB,
  goodTint: [225, 244, 234] as RGB,
  warn: [184, 113, 0] as RGB,
  warnTint: [251, 240, 220] as RGB,
  bad: [196, 38, 50] as RGB,
  badTint: [251, 226, 230] as RGB,
  neutralTint: [240, 242, 246] as RGB,
  flat: INK.ash,
  /** Avatar palette (deterministic by index) */
  avatar: [
    [196, 38, 50] as RGB,    // brand red
    [184, 113, 0] as RGB,    // warm amber
    [16, 138, 84] as RGB,    // green
    [49, 88, 168] as RGB,    // royal blue
    [128, 64, 168] as RGB,   // purple
    [212, 88, 14] as RGB,    // orange
    [70, 80, 95] as RGB,     // graphite
    [16, 100, 110] as RGB,   // teal
  ] as RGB[],
} as const;

function setColor(pdf: jsPDF, c: RGB) {
  pdf.setTextColor(c[0], c[1], c[2]);
}
function setFill(pdf: jsPDF, c: RGB) {
  pdf.setFillColor(c[0], c[1], c[2]);
}
function setDraw(pdf: jsPDF, c: RGB) {
  pdf.setDrawColor(c[0], c[1], c[2]);
}

const PAGE = { w: 210, h: 297, margin: 16 };
const FOOTER_Y = PAGE.h - 11;

/**
 * Substitui glifos que a Helvetica embutida no jsPDF nao tem por
 * equivalentes ASCII. CRITICO: U+2212 (math minus), U+00B1 (plusminus)
 * e emojis viram aspas duplas no PDF final. Use sempre ASCII (-, +/-).
 */
function sanitizeForPdf(text: string): string {
  return text
    .replace(/\u2212/g, '-')      // math minus -> hyphen-minus
    .replace(/\u2013/g, '-')      // en-dash -> hyphen
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↑/g, 'subiu')
    .replace(/↓/g, 'caiu')
    .replace(/▲/g, '+')
    .replace(/▼/g, '-')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Helpers de tipografia / desenho
// ---------------------------------------------------------------------------

function drawLabel(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; color?: RGB; align?: 'left' | 'center' | 'right'; spacing?: number; font?: 'helvetica' | 'times' } = {}
): void {
  const { size = 7, color = INK.ash, align = 'left', spacing = 0.8, font = 'helvetica' } = opts;
  setColor(pdf, color);
  pdf.setFont(font, 'bold');
  pdf.setFontSize(size);
  pdf.text(text.toUpperCase(), x, y, { align, charSpace: spacing });
}

/**
 * jsPDF.getTextWidth() NÃO considera o `charSpace` aplicado em pdf.text().
 * Quando renderizamos com tracking (ex.: charSpace: 1.2), a largura real
 * é maior que o reportado, causando OVERLAP de elementos vizinhos.
 * Esta função retorna a largura REAL incluindo o tracking aplicado.
 *
 * IMPORTANTE: chame DEPOIS de setar font/size para que getTextWidth use
 * a fonte correta.
 */
function measureText(pdf: jsPDF, text: string, charSpace: number = 0): number {
  const baseWidth = pdf.getTextWidth(text);
  const trackingExtra = Math.max(0, text.length - 1) * Math.max(0, charSpace);
  return baseWidth + trackingExtra;
}

function drawHairline(pdf: jsPDF, x1: number, y: number, x2: number, color: RGB = INK.silver): void {
  setDraw(pdf, color);
  pdf.setLineWidth(0.15);
  pdf.line(x1, y, x2, y);
}

/** Card "lifted": fundo cream + retângulo ofset cinza simulando sombra. */
function drawCard(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: RGB; radius?: number; borderColor?: RGB; lifted?: boolean } = {}
): void {
  const { fill = INK.cream, radius = 2.2, borderColor, lifted = false } = opts;
  if (lifted) {
    // sombra sutil — retângulo cinza claro deslocado
    setFill(pdf, [220, 224, 232]);
    pdf.roundedRect(x + 0.6, y + 0.8, w, h, radius, radius, 'F');
  }
  setFill(pdf, fill);
  pdf.roundedRect(x, y, w, h, radius, radius, 'F');
  if (borderColor) {
    setDraw(pdf, borderColor);
    pdf.setLineWidth(0.18);
    pdf.roundedRect(x, y, w, h, radius, radius, 'D');
  }
}

/** Stacked bar horizontal com legenda colorida. */
function drawStackedBar(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  segments: Array<{ value: number; color: RGB; label?: string }>,
  opts: { showLabelInside?: boolean; trackColor?: RGB; radius?: number } = {}
): void {
  const { showLabelInside = false, trackColor = INK.cloud, radius = h / 2 } = opts;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  // Track
  setFill(pdf, trackColor);
  pdf.roundedRect(x, y, w, h, radius, radius, 'F');

  if (total <= 0) return;

  // Render each segment (skip ones too thin to draw)
  let cursorX = x;
  segments.forEach((seg, idx) => {
    const segW = (seg.value / total) * w;
    if (segW <= 0.5) return;
    setFill(pdf, seg.color);

    // First segment: round left side. Last: round right. Middle: straight.
    const isFirst = idx === 0 || segments.slice(0, idx).every(s => (s.value / total) * w <= 0.5);
    const isLast = idx === segments.length - 1 || segments.slice(idx + 1).every(s => (s.value / total) * w <= 0.5);

    if (isFirst && isLast) {
      pdf.roundedRect(cursorX, y, segW, h, radius, radius, 'F');
    } else if (isFirst) {
      // Esquerda arredondada, direita reta — desenha rect inteiro depois quadrado pra cobrir borda
      pdf.roundedRect(cursorX, y, segW, h, radius, radius, 'F');
      pdf.rect(cursorX + segW - radius, y, radius, h, 'F');
    } else if (isLast) {
      pdf.roundedRect(cursorX, y, segW, h, radius, radius, 'F');
      pdf.rect(cursorX, y, radius, h, 'F');
    } else {
      pdf.rect(cursorX, y, segW, h, 'F');
    }

    if (showLabelInside && seg.label && segW > 14) {
      setColor(pdf, INK.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.text(seg.label, cursorX + segW / 2, y + h / 2 + 1.4, { align: 'center' });
    }

    cursorX += segW;
  });
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function drawAvatar(pdf: jsPDF, cx: number, cy: number, r: number, name: string, idx: number): void {
  const color = ACCENT.avatar[idx % ACCENT.avatar.length];
  setFill(pdf, color);
  pdf.circle(cx, cy, r, 'F');
  setColor(pdf, INK.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(r * 1.5);
  pdf.text(initialsOf(name), cx, cy + r * 0.5, { align: 'center' });
}

// ---------------------------------------------------------------------------
// CAPA — bloco hero massivo, tipografia editorial mista
// ---------------------------------------------------------------------------

function drawCover(pdf: jsPDF, input: ExecutiveSummaryInput): number {
  // Bloco hero: fundo navy ocupando ~40% do topo
  const heroH = 100;
  setFill(pdf, INK.black);
  pdf.rect(0, 0, PAGE.w, heroH, 'F');

  // Faixa vermelha decorativa fina no topo
  setFill(pdf, ACCENT.brandRed);
  pdf.rect(0, 0, PAGE.w, 3, 'F');

  // Faixa vermelha dupla decorativa no final do bloco
  setFill(pdf, ACCENT.brandRed);
  pdf.rect(0, heroH - 1.2, PAGE.w, 0.6, 'F');
  pdf.rect(0, heroH + 0.4, PAGE.w, 0.6, 'F');

  // Padrão decorativo discreto: quadrados vermelhos no canto superior direito
  // Reduzido pra 4 (era 6) — mais elegante, menos "ruidoso"
  for (let i = 0; i < 4; i++) {
    setFill(pdf, ACCENT.brandRed);
    pdf.rect(PAGE.w - PAGE.margin - i * 4, 9, 1.5, 1.5, 'F');
  }

  // Eyebrow superior
  drawLabel(pdf, 'Documento Interno - Confidencial', PAGE.margin, 14, {
    size: 7,
    color: ACCENT.brandRed,
    spacing: 1.4,
  });

  // Logo MINERVA tipográfico (Times Bold, large, tracking forte)
  setColor(pdf, INK.white);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(18);
  const logoTracking = 1.6;
  pdf.text('MINERVA FOODS', PAGE.margin, 28, { charSpace: logoTracking });
  // Largura REAL incluindo tracking (getTextWidth não conta charSpace)
  const logoW = measureText(pdf, 'MINERVA FOODS', logoTracking);

  // Tagline institucional sutil ao lado do logo — buffer 8mm
  setColor(pdf, [150, 160, 175]);
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  pdf.text('Tecnologia / Automação / RPA', PAGE.margin + logoW + 8, 28);

  // Hairline branca decorativa abaixo do logo
  setDraw(pdf, [70, 80, 95]);
  pdf.setLineWidth(0.3);
  pdf.line(PAGE.margin, 32, PAGE.margin + 36, 32);

  // Título principal — Times serif para impacto editorial
  setColor(pdf, INK.white);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(46);
  pdf.text('Resumo Executivo', PAGE.margin, 56);

  // Subtítulo em Times italic — coerência editorial com o título
  setColor(pdf, [200, 207, 218]);
  pdf.setFont('times', 'italic');
  pdf.setFontSize(13);
  pdf.text(
    `Central de Monitoramento de Chamados - ${input.groupName || 'RPA'}`,
    PAGE.margin,
    65
  );

  // Bloco metadata embaixo do título: período + data de geração
  // Tracking reduzido (1.0 vs 1.3) e label encurtado pra prevenir overflow.
  const metaY = 78;
  drawLabel(pdf, 'Período', PAGE.margin, metaY, {
    size: 7,
    color: [150, 160, 175],
    spacing: 1.0,
  });
  setColor(pdf, INK.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(input.periodLabel, PAGE.margin, metaY + 6);

  drawLabel(pdf, 'Emitido em', PAGE.w - PAGE.margin, metaY, {
    size: 7,
    color: [150, 160, 175],
    align: 'right',
    spacing: 1.0,
  });
  const stampDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const stampTime = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  setColor(pdf, INK.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(`${stampDate} - ${stampTime}`, PAGE.w - PAGE.margin, metaY + 6, { align: 'right' });

  return heroH + 6;
}

function drawPageHeader(pdf: jsPDF, sectionLabel: string): number {
  setFill(pdf, ACCENT.brandRed);
  pdf.rect(0, 0, PAGE.w, 1.4, 'F');
  setFill(pdf, INK.black);
  pdf.rect(0, 1.4, PAGE.w, 13, 'F');

  setColor(pdf, INK.white);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(10);
  const headerTracking = 1.2;
  pdf.text('MINERVA FOODS', PAGE.margin, 9, { charSpace: headerTracking });
  const brandW = measureText(pdf, 'MINERVA FOODS', headerTracking);

  setColor(pdf, [200, 207, 218]);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('Resumo Executivo - RPA', PAGE.margin + brandW + 6, 9);

  drawLabel(pdf, sectionLabel, PAGE.w - PAGE.margin, 9, {
    size: 7,
    color: ACCENT.brandRed,
    align: 'right',
    spacing: 1.3,
  });

  return 22;
}

function drawFooter(pdf: jsPDF, page: number, total: number): void {
  // Hairline DUPLA decorativa: fina + fininha vermelha
  setDraw(pdf, INK.silver);
  pdf.setLineWidth(0.2);
  pdf.line(PAGE.margin, FOOTER_Y - 5, PAGE.w - PAGE.margin, FOOTER_Y - 5);
  setDraw(pdf, ACCENT.brandRed);
  pdf.setLineWidth(0.4);
  pdf.line(PAGE.margin, FOOTER_Y - 4, PAGE.margin + 16, FOOTER_Y - 4);

  // Esquerda: brand institucional (Times serif "MINERVA FOODS" + tagline tech)
  setColor(pdf, INK.black);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(8);
  const footerTracking = 1;
  pdf.text('MINERVA FOODS', PAGE.margin, FOOTER_Y - 0.8, { charSpace: footerTracking });
  const footerBrandW = measureText(pdf, 'MINERVA FOODS', footerTracking);

  setColor(pdf, INK.ash);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.text('Tecnologia / RPA', PAGE.margin + footerBrandW + 5, FOOTER_Y - 0.8, { charSpace: 0.4 });

  // Centro: tagline confidencial
  setColor(pdf, INK.graphite);
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7);
  pdf.text(
    'Documento confidencial - distribuição interna restrita',
    PAGE.w / 2,
    FOOTER_Y - 0.8,
    { align: 'center' }
  );

  // Direita: paginação editorial — "PAG. 01/03" em Times bold
  setColor(pdf, INK.black);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  drawLabel(pdf, 'Página', PAGE.w - PAGE.margin - 14, FOOTER_Y - 0.8, {
    size: 6.2,
    color: INK.ash,
    spacing: 1,
    align: 'right',
  });
  setColor(pdf, INK.black);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(9);
  pdf.text(
    `${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
    PAGE.w - PAGE.margin,
    FOOTER_Y - 0.8,
    { align: 'right' }
  );
}

/**
 * Section header EDITORIAL com numeração à esquerda (Times serif XL),
 * título principal em Times bold, caption descritiva em Helvetica
 * regular abaixo, e hairline DUPLA institucional. Estilo annual report.
 */
function drawSectionHeader(
  pdf: jsPDF,
  y: number,
  num: number,
  label: string,
  caption?: string
): number {
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;

  // Número grande à esquerda — Times serif XL em cinza claro (peso visual decorativo)
  setColor(pdf, ACCENT.brandRed);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(28);
  const numText = String(num).padStart(2, '0');
  pdf.text(numText, x, y + 7);
  const numW = pdf.getTextWidth(numText);

  // Slash decorativo + label "SEÇÃO" pequena
  setColor(pdf, INK.silver);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(20);
  pdf.text('/', x + numW + 1.5, y + 7);

  drawLabel(pdf, 'Seção', x + numW + 6, y + 1, {
    size: 6.2,
    color: INK.ash,
    spacing: 1.4,
  });

  // Título principal — Times bold large
  setColor(pdf, INK.black);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(15);
  pdf.text(label, x + numW + 6, y + 7);

  // Caption descritiva à direita do título (em italic) ou abaixo se houver
  let blockH = 11;
  if (caption) {
    setColor(pdf, INK.graphite);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    const captionLines = pdf.splitTextToSize(caption, w - numW - 8);
    pdf.text(captionLines, x + numW + 6, y + 12);
    blockH = 11 + captionLines.length * 3.6;
  }

  // Hairline DUPLA institucional abaixo (uma fina cinza + uma fininha vermelha)
  setDraw(pdf, INK.charcoal);
  pdf.setLineWidth(0.4);
  pdf.line(x, y + blockH + 1.4, x + w, y + blockH + 1.4);
  setDraw(pdf, ACCENT.brandRed);
  pdf.setLineWidth(0.25);
  pdf.line(x, y + blockH + 2.4, x + 24, y + blockH + 2.4);

  return y + blockH + 6;
}

// ---------------------------------------------------------------------------
// HERO Numérico — número monumento + delta + stacked bar de tipos
// ---------------------------------------------------------------------------

function formatDeltaAscii(delta: number): { sign: string; text: string; isFlat: boolean; isUp: boolean } {
  const isFlat = delta === 0;
  const isUp = delta > 0;
  const sign = isFlat ? '+/-' : isUp ? '+' : '-';
  const text = `${sign}${Math.abs(delta).toFixed(Math.abs(delta) % 1 === 0 ? 0 : 1)}%`;
  return { sign, text, isFlat, isUp };
}

function drawHero(
  pdf: jsPDF,
  y: number,
  metrics: TicketMetrics,
  delta?: MetricsDelta
): number {
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;
  const blockH = 56;

  // Card massivo com fundo cream
  drawCard(pdf, x, y, w, blockH, { fill: INK.cream, radius: 3 });

  // Faixa vermelha lateral esquerda (decorativa)
  setFill(pdf, ACCENT.brandRed);
  pdf.rect(x, y, 2.4, blockH, 'F');

  const innerLeft = x + 9;
  const innerRight = x + w - 9;

  // Eyebrow uppercase
  drawLabel(pdf, 'Total no período', innerLeft, y + 9, {
    size: 7.5,
    color: INK.ash,
    spacing: 1.5,
  });

  // Número monumental — Helvetica Bold (sans tem mais "presença" que serif em números grandes)
  setColor(pdf, INK.black);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(56);
  const totalText = metrics.total.toLocaleString('pt-BR');
  pdf.text(totalText, innerLeft, y + 38);
  const numWidth = pdf.getTextWidth(totalText);

  // Caption sob o número
  setColor(pdf, INK.graphite);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text('chamados monitorados', innerLeft, y + 47);

  // Stacked bar de tipos (Inc vs Req) à direita do número
  const mix = metrics.totalByType;
  const mixTotal = mix.incident + mix.request + mix.unknown;
  if (mixTotal > 0) {
    const barX = innerLeft + numWidth + 14;
    const barW = innerRight - barX;
    const barY = y + 28;

    drawLabel(pdf, 'Mix do período', barX, y + 12, {
      size: 7,
      color: INK.ash,
      spacing: 1.3,
    });

    drawStackedBar(
      pdf,
      barX,
      barY,
      barW,
      6,
      [
        { value: mix.incident, color: ACCENT.bad, label: `${mix.incident}` },
        { value: mix.request, color: INK.charcoal, label: `${mix.request}` },
        { value: mix.unknown, color: INK.silver, label: mix.unknown > 0 ? `${mix.unknown}` : undefined },
      ],
      { showLabelInside: true, radius: 3 }
    );

    // Legendas embaixo da barra
    const legendY = barY + 10;
    let lx = barX;
    const legends: Array<{ color: RGB; label: string; value: number }> = [
      { color: ACCENT.bad, label: 'Incidentes', value: mix.incident },
      { color: INK.charcoal, label: 'Requisições', value: mix.request },
    ];
    if (mix.unknown > 0) legends.push({ color: INK.silver, label: 'Sem tipo', value: mix.unknown });

    legends.forEach(lg => {
      setFill(pdf, lg.color);
      pdf.circle(lx + 1.2, legendY - 1, 1, 'F');
      setColor(pdf, INK.charcoal);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.text(`${lg.label} ${lg.value}`, lx + 3.5, legendY, { charSpace: 0.2 });
      lx += pdf.getTextWidth(`${lg.label} ${lg.value}`) + 12;
    });

    // Delta principal embaixo da legenda (com seta gráfica)
    const deltaTotal = delta?.deltas.total;
    if (deltaTotal != null && Number.isFinite(deltaTotal)) {
      const dlta = formatDeltaAscii(deltaTotal);
      const tone: RGB = dlta.isFlat
        ? ACCENT.flat
        : dlta.isUp
          ? ACCENT.good
          : ACCENT.bad;

      const pillX = barX;
      const pillY = legendY + 4;
      const pillH = 9;

      // Pílula de delta colorida
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      const deltaW = pdf.getTextWidth(dlta.text) + 10;

      setFill(pdf, tone);
      pdf.roundedRect(pillX, pillY, deltaW, pillH, 1.6, 1.6, 'F');

      // Triangular arrow
      const arrowX = pillX + 5;
      const arrowY = pillY + pillH / 2;
      setFill(pdf, INK.white);
      if (dlta.isUp) {
        pdf.triangle(
          arrowX, arrowY - 1.6,
          arrowX - 1.4, arrowY + 1.2,
          arrowX + 1.4, arrowY + 1.2,
          'F'
        );
      } else if (!dlta.isFlat) {
        pdf.triangle(
          arrowX, arrowY + 1.6,
          arrowX - 1.4, arrowY - 1.2,
          arrowX + 1.4, arrowY - 1.2,
          'F'
        );
      } else {
        // Flat: pequena barra
        pdf.rect(arrowX - 1.4, arrowY - 0.4, 2.8, 0.8, 'F');
      }

      setColor(pdf, INK.white);
      pdf.text(dlta.text, pillX + deltaW - 4, pillY + 6, { align: 'right' });

      // Caption explicativa ao lado da pílula
      setColor(pdf, INK.graphite);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      const prevTotal = delta?.previous?.total;
      const captionText = typeof prevTotal === 'number'
        ? `vs período anterior (${prevTotal} chamados)`
        : 'vs período anterior';
      pdf.text(captionText, pillX + deltaW + 3, pillY + 6);
    }
  }

  return y + blockH + 6;
}

// ---------------------------------------------------------------------------
// Narrativa executiva — frase única em Times italic (síntese do período)
// ---------------------------------------------------------------------------

function buildNarrative(m: TicketMetrics, d?: MetricsDelta): string {
  const parts: string[] = [];
  parts.push(`No período foram monitorados ${m.total.toLocaleString('pt-BR')} chamados`);

  if (m.closureRate >= 90) {
    parts.push(`com taxa de resolução robusta de ${m.closureRate}%`);
  } else if (m.closureRate >= 70) {
    parts.push(`com taxa de resolução de ${m.closureRate}%`);
  } else {
    parts.push(`com taxa de resolução de ${m.closureRate}% — abaixo do ideal`);
  }

  if (m.open > 0) {
    parts.push(`${m.open} chamado${m.open > 1 ? 's' : ''} segue${m.open > 1 ? 'm' : ''} em aberto`);
  } else {
    parts.push('nenhum chamado pendente ao fim do período');
  }

  if (m.hoursBalanceType === 'gain' && Math.abs(m.hoursBalance) > 0.5) {
    parts.push(`e ganho de ${Math.abs(m.hoursBalance).toFixed(1)}h vs o planejado`);
  } else if (m.hoursBalanceType === 'loss' && Math.abs(m.hoursBalance) > 0.5) {
    parts.push(`e excedente de ${Math.abs(m.hoursBalance).toFixed(1)}h sobre o planejado`);
  }

  let sentence = parts.join(', ') + '.';

  // Adiciona delta se disponível
  const deltaTotal = d?.deltas.total;
  if (typeof deltaTotal === 'number' && Number.isFinite(deltaTotal) && Math.abs(deltaTotal) >= 1) {
    const dir = deltaTotal > 0 ? 'aumento' : 'redução';
    sentence += ` Volume registra ${dir} de ${Math.abs(deltaTotal).toFixed(1)}% frente ao período anterior.`;
  }

  return sanitizeForPdf(sentence);
}

function drawNarrativeQuote(pdf: jsPDF, y: number, m: TicketMetrics, d?: MetricsDelta): number {
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;

  // Eyebrow institucional
  drawLabel(pdf, 'Síntese do período', x, y + 3, {
    size: 6.5,
    color: ACCENT.brandRed,
    spacing: 1.5,
  });

  // Quote em Times italic — compacta (10pt, lineH 4.0)
  setColor(pdf, INK.charcoal);
  pdf.setFont('times', 'italic');
  pdf.setFontSize(10);
  const narrative = buildNarrative(m, d);
  const lines = pdf.splitTextToSize(narrative, w - 6);
  const lineH = 4;
  pdf.text(lines, x + 2, y + 7.5);

  const blockH = 4 + lines.length * lineH;

  // Hairline elegante abaixo
  drawHairline(pdf, x, y + blockH + 1, x + w);

  return y + blockH + 3.5;
}

// ---------------------------------------------------------------------------
// 3 KPI cards com fundo (Em aberto / Finalizados / Taxa de resolução)
// ---------------------------------------------------------------------------

interface HeroStat {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  deltaInverse?: boolean;
  /** Tom tonal pra dar leve indicação visual sem inundar de cor */
  toneTint?: RGB;
  toneAccent?: RGB;
}

function drawHeroStatRow(pdf: jsPDF, y: number, stats: HeroStat[]): number {
  const x = PAGE.margin;
  const totalW = PAGE.w - PAGE.margin * 2;
  const gap = 5;
  const colW = (totalW - gap * (stats.length - 1)) / stats.length;
  // Altura compacta — visual hierarchy: cards de apoio são menores
  // que o card principal de "Em Aberto" (28mm) e o hero (56mm).
  const cardH = 22;

  stats.forEach((s, idx) => {
    const cx = x + idx * (colW + gap);

    drawCard(pdf, cx, y, colW, cardH, {
      fill: s.toneTint || INK.cream,
      radius: 2.2,
    });

    // Acento lateral colorido
    if (s.toneAccent) {
      setFill(pdf, s.toneAccent);
      pdf.rect(cx, y, 1.6, cardH, 'F');
    }

    const innerLeft = cx + 6;

    drawLabel(pdf, s.label, innerLeft, y + 5.5, {
      size: 6.8,
      color: INK.ash,
      spacing: 1.3,
    });

    setColor(pdf, INK.black);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(s.value.length > 6 ? 18 : 22);
    pdf.text(s.value, innerLeft, y + 16);
    const valueW = pdf.getTextWidth(s.value);

    // Hint à direita do valor — economiza altura vertical
    if (s.hint) {
      setColor(pdf, INK.graphite);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.text(s.hint, innerLeft + valueW + 3, y + 16);
    }

    // Delta abaixo da linha do valor (pequeno)
    if (s.delta != null && Number.isFinite(s.delta)) {
      const dlta = formatDeltaAscii(s.delta);
      const isGoodDelta = dlta.isFlat
        ? null
        : s.deltaInverse
          ? !dlta.isUp
          : dlta.isUp;
      const tone: RGB = dlta.isFlat ? ACCENT.flat : isGoodDelta ? ACCENT.good : ACCENT.bad;

      setColor(pdf, tone);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      const hintW = s.hint
        ? pdf.getTextWidth(s.hint) + 4
        : 0;
      pdf.text(dlta.text, innerLeft + valueW + 3 + hintW, y + 16);
    }
  });

  return y + cardH + 4;
}

// ---------------------------------------------------------------------------
// Em Aberto — breakdown por estado (Novo / Em atendimento / Pendente cliente)
// O estado "Pendente" recebe destaque porque indica chamados que estão
// AGUARDANDO O CLIENTE — fora da nossa mão depois do ajuste.
// ---------------------------------------------------------------------------

interface OpenStateBreakdown {
  novo: number;
  atendimento: number;
  pendente: number;
  outros: number;
}

function parseOpenStates(
  breakdown: Array<{ status: string; count: number }> | undefined
): OpenStateBreakdown {
  const r: OpenStateBreakdown = { novo: 0, atendimento: 0, pendente: 0, outros: 0 };
  if (!breakdown || breakdown.length === 0) return r;
  for (const row of breakdown) {
    const s = row.status.toLowerCase();
    // Pula status fechados/finalizados
    if (s.includes('fechado') || s.includes('solucionado') || s.includes('encerrado')) continue;
    if (s.includes('pendente')) r.pendente += row.count;
    else if (s.includes('atendimento') || s.includes('processo') || s.includes('andamento')) r.atendimento += row.count;
    else if (s === 'novo' || s.startsWith('novo')) r.novo += row.count;
    else r.outros += row.count;
  }
  return r;
}

/**
 * Row de 4 cards INDEPENDENTES lado a lado (não aninhados):
 *   [ TOTAL ABERTOS ] [ NOVO ] [ EM ATENDIMENTO ] [ PENDENTE ★ ]
 *
 * Cards de saturação alta (não pastel) — cada um tem fundo cream
 * com acento lateral GROSSO colorido + número COLORIDO. O card
 * "Pendente" é diferente: fundo charcoal sólido com texto branco,
 * porque representa chamados FORA da nossa mão (aguardando cliente).
 *
 * Layout milimétrico:
 *   - cardW = (PAGE.w - margin*2 - gap*3) / 4 = 42.25mm
 *   - cardH = 26mm
 *   - eyebrow @ y+5, value @ y+16, hint @ y+22
 */
function drawOpenStateRow(
  pdf: jsPDF,
  y: number,
  m: TicketMetrics,
  statusBreakdown: Array<{ status: string; count: number }> | undefined,
  delta?: MetricsDelta
): number {
  const x = PAGE.margin;
  const totalW = PAGE.w - PAGE.margin * 2;
  const states = parseOpenStates(statusBreakdown);

  type StateCard = {
    label: string;
    value: string;
    hint: string;
    tone: RGB;          // cor do acento lateral + número
    solid?: boolean;    // se true, fundo da cor (texto branco)
    delta?: number | null;
    deltaInverse?: boolean;
  };

  const cards: StateCard[] = [
    {
      label: 'Total abertos',
      value: String(m.open),
      hint: 'no período',
      tone: ACCENT.warn,
      delta: delta?.deltas.open ?? null,
      deltaInverse: true,
    },
    {
      label: 'Novo',
      value: String(states.novo),
      hint: 'aguarda triagem',
      tone: ACCENT.brandRed,
    },
    {
      label: 'Em atendimento',
      value: String(states.atendimento),
      hint: 'sendo trabalhado',
      tone: ACCENT.warn,
    },
    {
      label: 'Pendente',
      value: String(states.pendente),
      hint: 'aguarda cliente',
      tone: INK.charcoal,
      solid: true, // destaque: card sólido charcoal com texto branco
    },
  ];

  const gap = 4;
  const cardW = (totalW - gap * (cards.length - 1)) / cards.length;
  const cardH = 26;

  cards.forEach((c, idx) => {
    const cx = x + idx * (cardW + gap);

    if (c.solid) {
      // Card SÓLIDO charcoal — texto branco. Destaque visual claro.
      setFill(pdf, c.tone);
      pdf.roundedRect(cx, y, cardW, cardH, 2.2, 2.2, 'F');

      // Eyebrow branco
      setColor(pdf, INK.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      pdf.text(c.label.toUpperCase(), cx + 5, y + 6.2, { charSpace: 1.1 });

      // Número grande branco
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(c.value.length > 2 ? 22 : 26);
      pdf.text(c.value, cx + 5, y + 18.5);

      // Hint branco (italic)
      setColor(pdf, [200, 207, 218]);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(6.8);
      pdf.text(c.hint, cx + 5, y + 23);

      // Pequeno bullet decorativo no topo direito (badge de "destaque")
      setFill(pdf, ACCENT.brandRed);
      pdf.circle(cx + cardW - 4, y + 4, 1.1, 'F');
    } else {
      // Card cream com acento lateral grosso colorido
      drawCard(pdf, cx, y, cardW, cardH, { fill: INK.cream, radius: 2.2 });

      // Acento lateral GROSSO (3mm) na cor da categoria — saturado
      setFill(pdf, c.tone);
      pdf.rect(cx, y, 3, cardH, 'F');

      const innerLeft = cx + 7;

      // Eyebrow uppercase NA COR DA CATEGORIA — destaque
      setColor(pdf, c.tone);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      pdf.text(c.label.toUpperCase(), innerLeft, y + 6.2, { charSpace: 1.1 });

      // Número grande NA COR DA CATEGORIA (saturado)
      setColor(pdf, c.tone);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(c.value.length > 2 ? 22 : 26);
      pdf.text(c.value, innerLeft, y + 18.5);
      const valueW = pdf.getTextWidth(c.value);

      // Delta inline (apenas no Total)
      if (c.delta != null && Number.isFinite(c.delta) && c.delta !== 0) {
        const dlta = formatDeltaAscii(c.delta);
        const isGood = c.deltaInverse ? !dlta.isUp : dlta.isUp;
        const deltaTone: RGB = isGood ? ACCENT.good : ACCENT.bad;
        setColor(pdf, deltaTone);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.text(dlta.text, innerLeft + valueW + 2.5, y + 18.5);
      }

      // Hint italic
      setColor(pdf, INK.graphite);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(6.8);
      pdf.text(c.hint, innerLeft, y + 23);
    }
  });

  return y + cardH + 5;
}

// ---------------------------------------------------------------------------
// Distribuição por status — barras 7mm com label INSIDE
// ---------------------------------------------------------------------------

const STATUS_TONE: Record<string, RGB> = {
  Fechado: INK.charcoal,
  Solucionado: INK.graphite,
  'Em Atendimento (atribuído)': ACCENT.warn,
  'Em Atendimento (planejado)': ACCENT.warn,
  Pendente: ACCENT.bad,
  Novo: ACCENT.brandRed,
};

function colorForStatus(status: string): RGB {
  if (STATUS_TONE[status]) return STATUS_TONE[status];
  const lower = status.toLowerCase();
  if (lower.includes('fechado')) return INK.charcoal;
  if (lower.includes('solucionado')) return INK.graphite;
  if (lower.includes('atendimento')) return ACCENT.warn;
  if (lower.includes('pendente')) return ACCENT.bad;
  if (lower.includes('novo')) return ACCENT.brandRed;
  return INK.ash;
}

function drawStatusDistribution(
  pdf: jsPDF,
  y: number,
  data: Array<{ status: string; count: number }>,
  total: number
): number {
  const top = data.slice(0, 6);
  if (top.length === 0) return y;

  const max = Math.max(...top.map(r => r.count));
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;

  const labelW = 54;
  const valueColW = 28;
  const barX = x + labelW;
  const barWidth = w - labelW - valueColW - 2;
  const valueX = x + w;

  let cursor = y;
  const rowH = 9; // compactado de 11→9 pra caber técnicos na mesma página

  for (const row of top) {
    const pct = total > 0 ? (row.count / total) * 100 : 0;
    const fillRatio = max > 0 ? row.count / max : 0;
    const fillW = Math.max(6, fillRatio * barWidth);
    const barColor = colorForStatus(row.status);

    // Label do status (alinhado à esquerda)
    setColor(pdf, INK.charcoal);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    const statusLabel = row.status.length > 28 ? row.status.slice(0, 27) + '...' : row.status;
    pdf.text(statusLabel, x, cursor + 4.5);

    // Track 6mm (era 7)
    setFill(pdf, INK.cloud);
    pdf.roundedRect(barX, cursor + 1, barWidth, 6, 1.6, 1.6, 'F');

    // Fill
    setFill(pdf, barColor);
    pdf.roundedRect(barX, cursor + 1, fillW, 6, 1.6, 1.6, 'F');

    // Label INSIDE the bar (count) — só se a barra for grande o suficiente
    if (fillW > 22) {
      setColor(pdf, INK.white);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.text(`${row.count.toLocaleString('pt-BR')}`, barX + 2.5, cursor + 5);
    }

    // Valor + % (sempre alinhado à direita)
    setColor(pdf, INK.black);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    const countText = row.count.toLocaleString('pt-BR');
    pdf.text(countText, valueX, cursor + 5, { align: 'right' });
    const countW = pdf.getTextWidth(countText);

    setColor(pdf, INK.ash);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`${pct.toFixed(1)}%`, valueX - countW - 2, cursor + 5, { align: 'right' });

    cursor += rowH;
  }

  return cursor + 1;
}

// ---------------------------------------------------------------------------
// Por Tipo — cards visuais grandes com fundo cream + breakdown
// ---------------------------------------------------------------------------

function drawTypeColumns(pdf: jsPDF, y: number, metrics: TicketMetrics): number {
  const colGap = 6;
  const colW = (PAGE.w - PAGE.margin * 2 - colGap) / 2;
  const cardH = 54; // compactado de 64→54
  const total =
    metrics.totalByType.incident +
    metrics.totalByType.request +
    metrics.totalByType.unknown;

  const blocks = [
    {
      label: 'Incidentes',
      caption: 'Algo quebrou na operação',
      tone: ACCENT.bad,
      tint: ACCENT.badTint,
      total: metrics.totalByType.incident,
      open: metrics.openByType.incident,
      stale: metrics.staleByType.incident,
      finalized: metrics.finalizedByType.incident,
    },
    {
      label: 'Requisições',
      caption: 'Solicitação - melhoria - projeto',
      tone: INK.charcoal,
      tint: INK.cream,
      total: metrics.totalByType.request,
      open: metrics.openByType.request,
      stale: metrics.staleByType.request,
      finalized: metrics.finalizedByType.request,
    },
  ];

  blocks.forEach((b, idx) => {
    const cx = PAGE.margin + idx * (colW + colGap);

    drawCard(pdf, cx, y, colW, cardH, { fill: b.tint, radius: 3, lifted: true });

    // Faixa colorida superior fina
    setFill(pdf, b.tone);
    pdf.rect(cx, y, colW, 2, 'F');

    const innerLeft = cx + 7;

    // Layout milimétrico em cardH=54mm:
    //   y+8   eyebrow (8pt)
    //   y+13  caption (8pt)
    //   y+30  número MASSIVO 34pt (baseline)
    //   y+34  hairline
    //   y+39  dot mini-stat
    //   y+39.5 label mini-stat (6.3pt)
    //   y+47  valor mini-stat (13pt)
    drawLabel(pdf, b.label, innerLeft, y + 8, {
      size: 8,
      color: b.tone,
      spacing: 1.6,
    });

    setColor(pdf, INK.graphite);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text(b.caption, innerLeft, y + 13);

    // Número MASSIVO (reduzido 42→34 pra caber no card menor)
    setColor(pdf, INK.black);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(34);
    pdf.text(b.total.toLocaleString('pt-BR'), innerLeft, y + 30);

    // % do total à direita do número
    const pct = total > 0 ? (b.total / total) * 100 : 0;
    const numW = pdf.getTextWidth(b.total.toLocaleString('pt-BR'));
    setColor(pdf, INK.ash);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`${pct.toFixed(1)}% do total`, innerLeft + numW + 4, y + 30);

    // Hairline divisória
    drawHairline(pdf, innerLeft, y + 34, cx + colW - 7);

    // 3 mini-stats em linha
    const closure = b.total > 0 ? Math.round((b.finalized / b.total) * 100) : 0;
    const stats = [
      { label: 'Aberto', value: String(b.open), tone: ACCENT.warn },
      { label: 'Antigos', value: String(b.stale), tone: b.stale > 0 ? ACCENT.bad : ACCENT.good },
      { label: 'Resolução', value: `${closure}%`, tone: ACCENT.good },
    ];
    const innerW = colW - 14;
    const statW = innerW / stats.length;
    stats.forEach((s, i) => {
      const sx = innerLeft + i * statW;

      // Mini-dot colorido pequeno acima do label
      setFill(pdf, s.tone);
      pdf.circle(sx + 1.2, y + 39, 0.85, 'F');

      // Label uppercase com spacing reduzido pra cabe sem cortar
      setColor(pdf, INK.ash);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.2);
      pdf.text(s.label.toUpperCase(), sx + 3.5, y + 39.6, { charSpace: 0.4 });

      setColor(pdf, INK.black);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(s.value, sx, y + 48);
    });
  });

  return y + cardH + 4;
}

// ---------------------------------------------------------------------------
// Top Técnicos — ranking com avatares de iniciais
// ---------------------------------------------------------------------------

function drawTechRanking(
  pdf: jsPDF,
  y: number,
  data: Array<{ technician: string; count: number }>,
  totalAll: number
): number {
  const top = data.slice(0, 5);
  if (top.length === 0) return y;

  const max = top[0].count;
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;

  const rankColW = 9;
  const avatarColW = 14;
  const labelColW = 70;
  const valueColW = 24;
  const barX = x + rankColW + avatarColW + labelColW;
  const barWidth = w - rankColW - avatarColW - labelColW - valueColW - 4;
  const valueX = x + w;

  let cursor = y;
  const rowH = 12; // compactado de 14→12

  top.forEach((row, idx) => {
    const pct = totalAll > 0 ? (row.count / totalAll) * 100 : 0;
    const fillRatio = max > 0 ? row.count / max : 0;

    // Rank — Times serif
    setColor(pdf, INK.silver);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(18);
    pdf.text(String(idx + 1).padStart(2, '0'), x, cursor + 7.5);

    // Avatar
    drawAvatar(pdf, x + rankColW + 5, cursor + 5.5, 4, row.technician, idx);

    // Nome (font 9.5 mais compacto)
    setColor(pdf, INK.black);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    const nameLabel = row.technician.length > 30 ? row.technician.slice(0, 28) + '...' : row.technician;
    pdf.text(nameLabel, x + rankColW + avatarColW + 1, cursor + 4.5);

    // Count subtitle
    setColor(pdf, INK.ash);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(`${row.count.toLocaleString('pt-BR')} chamados`, x + rankColW + avatarColW + 1, cursor + 8.5);

    // Track + Fill
    setFill(pdf, INK.cloud);
    pdf.roundedRect(barX, cursor + 4, barWidth, 4.5, 1.4, 1.4, 'F');

    // Cor decrescente: top 3 charcoal, depois mais clara
    const barColor: RGB = idx === 0 ? INK.black : idx === 1 ? INK.charcoal : idx === 2 ? INK.graphite : INK.ash;
    setFill(pdf, barColor);
    pdf.roundedRect(barX, cursor + 4, Math.max(2, fillRatio * barWidth), 4.5, 1.4, 1.4, 'F');

    // % à direita
    setColor(pdf, INK.black);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(`${pct.toFixed(1)}%`, valueX, cursor + 6.8, { align: 'right' });

    cursor += rowH;

    if (idx < top.length - 1) {
      drawHairline(pdf, x, cursor - 1, x + w);
    }
  });

  return cursor + 2;
}

// ---------------------------------------------------------------------------
// Stats de horas — 3 cards com fundo
// ---------------------------------------------------------------------------

function drawHoursStats(pdf: jsPDF, y: number, m: TicketMetrics): number {
  const balanceText =
    m.hoursBalanceType === 'gain'
      ? `+${Math.abs(m.hoursBalance).toFixed(1)}h`
      : m.hoursBalanceType === 'loss'
        ? `-${Math.abs(m.hoursBalance).toFixed(1)}h`
        : `${m.hoursBalance.toFixed(1)}h`;
  const balanceTone: RGB =
    m.hoursBalanceType === 'gain'
      ? ACCENT.good
      : m.hoursBalanceType === 'loss'
        ? ACCENT.bad
        : ACCENT.flat;
  const balanceTint: RGB =
    m.hoursBalanceType === 'gain'
      ? ACCENT.goodTint
      : m.hoursBalanceType === 'loss'
        ? ACCENT.badTint
        : ACCENT.neutralTint;

  const cards: Array<{
    label: string;
    value: string;
    hint: string;
    tone: RGB;
    tint: RGB;
  }> = [
    {
      label: 'Média por chamado',
      value: `${m.avgWorkHours.toFixed(1)}h`,
      hint: 'horas médias apontadas',
      tone: INK.charcoal,
      tint: INK.cream,
    },
    {
      label:
        m.hoursBalanceType === 'gain'
          ? 'Ganho vs planejado'
          : m.hoursBalanceType === 'loss'
            ? 'Perda vs planejado'
            : 'Saldo de horas',
      value: balanceText,
      hint:
        m.hoursBalanceType === 'gain'
          ? 'horas economizadas'
          : m.hoursBalanceType === 'loss'
            ? 'horas além do plano'
            : 'realizado igual ao plano',
      tone: balanceTone,
      tint: balanceTint,
    },
    {
      label: 'Total realizado',
      value: `${m.totalRealizedHours.toFixed(1)}h`,
      hint: 'apontadas no período',
      tone: INK.charcoal,
      tint: INK.cream,
    },
  ];

  const x = PAGE.margin;
  const totalW = PAGE.w - PAGE.margin * 2;
  const gap = 5;
  const colW = (totalW - gap * 2) / 3;
  // Mesmo padrão de altura compacta dos demais cards de apoio
  const cardH = 22;

  cards.forEach((c, idx) => {
    const cx = x + idx * (colW + gap);

    drawCard(pdf, cx, y, colW, cardH, { fill: c.tint, radius: 2.2 });

    // Acento lateral
    setFill(pdf, c.tone);
    pdf.rect(cx, y, 1.6, cardH, 'F');

    const innerLeft = cx + 6;

    drawLabel(pdf, c.label, innerLeft, y + 5.5, {
      size: 6.5,
      color: INK.ash,
      spacing: 1.2,
    });

    setColor(pdf, c.tone);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(c.value.length > 6 ? 16 : 20);
    pdf.text(c.value, innerLeft, y + 16);
    const valueW = pdf.getTextWidth(c.value);

    // Hint à direita do valor
    setColor(pdf, INK.graphite);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(c.hint, innerLeft + valueW + 3, y + 16);
  });

  return y + cardH + 4;
}

// ---------------------------------------------------------------------------
// Insights — cards TONAIS com fundo (verde / âmbar / vermelho / neutro)
// ---------------------------------------------------------------------------

const TONE_COLOR: Record<Insight['tone'], RGB> = {
  good: ACCENT.good,
  warn: ACCENT.warn,
  bad: ACCENT.bad,
  neutral: INK.graphite,
};

const TONE_TINT: Record<Insight['tone'], RGB> = {
  good: ACCENT.goodTint,
  warn: ACCENT.warnTint,
  bad: ACCENT.badTint,
  neutral: ACCENT.neutralTint,
};

const TONE_LABEL: Record<Insight['tone'], string> = {
  good: 'Positivo',
  warn: 'Atenção',
  bad: 'Crítico',
  neutral: 'Neutro',
};

function drawInsightItem(pdf: jsPDF, y: number, idx: number, ins: Insight): number {
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;
  const numColW = 14;
  const innerWidth = w - numColW - 12;

  const tint = TONE_TINT[ins.tone];
  const tone = TONE_COLOR[ins.tone];

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const safeText = sanitizeForPdf(ins.text);
  const textLines = pdf.splitTextToSize(safeText, innerWidth);
  // Compacto: altura mínima 16, +4mm/linha (era 20/4.4)
  const blockH = Math.max(16, 11 + textLines.length * 4);

  // Card com fundo tonal
  drawCard(pdf, x, y, w, blockH, { fill: tint, radius: 2 });

  // Acento lateral colorido
  setFill(pdf, tone);
  pdf.rect(x, y, 2, blockH, 'F');

  // Número Times serif (impacto editorial mas menor)
  setColor(pdf, tone);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(18);
  pdf.text(String(idx).padStart(2, '0'), x + 5, y + 12);

  // Eyebrow tonal
  drawLabel(pdf, TONE_LABEL[ins.tone], x + numColW + 4, y + 5.5, {
    size: 6.5,
    color: tone,
    spacing: 1.2,
  });

  // Texto principal
  setColor(pdf, INK.charcoal);
  pdf.text(textLines, x + numColW + 4, y + 11);

  return y + blockH + 2.5;
}

// ---------------------------------------------------------------------------
// Geração principal
// ---------------------------------------------------------------------------

export async function downloadExecutiveSummaryPdf(input: ExecutiveSummaryInput): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const m = input.metrics;
  const d = input.delta?.deltas;

  // ============ PÁGINA 1 — SNAPSHOT EXECUTIVO COMPLETO ============
  // Capa + hero + síntese + breakdown de abertos + KPIs principais + horas.
  // Tudo que um CTO precisa pra entender o cenário em 30 segundos.
  let y = drawCover(pdf, input);

  // Hero (número-monumento + mix bar)
  y = drawHero(pdf, y, m, input.delta);

  // Narrativa executiva: síntese do período em 1 frase Times italic
  y = drawNarrativeQuote(pdf, y, m, input.delta);

  // ROW de 4 cards: Total Abertos / Novo / Em Atendimento / Pendente.
  // Pendente é card SÓLIDO charcoal (texto branco) — destaque visual
  // para sinalizar que aguarda cliente (fora da nossa mão).
  y = drawOpenStateRow(pdf, y, m, input.statusBreakdown, input.delta);

  // 2 stats secundários (Finalizados + Taxa de resolução) — row de 2 cards
  const inc = m.totalByType.incident;
  const req = m.totalByType.request;
  const incClosed = inc > 0 ? Math.round((m.finalizedByType.incident / inc) * 100) : 0;
  const reqClosed = req > 0 ? Math.round((m.finalizedByType.request / req) * 100) : 0;

  y = drawHeroStatRow(pdf, y, [
    {
      label: 'Finalizados',
      value: m.finalized.toLocaleString('pt-BR'),
      hint: `${incClosed}% inc - ${reqClosed}% req`,
      toneTint: ACCENT.goodTint,
      toneAccent: ACCENT.good,
    },
    {
      label: 'Taxa de resolução',
      value: `${m.closureRate}%`,
      hint: `${m.finalized} de ${m.total}`,
      delta: d?.closureRate,
      toneTint: INK.cream,
      toneAccent: INK.charcoal,
    },
  ]);

  // Apontamento de horas — agora junto com a síntese (foi pedido explicitamente)
  y = drawHoursStats(pdf, y, m);

  // Section counter — incrementado a cada drawSectionHeader pra dar ordenação editorial
  let sectionNum = 0;

  // ============ PÁGINA 2 — STATUS + TIPO + TÉCNICOS (tudo de operacional) ============
  // Orçamento de altura (PAGE.h = 297, FOOTER ~285):
  //   Header de página         22mm   →  22
  //   Section "Status"        16mm   →  38
  //   StatusDistribution (5 rows × 11mm)  55mm  →  93
  //   Section "Tipo"          16mm   →  109
  //   TypeColumns             64mm   →  173
  //   Section "Técnicos"      16mm   →  189
  //   TechRanking (5 × 14mm)  70mm   →  259
  //   Footer (~286)                  → sobra ~26mm de respiro
  pdf.addPage();
  y = drawPageHeader(pdf, 'Operação');

  if (input.statusBreakdown && input.statusBreakdown.length > 0) {
    y = drawSectionHeader(
      pdf,
      y,
      ++sectionNum,
      'Distribuição por status',
      'Estados operacionais dos chamados ao final do período no GLPI.'
    );
    y = drawStatusDistribution(pdf, y, input.statusBreakdown, m.total);
    y += 3;
  }

  y = drawSectionHeader(
    pdf,
    y,
    ++sectionNum,
    'Por tipo de chamado',
    'Volume, abertos, antigos e taxa de fechamento por categoria.'
  );
  y = drawTypeColumns(pdf, y, m);
  y += 3;

  if (input.technicianBreakdown && input.technicianBreakdown.length > 0) {
    y = drawSectionHeader(
      pdf,
      y,
      ++sectionNum,
      'Top técnicos por volume',
      'Ranking dos analistas RPA com maior carga de chamados.'
    );
    y = drawTechRanking(pdf, y, input.technicianBreakdown, m.total);
  }

  // ============ PÁGINA 3 — ANÁLISE EXECUTIVA (apenas insights) ============
  // Orçamento sem a seção de ações (que foi removida):
  //   Header                  22mm   →  22
  //   Section "Leitura"       24mm   →  46
  //   Até 5 insights × ~18mm + gaps  →  ~146
  //   Footer (~286)                  → sobra ~140mm de respiro
  // Página fica intencionalmente "arejada" — silêncio é qualidade
  // editorial quando o conteúdo apresentado é o que importa.
  pdf.addPage();
  let y3 = drawPageHeader(pdf, 'Análise');

  y3 = drawSectionHeader(
    pdf,
    y3,
    ++sectionNum,
    'Leitura executiva',
    'Insights gerados a partir dos dados do período — destaques e alertas.'
  );
  if (input.insights.length === 0) {
    setColor(pdf, INK.ash);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9.5);
    pdf.text('Sem insights relevantes no período.', PAGE.margin, y3 + 2);
    y3 += 8;
  } else {
    for (let i = 0; i < input.insights.length; i++) {
      // Safety: se algum insight muito longo estourar, quebra pagina
      if (y3 > PAGE.h - 40) {
        pdf.addPage();
        y3 = drawPageHeader(pdf, 'Análise (cont.)');
        y3 = drawSectionHeader(
          pdf,
          y3,
          sectionNum,
          'Leitura executiva (cont.)',
          'Continuação dos insights do período.'
        );
      }
      y3 = drawInsightItem(pdf, y3, i + 1, input.insights[i]);
    }
  }

  // Seção "Ações prioritárias" foi REMOVIDA do resumo executivo a pedido
  // do usuário. A análise (insights) é a entrega final do PDF — ações
  // continuam disponíveis no Dashboard e no Excel export.

  // ============ Footers em todas as páginas ============
  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    drawFooter(pdf, p, pageCount);
  }

  pdf.save(`resumo-executivo-rpa-${fileSafeStamp()}.pdf`);
}
