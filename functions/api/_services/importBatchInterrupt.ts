export function interruptBatchSql(scope: 'one' | 'overdue'): string {
  const where =
    scope === 'one'
      ? "id = ? AND user_id = ? AND status = 'processing' AND generation = ?"
      : "status = 'processing' AND processing_deadline IS NOT NULL AND processing_deadline <= ?"
  return `UPDATE import_batches SET
    status = CASE WHEN EXISTS (SELECT 1 FROM import_drafts d WHERE d.batch_id = import_batches.id AND d.user_id = import_batches.user_id) THEN 'partial' ELSE 'failed' END,
    stage = NULL, error_code = 'JOB_INTERRUPTED', generation = generation + 1, sequence = sequence + 1,
    processing_deadline = NULL, updated_at = ? WHERE ${where}`
}
