from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class ContributionBounds:
    planned_weekly_min: float = 0.0
    planned_weekly_max: float = 80.0
    actual_weekly_min: float = 0.0
    actual_weekly_max: float = 140.0

    def __post_init__(self) -> None:
        if self.planned_weekly_max <= self.planned_weekly_min:
            raise ValueError("planned_weekly_max must be greater than planned_weekly_min")
        if self.actual_weekly_max <= self.actual_weekly_min:
            raise ValueError("actual_weekly_max must be greater than actual_weekly_min")

    def clip_planned(self, value: float) -> float:
        return min(max(value, self.planned_weekly_min), self.planned_weekly_max)

    def clip_actual(self, value: float) -> float:
        return min(max(value, self.actual_weekly_min), self.actual_weekly_max)


@dataclass(frozen=True, slots=True)
class EpsilonSplit:
    planned_sum: float = 0.3
    actual_sum: float = 0.7

    def __post_init__(self) -> None:
        if self.planned_sum <= 0 or self.actual_sum <= 0:
            raise ValueError("all epsilon split components must be positive")

    @property
    def total(self) -> float:
        return self.planned_sum + self.actual_sum


@dataclass(frozen=True, slots=True)
class ReleasePolicyConfig:
    k_min: int = 11
    activation_weeks: int = 2
    deactivation_grace_weeks: int = 2
    publish_counts: bool = False
    dominance_threshold: float = 0.30

    def __post_init__(self) -> None:
        if self.k_min < 1:
            raise ValueError("k_min must be at least 1")
        if self.activation_weeks < 1:
            raise ValueError("activation_weeks must be at least 1")
        if self.deactivation_grace_weeks < 1:
            raise ValueError("deactivation_grace_weeks must be at least 1")
        if not (0.0 < self.dominance_threshold <= 1.0):
            raise ValueError("dominance_threshold must be in (0, 1]")


@dataclass(frozen=True, slots=True)
class DPGroupStatsV1Config:
    bounds: ContributionBounds = field(default_factory=ContributionBounds)
    epsilon_split: EpsilonSplit = field(default_factory=EpsilonSplit)
    release_policy: ReleasePolicyConfig = field(default_factory=ReleasePolicyConfig)
    annual_epsilon_cap: float | None = None

    def __post_init__(self) -> None:
        if self.annual_epsilon_cap is not None:
            annual_spend = self.epsilon_split.total * 52
            if annual_spend > self.annual_epsilon_cap:
                raise ValueError(
                    f"Weekly ε ({self.epsilon_split.total}) × 52 = {annual_spend} "
                    f"exceeds annual cap ({self.annual_epsilon_cap})"
                )
