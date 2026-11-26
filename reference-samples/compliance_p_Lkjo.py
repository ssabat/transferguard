import uuid
import pycountry

MAX_TRANSFER_USD = 10000.0
BLOCKED_ISO_ALPHA2 = {"SO", "AF"}  # Somalia, Afghanistan


def normalize_country_to_alpha2(country_input: str) -> str | None:
  cleaned = country_input.strip()
  if not cleaned:
    return None

  # Check exact alpha-2 or alpha-3 codes first
  upper = cleaned.upper()
  if len(upper) == 2 and pycountry.countries.get(alpha_2=upper):
    return upper
  if len(upper) == 3:
    match = pycountry.countries.get(alpha_3=upper)
    if match:
      return match.alpha_2

  # Fuzzy lookup by common or official country name
  try:
    matches = pycountry.countries.search_fuzzy(cleaned)
    if matches:
      return matches[0].alpha_2
  except LookupError:
    return None
  return None


def evaluate_and_execute_transfer(params: dict) -> dict:
  try:
    amount = float(params.get("amount", 0))
  except (TypeError, ValueError):
    return {
        "status": "FAILURE",
        "reason": "Invalid transfer amount provided.",
        "audit": {"amount": params.get("amount"), "decision": "BLOCKED"},
    }

  country_raw = str(params.get("destination_country", "")).strip()
  recipient = str(params.get("recipient", "")).strip()
  iso_code = normalize_country_to_alpha2(country_raw)

  # Rule 1: Reject transfers strictly above $10,000
  if amount > MAX_TRANSFER_USD:
    reason = (
        f"Blocked by policy: Transfer amount (${amount:,.2f}) exceeds the "
        f"${MAX_TRANSFER_USD:,.2f} single-transaction limit."
    )
    return {
        "status": "FAILURE",
        "reason": reason,
        "audit": {
            "amount": amount,
            "country": country_raw,
            "iso_code": iso_code or "UNKNOWN",
            "recipient": recipient,
            "decision": "BLOCKED_AMOUNT_LIMIT",
        },
    }

  # Rule 2: Reject unrecognized or restricted countries (Somalia, Afghanistan)
  if not iso_code:
    reason = (
        "Blocked by policy: Unable to verify destination country"
        f" '{country_raw}'."
    )
    return {
        "status": "FAILURE",
        "reason": reason,
        "audit": {
            "amount": amount,
            "country": country_raw,
            "iso_code": "UNVERIFIED",
            "recipient": recipient,
            "decision": "BLOCKED_UNVERIFIED_COUNTRY",
        },
    }

  if iso_code in BLOCKED_ISO_ALPHA2:
    country_obj = pycountry.countries.get(alpha_2=iso_code)
    country_name = country_obj.name if country_obj else country_raw
    reason = (
        f"Blocked by policy: Transfers to {country_name} ({iso_code}) are"
        " prohibited under high-risk jurisdiction rules."
    )
    return {
        "status": "FAILURE",
        "reason": reason,
        "audit": {
            "amount": amount,
            "country": country_name,
            "iso_code": iso_code,
            "recipient": recipient,
            "decision": "BLOCKED_RESTRICTED_COUNTRY",
        },
    }

  # Rule 3: Safe to execute transfer
  tx_id = f"TX-{uuid.uuid4().hex[:8].upper()}"
  return {
      "status": "SUCCESS",
      "reason": (
          f"Approved and executed: ${amount:,.2f} sent to {recipient} in "
          f"{iso_code}. Confirmation ID: {tx_id}."
      ),
      "audit": {
          "transaction_id": tx_id,
          "amount": amount,
          "country": country_raw,
          "iso_code": iso_code,
          "recipient": recipient,
          "decision": "APPROVED",
      },
  }
