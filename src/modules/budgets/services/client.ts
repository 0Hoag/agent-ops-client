import { api } from '../../../shared/api/client';
import type { BudgetBudget, BudgetRequest } from '../../../shared/api/generated/Api';

export async function listBudgets(): Promise<BudgetBudget[]> { return (await api.api.v1BudgetsList()).data; }
export async function createBudget(input: BudgetRequest): Promise<BudgetBudget> { return (await api.api.v1BudgetsCreate(input)).data; }
export async function updateBudget(id: string, input: BudgetRequest): Promise<BudgetBudget> { return (await api.api.v1BudgetsPartialUpdate(id, input)).data; }
export async function deleteBudget(id: string): Promise<void> { await api.api.v1BudgetsDelete(id); }

export async function budgetSession(): Promise<{ org: string; role: string }> {
  const session = (await api.api.v1AuthSessionList()).data;
  const org = session.organization_id ?? '';
  if (!org) return { org, role: '' };
  const members = (await api.api.v1OrganizationsMembersList(org)).data.data as { account_id: string; role: string }[] | undefined;
  const role = members?.find((member) => member.account_id === session.account_id)?.role ?? '';
  return { org, role };
}
