### Spec review

**You own the spec. No code until it passes.**

1. Run the **egm-review** skill on the spec. Read it at `../../egm-review/SKILL.md`.
2. On `PASS`, route the build to the **Feature** playbook for one PR or the **Multi-phase or multi-PR plan** playbook for more. Carry the spec path into that playbook's first step.
3. Without a pass after three rounds, stop. Reply with the open gaps and the decision each one needs from the user.

**Reply.** The spec path, its final status, and the playbook the build routes to.
