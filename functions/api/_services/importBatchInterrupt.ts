/**
 * The one definition of interrupting an import batch (restart or deadline recovery). A batch whose job died keeps
 * the rows it already persisted (partial) or fails (failed); the generation bump fences any late write from the dead
 * job, and the stored deadline is cleared so the sweep never picks the batch up again.
 *
 * 'one' binds (now, batchId, userId, generation) and fences a single batch; 'overdue' binds (now, now) and takes
 * every processing batch whose stored deadline has passed.
 */
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
