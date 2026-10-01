"""Payments domain app.

Fares are settled by hand: a student pays their driver in cash or by direct
bank transfer, marks the trip as paid, and the assigned driver confirms they
received the money. There is no payment provider, so no API keys or webhook
secrets are involved.

An in-app wallet/balance is intentionally not modelled yet; the student wallet
is a frontend placeholder until that product exists.
"""
