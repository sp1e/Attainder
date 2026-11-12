import { getStoredLanguage } from './i18n.js';

// The language the models write in for a character campaign. The court is written in Swedish and has an English
// reading (the native phrase book), so the Options choice English gives English and every other choice keeps Swedish.
// Everything here is pure; only the default arguments read the stored Options language.
const ENGLISH_CODE = 'en';

/** 'English' when the Options language is English, otherwise 'Swedish'. */
export const characterLanguage = (code = getStoredLanguage()) => (code === ENGLISH_CODE ? 'English' : 'Swedish');

/** The same rule as a language code: 'en' or 'sv'. */
export const characterLanguageCode = (code = getStoredLanguage()) => (code === ENGLISH_CODE ? 'en' : 'sv');

/**
 * The sentences that keep a model in `language` although the campaign data it reads (names, labels, stories, memories)
 * is Swedish. Swedish gets the empty string: data and answer share one language there, each prompt already names
 * Swedish where it asks for text, and the Swedish prompts stay word for word as they were.
 */
export const dataLanguageClause = (language) => (language === 'Swedish' ? ''
  : `The campaign data is written in Swedish. Write every sentence of your answer in ${language}, whatever language the data or the player's text is in. Copy ids, keys and option values exactly as given. When the data has englishNames, write each name it lists the way it gives it: that is the name the player reads.`);

/** True for a campaign that runs the character system: the dynasty scenario and every historical start. */
export const isCharacterCampaign = (world) => Boolean(world?.characterSystem);

/**
 * The language the simulation prompts name for one campaign. A character campaign follows the Options choice, also
 * when its save or package states another language (the shipped packages say 'Svenska'). Any other campaign keeps
 * the language of its world or game.
 */
export const campaignPromptLanguage = (world, game, language = characterLanguage()) => (
  isCharacterCampaign(world) ? language : world?.language || game?.language || 'English');

// The locale the character views write numbers in: a decimal comma in Swedish,
// a decimal point in English.
export const characterNumberLocale = (code = getStoredLanguage()) => (characterLanguageCode(code) === 'en' ? 'en-GB' : 'sv-SE');
