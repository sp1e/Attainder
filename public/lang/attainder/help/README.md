# Attainder help text

This catalog supplies 32 adapted guide pages in Swedish and English, plus shared navigation and shell text. The 398 paired fields have received bilingual and source review. The source snapshot is recorded in `manifest.json`; its page evidence was also checked against the revision named by `verifiedAgainstRevision`.

Read `manifest.json` for page files, canonical routes, section counts and SHA-256 file identities. A page uses `attainder-help-page-v1`: `title`, `nav`, `description`, and each section's `title` and Markdown `body` contain `sv` and `en`. Section IDs and routes remain the same in both languages. Evidence references identify the implementation at the pinned source revision; upstream file hashes identify the original help used for adaptation. `topicDispositions`, where present, explain which original topics were retained, changed or excluded.

`navigation.json` supplies the reading order and six paired section labels. Page navigation labels come from the referenced page. `shell.json` supplies shared controls, accessible labels, the current-guide note and the complete upstream legal notice.

The content describes the current historical game. It distinguishes dynasty controls from general country tools that are available only in campaigns without a character system. Older upstream beta features are not treated as present merely because their help pages exist.

These JSON files are data for integration. The current wiki generator does not load this catalog. Integration must select the Options locale, render both language variants, build localized search indexes, set document language, and verify navigation and language changes in the browser. Preserve original upstream help separately, and retain Open Historia attribution and AGPL notices, including the original subject of the legal notice in `shell.json`.
