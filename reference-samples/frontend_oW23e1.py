import uuid
import requests
import streamlit as st

API_URL = "http://localhost:8000/chat"

st.set_page_config(page_title="Bedrock Transfer Guard", layout="wide")
st.title("Wire Transfer Assistant (Bedrock + Return of Control)")

if "session_id" not in st.session_state:
  st.session_state.session_id = f"sess-{uuid.uuid4().hex[:10]}"
if "messages" not in st.session_state:
  st.session_state.messages = []
if "audits" not in st.session_state:
  st.session_state.audits = []

with st.sidebar:
  st.header("Compliance Audit Log")
  st.caption(f"Session ID: `{st.session_state.session_id}`")
  if st.button("New Session"):
    st.session_state.session_id = f"sess-{uuid.uuid4().hex[:10]}"
    st.session_state.messages = []
    st.session_state.audits = []
    st.rerun()

  for audit in reversed(st.session_state.audits):
    decision = audit.get("decision", "UNKNOWN")
    if decision == "APPROVED":
      st.success(f"**{decision}** — ${audit['amount']:,.2f} ({audit['iso_code']})")
    else:
      st.error(
          f"**{decision}** — ${audit.get('amount', 0):,.2f}"
          f" ({audit.get('country', '')})"
      )
    st.json(audit)

for msg in st.session_state.messages:
  with st.chat_message(msg["role"]):
    st.markdown(msg["content"])

if prompt := st.chat_input(
    "e.g., Send $5,000 to Alice in Canada, or Send $12,000 to Bob in Somalia"
):
  st.session_state.messages.append({"role": "user", "content": prompt})
  with st.chat_message("user"):
    st.markdown(prompt)

  with st.chat_message("assistant"):
    with st.spinner("Evaluating transfer request..."):
      resp = requests.post(
          API_URL,
          json={"session_id": st.session_state.session_id, "message": prompt},
          timeout=60,
      )
      if resp.ok:
        data = resp.json()
        reply = data["reply"]
        st.session_state.audits.extend(data.get("audit_events", []))
      else:
        reply = f"Backend error: {resp.text}"

      st.markdown(reply)
      st.session_state.messages.append({"role": "assistant", "content": reply})
      st.rerun()
