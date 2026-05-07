/**
 * Exportações visuais do dashboard:
 * - Snapshot PNG (download ou copiar para clipboard)
 * - Snapshot PDF (paginação automática multi-página em A4 retrato)
 * - Resumo Executivo PDF (relatório executivo brilhante, gerado dos
 *   dados — sem html2canvas — com identidade visual Minerva)
 *
 * Tudo aqui é lazy-loaded (chamado dinamicamente) para não inflar o
 * bundle inicial.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  ActionItem,
  Insight,
  MetricsDelta,
  TicketMetrics,
  TypeBreakdown,
} from './analytics';
import { saveAs } from 'file-saver';

// ---------------------------------------------------------------------------
// Captura DOM → canvas (compartilhada por PNG/PDF snapshot)
// ---------------------------------------------------------------------------

interface CaptureOptions {
  /** Cor de fundo aplicada onde o DOM é transparente. */
  backgroundColor?: string;
  /** Pixel ratio. 3 = bem nítido em telas e impressão. */
  scale?: number;
}

async function captureCanvas(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    backgroundColor: options.backgroundColor ?? '#0F172A',
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

/**
 * Snapshot do dashboard em PDF A4 retrato com paginação automática.
 * Em vez de comprimir o dashboard inteiro em uma página, fatia
 * verticalmente em quantas páginas forem necessárias para preservar
 * a legibilidade.
 */
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

  // Escalas: canvas → mm
  const mmPerPx = usableWidth / canvas.width;
  const totalCanvasMm = canvas.height * mmPerPx;
  const pageCanvasMm = usableHeight; // altura útil de cada página em mm
  const pages = Math.max(1, Math.ceil(totalCanvasMm / pageCanvasMm));

  // Fatia o canvas em N pedaços e adiciona cada um em uma página.
  for (let i = 0; i < pages; i++) {
    if (i > 0) pdf.addPage();

    // Header da página
    drawSnapshotHeader(pdf, pageWidth, headerHeight, margin);

    // Recorte do canvas que vai nesta página
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
  setFill(pdf, BRAND.red);
  pdf.rect(0, 0, pageWidth, 2, 'F');
  setFill(pdf, BRAND.navy);
  pdf.rect(0, 2, pageWidth, h - 2, 'F');

  setColor(pdf, [255, 255, 255]);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('MINERVA FOODS', margin, 9);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Central de Monitoramento RPA — Snapshot do Dashboard', pageWidth - margin, 9, {
    align: 'right',
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
  setDraw(pdf, BRAND.divider);
  pdf.setLineWidth(0.2);
  pdf.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);
  setColor(pdf, BRAND.muted);
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7.5);
  pdf.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')} · Minerva Foods`,
    margin,
    pageHeight - 5
  );
  pdf.text(`Página ${page} / ${total}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
}

// ---------------------------------------------------------------------------
// Resumo Executivo (PDF gerado dos dados, sem capturar a tela)
// ---------------------------------------------------------------------------

export interface ExecutiveSummaryInput {
  metrics: TicketMetrics;
  insights: Insight[];
  actionItems: ActionItem[];
  periodLabel: string;
  groupName?: string;
  /** (opcional) Comparativo com período anterior para mostrar deltas. */
  delta?: MetricsDelta;
  /** (opcional) Distribuição por status — usada na seção de mini-chart. */
  statusBreakdown?: Array<{ status: string; count: number }>;
  /** (opcional) Top técnicos — usado na seção de ranking. */
  technicianBreakdown?: Array<{ technician: string; count: number }>;
}

type RGB = [number, number, number];

const BRAND = {
  navy: [29, 46, 64] as RGB,
  navyDark: [21, 34, 49] as RGB,
  navyLight: [42, 65, 88] as RGB,
  red: [248, 68, 84] as RGB,
  redDark: [214, 54, 68] as RGB,
  cream: [248, 249, 251] as RGB,
  white: [255, 255, 255] as RGB,
  // Acentos
  green: [34, 168, 105] as RGB,
  amber: [220, 145, 14] as RGB,
  blue: [56, 121, 196] as RGB,
  purple: [129, 90, 200] as RGB,
  slate: [71, 85, 105] as RGB,
  // Texto
  text: [22, 32, 46] as RGB,
  muted: [108, 119, 138] as RGB,
  divider: [225, 229, 235] as RGB,
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

const TONE_COLOR: Record<Insight['tone'], RGB> = {
  good: BRAND.green,
  warn: BRAND.amber,
  bad: BRAND.red,
  neutral: BRAND.slate,
};
const TONE_BG: Record<Insight['tone'], RGB> = {
  good: [232, 246, 238],
  warn: [253, 244, 226],
  bad: [253, 232, 234],
  neutral: [240, 242, 246],
};
const SEVERITY_COLOR: Record<ActionItem['severity'], RGB> = {
  high: BRAND.red,
  medium: BRAND.amber,
  low: BRAND.slate,
};
const SEVERITY_LABEL: Record<ActionItem['severity'], string> = {
  high: 'ALTA',
  medium: 'MÉDIA',
  low: 'BAIXA',
};

const PAGE = { w: 210, h: 297, margin: 14 };
const FOOTER_Y = PAGE.h - 10;

// ---------------------------------------------------------------------------
// Helpers de desenho
// ---------------------------------------------------------------------------

function drawCoverHeader(
  pdf: jsPDF,
  input: ExecutiveSummaryInput
): void {
  // Faixa vermelha topo
  setFill(pdf, BRAND.red);
  pdf.rect(0, 0, PAGE.w, 3, 'F');

  // Bloco navy principal
  setFill(pdf, BRAND.navy);
  pdf.rect(0, 3, PAGE.w, 31, 'F');

  // Sombra/realce inferior
  setFill(pdf, BRAND.navyLight);
  pdf.rect(0, 33, PAGE.w, 1, 'F');

  // Eyebrow
  setColor(pdf, [200, 210, 225]);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.text('MINERVA FOODS · DOCUMENTO INTERNO', PAGE.margin, 10);

  // Título principal
  setColor(pdf, BRAND.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.text('Resumo Executivo', PAGE.margin, 22);

  // Subtítulo
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  setColor(pdf, [200, 210, 225]);
  pdf.text(
    `Central de Monitoramento de Chamados — ${input.groupName || 'RPA'}`,
    PAGE.margin,
    28
  );

  // Bloco direito: período + data
  setColor(pdf, BRAND.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('PERÍODO', PAGE.w - PAGE.margin, 13, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  setColor(pdf, [200, 210, 225]);
  pdf.text(input.periodLabel, PAGE.w - PAGE.margin, 18, { align: 'right' });

  setColor(pdf, BRAND.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('GERADO EM', PAGE.w - PAGE.margin, 25, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  setColor(pdf, [200, 210, 225]);
  pdf.text(
    new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    PAGE.w - PAGE.margin,
    30,
    { align: 'right' }
  );
}

function drawSimplePageHeader(pdf: jsPDF, title: string): void {
  setFill(pdf, BRAND.red);
  pdf.rect(0, 0, PAGE.w, 2, 'F');
  setFill(pdf, BRAND.navy);
  pdf.rect(0, 2, PAGE.w, 12, 'F');

  setColor(pdf, BRAND.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('MINERVA FOODS · RPA', PAGE.margin, 9);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(title, PAGE.w - PAGE.margin, 9, { align: 'right' });
}

function drawFooter(pdf: jsPDF, page: number, total: number): void {
  setDraw(pdf, BRAND.divider);
  pdf.setLineWidth(0.2);
  pdf.line(PAGE.margin, FOOTER_Y - 3, PAGE.w - PAGE.margin, FOOTER_Y - 3);

  setColor(pdf, BRAND.muted);
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7.5);
  pdf.text(
    'Central de Monitoramento RPA · Minerva Foods',
    PAGE.margin,
    FOOTER_Y
  );
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Página ${page} / ${total}`, PAGE.w - PAGE.margin, FOOTER_Y, {
    align: 'right',
  });
}

