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

function datePrefix(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
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
      shading: { fill: '0a1628' },
    });

  const tableCell = (text: string) =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })],
    });

  const actionTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:           { style: BorderStyle.SINGLE, size: 1, color: 'c9a84c' },
      bottom:        { style: BorderStyle.SINGLE, size: 1, color: 'c9a84c' },
      left:          { style: BorderStyle.SINGLE, size: 1, color: 'c9a84c' },
      right:         { style: BorderStyle.SINGLE, size: 1, color: 'c9a84c' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
      insideVertical:   { style: BorderStyle.SINGLE, size: 1, color: 'd1d5db' },
    },
    rows: [
      new TableRow({
        children: [
          tableHeaderCell('宿題事項'),
          tableHeaderCell('担当弁護士'),
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

  const agendaItems = result.next_meeting?.agenda ?? [];

  const sections: InstanceType<typeof Paragraph | typeof Table>[] = [
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
    heading('📄 相談内容の要約'),
    body(result.summary ?? ''),
    heading('⚠️ 法的論点・争点'),
    ...(result.problems ?? []).map(p => bullet(p)),
    heading('💡 対応方針'),
    ...(result.improvements ?? []).map(imp => bullet(imp)),
  ];

  if (result.litigation_risk) {
    sections.push(heading('🔥 訴訟リスク評価'));
    sections.push(body(`リスクレベル: ${result.litigation_risk.level}`));
    sections.push(body(result.litigation_risk.description));
    for (const f of result.litigation_risk.factors ?? []) {
      sections.push(bullet(f));
    }
  }

  if (result.negotiation_strategy) {
    sections.push(heading('🧠 交渉戦略・心理的分析'));
    sections.push(body(`戦略: ${result.negotiation_strategy.approach}`));
    sections.push(body(`心理的分析: ${result.negotiation_strategy.psychological_notes}`));
    for (const kp of result.negotiation_strategy.key_points ?? []) {
      sections.push(bullet(kp));
    }
  }

  sections.push(heading('🎯 宿題事項・期日'));
  sections.push(actionTable);
  sections.push(heading('📅 次回期日'));
  sections.push(body(`提案時期: ${result.next_meeting?.suggested_timing ?? ''}`));
  for (const a of agendaItems) {
    sections.push(bullet(`検討事項: ${a}`));
  }
  if (result.next_meeting?.notes) {
    sections.push(body(`備考: ${result.next_meeting.notes}`));
  }
  sections.push(heading('📝 文字起こし'));
  sections.push(new Paragraph({
    children: [new TextRun({ text: result.transcript ?? '', size: 20 })],
    spacing: { before: 80 },
  }));

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Meiryo', size: 22 } },
      },
    },
    sections: [{ children: sections }],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `${datePrefix()}_${sanitize(result.title)}_相談記録.docx`);
}

// ──────────────────────────────────────────
// Excel (.xlsx) エクスポート
// ──────────────────────────────────────────
export async function downloadXlsx(result: GeminiResult): Promise<void> {
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();

  const actionData = [
    ['宿題事項', '担当弁護士', '優先度', '期限'],
    ...(result.action_plan ?? []).map(a => [
      a.task, a.assignee, PRIORITY_JA[a.priority] ?? a.priority, a.deadline,
    ]),
  ];
  const wsAction = XLSX.utils.aoa_to_sheet(actionData);
  wsAction['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 8 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsAction, '宿題事項');

  const issueData = [
    ['種別', '内容', '優先度'],
    ...(result.problems ?? []).map(p => ['法的論点', p, '高']),
    ...(result.improvements ?? []).map(imp => ['対応方針', imp, '中']),
  ];
  const wsIssues = XLSX.utils.aoa_to_sheet(issueData);
  wsIssues['!cols'] = [{ wch: 10 }, { wch: 50 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, wsIssues, '法的論点・対応方針');

  const summaryData = [
    ['項目', '内容'],
    ['案件名', result.title ?? ''],
    ['日付', todayJa()],
    ['相談要約', result.summary ?? ''],
    ['訴訟リスク', result.litigation_risk?.level ?? ''],
    ['訴訟リスク詳細', result.litigation_risk?.description ?? ''],
    ['交渉戦略', result.negotiation_strategy?.approach ?? ''],
    ['次回期日提案', result.next_meeting?.suggested_timing ?? ''],
    ['次回備考', result.next_meeting?.notes ?? ''],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 16 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, '相談サマリー');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, `${datePrefix()}_${sanitize(result.title)}_相談記録.xlsx`);
}

// ──────────────────────────────────────────
// プレーンテキストをクリップボードにコピー
// ──────────────────────────────────────────
export function buildPlainText(result: GeminiResult): string {
  const lines: string[] = [
    `【案件名】${result.title}`,
    `【日付】${todayJa()}`,
    `【相談内容の要約】\n${result.summary ?? ''}`,
  ];
  if (result.problems?.length)
    lines.push(`【法的論点・争点】\n${result.problems.map(p => `• ${p}`).join('\n')}`);
  if (result.improvements?.length)
    lines.push(`【対応方針】\n${result.improvements.map(i => `• ${i}`).join('\n')}`);
  if (result.litigation_risk)
    lines.push(`【訴訟リスク評価】${result.litigation_risk.level}\n${result.litigation_risk.description}`);
  if (result.negotiation_strategy)
    lines.push(`【交渉戦略】${result.negotiation_strategy.approach}\n【心理的分析】${result.negotiation_strategy.psychological_notes}`);
  if (result.action_plan?.length)
    lines.push(`【宿題事項】\n${result.action_plan.map(a =>
      `• ${a.task}（担当: ${a.assignee}、期限: ${a.deadline}、優先度: ${PRIORITY_JA[a.priority] ?? a.priority}）`
    ).join('\n')}`);
  if (result.next_meeting)
    lines.push(`【次回期日】${result.next_meeting.suggested_timing}`);
  if (result.transcript)
    lines.push(`【文字起こし】\n${result.transcript}`);
  return lines.join('\n\n');
}

// ──────────────────────────────────────────
// 共通ユーティリティ
// ──────────────────────────────────────────
function sanitize(name: string): string {
  return (name ?? '案件').replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
