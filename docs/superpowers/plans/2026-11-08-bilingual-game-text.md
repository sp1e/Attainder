# Swedish and English game text

The owner requires the game to be playable in Swedish and English through Options, and requires the translations to be written now. Codex owns the translation data; Claude owns runtime integration. This plan covers the actual text delivery, with the integration gaps recorded separately.

## Global Constraints

- Preserve Swedish originals, canonical IDs, saved values, dates, numbers, uncertainty, historical attribution and template variables.
- Translate every authoritative player-facing source once. Keep bibliographic titles, original quotations and attested personal name forms in their original languages.
- Do not modify JavaScript, JSX, MJS, tests, build inputs owned by Claude, generated packages or release manifests.
- Translation is not a new historical source review. Existing approvals, held records and source retrieval claims remain unchanged.
- Reuse existing aligned English and Swedish language entries when context matches. Do not reverse ambiguous dictionary entries blindly.
- Use UTF-8, read back each deliverable and independently review translation meaning and coverage. Run existing checks appropriate to data changes.
- Public notes are English and contain no machine-specific paths or private reports.

## Task 1: Historical event translations

Translate all 2,055 Swedish display fields in the 449-event catalog at revision 467ba0853da5c1c53fb9fd124ae118c3524615cf. Work from nine immutable input shards. Return all exact keys with English values, preserving the full source meaning. Include date notes and geography. Use conventional English historical names where established. Preserve competing dates and qualifications. Validate exact key closure and empty values, and review the complete bilingual output. Publish as a translation sidecar without changing the approved catalog.

## Task 2: Historical starts and names

Translate court dossier display fields, map review display fields, culture inventory names and name-pool explanations. Keep attested names and original source quotations unchanged. Use stable entity identifiers and source field references. Record fields deliberately retained as proper names. Review the bilingual output and verify source field coverage. Task 3 handles builder phrases with the other AST-derived text.

Also translate explanatory source-locator and institution prose into Swedish for the source panel. Keep official institution names, quoted section titles and archival identifiers in their original form. Every input key receives a translation or an explicit unchanged-name classification; none is silently omitted.

## Task 3: Rules, interface and model-facing language requirements

Classify the current AST inventory and the missing entries from the existing language extractor. Translate player-facing Swedish text into English and uncovered English UI text into Swedish. Include authoritative builder display phrases, action labels, outcomes, life events, tooltips, accessible labels, loading and error messages. Preserve placeholders and supply full sentence variants where a template embeds Swedish grammar. Record internal identifiers and development-only exclusions. Supply language-specific prompt prose as data where the model currently requires Swedish. Gameplay help served inside the app is in scope; developer documentation remains English. Do not change runtime code.

## Task 4: Integration contract, review and publication

Document how to consume the translated data and the current runtime gaps: English translator bypass, excluded start card, hardcoded campaign language, model language settings and English error filtering. Validate completeness against authoritative sources and existing packages. Obtain independent broad review of the final diff, publish a PR, wait for current-head required CI, merge under the standing mandate and verify remote bytes. Record prepared translations separately from runtime-tested language switching.
