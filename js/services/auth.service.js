/**
 * 登入與可見範圍。
 * 帳號必須為啟用。組織必須有效。
 * 營養師可看同組織的球員。
 * 教練只可看指派期間內的球員。
 */
import { accounts, coaches, nutritionists, organizations, players } from "../api/athlete.api.js";
const UI_ROLE = { nutritionist: "nutritionist", coach: "coach", athlete: "player" };
export async function directory() {
  const [organizationRows, accountRows, nutritionistRows, coachRows, playerRows] = await Promise.all([
    organizations.list(),
    accounts.list(),
    nutritionists.list(),
    coaches.list(),
    players.list(),
  ]);
  return presentAccounts(
    organizationRows,
    accountRows,
    nutritionistRows,
    coachRows,
    playerRows,
  );
}
export function presentAccounts(organizations, accounts, nutritionists, coaches, players) {
  return accounts.map((account) => {
    const organization = organizations.find((item) => item.id === account.organizationId);
    const name =
      account.role === "nutritionist"
        ? nutritionists.find((item) => item.accountId === account.id)?.name
        : account.role === "coach"
          ? coaches.find((item) => item.accountId === account.id)?.name
          : players.find((item) => item.accountId === account.id)?.name;
    return {
      id: account.id,
      email: account.email,
      role: account.role,
      uiRole: UI_ROLE[account.role] || account.role,
      status: account.status,
      name: name || account.email,
      organizationId: account.organizationId,
      organizationName: organization?.name || "",
      organizationStatus: organization?.status || "inactive",
      athleteId: players.find((item) => item.accountId === account.id)?.id || null,
    };
  });
}
export function signInError(account) {
  if (!account || account.status === "disabled") return "找不到這個帳號";
  if (account.status === "suspended") return "這個帳號已停權，不能登入";
  if (account.organizationStatus !== "active") return "所屬組織已停用，不能登入";
  if (account.status !== "active") return "這個帳號不能登入";
  return "";
}
/** 營養師看同組織。教練看指派期間內的球員。球員只看自己。 */
export function visibleAthleteIds(account, tables, date) {
  if (!account) return tables.players.map((player) => player.id);
  if (account.role === "nutritionist") {
    const memberIds = new Set(
      tables.accounts
        .filter(
          (item) =>
            item.organizationId === account.organizationId && item.role === "athlete",
        )
        .map((item) => item.id),
    );
    return tables.players
      .filter((player) => memberIds.has(player.accountId))
      .map((player) => player.id);
  }
  if (account.role === "coach") {
    const coach = tables.coaches.find((item) => item.accountId === account.id);
    return tables.athleteCoaches
      .filter(
        (row) =>
          row.coachId === coach?.id &&
          row.startDate <= date &&
          (row.endDate == null || row.endDate >= date),
      )
      .map((row) => row.athleteId);
  }
    return account.athleteId ? [account.athleteId] : [];
}
export function activeCoaches(assignments, coaches, athleteId, date) {
  return (assignments || [])
    .filter(
      (row) =>
        row.athleteId === athleteId &&
        row.startDate <= date &&
        (row.endDate == null || row.endDate >= date),
    )
    .map((row) => coaches.find((coach) => coach.id === row.coachId)?.name)
    .filter(Boolean);
}
