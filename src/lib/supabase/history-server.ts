import { createClient } from './server'
import type { ScanRecord } from '@/types'

/**
 * Load satu scan buat halaman publik /report/[id]. HANYA dipanggil dari
 * server component (pakai next/headers) — jangan import file ini dari
 * komponen "use client", karena bakal gagal build.
 * Hanya berhasil kalau is_public = true (ditegakkan oleh RLS policy
 * "Public scans are viewable by everyone"). Kalau scan tidak ada atau
 * tidak publik, return null.
 */
export async function loadPublicScan(id: string): Promise<ScanRecord | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('scan_history')
    .select('*')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    fileName: data.file_name,
    timestamp: new Date(data.created_at),
    documentText: data.document_text,
    biasResult: data.bias_result,
    consistencyResult: data.consistency_result,
    integrityScore: data.integrity_score,
  }
}