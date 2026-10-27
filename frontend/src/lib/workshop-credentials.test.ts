import { describe, expect, it } from "vitest";

import { credentialsCsv, credentialSlips } from "./workshop-credentials";

const ACCOUNTS = [
    { team: "Axpo", username: "Laufenbourg", password: "k7mp3xq9rt" },
    { team: "Axpo", username: "Regensdorf", password: "b4nw8zd2hc" },
    { team: "Romande Energie", username: "Romanel", password: "u5ye6gvj2s" },
];

describe("credentialSlips", () => {
    it("gives each team one slip, in the order the teams come", () => {
        expect(credentialSlips(ACCOUNTS)).toEqual([
            { team: "Axpo", accounts: ACCOUNTS.slice(0, 2) },
            { team: "Romande Energie", accounts: ACCOUNTS.slice(2) },
        ]);
    });

    it("gives no slips without accounts", () => {
        expect(credentialSlips([])).toEqual([]);
    });
});

describe("credentialsCsv", () => {
    it("has a header and one line per account", () => {
        expect(credentialsCsv(ACCOUNTS)).toBe(
            "team,username,password\r\n" +
                "Axpo,Laufenbourg,k7mp3xq9rt\r\n" +
                "Axpo,Regensdorf,b4nw8zd2hc\r\n" +
                "Romande Energie,Romanel,u5ye6gvj2s\r\n",
        );
    });

    it("quotes a cell holding a comma, a quote or a line break", () => {
        expect(
            credentialsCsv([
                { team: 'Axpo, "Nord"', username: "a", password: "b" },
            ]),
        ).toBe('team,username,password\r\n"Axpo, ""Nord""",a,b\r\n');
    });

    it("leaves a cell that looks like a formula as it is", () => {
        expect(
            credentialsCsv([{ team: "=1+1", username: "-a", password: "b" }]),
        ).toBe("team,username,password\r\n=1+1,-a,b\r\n");
    });
});
