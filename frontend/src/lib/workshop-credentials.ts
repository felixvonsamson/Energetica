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
 * A cell as CSV writes it. A cell holding a comma, a quote or a line break is
 * quoted. A cell starting with `=`, `+`, `-` or `@` gets a leading apostrophe,
 * so a spreadsheet shows it as text rather than running it as a formula.
 */
function csvCell(value: string): string {
    const text = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** `team,username,password`, one line per account. */
export function credentialsCsv(accounts: CredentialLine[]): string {
    const rows = [
        ["team", "username", "password"],
        ...accounts.map((a) => [a.team, a.username, a.password]),
    ];
    return rows.map((row) => row.map(csvCell).join(",") + "\r\n").join("");
}
