"""End-to-end check of auto-settling payments and seat-count fares.

Runs against the local Django server: no test doubles, so this exercises the
real serializer validation, the group buyout pricing and the auto-settle.
"""

import json
import random
import string
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8931/api/v1"

PICKUP = {"lat": 6.4541, "lng": 3.3947}
DEST = {"lat": 6.4478, "lng": 3.3729}

passed = 0
failed = 0


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed += 1
        print(f"  FAIL  {label} {detail}")


def call(method, path, body=None, token=None, expect=200):
    req = urllib.request.Request(f"{BASE}{path}", method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = None
    if body is not None:
        data = json.dumps(body).encode()
    try:
        with urllib.request.urlopen(req, data, timeout=20) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"{}")
        except json.JSONDecodeError:
            # Removed routes answer with Django's HTML 404 page.
            return e.code, {"raw": raw[:80].decode("utf-8", "replace")}


def signup(role, email):
    password = "VerifyPass123!"
    status, body = call(
        "POST",
        "/auth/register/",
        {
            "email": email,
            "password": password,
            "confirm_password": password,
            "first_name": "Verify",
            "last_name": role.title(),
            "role": role.upper(),
        },
    )
    if status not in (200, 201):
        raise SystemExit(f"signup failed for {role}: {status} {body}")
    return body["access"], body["user"]["id"], password


def make_group(token, tag, seats_note=""):
    status, body = call(
        "POST",
        "/groups/",
        {
            "name": f"Verify {tag}",
            "pickup_location": "Main Gate",
            "destination": "Lecture Theatre",
            "pickup_lat": PICKUP["lat"],
            "pickup_lng": PICKUP["lng"],
            "destination_lat": DEST["lat"],
            "destination_lng": DEST["lng"],
            "capacity": 4,
            # The frontend now sends these for parity with endpoints that
            # require them up front; a repricing server must ignore them.
            "seats": 1,
            "amount": 150,
            "currency": "NGN",
        },
        token=token,
    )
    if status != 201:
        raise SystemExit(f"group create failed: {status} {body}")
    return body





def main():
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    s_token, s_id, _ = signup("student", f"student-{suffix}@example.com")
    d_token, d_id, _ = signup("driver", f"driver-{suffix}@example.com")
    print(f"student={s_id} driver={d_id} run={suffix}\n")

    print("Group creation exposes authoritative fares")
    group = make_group(s_token, f"{suffix}-a")
    per_seat = float(group["fare_per_seat"])
    check("fare_per_seat is present and positive", per_seat > 0, per_seat)
    check(
        "fare_total == fare_per_seat * capacity",
        abs(float(group["fare_total"]) - per_seat * group["capacity"]) < 0.01,
        f"{group['fare_total']} vs {per_seat * 4}",
    )
    check("remaining_seats == 3 after the creator joins", group["remaining_seats"] == 3, group.get("remaining_seats"))

    print("\nBuyout is priced by the server, not the client")
    status, buy = call(
        "POST",
        f"/groups/{group['id']}/buyout/",
        {"seats": 2, "amount": 1.0},
        token=s_token,
    )
    check("underquoted buyout still accepted at server price", status == 201, status)
    check("2 seats cost 2 x fare_per_seat", abs(float(buy["amount"]) - per_seat * 2) < 0.01, buy.get("amount"))
    check("buyout settles immediately", buy["status"] == "SUCCESSFUL", buy.get("status"))
    check("buyout awaits nothing", buy["awaiting_confirmation"] is False)

    status, bought = call("GET", "/groups/", token=s_token)
    g = next(x for x in bought if x["id"] == group["id"])
    check("partial buyout leaves a seat open", g["remaining_seats"] == 1, g.get("remaining_seats"))

    print("\nOut-of-range seat counts are refused")
    status, _ = call("POST", f"/groups/{group['id']}/buyout/", {"seats": 4}, token=s_token)
    check("cannot buy more seats than are empty", status == 400, status)

    print("\nSeat fares multiply on trip payments")
    call("POST", f"/groups/{group['id']}/buyout/", {"seats": 1}, token=s_token)
    status, full = call("GET", "/groups/", token=s_token)
    g = next(x for x in full if x["id"] == group["id"])
    check("group is now full", g["seats_filled"] == 4 and g["status"] == "FULL", g.get("seats_filled"))

    status, trip = call(
        "POST",
        "/trips/",
        {"group": group["id"], "pickup_location": "Main Gate", "destination": "Lecture Theatre", "fare": per_seat},
        token=s_token,
    )
    check("trip created", status == 201, f"{status} {trip}")
    if status != 201:
        return

    status, _ = call(
        "PATCH",
        "/drivers/availability/",
        {"availability_status": "ONLINE"},
        token=d_token,
    )
    check("driver goes online", status == 200, status)
    status, avail = call("GET", "/trips/available/", token=d_token)
    check("driver sees the request", status == 200 and any(t["id"] == trip["id"] for t in avail))

    status, accepted = call("POST", f"/trips/{trip['id']}/accept/", None, token=d_token)
    check("driver accepts", status == 200 and accepted["status"] == "ACCEPTED", f"{status} {accepted.get('status')}")

    print("\nPayment settles on the student's declaration")
    status, pay = call(
        "POST",
        "/payments/",
        {"trip": trip["id"], "amount": per_seat * 3, "currency": "NGN", "method": "CASH", "seats": 3},
        token=s_token,
    )
    check("3-seat payment accepted", status == 201, f"{status} {pay}")
    check("amount is 3 x fare", abs(float(pay["amount"]) - per_seat * 3) < 0.01, pay.get("amount"))
    check("seats recorded", pay["seats"] == 3, pay.get("seats"))
    check("status is SUCCESSFUL", pay["status"] == "SUCCESSFUL", pay.get("status"))
    check("confirmed_at is set", pay["confirmed_at"] is not None)
    check("awaiting_confirmation is False", pay["awaiting_confirmation"] is False)

    print("\nUnderpaying for multiple seats is rejected")
    # A second group+ride, to test the underquote path on a clean trip.
    group2 = make_group(s_token, f"{suffix}-b")
    call("POST", f"/groups/{group2['id']}/buyout/", {"seats": 3}, token=s_token)
    status, trip2 = call(
        "POST",
        "/trips/",
        {
            "group": group2["id"],
            "pickup_location": "Main Gate",
            "destination": "Lecture Theatre",
            "fare": group2["fare_per_seat"],
        },
        token=s_token,
    )
    call("POST", f"/trips/{trip2['id']}/accept/", None, token=d_token)
    status, err = call(
        "POST",
        "/payments/",
        {
            "trip": trip2["id"],
            "amount": group2["fare_per_seat"],
            "currency": "NGN",
            "method": "CASH",
            "seats": 3,
        },
        token=s_token,
    )
    check("claiming 3 seats at 1-seat price is refused", status == 400, status)

    print("\nDriver confirmation endpoints are gone")
    status, _ = call("POST", f"/payments/{pay['id']}/confirm/", None, token=d_token)
    check("confirm returns 404", status == 404, status)
    status, _ = call("POST", f"/payments/{pay['id']}/reject/", None, token=d_token)
    check("reject returns 404", status == 404, status)

    status, collectable = call("GET", "/payments/collectable/", token=d_token)
    check(
        "driver sees collected fares, all settled",
        status == 200 and all(p["status"] == "SUCCESSFUL" for p in collectable),
        [p["status"] for p in collectable] if status == 200 else status,
    )

    print(f"\n{passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())