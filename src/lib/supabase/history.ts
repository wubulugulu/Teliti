import { createClient } from './client'
import type { ScanRecord } from '@/types'

export async function saveScan(scan: ScanRecord) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('scan_history')
    .insert({
      user_id: user.id,
      file_name: scan.fileName,
      document_text: scan.documentText,
      bias_result: scan.biasResult,
      consistency_result: scan.consistencyResult,
      integrity_score: scan.integrityScore,
    })
    .select()
    .single()

  if (error) console.error('Save scan error:', error)
  return data
}

export async function loadScans(): Promise<ScanRecord[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('scan_history')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Load scans error:', error)
    return []
  }

  return data.map(row => ({
    id: row.id,
    fileName: row.file_name,
    timestamp: new Date(row.created_at),
    documentText: row.document_text,
    biasResult: row.bias_result,
    consistencyResult: row.consistency_result,
    integrityScore: row.integrity_score,
  }))
}

export async function deleteScan(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('scan_history')
    .delete()
    .eq('id', id)

  if (error) console.error('Delete scan error:', error)
}

/**
 * Nyalain/matiin status publik sebuah scan. Dipanggil dari client (browser),
 * hanya bisa berhasil kalau row itu milik user yang login (RLS: user_id = auth.uid()).
 */
export async function setScanPublic(id: string, isPublic: boolean) {
  const supabase = createClient()
  const { error } = await supabase
    .from('scan_history')
    .update({ is_public: isPublic })
    .eq('id', id)

  if (error) {
    console.error('Set scan public error:', error)
    return false
  }
  return true
}