function drawSectionTitle(pdf: jsPDF, y: number, label: string, accent: RGB = BRAND.red): number {
  setFill(pdf, accent);
  pdf.rect(PAGE.margin, y - 3.5, 3, 4, 'F');

  setColor(pdf, BRAND.navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(label.toUpperCase(), PAGE.margin + 5, y);

  setDraw(pdf, BRAND.divider);
  pdf.setLineWidth(0.2);
  pdf.line(PAGE.margin, y + 2, PAGE.w - PAGE.margin, y + 2);

  return y + 7;
}

interface KpiCard {
  title: string;
  value: string;
  /** Subtítulo de 1 linha (modo simples). Ignorado se `subtitleLines` for fornecido. */
  subtitle?: string;
  /** Subtítulo multilinha didático. Cada item é uma linha (até 3-4). */
  subtitleLines?: Array<{ value: string; label: string; hint?: string }>;
  /** Mini-pílulas Inc/Req embutidas no rodapé do card. */
  typeBreakdown?: TypeBreakdown;
  color: RGB;
  delta?: number | null;
  /** Quando true, subir é ruim (ex.: chamados parados, em aberto). */
  deltaInverse?: boolean;
}

/**
 * Constrói o texto do delta usando caracteres ASCII-safe.
 * NÃO usar `▲` ou `▼` aqui — Helvetica embutido no jsPDF não tem esses
 * glifos e renderiza lixo ("%²", "%¼"). Cor + sinal `+`/`−`/`±` é o suficiente.
 */
function formatDeltaText(delta: number): { sign: string; text: string } {
  if (delta === 0) return { sign: '+/-', text: '0%' };
  // Ascii-safe: + e - (U+002D), suportados em qualquer fonte embutida no jsPDF.
  const sign = delta > 0 ? '+' : '-';
  return {
    sign,
    text: `${sign}${Math.abs(delta).toFixed(Math.abs(delta) % 1 === 0 ? 0 : 1)}%`,
  };
}

function drawDeltaBadge(
  pdf: jsPDF,
  x: number,
  y: number,
  delta: number,
  inverse = false
): { width: number; height: number } {
  const isUp = delta > 0;
  const isFlat = delta === 0;
  const isGood = isFlat ? null : inverse ? !isUp : isUp;
  const badgeColor: RGB = isFlat ? BRAND.slate : isGood ? BRAND.green : BRAND.red;
  const { text } = formatDeltaText(delta);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  const textW = pdf.getTextWidth(text);
  const padX = 2.4;
  const badgeW = textW + padX * 2;
  const badgeH = 4.6;

  setFill(pdf, badgeColor);
  pdf.roundedRect(x, y, badgeW, badgeH, 1.2, 1.2, 'F');
  setColor(pdf, BRAND.white);
  pdf.text(text, x + badgeW / 2, y + 3.3, { align: 'center' });

  return { width: badgeW, height: badgeH };
}

function drawTypePillsInline(
  pdf: jsPDF,
  x: number,
  y: number,
  bd: TypeBreakdown
): void {
  const items: Array<{ label: string; color: RGB }> = [
    { label: `Inc ${bd.incident}`, color: BRAND.red },
    { label: `Req ${bd.request}`, color: BRAND.blue },
  ];
  if (bd.unknown > 0) items.push({ label: `? ${bd.unknown}`, color: BRAND.slate });

  let cursor = x;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.8);
  for (const item of items) {
    const w = pdf.getTextWidth(item.label) + 4.5;
    const h = 3.6;
    setFill(pdf, item.color);
    pdf.roundedRect(cursor, y, w, h, h / 2, h / 2, 'F');
    setColor(pdf, BRAND.white);
    pdf.text(item.label, cursor + w / 2, y + 2.55, { align: 'center' });
    cursor += w + 1.5;
  }
}

