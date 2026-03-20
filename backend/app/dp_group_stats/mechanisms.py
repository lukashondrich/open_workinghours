from __future__ import annotations

import secrets
from typing import Protocol


class _UniformRng(Protocol):
    def uniform(self, a: float, b: float) -> float: ...


def laplace_noise(epsilon: float, sensitivity: float, rng: _UniformRng | None = None) -> float:
    if epsilon <= 0:
        raise ValueError("epsilon must be positive")
    if sensitivity < 0:
        raise ValueError("sensitivity must be non-negative")
    if sensitivity == 0:
        return 0.0

    scale = sensitivity / epsilon
    rand = rng if rng is not None else secrets.SystemRandom()
    u = rand.uniform(-0.5, 0.5)

    if u < 0:
        return scale * (1 + u * 2)
    return -scale * (1 - u * 2)
