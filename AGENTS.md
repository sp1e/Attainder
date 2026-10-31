# Attainder contributor instructions

- The project repository is https://github.com/sp1e/Attainder. Publish tested project changes there at development milestones. Verify the remote commit after each push.
- Keep README and new public documentation in English. The current game interface includes Swedish text.
- Preserve upstream attribution and AGPL notices. Do not publish credentials, account sessions, campaign saves, private reports or machine-specific paths.
- Build each phase of the design in `docs/superpowers/specs/` from a written plan in `docs/superpowers/plans/`, with tests first and a review of each task.
- When Claude runs on the owner's private Claude account, the global GitHub CLI account is `sp1e`. Check `gh api user --jq .login` and `git var GIT_AUTHOR_IDENT` before every push; both must name sp1e.
- Other agents and sessions, such as Codex or a Claude session on the owner's work account, leave the shared global GitHub CLI account as it is. They reach this repository with a process-local sp1e token: set `GH_TOKEN` for the single command.
- Run checks appropriate to the change. A successful build does not replace gameplay or visual verification.
- Use the installed stop-slop editorial pass; use slopmonster for English copy when available. Never send drafts to another model without explicit authorization.
