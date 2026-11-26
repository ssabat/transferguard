import os
import boto3
from compliance import evaluate_and_execute_transfer
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Bedrock Transfer Compliance API")

REGION = os.getenv("AWS_REGION", "us-east-1")
AGENT_ID = os.getenv("BEDROCK_AGENT_ID", "")
AGENT_ALIAS_ID = os.getenv("BEDROCK_AGENT_ALIAS_ID", "")

bedrock_runtime = boto3.client("bedrock-agent-runtime", region_name=REGION)


class ChatRequest(BaseModel):
  session_id: str
  message: str


class ChatResponse(BaseModel):
  reply: str
  audit_events: list[dict]


def invoke_with_roc(
    session_id: str,
    input_text: str | None = None,
    session_state: dict | None = None,
    audit_events: list[dict] | None = None,
) -> tuple[str, list[dict]]:
  if audit_events is None:
    audit_events = []

  kwargs = {
      "agentId": AGENT_ID,
      "agentAliasId": AGENT_ALIAS_ID,
      "sessionId": session_id,
  }
  if input_text:
    kwargs["inputText"] = input_text
  if session_state:
    kwargs["sessionState"] = session_state

  response = bedrock_runtime.invoke_agent(**kwargs)
  text_chunks = []

  for event in response["completion"]:
    if "chunk" in event:
      text_chunks.append(event["chunk"]["bytes"].decode("utf-8"))

    elif "returnControl" in event:
      rc = event["returnControl"]
      invocation_id = rc["invocationId"]
      results = []

      for item in rc["invocationInputs"]:
        fn_input = item["functionInvocationInput"]
        raw_params = {
            p["name"]: p["value"] for p in fn_input.get("parameters", [])
        }

        outcome = evaluate_and_execute_transfer(raw_params)
        audit_events.append(outcome["audit"])

        results.append({
            "functionResult": {
                "actionGroup": fn_input["actionGroup"],
                "function": fn_input["function"],
                "responseState": outcome["status"],
                "responseBody": {"TEXT": {"body": outcome["reason"]}},
            }
        })

      followup_state = {
          "invocationId": invocation_id,
          "returnControlInvocationResults": results,
      }
      nested_text, audit_events = invoke_with_roc(
          session_id=session_id,
          session_state=followup_state,
          audit_events=audit_events,
      )
      text_chunks.append(nested_text)

  return "".join(text_chunks), audit_events


@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
  if not AGENT_ID or not AGENT_ALIAS_ID:
    raise HTTPException(
        status_code=500, detail="Bedrock Agent environment variables not set."
    )
  try:
    reply, audits = invoke_with_roc(
        session_id=req.session_id, input_text=req.message
    )
    return ChatResponse(reply=reply, audit_events=audits)
  except Exception as exc:
    raise HTTPException(status_code=500, detail=str(exc)) from exc