function drawKpiCard(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  c: KpiCard
): void {
  setFill(pdf, BRAND.cream);
  pdf.roundedRect(x, y, w, h, 2, 2, 'F');

  setFill(pdf, c.color);
  pdf.roundedRect(x, y, 2.5, h, 1.2, 1.2, 'F');

  const innerLeft = x + 7;
  const innerRight = x + w - 4;

  setColor(pdf, BRAND.muted);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.8);
  pdf.text(c.title.toUpperCase(), innerLeft, y + 5.6);

  // Valor: tamanho dinâmico em função do tamanho do texto
  setColor(pdf, BRAND.navy);
  pdf.setFont('helvetica', 'bold');
  const valueFont = c.value.length > 7 ? 16 : c.value.length > 5 ? 18 : 20;
  pdf.setFontSize(valueFont);
  pdf.text(c.value, innerLeft, y + 16);

  // Delta badge (canto superior direito)
  if (c.delta !== undefined && c.delta !== null && Number.isFinite(c.delta)) {
    const { text } = formatDeltaText(c.delta);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    const textW = pdf.getTextWidth(text);
    const badgeW = textW + 4.8;
    drawDeltaBadge(pdf, innerRight - badgeW, y + 3, c.delta, c.deltaInverse);
  }

  // Subtítulo
  setColor(pdf, BRAND.muted);
  pdf.setFont('helvetica', 'normal');
  if (c.subtitleLines && c.subtitleLines.length > 0) {
    let subY = y + 22;
    pdf.setFontSize(7.5);
    for (const line of c.subtitleLines) {
      // valor em negrito navy + label em muted + hint em itálico mais clarinho
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      setColor(pdf, BRAND.navy);
      const valueText = String(line.value);
      pdf.text(valueText, innerLeft, subY);
      const valueW = pdf.getTextWidth(valueText);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      setColor(pdf, BRAND.text);
      pdf.text(' ' + line.label, innerLeft + valueW, subY);

      if (line.hint) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(6.5);
        setColor(pdf, BRAND.muted);
        const hintLines = pdf.splitTextToSize(line.hint, w - 10);
        pdf.text(hintLines[0], innerLeft, subY + 3);
        subY += 7;
      } else {
        subY += 4.5;
      }
    }
  } else if (c.subtitle) {
    pdf.setFontSize(7.5);
    const subLines = pdf.splitTextToSize(c.subtitle, w - 10);
    pdf.text(subLines, innerLeft, y + 22);
  }

  // Mini-pílulas Inc/Req no rodapé
  if (c.typeBreakdown) {
    drawTypePillsInline(pdf, innerLeft, y + h - 4.5, c.typeBreakdown);
  }
}

