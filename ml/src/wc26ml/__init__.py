"""WC26 Continental Chaos Board — offline ML pipeline.

Runs in GitHub Actions (no paid infra), publishes static JSON to public/oracle/.
Pipeline order (PLAN.md §6): ingest → elo → goals_model → simulate → insights → publish.
Phase 2+ fills in the stubs below; the public function/CLI surface is fixed here.
"""

__version__ = "0.1.0"
