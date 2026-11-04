/*! Open Historia — the words that say territory moved © 2026 Nicholas Krol, AGPL-3.0-or-later (see LICENSE). */
// Import-free, so the patterns can be tested under bare node (gameplay.js cannot be).
//
// Event text that claims control changed hands (capture verbs) or that legal
// sovereignty moved (cession, annexation, treaty). Word-boundary anchored so
// "preoccupied" never matches; deliberately narrow so a defensive battle that
// moved no borders never trips the reluctance guards in gameplay.js.
// "sold to" and never bare "sold": in Swedish narration sold is a soldier's pay.
export const CONTROL_CHANGE_LANGUAGE = /\b(captur\w*|seiz\w*|conquer\w*|occup(?:y|ies|ied|ation)|overr[au]n|liberat\w*|retak\w*|retaken|recaptur\w*|fell to|falls? to|takes? control|assumes? control)\b/i;
export const LEGAL_TRANSFER_LANGUAGE = /\b(annex\w*|cedes?|ceded|ceding|cession|sovereignty (?:passes|transfers?|is transferred)|treaty transfer|formal(?:ly)? transfer(?:red)?|incorporat\w*|unification|territorial award|sold to|sale of territory)\b/i;
