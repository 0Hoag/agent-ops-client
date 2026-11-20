import { api } from '../../../shared/api/client';
import type { BudgetBudget, BudgetRequest } from '../../../shared/api/generated/Api';

// The controller uses the shared data envelope; generated budget types omit it.
type BudgetEnvelope<T> = { data: T };

/** Lists repositories authorized for the selected organization. */
export async function listBudgetRepositories() { return (await api.api.v1RepositoriesList()).data.data ?? []; }

export async function listBudgets(): Promise<BudgetBudget[]> { return ((await api.api.v1BudgetsList()).data as unknown as BudgetEnvelope<BudgetBudget[] | null>).data ?? []; }
function apiDates(input: BudgetRequest): BudgetRequest {
  const { ends_at, repository_id, ...rest } = input;
  return {
    ...rest,
    ...(repository_id ? { repository_id } : {}),
    ...(input.starts_at && /^\d{4}-\d{2}-\d{2}$/.test(input.starts_at) ? { starts_at: `${input.starts_at}T00:00:00Z` } : {}),
    ...(ends_at ? { ends_at: /^\d{4}-\d{2}-\d{2}$/.test(ends_at) ? `${ends_at}T00:00:00Z` : ends_at } : {}),
  };
}

export async function createBudget(input: BudgetRequest): Promise<BudgetBudget> { return ((await api.api.v1BudgetsCreate(apiDates(input))).data as unknown as BudgetEnvelope<BudgetBudget>).data; }
export async function updateBudget(id: string, input: BudgetRequest): Promise<BudgetBudget> { return ((await api.api.v1BudgetsPartialUpdate(id, apiDates(input))).data as unknown as BudgetEnvelope<BudgetBudget>).data; }
export async function deleteBudget(id: string): Promise<void> { await api.api.v1BudgetsDelete(id); }

export async function budgetSession(): Promise<{ org: string; role: string }> {
  const session = (await api.api.v1AuthSessionList()).data;
  const org = session.organization_id ?? '';
  if (!org) return { org, role: '' };
  const members = (await api.api.v1OrganizationsMembersList(org)).data.data as { account_id: string; role: string }[] | undefined;
  const role = members?.find((member) => member.account_id === session.account_id)?.role ?? '';
  return { org, role };
}
