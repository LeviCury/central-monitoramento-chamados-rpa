import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Ticket } from '../types';
import { formatHoursMinutes } from '../utils/timeFormat';

// Cores da Minerva Foods
const COLORS = {
  navy: 'FF1D2E40',
  navyLight: 'FF2a4158',
  red: 'FFF84454',
  white: 'FFFFFFFF',
  gray50: 'FFF8FAFC',
  gray100: 'FFF1F5F9',
  gray200: 'FFE2E8F0',
  gray300: 'FFCBD5E1',
  gray500: 'FF64748B',
  green: 'FF10B981',
  amber: 'FFF59E0B',
  emerald: 'FF059669',
};

// Cores por status
const STATUS_COLORS: Record<string, string> = {
  'Fechado': 'FF10B981',
  'Solucionado': 'FF1D2E40',
  'Novo': 'FF8B5CF6',
  'Em Atendimento (atribuído)': 'FFF84454',
  'Em Atendimento (planejado)': 'FFF59E0B',
  'Pendente': 'FFEF4444',
};

interface ExportMetrics {
  total: number;
  closureRate: number;
  closed: number;
  solved: number;
  inProgress: number;
  pending: number;
  newTickets: number;
  avgWorkHours: number;
  totalWorkHours: number;
  totalPlannedHours: number;
  totalRealizedHours: number;
  totalLegacyHours: number;
  hoursBalance: number;
  hoursBalanceType: 'gain' | 'loss' | 'neutral';
  pendingHoursNotes: number;
}

interface ExportOptions {
  tickets: Ticket[];
  metrics: ExportMetrics;
  dateRange: { start: string; end: string };
  fileName?: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTechnicianName(name: string | undefined): string {
  if (!name || name === 'null' || name === 'undefined') return 'Não atribuído';
  if (/^\d+$/.test(name)) return `Técnico #${name}`;
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    return `${parts[1]} ${parts[0]}`;
  }
  return name;
}

function getHoursStatusLabel(status: Ticket['hours_status']): string {
  const labels: Record<Ticket['hours_status'], string> = {
    not_loaded: 'Não carregado',
    complete: 'Completo',
    missing_planned: 'Falta planejado',
    missing_realized: 'Falta realizado',
    missing_both: 'Faltam ambos',
    legacy: 'Legado',
    no_rpa_tasks: 'Sem apontamentos RPA',
  };

  return labels[status];
}

function joinTaskContents(tasks: { content: string }[]): string {
  const contents = tasks
    .map(task => task.content.trim())
    .filter(Boolean);

  return contents.length > 0 ? contents.join('\n---\n') : '-';
}

function getHoursBalanceLabel(balance: number): string {
  if (balance > 0) return `Ganho de ${formatHoursMinutes(balance)}`;
  if (balance < 0) return `Perda de ${formatHoursMinutes(Math.abs(balance))}`;
  return 'Sem variação';
}

