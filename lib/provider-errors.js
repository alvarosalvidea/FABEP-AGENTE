const permanent = new Set([
  'credit_balance_exhausted', 'insufficient_quota', 'organization_spend_limit_exceeded',
  'project_spend_limit_exceeded', 'organization_usage_limit_exceeded', 'usage_limit_exceeded',
  'billing_hard_limit_reached', 'billing_not_active'
]);
const known = new Set([...permanent, 'rate_limit_exceeded', 'slow_down', 'model_not_found', 'invalid_api_key']);
export function providerErrorCode(error) {
  return [error?.code, error?.error?.code, error?.error?.error?.code].find(code => known.has(code)) || 'provider_error';
}
export function requiresAccountAction(error) {
  return permanent.has(providerErrorCode(error));
}
