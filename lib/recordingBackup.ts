'use client';

// IndexedDB を使って録音チャンクをバックアップする
// localStorage より大容量（数百MB）で音声データを安全に保存できる

const DB_NAME    = 'mtg_recording_backup';
const STORE_NAME = 'recordings';
const BACKUP_KEY = 'latest';

interface BackupRecord {
  key:        string;
  data:       ArrayBuffer;   // 結合済み音声 Blob の ArrayBuffer
  mimeType:   string;
  durationSec: number;
  savedAt:    number;        // Unix ms
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** 録音チャンクを IndexedDB に保存（5分ごとに呼ぶ） */
export async function saveRecordingBackup(
  chunks: Blob[],
  mimeType: string,
  durationSec: number,
): Promise<void> {
  try {
    if (chunks.length === 0) return;
    const blob = new Blob(chunks, { type: mimeType });
    const data = await blob.arrayBuffer();
    const db   = await openDB();
    const record: BackupRecord = { key: BACKUP_KEY, data, mimeType, durationSec, savedAt: Date.now() };
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
  } catch (e) {
    console.warn('[recordingBackup] save failed:', e);
  }
}

/** バックアップを読み込む */
export async function loadRecordingBackup(): Promise<{
  blob: Blob;
  mimeType: string;
  durationSec: number;
  savedAt: Date;
} | null> {
  try {
    const db = await openDB();
    const record = await new Promise<BackupRecord | undefined>((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(BACKUP_KEY);
      req.onsuccess = () => resolve(req.result as BackupRecord | undefined);
      req.onerror   = () => reject(req.error);
    });
    if (!record) return null;
    const blob = new Blob([record.data], { type: record.mimeType });
    return { blob, mimeType: record.mimeType, durationSec: record.durationSec, savedAt: new Date(record.savedAt) };
  } catch {
    return null;
  }
}

/** バックアップを削除（録音成功後に呼ぶ） */
export async function clearRecordingBackup(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(BACKUP_KEY);
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
  } catch { /* ignore */ }
}