function drawHeroBlock(
  pdf: jsPDF,
  y: number,
  metrics: TicketMetrics,
  delta?: MetricsDelta
): number {
  const blockX = PAGE.margin;
  const blockY = y;
  const blockW = PAGE.w - PAGE.margin * 2;
  const blockH = 24;

  setFill(pdf, BRAND.navyDark);
  pdf.roundedRect(blockX, blockY, blockW, blockH, 3, 3, 'F');

  // Acentos decorativos: três quadradinhos vermelhos no canto sup. esq.
  for (let i = 0; i < 3; i++) {
    setFill(pdf, BRAND.red);
    pdf.rect(blockX + 5 + i * 3, blockY + 5, 1.5, 1.5, 'F');
  }

  // Total — número grande
  setColor(pdf, BRAND.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(34);
  pdf.text(metrics.total.toLocaleString('pt-BR'), blockX + 8, blockY + 19);

  // Label
  setColor(pdf, [200, 210, 225]);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('chamados no período', blockX + 8, blockY + 23);

  // Pills à direita
  const pills = [
    { label: 'em aberto', value: metrics.open.toLocaleString('pt-BR'), color: BRAND.amber },
    { label: 'finalizados', value: metrics.finalized.toLocaleString('pt-BR'), color: BRAND.green },
    {
      label: 'parados',
      value: metrics.staleCount.toLocaleString('pt-BR'),
      color: metrics.staleCount > 0 ? BRAND.red : BRAND.green,
    },
  ];
  let pillX = blockX + blockW - 6;
  for (let i = pills.length - 1; i >= 0; i--) {
    const p = pills[i];
    const valueText = p.value;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    const valW = pdf.getTextWidth(valueText);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    const labW = pdf.getTextWidth(p.label);
    const pillW = Math.max(valW, labW) + 8;

    pillX -= pillW;

    // Pill bg
    setFill(pdf, BRAND.navyLight);
    pdf.roundedRect(pillX, blockY + 6, pillW, 12, 2, 2, 'F');

    // Dot colorido
    setFill(pdf, p.color);
    pdf.circle(pillX + 3, blockY + 9.5, 1.1, 'F');

    // Valor
    setColor(pdf, BRAND.white);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(valueText, pillX + pillW - 4, blockY + 12, { align: 'right' });

    // Label
    setColor(pdf, [200, 210, 225]);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(p.label, pillX + pillW - 4, blockY + 16, { align: 'right' });

    pillX -= 3;
  }

  // Delta de total no canto sup. esq. (se houver)
  if (delta?.deltas.total != null && Number.isFinite(delta.deltas.total)) {
    const d = delta.deltas.total;
    const { text } = formatDeltaText(d);
    const txt = `${text} vs período anterior`;
    setColor(pdf, d === 0 ? [200, 210, 225] : d > 0 ? [142, 247, 184] : [253, 156, 165]);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(txt, blockX + 24, blockY + 8);
  }

  return blockY + blockH + 6;
}

/**
 * Faixa fina cinza-clara explicando o que é a variação % nos KPIs.
 * Aparece logo abaixo do hero, na primeira página.
 */
function drawDidacticLegend(pdf: jsPDF, y: number): number {
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;
  const h = 13;

  setFill(pdf, [240, 244, 250]);
  pdf.roundedRect(x, y, w, h, 2, 2, 'F');

  setFill(pdf, BRAND.navy);
  pdf.roundedRect(x, y, 1.5, h, 0.7, 0.7, 'F');

  setColor(pdf, BRAND.navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.text('COMO LER AS %', x + 4, y + 4);

  setColor(pdf, BRAND.text);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(
    'Cada variacao compara o periodo atual com o periodo anterior de mesma duracao.',
    x + 4,
    y + 8
  );

  // mini-legenda colorida na linha de baixo
  const legY = y + 11.5;
  // Verde +
  setFill(pdf, BRAND.green);
  pdf.roundedRect(x + 4, legY - 2, 5.5, 3, 1, 1, 'F');
  setColor(pdf, BRAND.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.text('+X%', x + 6.75, legY + 0.3, { align: 'center' });
  setColor(pdf, BRAND.text);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text('subiu (verde = direcao desejada)', x + 11, legY);

  setFill(pdf, BRAND.red);
  pdf.roundedRect(x + 73, legY - 2, 6.2, 3, 1, 1, 'F');
  setColor(pdf, BRAND.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.text('-X%', x + 76.1, legY + 0.3, { align: 'center' });
  setColor(pdf, BRAND.text);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text('caiu (vermelho = direcao indesejada)', x + 81, legY);

  return y + h + 5;
}

function drawHorizontalBar(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  pct: number,
  color: RGB,
  label: string,
  rightLabel: string
): void {
  // Track
  setFill(pdf, [240, 242, 246]);
  pdf.roundedRect(x, y, w, h, h / 2, h / 2, 'F');

  // Fill
  const fillW = Math.max(h, (w * Math.min(100, Math.max(0, pct))) / 100);
  setFill(pdf, color);
  pdf.roundedRect(x, y, fillW, h, h / 2, h / 2, 'F');

  // Label esquerda (acima da barra)
  setColor(pdf, BRAND.text);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text(label, x, y - 1.5);

  // Label direita
  setColor(pdf, BRAND.muted);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.text(rightLabel, x + w, y - 1.5, { align: 'right' });
}

const STATUS_COLORS: Record<string, RGB> = {
  Fechado: BRAND.green,
  Solucionado: BRAND.blue,
  'Em Atendimento (atribuído)': BRAND.amber,
  'Em Atendimento (planejado)': BRAND.purple,
  Pendente: BRAND.red,
  Novo: BRAND.slate,
};

function colorForStatus(status: string): RGB {
  if (STATUS_COLORS[status]) return STATUS_COLORS[status];
  const lower = status.toLowerCase();
  if (lower.includes('fechado')) return BRAND.green;
  if (lower.includes('solucionado')) return BRAND.blue;
  if (lower.includes('atendimento')) return BRAND.amber;
  if (lower.includes('pendente')) return BRAND.red;
  if (lower.includes('novo')) return BRAND.slate;
  return BRAND.slate;
}

function drawStatusBreakdown(
  pdf: jsPDF,
  y: number,
  data: Array<{ status: string; count: number }>,
  total: number
): number {
  const top = data.slice(0, 6);
  const max = top[0]?.count ?? 1;
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;

  let cursor = y;
  const rowGap = 8.5;
  for (const row of top) {
    const pct = (row.count / Math.max(1, max)) * 100;
    const pctOfTotal = total > 0 ? (row.count / total) * 100 : 0;
    drawHorizontalBar(
      pdf,
      x,
      cursor + 1.5,
      w,
      3,
      pct,
      colorForStatus(row.status),
      row.status,
      `${row.count.toLocaleString('pt-BR')}  ·  ${pctOfTotal.toFixed(1)}%`
    );
    cursor += rowGap;
  }
  return cursor + 1;
}

function drawTypeBreakdownSection(
  pdf: jsPDF,
  y: number,
  metrics: TicketMetrics
): number {
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;
  const colGap = 5;
  const colW = (w - colGap) / 2;
  const h = 36;

  const total =
    metrics.totalByType.incident +
    metrics.totalByType.request +
    metrics.totalByType.unknown;

  const blocks = [
    {
      label: 'Incidentes',
      hint: 'Algo quebrou na operação',
      color: BRAND.red,
      total: metrics.totalByType.incident,
      open: metrics.openByType.incident,
      stale: metrics.staleByType.incident,
      finalized: metrics.finalizedByType.incident,
    },
    {
      label: 'Requisições',
      hint: 'Solicitação / melhoria / projeto',
      color: BRAND.blue,
      total: metrics.totalByType.request,
      open: metrics.openByType.request,
      stale: metrics.staleByType.request,
      finalized: metrics.finalizedByType.request,
    },
  ];

  blocks.forEach((b, idx) => {
    const cx = x + idx * (colW + colGap);
    setFill(pdf, BRAND.cream);
    pdf.roundedRect(cx, y, colW, h, 2, 2, 'F');
    setFill(pdf, b.color);
    pdf.roundedRect(cx, y, 2.5, h, 1.2, 1.2, 'F');

    setColor(pdf, BRAND.muted);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.8);
    pdf.text(b.label.toUpperCase(), cx + 6, y + 5);

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7);
    setColor(pdf, BRAND.muted);
    pdf.text(b.hint, cx + 6, y + 9);

    setColor(pdf, BRAND.navy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text(b.total.toLocaleString('pt-BR'), cx + 6, y + 19);

    const pctOfTotal = total > 0 ? (b.total / total) * 100 : 0;
    setColor(pdf, BRAND.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text(`${pctOfTotal.toFixed(1)}% do total`, cx + 6, y + 23);

    // Métricas linha de baixo
    const closure = b.total > 0 ? Math.round((b.finalized / b.total) * 100) : 0;
    const stats = [
      { label: 'em aberto', value: String(b.open), color: BRAND.amber },
      { label: 'parados', value: String(b.stale), color: b.stale > 0 ? BRAND.red : BRAND.green },
      { label: 'taxa resol.', value: `${closure}%`, color: BRAND.green },
    ];

    const statW = (colW - 12) / stats.length;
    stats.forEach((s, i) => {
      const sx = cx + 6 + i * statW;
      setFill(pdf, [255, 255, 255]);
      pdf.roundedRect(sx, y + 26, statW - 1, 8, 1.5, 1.5, 'F');

      setFill(pdf, s.color);
      pdf.circle(sx + 2.5, y + 30, 1, 'F');

      setColor(pdf, BRAND.navy);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.text(s.value, sx + 5, y + 30.5);

      setColor(pdf, BRAND.muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.text(s.label, sx + 5, y + 33.5);
    });
  });

  return y + h + 4;
}

function drawTechnicianBreakdown(
  pdf: jsPDF,
  y: number,
  data: Array<{ technician: string; count: number }>
): number {
  const top = data.slice(0, 5);
  if (top.length === 0) return y;

  const max = top[0].count;
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;

  let cursor = y;
  const rowGap = 8.5;
  const palette: RGB[] = [
    BRAND.red,
    BRAND.amber,
    BRAND.blue,
    BRAND.green,
    BRAND.purple,
  ];
  top.forEach((row, idx) => {
    const pct = (row.count / Math.max(1, max)) * 100;
    drawHorizontalBar(
      pdf,
      x,
      cursor + 1.5,
      w,
      3,
      pct,
      palette[idx % palette.length],
      `${idx + 1}. ${row.technician}`,
      row.count.toLocaleString('pt-BR')
    );
    cursor += rowGap;
  });
  return cursor + 1;
}

function drawInsightCard(pdf: jsPDF, y: number, ins: Insight): number {
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;
  const innerPad = 4;
  const accentW = 2.5;

  // Calcula altura baseada em texto
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  const textLines = pdf.splitTextToSize(ins.text, w - innerPad * 2 - accentW - 2);
  const h = Math.max(11, 4 + textLines.length * 4.2 + 3);

  // Fundo
  setFill(pdf, TONE_BG[ins.tone]);
  pdf.roundedRect(x, y, w, h, 2, 2, 'F');

  // Acento
  setFill(pdf, TONE_COLOR[ins.tone]);
  pdf.roundedRect(x, y, accentW, h, 1.2, 1.2, 'F');

  // Texto
  setColor(pdf, BRAND.text);
  pdf.text(textLines, x + accentW + innerPad, y + 5.5);

  return y + h + 2.5;
}

function drawActionCard(pdf: jsPDF, y: number, a: ActionItem): number {
  const x = PAGE.margin;
  const w = PAGE.w - PAGE.margin * 2;
  const sevColor = SEVERITY_COLOR[a.severity];

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const descLines = pdf.splitTextToSize(a.description, w - 30);
  const h = Math.max(15, 6 + 5 + descLines.length * 4 + 2);

  // Fundo branco com borda
  setFill(pdf, BRAND.white);
  setDraw(pdf, BRAND.divider);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, w, h, 2, 2, 'FD');

  // Coluna de severidade (à esquerda)
  setFill(pdf, sevColor);
  pdf.roundedRect(x, y, 22, h, 2, 2, 'F');
  // "tira" lado direito do retângulo de severidade pra deixar só esquerda arredondada
  pdf.rect(x + 18, y, 4, h, 'F');

  // Severity label (vertical-ish: contagem grande + label)
  setColor(pdf, BRAND.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(a.count.toLocaleString('pt-BR'), x + 11, y + h / 2 + 0.5, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.text(SEVERITY_LABEL[a.severity], x + 11, y + h - 3, { align: 'center' });

  // Title
  setColor(pdf, BRAND.text);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10.5);
  pdf.text(a.title, x + 26, y + 7);

  // Description
  setColor(pdf, BRAND.muted);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(descLines, x + 26, y + 12);

  return y + h + 3;
}

// ---------------------------------------------------------------------------
// Geração principal
// ---------------------------------------------------------------------------

export async function downloadExecutiveSummaryPdf(input: ExecutiveSummaryInput): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ============== PÁGINA 1 ==============
  drawCoverHeader(pdf, input);

  // Hero
  let y = 42;
  y = drawHeroBlock(pdf, y, input.metrics, input.delta);

  // Legenda didática explicando as %
  y = drawDidacticLegend(pdf, y);

  // KPIs grid (3 colunas × 2 linhas) — altura maior pra acomodar 3 linhas de subtítulo
  const kpiW = (PAGE.w - PAGE.margin * 2 - 4 * 2) / 3;
  const kpiH = 38;
  const cards = buildKpiCards(input);

  for (let i = 0; i < cards.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = PAGE.margin + col * (kpiW + 4);
    const cy = y + row * (kpiH + 4);
    drawKpiCard(pdf, cx, cy, kpiW, kpiH, cards[i]);
  }
  y += kpiH * 2 + 4 + 7;

  // Quebra para a próxima página se vai ficar apertado
  if (y > PAGE.h - 75) {
    pdf.addPage();
    drawSimplePageHeader(pdf, 'Resumo Executivo · Distribuicoes');
    y = 22;
  }

  // Distribuição por Status (se vier)
  if (input.statusBreakdown && input.statusBreakdown.length > 0) {
    y = drawSectionTitle(pdf, y, 'Distribuicao por Status', BRAND.red);
    y = drawStatusBreakdown(pdf, y, input.statusBreakdown, input.metrics.total);
    y += 4;
  }

  // Por Tipo de Chamado
  if (y > PAGE.h - 60) {
    pdf.addPage();
    drawSimplePageHeader(pdf, 'Resumo Executivo · Distribuicoes');
    y = 22;
  }
  y = drawSectionTitle(pdf, y, 'Por Tipo de Chamado', BRAND.red);
  y = drawTypeBreakdownSection(pdf, y, input.metrics);

  // Top técnicos (se vier)
  if (input.technicianBreakdown && input.technicianBreakdown.length > 0) {
    if (y > PAGE.h - 65) {
      pdf.addPage();
      drawSimplePageHeader(pdf, 'Resumo Executivo · Distribuicoes');
      y = 22;
    }
    y = drawSectionTitle(pdf, y, 'Top 5 Tecnicos', BRAND.red);
    y = drawTechnicianBreakdown(pdf, y, input.technicianBreakdown);
  }

  // ============== PÁGINA 2: Insights + Ações ==============
  pdf.addPage();
  drawSimplePageHeader(pdf, 'Resumo Executivo · Análise');

  let y2 = 22;

  y2 = drawSectionTitle(pdf, y2, 'Leitura rápida', BRAND.red);
  if (input.insights.length === 0) {
    setColor(pdf, BRAND.muted);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9.5);
    pdf.text('Sem insights relevantes no período.', PAGE.margin, y2 + 1);
    y2 += 6;
  } else {
    for (const ins of input.insights) {
      if (y2 > PAGE.h - 50) {
        pdf.addPage();
        drawSimplePageHeader(pdf, 'Resumo Executivo · Análise (cont.)');
        y2 = 22;
        y2 = drawSectionTitle(pdf, y2, 'Leitura rápida (cont.)', BRAND.red);
      }
      y2 = drawInsightCard(pdf, y2, ins);
    }
  }
  y2 += 4;

  // Próximas ações
  if (y2 > PAGE.h - 60) {
    pdf.addPage();
    drawSimplePageHeader(pdf, 'Resumo Executivo · Análise');
    y2 = 22;
  }
  y2 = drawSectionTitle(pdf, y2, 'Próximas ações', BRAND.red);

  if (input.actionItems.length === 0) {
    setColor(pdf, BRAND.green);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('Sem ações pendentes — bom trabalho.', PAGE.margin, y2 + 2);
  } else {
    for (const a of input.actionItems) {
      if (y2 > PAGE.h - 35) {
        pdf.addPage();
        drawSimplePageHeader(pdf, 'Resumo Executivo · Próximas ações (cont.)');
        y2 = 22;
        y2 = drawSectionTitle(pdf, y2, 'Próximas ações (cont.)', BRAND.red);
      }
      y2 = drawActionCard(pdf, y2, a);
    }
  }

  // ============== Footers em todas as páginas ==============
  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    drawFooter(pdf, p, pageCount);
  }

  pdf.save(`resumo-executivo-rpa-${fileSafeStamp()}.pdf`);
}

function buildKpiCards(input: ExecutiveSummaryInput): KpiCard[] {
  const m = input.metrics;
  const d = input.delta?.deltas;

  return [
    {
      title: 'Total de Chamados',
      value: m.total.toLocaleString('pt-BR'),
      subtitle: `${m.inProgress} em atendimento`,
      typeBreakdown: m.totalByType,
      color: BRAND.navy,
      delta: d?.total ?? null,
    },
    {
      title: 'Taxa de Resolução',
      value: `${m.closureRate}%`,
      subtitle: `${m.finalized} finalizados de ${m.total}`,
      color: BRAND.green,
      delta: d?.closureRate ?? null,
    },
    {
      title: 'Em Aberto',
      value: m.open.toLocaleString('pt-BR'),
      subtitleLines: [
        {
          value: String(m.inProgress),
          label: 'em atendimento',
          hint: 'na nossa mão',
        },
        {
          value: String(m.pending),
          label: 'pendentes',
          hint: 'aguardando externos (cliente / fornecedor)',
        },
        {
          value: String(m.newTickets),
          label: 'novos',
          hint: 'ainda nao atribuidos',
        },
      ],
      typeBreakdown: m.openByType,
      color: BRAND.amber,
      delta: d?.open ?? null,
      deltaInverse: true,
    },
    {
      title: 'Chamados Parados',
      value: m.staleCount.toLocaleString('pt-BR'),
      subtitle:
        m.staleCount === 0
          ? `Nenhum > ${m.staleThresholdDays}d`
          : `Media ${m.avgDaysOpen.toFixed(1)}d (limite ${m.staleThresholdDays}d)`,
      typeBreakdown: m.staleCount > 0 ? m.staleByType : undefined,
      color: m.staleCount > 0 ? BRAND.red : BRAND.green,
      delta: d?.staleCount ?? null,
      deltaInverse: true,
    },
    {
      title: 'Media de Horas',
      value: `${m.avgWorkHours.toFixed(1)}h`,
      subtitle: `${m.totalRealizedHours.toFixed(1)}h realizadas`,
      color: BRAND.blue,
      delta: d?.avgWorkHours ?? null,
    },
    {
      title:
        m.hoursBalanceType === 'gain'
          ? 'Ganho de Horas'
          : m.hoursBalanceType === 'loss'
            ? 'Perda de Horas'
            : 'Saldo de Horas',
      value: `${Math.abs(m.hoursBalance).toFixed(1)}h`,
      subtitle:
        m.hoursBalanceType === 'gain'
          ? 'Realizado abaixo do planejado'
          : m.hoursBalanceType === 'loss'
            ? 'Realizado acima do planejado'
            : 'Realizado igual ao planejado',
      color:
        m.hoursBalanceType === 'loss'
          ? BRAND.red
          : m.hoursBalanceType === 'gain'
            ? BRAND.green
            : BRAND.slate,
    },
  ];
}