export async function exportToExcel({ tickets, metrics, dateRange, fileName }: ExportOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Central de Monitoramento RPA - Minerva Foods';
  workbook.created = new Date();

  // ==========================================
  // PLANILHA 1: RESUMO EXECUTIVO
  // ==========================================
  const summarySheet = workbook.addWorksheet('Resumo Executivo', {
    properties: { tabColor: { argb: COLORS.navy } },
    views: [{ showGridLines: false }],
  });

  // Configurar largura das colunas
  summarySheet.columns = [
    { width: 3 },   // A - margem
    { width: 25 },  // B
    { width: 20 },  // C
    { width: 20 },  // D
    { width: 20 },  // E
    { width: 20 },  // F
    { width: 3 },   // G - margem
  ];

  // HEADER - Título
  summarySheet.mergeCells('B2:F2');
  const titleCell = summarySheet.getCell('B2');
  titleCell.value = 'CENTRAL DE MONITORAMENTO DE CHAMADOS RPA';
  titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(2).height = 40;

  // Subtítulo
  summarySheet.mergeCells('B3:F3');
  const subtitleCell = summarySheet.getCell('B3');
  subtitleCell.value = 'MINERVA FOODS S.A.';
  subtitleCell.font = { name: 'Calibri', size: 12, color: { argb: COLORS.white } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyLight } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(3).height = 25;

  // Período
  const periodText = dateRange.start && dateRange.end 
    ? `Período: ${formatDateShort(dateRange.start)} a ${formatDateShort(dateRange.end)}`
    : 'Período: Todos os registros';
  
  summarySheet.mergeCells('B4:F4');
  const periodCell = summarySheet.getCell('B4');
  periodCell.value = periodText;
  periodCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: COLORS.gray500 } };
  periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gray100 } };
  periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(4).height = 22;

  // Espaço
  summarySheet.getRow(5).height = 15;

  // ==========================================
  // SEÇÃO: INDICADORES PRINCIPAIS (KPIs)
  // ==========================================
  summarySheet.mergeCells('B6:F6');
  const kpiTitleCell = summarySheet.getCell('B6');
  kpiTitleCell.value = '📊 INDICADORES PRINCIPAIS';
  kpiTitleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.navy } };
  kpiTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  summarySheet.getRow(6).height = 30;

  // KPI Cards
  const kpis = [
    { label: 'Total de Chamados', value: metrics.total.toString(), color: COLORS.navy },
    { label: 'Taxa de Resolução', value: `${metrics.closureRate}%`, color: COLORS.green },
    { label: 'Em Aberto', value: (metrics.inProgress + metrics.pending + metrics.newTickets).toString(), color: COLORS.amber },
    { label: 'Finalizados', value: (metrics.closed + metrics.solved).toString(), color: COLORS.emerald },
  ];

  // Linha dos KPIs
  const kpiRow = summarySheet.getRow(8);
  kpiRow.height = 60;

  kpis.forEach((kpi, index) => {
    const col = index + 2; // B, C, D, E
    const cell = kpiRow.getCell(col);
    cell.value = `${kpi.value}\n${kpi.label}`;
    cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.white } },
      left: { style: 'thin', color: { argb: COLORS.white } },
      bottom: { style: 'thin', color: { argb: COLORS.white } },
      right: { style: 'thin', color: { argb: COLORS.white } },
    };
  });

  // Espaço
  summarySheet.getRow(9).height = 20;

  // ==========================================
  // SEÇÃO: DETALHAMENTO
  // ==========================================
  summarySheet.mergeCells('B10:F10');
  const detailTitleCell = summarySheet.getCell('B10');
  detailTitleCell.value = '📋 DETALHAMENTO POR STATUS';
  detailTitleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.navy } };
  detailTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  summarySheet.getRow(10).height = 30;

  // Tabela de status
  const statusData = [
    ['Status', 'Quantidade', 'Percentual'],
    ['Fechado', metrics.closed, metrics.total > 0 ? `${((metrics.closed / metrics.total) * 100).toFixed(1)}%` : '0%'],
    ['Solucionado', metrics.solved, metrics.total > 0 ? `${((metrics.solved / metrics.total) * 100).toFixed(1)}%` : '0%'],
    ['Em Atendimento', metrics.inProgress, metrics.total > 0 ? `${((metrics.inProgress / metrics.total) * 100).toFixed(1)}%` : '0%'],
    ['Pendente', metrics.pending, metrics.total > 0 ? `${((metrics.pending / metrics.total) * 100).toFixed(1)}%` : '0%'],
    ['Novo', metrics.newTickets, metrics.total > 0 ? `${((metrics.newTickets / metrics.total) * 100).toFixed(1)}%` : '0%'],
  ];

  statusData.forEach((row, rowIndex) => {
    const excelRow = summarySheet.getRow(12 + rowIndex);
    excelRow.height = 25;
    
    row.forEach((value, colIndex) => {
      const cell = excelRow.getCell(colIndex + 2); // B, C, D
      cell.value = value;
      
      if (rowIndex === 0) {
        // Header
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
      } else {
        // Data
        cell.font = { name: 'Calibri', size: 11, color: { argb: COLORS.navy } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIndex % 2 === 0 ? COLORS.gray50 : COLORS.white } };
      }
      
      cell.alignment = { horizontal: colIndex === 0 ? 'left' : 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.gray200 } },
        left: { style: 'thin', color: { argb: COLORS.gray200 } },
        bottom: { style: 'thin', color: { argb: COLORS.gray200 } },
        right: { style: 'thin', color: { argb: COLORS.gray200 } },
      };
    });
  });

  // Totais de horas
  summarySheet.mergeCells('B19:F19');
  const hoursTitleCell = summarySheet.getCell('B19');
  hoursTitleCell.value = 'HORAS APONTADAS';
  hoursTitleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLORS.navy } };
  hoursTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const hoursData = [
    ['Planejado', formatHoursMinutes(metrics.totalPlannedHours)],
    ['Realizado', formatHoursMinutes(metrics.totalRealizedHours)],
    ['Saldo Planejado x Realizado', getHoursBalanceLabel(metrics.hoursBalance)],
    ['Legado', formatHoursMinutes(metrics.totalLegacyHours)],
    ['Pendências', metrics.pendingHoursNotes],
  ];

  hoursData.forEach((row, rowIndex) => {
    const excelRow = summarySheet.getRow(21 + rowIndex);
    row.forEach((value, colIndex) => {
      const cell = excelRow.getCell(colIndex + 2);
      cell.value = value;
      cell.font = { name: 'Calibri', size: 11, bold: colIndex === 0, color: { argb: COLORS.navy } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowIndex % 2 === 0 ? COLORS.gray50 : COLORS.white } };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.gray200 } },
        left: { style: 'thin', color: { argb: COLORS.gray200 } },
        bottom: { style: 'thin', color: { argb: COLORS.gray200 } },
        right: { style: 'thin', color: { argb: COLORS.gray200 } },
      };
    });
  });

  // Data de geração
  summarySheet.mergeCells('B27:F27');
  const footerCell = summarySheet.getCell('B27');
  footerCell.value = `Relatório gerado em ${new Date().toLocaleString('pt-BR')} | Central de Monitoramento RPA - Minerva Foods`;
  footerCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLORS.gray500 } };
  footerCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // ==========================================
  // PLANILHA 2: LISTA DE CHAMADOS
  // ==========================================
  const ticketsSheet = workbook.addWorksheet('Chamados', {
    properties: { tabColor: { argb: COLORS.red } },
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  // Configurar largura das colunas
  ticketsSheet.columns = [
    { width: 12 },  // A - ID
    { width: 60 },  // B - Título
    { width: 25 },  // C - Status
    { width: 30 },  // D - Técnico
    { width: 16 },  // E - Planejado
    { width: 16 },  // F - Realizado
    { width: 26 },  // G - Saldo
    { width: 16 },  // H - Legado
    { width: 24 },  // I - Status horas
    { width: 20 },  // J - Data Abertura
    { width: 20 },  // K - Última Atualização
  ];

  // Título da planilha
  ticketsSheet.mergeCells('A1:K1');
  const ticketsTitleCell = ticketsSheet.getCell('A1');
  ticketsTitleCell.value = '📋 LISTA COMPLETA DE CHAMADOS';
  ticketsTitleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLORS.white } };
  ticketsTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  ticketsTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ticketsSheet.getRow(1).height = 35;

  // Info do período
  ticketsSheet.mergeCells('A2:K2');
  const ticketsPeriodCell = ticketsSheet.getCell('A2');
  ticketsPeriodCell.value = `${periodText} | Total: ${tickets.length} chamados`;
  ticketsPeriodCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.gray500 } };
  ticketsPeriodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gray100 } };
  ticketsPeriodCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ticketsSheet.getRow(2).height = 22;

  // Cabeçalho da tabela
  const headers = [
    'ID',
    'Título',
    'Status',
    'Técnico Responsável',
    'Horas Planejadas',
    'Horas Realizadas',
    'Saldo Planejado x Realizado',
    'Horas Legado',
    'Status Apontamento',
    'Data Abertura',
    'Última Atualização',
  ];
  const headerRow = ticketsSheet.getRow(3);
  headerRow.height = 30;

  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyLight } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.navy } },
      left: { style: 'thin', color: { argb: COLORS.navy } },
      bottom: { style: 'medium', color: { argb: COLORS.navy } },
      right: { style: 'thin', color: { argb: COLORS.navy } },
    };
  });

  // Dados dos chamados
  tickets.forEach((ticket, index) => {
    const row = ticketsSheet.getRow(index + 4);
    row.height = 28;
    const isEven = index % 2 === 0;
    const bgColor = isEven ? COLORS.white : COLORS.gray50;

    // ID
    const idCell = row.getCell(1);
    idCell.value = `#${ticket.id}`;
    idCell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: COLORS.navy } };
    idCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    idCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Título
    const titleCellTicket = row.getCell(2);
    titleCellTicket.value = ticket.title;
    titleCellTicket.font = { name: 'Calibri', size: 10, color: { argb: COLORS.navy } };
    titleCellTicket.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    titleCellTicket.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    // Status
    const statusCell = row.getCell(3);
    statusCell.value = ticket.status;
    const statusColor = STATUS_COLORS[ticket.status] || COLORS.gray500;
    statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.white } };
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor } };
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Técnico
    const techCell = row.getCell(4);
    techCell.value = formatTechnicianName(ticket.assigned_technician);
    techCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.navy } };
    techCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    techCell.alignment = { horizontal: 'left', vertical: 'middle' };

    // Horas Planejadas
    const plannedCell = row.getCell(5);
    plannedCell.value = formatHoursMinutes(ticket.planned_time_hours);
    plannedCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.navy } };
    plannedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    plannedCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Horas Realizadas
    const realizedCell = row.getCell(6);
    realizedCell.value = formatHoursMinutes(ticket.realized_time_hours);
    realizedCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.green } };
    realizedCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    realizedCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Saldo Planejado x Realizado
    const balanceCell = row.getCell(7);
    const ticketBalance = (ticket.planned_time_hours || 0) - (ticket.realized_time_hours || 0);
    balanceCell.value = getHoursBalanceLabel(ticketBalance);
    balanceCell.font = { name: 'Calibri', size: 10, color: { argb: ticketBalance < 0 ? COLORS.red : COLORS.green } };
    balanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    balanceCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Horas Legado
    const legacyCell = row.getCell(8);
    legacyCell.value = formatHoursMinutes(ticket.legacy_time_hours);
    legacyCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.amber } };
    legacyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    legacyCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Status Apontamento
    const hoursStatusCell = row.getCell(9);
    hoursStatusCell.value = getHoursStatusLabel(ticket.hours_status);
    hoursStatusCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.navy } };
    hoursStatusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    hoursStatusCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Data Abertura
    const dateCell = row.getCell(10);
    dateCell.value = formatDate(ticket.created_at);
    dateCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray500 } };
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Última Atualização
    const updateCell = row.getCell(11);
    updateCell.value = formatDate(ticket.updated_date || ticket.created_at);
    updateCell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.gray500 } };
    updateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    updateCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Bordas para todas as células
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].forEach(col => {
      row.getCell(col).border = {
        top: { style: 'thin', color: { argb: COLORS.gray200 } },
        left: { style: 'thin', color: { argb: COLORS.gray200 } },
        bottom: { style: 'thin', color: { argb: COLORS.gray200 } },
        right: { style: 'thin', color: { argb: COLORS.gray200 } },
      };
    });
  });

  // Adicionar filtros
  ticketsSheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: tickets.length + 3, column: 11 },
  };

  // ==========================================
  // PLANILHA 3: APONTAMENTOS DETALHADOS
  // ==========================================
  const tasksSheet = workbook.addWorksheet('Apontamentos', {
    properties: { tabColor: { argb: COLORS.amber } },
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  tasksSheet.columns = [
    { width: 12 },
    { width: 50 },
    { width: 35 },
    { width: 55 },
    { width: 18 },
    { width: 55 },
    { width: 18 },
    { width: 55 },
    { width: 18 },
    { width: 24 },
  ];

  tasksSheet.mergeCells('A1:J1');
  const tasksTitleCell = tasksSheet.getCell('A1');
  tasksTitleCell.value = 'APONTAMENTOS POR CHAMADO E COLABORADOR';
  tasksTitleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLORS.white } };
  tasksTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  tasksTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  tasksSheet.getRow(1).height = 35;

  tasksSheet.mergeCells('A2:J2');
  const tasksPeriodCell = tasksSheet.getCell('A2');
  tasksPeriodCell.value = periodText;
  tasksPeriodCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.gray500 } };
  tasksPeriodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gray100 } };
  tasksPeriodCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const taskHeaders = [
    'ID Chamado',
    'Título',
    'Colaborador',
    'Apontamento Planejado',
    'Horas Planejadas',
    'Apontamento Realizado',
    'Horas Realizadas',
    'Apontamento Legado',
    'Horas Legado',
    'Status Apontamento',
  ];
  const taskHeaderRow = tasksSheet.getRow(3);
  taskHeaders.forEach((header, index) => {
    const cell = taskHeaderRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navyLight } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const taskRows = tickets.flatMap(ticket =>
    ticket.collaborator_hours.map(collaborator => {
      const plannedTasks = collaborator.tasks.filter(task => task.kind === 'planned');
      const realizedTasks = collaborator.tasks.filter(task => task.kind === 'realized');
      const legacyTasks = collaborator.tasks.filter(task => task.kind === 'legacy');

      return {
        ticket,
        collaborator: collaborator.collaborator,
        plannedContent: joinTaskContents(plannedTasks),
        plannedHours: collaborator.planned_hours,
        realizedContent: joinTaskContents(realizedTasks),
        realizedHours: collaborator.realized_hours,
        legacyContent: joinTaskContents(legacyTasks),
        legacyHours: collaborator.legacy_hours,
      };
    })
  );

  taskRows.forEach((taskRow, index) => {
    const row = tasksSheet.getRow(index + 4);
    const bgColor = index % 2 === 0 ? COLORS.white : COLORS.gray50;
    row.height = 42;

    [
      `#${taskRow.ticket.id}`,
      taskRow.ticket.title,
      taskRow.collaborator,
      taskRow.plannedContent,
      formatHoursMinutes(taskRow.plannedHours),
      taskRow.realizedContent,
      formatHoursMinutes(taskRow.realizedHours),
      taskRow.legacyContent,
      formatHoursMinutes(taskRow.legacyHours),
      getHoursStatusLabel(taskRow.ticket.hours_status),
    ].forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      cell.value = value;
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.navy } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.alignment = {
        horizontal: [3, 5, 7].includes(colIndex) ? 'left' : 'center',
        vertical: 'middle',
        wrapText: [1, 3, 5, 7].includes(colIndex),
      };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.gray200 } },
        left: { style: 'thin', color: { argb: COLORS.gray200 } },
        bottom: { style: 'thin', color: { argb: COLORS.gray200 } },
        right: { style: 'thin', color: { argb: COLORS.gray200 } },
      };
    });
  });

  tasksSheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: taskRows.length + 3, column: 10 },
  };

  // ==========================================
  // GERAR E BAIXAR ARQUIVO
  // ==========================================
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const date = new Date().toISOString().split('T')[0];
  const defaultFileName = `Relatorio_Chamados_RPA_${date}.xlsx`;
  
  saveAs(blob, fileName || defaultFileName);
}
