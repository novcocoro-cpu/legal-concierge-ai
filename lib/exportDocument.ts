import type { GeminiResult } from '@/types';

const PRIORITY_JA: Record<string, string> = {
  high:   '高',
  medium: '中',
  low:    '低',
};

function todayJa(): string {
  return new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ──────────────────────────────────────────
// Word (.docx) エクスポート
// ──────────────────────────────────────────
export async function downloadDocx(result: GeminiResult): Promise<void> {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle,
  } = await import('docx');

  const heading = (text: string) =>
    new Paragraph({
      text,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 120 },
    });

  const bullet = (text: string) =>
    new Paragraph({
      children: [new TextRun({ text: `• ${text}`, size: 22 })],
      spacing: { before: 80 },
    });

  const body = (text: string) =>
    new Paragraph({
      children: [new TextRun({ text, size: 22 })],
      spacing: { before: 80 },
    });

  const tableHeaderCell = (text: string) =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20 })] })],
      shading: { fill: 'dbeafe' },
    });

  const tableCell = (text: string) =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })],
    });

  // アクションプランテーブル
  const actionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:           { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
      bottom:        { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
      left:          { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
      right:         { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
      insideVertical:   { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
    },
    rows: [
      new TableRow({
        children: [
          tableHeaderCell('タスク'),
          tableHeaderCell('担当者'),
          tableHeaderCell('期限'),
          tableHeaderCell('優先度'),
        ],
      }),
      ...(result.action_plan ?? []).map(a =>
        new TableRow({
          children: [
            tableCell(a.task),
            tableCell(a.assignee),
            tableCell(a.deadline),
            tableCell(PRIORITY_JA[a.priority] ?? a.priority),
          ],
        })
      ),
    ],
  });

  // 次回会議アジェンダテーブル
  const agendaItems = result.next_meeting?.agenda ?? [];

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Meiryo', size: 22 } },
      },
    },
    sections: [{
      children: [
        // タイトル
        new Paragraph({
          children: [new TextRun({ text: result.title, bold: true, size: 36, font: 'Meiryo' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: todayJa(), size: 20, color: '6b7280' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),

        // 会議の要約
        heading('📄 会議の要約'),
        body(result.summary ?? ''),

        // 問題点
        heading('⚠️ 問題点'),
        ...(result.problems ?? []).map(p => bullet(p)),

        // 改善策
        heading('💡 改善策'),
        ...(result.improvements ?? []).map(imp => bullet(imp)),

        // アクションプラン
        heading('🎯 アクションプラン'),
        actionTable,

        // 次回会議
        heading('📅 次回会議'),
        body(`提案時期: ${result.next_meeting?.suggested_timing ?? ''}`),
        ...(agendaItems.map(a => bullet(`アジェンダ: ${a}`))),
        ...(result.next_meeting?.notes ? [body(`備考: ${result.next_meeting.notes}`)] : []),

        // 文字起こし
        heading('📝 文字起こし'),
        new Paragraph({
          children: [new TextRun({ text: result.transcript ?? '', size: 20 })],
          spacing: { before: 80 },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${sanitize(result.title)}_議事録.docx`);
}

// ──────────────────────────────────────────
// Excel (.xlsx) エクスポート
// ──────────────────────────────────────────
export async function downloadXlsx(result: GeminiResult): Promise<void> {
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: アクションプラン ──
  const actionData = [
    ['項目名', '内容', '優先度', '担当者', '期限'],
    ...(result.action_plan ?? []).map(a => [
      'アクション', a.task, PRIORITY_JA[a.priority] ?? a.priority, a.assignee, a.deadline,
    ]),
  ];
  const wsAction = XLSX.utils.aoa_to_sheet(actionData);
  wsAction['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 8 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsAction, 'アクションプラン');

  // ── Sheet 2: 問題点・改善策 ──
  const issueData = [
    ['種別', '内容', '優先度', '担当部門'],
    ...(result.problems ?? []).map(p => ['問題点', p, '高', '']),
    ...(result.improvements ?? []).map(imp => ['改善策', imp, '中', '']),
  ];
  const wsIssues = XLSX.utils.aoa_to_sheet(issueData);
  wsIssues['!cols'] = [{ wch: 10 }, { wch: 50 }, { wch: 8 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsIssues, '問題点・改善策');

  // ── Sheet 3: 会議サマリー ──
  const dateStr = todayJa();
  const summaryData = [
    ['項目', '内容'],
    ['タイトル', result.title ?? ''],
    ['日付', dateStr],
    ['要約', result.summary ?? ''],
    ['次回会議提案', result.next_meeting?.suggested_timing ?? ''],
    ['次回備考', result.next_meeting?.notes ?? ''],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 16 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, '会議サマリー');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, `${sanitize(result.title)}_議事録.xlsx`);
}

// ──────────────────────────────────────────
// 共通ユーティリティ
// ──────────────────────────────────────────
function sanitize(name: string): string {
  return (name ?? '会議').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
