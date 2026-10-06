# Django - Service Layer

> Keep business operations out of views. Read this for payment retry, transaction
> boundaries and durable notification delivery.
>
> **Size budget: 8 KB** — `token-budget.mjs --check`.

Use `transaction.atomic` for local database effects. It cannot roll back a remote
charge. Persist a payment intent with a stable attempt identity and frozen amount/
currency before contacting the gateway. Retry ambiguous responses using the same key;
reconcile against the provider receipt. Never mint a fresh key merely because saving
its result failed. Validate authorization and price in the repository, not request data.

This executable service defines adapter contracts rather than pretending a database
transaction includes an external provider:

```python
from dataclasses import dataclass
from typing import Literal, Protocol


@dataclass(frozen=True)
class PaymentIntent:
    key: str
    amount_minor: int
    currency: str
    status: Literal["pending", "paid", "declined"]


@dataclass(frozen=True)
class PaymentResult:
    success: bool
    receipt_id: str


class PaymentStore(Protocol):
    def reserve(self, order_id: str) -> PaymentIntent:
        """Commit or retrieve one frozen intent under a unique order/attempt constraint."""
        ...

    def settle(self, key: str, result: PaymentResult) -> None:
        """Atomically persist receipt, paid order and uniquely keyed notification outbox."""
        ...


class PaymentGateway(Protocol):
    def charge(self, *, amount: int, currency: str, token: str,
               idempotency_key: str) -> PaymentResult:
        """Same key/payload returns the same charge; ambiguous responses raise."""
        ...


class OrderService:
    def __init__(self, store: PaymentStore, gateway: PaymentGateway) -> None:
        self.store = store
        self.gateway = gateway

    def process_payment(self, order_id: str, token: str) -> bool:
        intent = self.store.reserve(order_id)
        if intent.status != "pending":
            return intent.status == "paid"
        result = self.gateway.charge(
            amount=intent.amount_minor,
            currency=intent.currency,
            token=token,
            idempotency_key=intent.key,
        )
        self.store.settle(intent.key, result)
        return result.success
```

Implement `reserve` and `settle` with Django transactions and database uniqueness,
including concurrency-safe conflict handling. `settle` must be idempotent and reject
conflicting receipts; a declined result must not mark the order paid or enqueue a
success notification. Keep tokens out of persisted intents/logs. A worker delivers the
outbox with its own stable notification key; delivery failure leaves retryable state.
An on-commit callback alone is not durable delivery.

Provider idempotency retention can expire: after its guaranteed window, query/reconcile
its original charge before any retry, and stop for explicit recovery if uncertain.
Only a verified terminal decline and explicit new payment attempt may allocate a new
key. Do not use an in-process lock as cross-worker serialization.

Test intent-commit failure (no charge), result-commit failure (one charge on retry),
concurrent retries, lost provider acknowledgment, decline, notification failure and
restart. Add real database uniqueness/rollback and provider contract tests for the
chosen adapters; fake gateways establish orchestration, not provider behavior.

[Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests).
