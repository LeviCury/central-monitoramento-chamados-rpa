/**
 * Exportações visuais do dashboard:
 * - Snapshot PNG (download ou copiar para clipboard)
 * - Snapshot PDF (página única em paisagem)
 * - Resumo Executivo PDF (1 página com KPIs + insights + action items, gerado de dados — sem html2canvas)
 *
 * Tudo aqui é lazy-loaded (chamado dinamicamente) para não inflar o bundle inicial.
 */
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ActionItem, Insight, TicketMetrics } from './analytics';
import { saveAs } from 'file-saver';

const A4_LANDSCAPE = { w: 297, h: 210 };

interface CaptureOptions {
  /** Cor de fundo para áreas transparentes (gradiente do app etc). Default branco. */
  backgroundColor?: string;
  /** Pixel ratio (2 = retina). Default 2. */
  scale?: number;
}

async function captureCanvas(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<HTMLCanvasElement> {
  return html2canvas(element, {
    backgroundColor: options.backgroundColor ?? '#ffffff',
    scale: options.scale ?? 2,
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
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const ratio = canvas.width / canvas.height;
  const pageRatio = A4_LANDSCAPE.w / A4_LANDSCAPE.h;
  let renderWidth = A4_LANDSCAPE.w;
  let renderHeight = A4_LANDSCAPE.h;
  if (ratio > pageRatio) {
    renderHeight = A4_LANDSCAPE.w / ratio;
  } else {
    renderWidth = A4_LANDSCAPE.h * ratio;
  }
  const offsetX = (A4_LANDSCAPE.w - renderWidth) / 2;
  const offsetY = (A4_LANDSCAPE.h - renderHeight) / 2;

  pdf.setFontSize(10);
  pdf.setTextColor(120);
  pdf.text(`Central de Monitoramento RPA · gerado em ${new Date().toLocaleString('pt-BR')}`, 10, 10);
  pdf.addImage(imgData, 'PNG', offsetX, offsetY, renderWidth, renderHeight);
  pdf.save(`dashboard-rpa-${fileSafeStamp()}.pdf`);
}

// ---------------------------------------------------------------------------
// Resumo Executivo (PDF gerado direto dos dados, sem capturar a tela)
// ---------------------------------------------------------------------------

export interface ExecutiveSummaryInput {
  metrics: TicketMetrics;
  insights: Insight[];
  actionItems: ActionItem[];
  periodLabel: string;
  groupName?: string;
}

const PALETTE = {
  navy: [13, 39, 73] as [number, number, number],
  red: [200, 16, 46] as [number, number, number],
  green: [16, 122, 67] as [number, number, number],
  amber: [180, 102, 0] as [number, number, number],
  slate: [71, 85, 105] as [number, number, number],
  text: [33, 33, 33] as [number, number, number],
  muted: [110, 110, 110] as [number, number, number],
  divider: [220, 220, 220] as [number, number, number],
};

function setColor(pdf: jsPDF, color: [number, number, number]) {
  pdf.setTextColor(color[0], color[1], color[2]);
}

function setFill(pdf: jsPDF, color: [number, number, number]) {
  pdf.setFillColor(color[0], color[1], color[2]);
}

function setDraw(pdf: jsPDF, color: [number, number, number]) {
  pdf.setDrawColor(color[0], color[1], color[2]);
}

function drawKpi(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  value: string,
  subtitle: string,
  accent: [number, number, number]
) {
  setFill(pdf, [248, 249, 251]);
  pdf.roundedRect(x, y, w, h, 3, 3, 'F');
  setFill(pdf, accent);
  pdf.roundedRect(x, y, 3, h, 1.5, 1.5, 'F');

  setColor(pdf, PALETTE.muted);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text(title.toUpperCase(), x + 6, y + 6);

  setColor(pdf, PALETTE.navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text(value, x + 6, y + 16);

  setColor(pdf, PALETTE.muted);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(subtitle, x + 6, y + h - 4);
}

const TONE_COLOR: Record<Insight['tone'], [number, number, number]> = {
  good: PALETTE.green,
  warn: PALETTE.amber,
  bad: PALETTE.red,
  neutral: PALETTE.slate,
};

const SEVERITY_COLOR: Record<ActionItem['severity'], [number, number, number]> = {
  high: PALETTE.red,
  medium: PALETTE.amber,
  low: PALETTE.slate,
};

const SEVERITY_LABEL: Record<ActionItem['severity'], string> = {
  high: 'ALTA',
  medium: 'MÉDIA',
  low: 'BAIXA',
};

export async function downloadExecutiveSummaryPdf(input: ExecutiveSummaryInput): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  let cursorY = margin;

  // Header
  setFill(pdf, PALETTE.navy);
  pdf.rect(0, 0, pageWidth, 22, 'F');
  setColor(pdf, [255, 255, 255]);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('Central de Monitoramento RPA — Resumo Executivo', margin, 11);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(input.periodLabel, margin, 17);
  pdf.text(
    `Gerado em ${new Date().toLocaleString('pt-BR')}${input.groupName ? ` · Grupo ${input.groupName}` : ''}`,
    pageWidth - margin,
    17,
    { align: 'right' }
  );
  cursorY = 30;

  // KPI grid (3 col × 2 lin)
  const m = input.metrics;
  const kpiCardW = (pageWidth - margin * 2 - 4 * 2) / 3;
  const kpiCardH = 24;
  const cards: Array<{ title: string; value: string; subtitle: string; color: [number, number, number] }> = [
    {
      title: 'Total de Chamados',
      value: m.total.toLocaleString('pt-BR'),
      subtitle: `${m.inProgress} em atendimento`,
      color: PALETTE.navy,
    },
    {
      title: 'Taxa de Resolução',
      value: `${m.closureRate}%`,
      subtitle: `${m.finalized} finalizados`,
      color: PALETTE.green,
    },
    {
      title: 'Em Aberto',
      value: m.open.toLocaleString('pt-BR'),
      subtitle: `${m.pending} pendentes · ${m.newTickets} novos`,
      color: PALETTE.amber,
    },
    {
      title: 'Chamados Parados',
      value: m.staleCount.toLocaleString('pt-BR'),
      subtitle:
        m.staleCount === 0
          ? `Nenhum > ${m.staleThresholdDays}d`
          : `Média ${m.avgDaysOpen.toFixed(1)}d (limite ${m.staleThresholdDays}d)`,
      color: m.staleCount > 0 ? PALETTE.red : PALETTE.green,
    },
    {
      title: 'Média de Horas / Chamado',
      value: `${m.avgWorkHours.toFixed(1)}h`,
      subtitle: `${m.totalRealizedHours.toFixed(1)}h realizadas`,
      color: PALETTE.slate,
    },
    {
      title: m.hoursBalanceType === 'gain' ? 'Ganho de Horas' : m.hoursBalanceType === 'loss' ? 'Perda de Horas' : 'Saldo de Horas',
      value: `${Math.abs(m.hoursBalance).toFixed(1)}h`,
      subtitle:
        m.hoursBalanceType === 'gain'
          ? 'Realizado abaixo do planejado'
          : m.hoursBalanceType === 'loss'
            ? 'Realizado acima do planejado'
            : 'Realizado igual ao planejado',
      color: m.hoursBalanceType === 'loss' ? PALETTE.red : PALETTE.green,
    },
  ];

  for (let i = 0; i < cards.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + col * (kpiCardW + 4);
    const y = cursorY + row * (kpiCardH + 4);
    const c = cards[i];
    drawKpi(pdf, x, y, kpiCardW, kpiCardH, c.title, c.value, c.subtitle, c.color);
  }
  cursorY += kpiCardH * 2 + 4 + 8;

  // Insights
  setColor(pdf, PALETTE.navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Leitura rápida', margin, cursorY);
  cursorY += 5;
  setDraw(pdf, PALETTE.divider);
  pdf.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 4;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  if (input.insights.length === 0) {
    setColor(pdf, PALETTE.muted);
    pdf.text('Nenhum insight no período.', margin, cursorY);
    cursorY += 6;
  } else {
    for (const ins of input.insights) {
      const tone = TONE_COLOR[ins.tone];
      setFill(pdf, tone);
      pdf.circle(margin + 1.5, cursorY - 1.5, 1.2, 'F');
      setColor(pdf, PALETTE.text);
      const lines = pdf.splitTextToSize(ins.text, pageWidth - margin * 2 - 8);
      pdf.text(lines, margin + 5, cursorY);
      cursorY += lines.length * 4.5 + 2;
    }
  }

  cursorY += 4;

  // Action items
  setColor(pdf, PALETTE.navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Próximas ações', margin, cursorY);
  cursorY += 5;
  setDraw(pdf, PALETTE.divider);
  pdf.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 4;

  if (input.actionItems.length === 0) {
    setColor(pdf, PALETTE.muted);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.text('Nada urgente. Bom trabalho.', margin, cursorY);
    cursorY += 6;
  } else {
    for (const a of input.actionItems) {
      const sevColor = SEVERITY_COLOR[a.severity];
      const sevText = SEVERITY_LABEL[a.severity];
      setFill(pdf, sevColor);
      pdf.roundedRect(margin, cursorY - 4, 16, 6, 1.5, 1.5, 'F');
      setColor(pdf, [255, 255, 255]);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.text(sevText, margin + 8, cursorY, { align: 'center' });

      setColor(pdf, PALETTE.text);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text(a.title, margin + 20, cursorY);
      cursorY += 4.5;

      setColor(pdf, PALETTE.muted);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const descLines = pdf.splitTextToSize(a.description, pageWidth - margin * 2 - 20);
      pdf.text(descLines, margin + 20, cursorY);
      cursorY += descLines.length * 4 + 4;

      if (cursorY > pageHeight - 25) {
        pdf.addPage();
        cursorY = margin + 4;
      }
    }
  }

  // Rodapé
  setColor(pdf, PALETTE.muted);
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  pdf.text(
    'Gerado pela Central de Monitoramento RPA · Minerva Foods',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  pdf.save(`resumo-executivo-rpa-${fileSafeStamp()}.pdf`);
}
