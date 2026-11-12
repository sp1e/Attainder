// The character panel writes a date as "25/12 800 e.Kr." or "1/2 300 f.Kr."
// (dateLabel in CharactersPanel.jsx and ActionBox.jsx). A pattern cannot turn
// a month number into a month name, so English mode reads these with a rule:
// "25 December AD 800", "1 February 300 BC".

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DATE_LABEL = /^(\d{1,2})\/(\d{1,2}) (\d{1,6}) (e|f)\.Kr\.$/;

// The English form of a Swedish date label, or null for any other text.
export const englishDateLabel = (text) => {
  if (typeof text !== "string") return null;
  const match = DATE_LABEL.exec(text.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[Number(match[2]) - 1];
  if (!month || day < 1 || day > 31) return null;
  return match[4] === "e" ? `${day} ${month} AD ${match[3]}` : `${day} ${month} ${match[3]} BC`;
};

// The engine writes a number into its sentences with a decimal comma ("−13,8 silver"). One or two digits after
// the comma are a decimal; three would be an English thousands group and are left alone.
const DECIMAL_COMMA = /^([+−-]?\d+),(\d{1,2})$/;
export const englishDecimal = (text) => {
  if (typeof text !== "string") return null;
  const match = DECIMAL_COMMA.exec(text.trim());
  return match ? `${match[1]}.${match[2]}` : null;
};

// What English mode reads by rule: a date label or a decimal number.
export const englishValue = (text) => englishDateLabel(text) ?? englishDecimal(text);
