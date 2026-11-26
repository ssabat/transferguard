// The package root dynamically requires every locale, which fails in standalone server bundles.
import * as countries from "i18n-iso-countries/index.js";
import en from "i18n-iso-countries/langs/en.json";

countries.registerLocale(en);
export const MAX_CENTS = 1_000_000;
const restricted = new Set(["AF", "SO"]);
const aliases: Record<string, string> = {
  usa: "US",
  uk: "GB",
  "u.k.": "GB",
  "u.s.": "US",
  "u.s.a.": "US",
  "south korea": "KR",
  "north korea": "KP",
  "united states of america": "US",
  uae: "AE",
};
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function countryCode(raw: string) {
  const text = raw.trim();
  const code = text.toUpperCase();
  if (Object.hasOwn(aliases, text.toLowerCase())) return aliases[text.toLowerCase()];
  if (/^[A-Z]{2}$/.test(code) && countries.isValid(code)) return code;
  if (/^[A-Z]{3}$/.test(code)) return countries.alpha3ToAlpha2(code) ?? null;
  return countries.getAlpha2Code(text, "en") ?? null;
}

export function parseAmount(raw: string) {
  const clean = raw
    .trim()
    .replace(/^USD\s*/i, "")
    .replace(/^\$\s*/, "")
    .replace(/\s*USD$/i, "");
  if (!/^(?:\d{1,12}|\d{1,3}(?:,\d{3}){1,3})(?:\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.replaceAll(",", "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export type Proposal = { amount: string; destination_country: string; recipient: string };

export function evaluate(proposal: Proposal) {
  const amountInput = proposal.amount.trim().slice(0, 64);
  const amountCents = parseAmount(amountInput);
  const rawCountry = proposal.destination_country.trim().slice(0, 120);
  const isoCode = countryCode(rawCountry);
  const country = (isoCode && countries.getName(isoCode, "en")) || rawCountry;
  const recipient = proposal.recipient.trim().slice(0, 120);
  const details = {
    amountCents,
    amountInput,
    country,
    isoCode,
    recipient,
    reference: null as string | null,
  };
  if (amountCents === null)
    return {
      ...details,
      decision: "BLOCKED_INVALID_AMOUNT" as const,
      reason: "Enter a positive USD amount with no more than two decimal places.",
    };
  const formatted = usd.format(amountCents / 100);
  if (amountCents > MAX_CENTS)
    return {
      ...details,
      decision: "BLOCKED_AMOUNT_LIMIT" as const,
      reason: `${formatted} exceeds the $10,000.00 single-transfer limit.`,
    };
  if (!isoCode)
    return {
      ...details,
      decision: "BLOCKED_UNVERIFIED_COUNTRY" as const,
      reason: "The destination could not be verified. Use a country name or an ISO country code.",
    };
  if (restricted.has(isoCode))
    return {
      ...details,
      decision: "BLOCKED_RESTRICTED_COUNTRY" as const,
      reason: `Transfers to ${country} (${isoCode}) are blocked by the sandbox policy.`,
    };
  if (!recipient)
    return {
      ...details,
      decision: "BLOCKED_MISSING_RECIPIENT" as const,
      reason: "A recipient name is required.",
    };
  const reference = `SIM-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  return {
    ...details,
    reference,
    decision: "APPROVED" as const,
    reason: `${formatted} to ${recipient} in ${country} passed the sandbox policy. No funds were moved.`,
  };
}

export type Evaluation = ReturnType<typeof evaluate>;

export function demoProposal(text: string): Proposal | null {
  const normalized = text.trim().replace(/[.!?]+$/, "");
  const match = normalized.match(
    /^(?:(?:please\s+)?(?:send|transfer|wire|simulate(?:\s+(?:a\s+)?(?:transfer\s+of)?)?)\s+)(.{1,64}?)\s+to\s+([^\n]{1,120}?)\s+in\s+([^\n]{1,120})$/i,
  );
  return match ? { amount: match[1], recipient: match[2], destination_country: match[3] } : null;
}
