'use client';

function getDeviceInfo(): string {
  if (typeof navigator === 'undefined') return '不明';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'その他';
}

function getBrowserInfo(): string {
  if (typeof navigator === 'undefined') return '不明';
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
  if (/Firefox/i.test(ua)) return 'Firefox';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  return 'その他';
}

/**
 * エラーをSupabaseのerror_logsテーブルに保存する
 * @param errorMessage エラー内容
 * @param processType  失敗した処理（録音・文字起こし・保存・マイクアクセスなど）
 */
export async function logError(errorMessage: string, processType: string): Promise<void> {
  try {
    await fetch('/api/error-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error_message: errorMessage,
        process_type: processType,
        device_info: getDeviceInfo(),
        browser_info: getBrowserInfo(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
    });
  } catch {
    // ログ保存失敗はサイレントに無視（アプリを壊さない）
  }
}
