export function isUserAnalyticsAdmin(
  env: { ADMIN_USER_ID?: string },
  userId: string | null,
): boolean {
  const owner = env.ADMIN_USER_ID
  return typeof owner === 'string' && owner.length > 0 && !/[\s,;]/.test(owner) && userId === owner
}
