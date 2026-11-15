/**
 * The credentials of a Workshop Run with teams (#1385): one printed slip per
 * team, and the CSV the facilitator downloads.
 */

import type { ApiSchema } from "@/types/api-helpers";

type CredentialLine = ApiSchema<"CredentialLine">;

/** One team's slip: its name and its accounts. */
export interface CredentialSlip {
    team: string;
    accounts: CredentialLine[];
}

/** One slip per team, in the order the teams first come in `accounts`. */
export function credentialSlips(accounts: CredentialLine[]): CredentialSlip[] {
    const slips = new Map<string, CredentialLine[]>();
    for (const account of accounts) {
        const slip = slips.get(account.team);
        if (slip) slip.push(account);
        else slips.set(account.team, [account]);
    }
    return [...slips].map(([team, members]) => ({ team, accounts: members }));
}

/**
 * A cell as CSV writes it: quoted if it holds a comma, a quote or a line break.
 * It is never changed otherwise, since the CSV must hold the exact usernames
 * and passwords that log in.
 */
function csvCell(value: string): string {
    return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** `team,username,password`, one line per account. */
export function credentialsCsv(accounts: CredentialLine[]): string {
    const rows = [
        ["team", "username", "password"],
        ...accounts.map((a) => [a.team, a.username, a.password]),
    ];
    return rows.map((row) => row.map(csvCell).join(",") + "\r\n").join("");
}
