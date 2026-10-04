#!/usr/bin/env python3
"""Create/replay the atlas demo account only on the isolated loopback fixture."""
import hashlib
import json
from pathlib import Path
import re
import urllib.error
import urllib.request

BASE = "http://localhost:8799"
EMAIL = "atlas-user@example.test"
PASSWORD = "Atlas-demo-2026!"
DATA = Path(__file__).resolve().parents[1] / "2026-10-03/test-user/recognition-result.json"
cookie = ""
csrf = ""


def request(method, path, body=None, key=None):
    headers = {"Origin": BASE, "Content-Type": "application/json"}
    if cookie:
        headers.update({"Cookie": cookie, "X-CSRF-Token": csrf})
    if key:
        headers["Idempotency-Key"] = key
    req = urllib.request.Request(BASE + path, method=method, headers=headers,
                                 data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.load(response), response.headers


try:
    identity, headers = request("POST", "/api/auth/signup", {
        "email": EMAIL, "password": PASSWORD, "displayName": "Тестовый путешественник",
    })
except urllib.error.HTTPError as error:
    if error.code != 409:
        raise
    identity, headers = request("POST", "/api/auth/signin", {"email": EMAIL, "password": PASSWORD})

values = {}
for header in headers.get_all("Set-Cookie", []):
    for name, value in re.findall(r"(kuuki_auth_session|kuuki_session|kuuki_csrf)=([^;,]+)", header):
        values[name] = value
session_name = "kuuki_auth_session" if values.get("kuuki_auth_session") else "kuuki_session"
if not values.get(session_name) or not values.get("kuuki_csrf"):
    raise RuntimeError("Fixture did not issue both cookies")
cookie = f"{session_name}={values[session_name]}; kuuki_csrf={values['kuuki_csrf']}"
csrf = values["kuuki_csrf"]
request("PATCH", "/api/profiles/me", {
    "username": "test-traveler", "display_name": "Тестовый путешественник", "locale": "ru",
    "bio": "Локальный тестовый профиль для карты экранов", "is_public": True,
    "show_on_leaderboards": True, "home_airport": "TBS",
})
data = json.loads(DATA.read_text())
saved = 0
for record in data["records"]:
    if record["status"] != "accepted":
        continue
    flight = record["flight"]
    digest = hashlib.sha256(json.dumps(flight, sort_keys=True).encode()).hexdigest()[:24]
    result, _ = request("POST", "/api/flights", flight, key=f"atlas-{record['id']}-{digest}")
    if result.get("derived_state") != "ready":
        raise RuntimeError(f"Derived state incomplete for {record['id']}")
    saved += 1
flights, _ = request("GET", "/api/flights?limit=200")
stats, _ = request("GET", "/api/me/stats")
print(json.dumps({"email": EMAIL, "username": "test-traveler", "prepared_flights": saved,
                  "account_flights": flights["total"], "source_counts": data["counts"],
                  "stats": stats}, ensure_ascii=False, indent=2))
