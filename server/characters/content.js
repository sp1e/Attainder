export const SCHEMA_VERSION = 1;
export const RULES_VERSION = 'hadara-1.0.0';
export const CONTENT_VERSION = 'hadara-1.0.0';
export const ADULT_AGE = 18;
export const ARCHETYPES = {
  commander: { name: 'Fältherren', ability: 'Samordnad mobilisering', action: 'mobilize', description: 'Stärk arméns beredskap under tre år. Kräver aktivt härskarmandat.', cost: 35 },
  steward: { name: 'Förvaltaren', ability: 'Förvaltningsreform', action: 'reform', description: 'Reformera skatteförvaltningen i tre år. Familjerna kräver inflytande.', cost: 30 },
  diplomat: { name: 'Diplomaten', ability: 'Försoningsråd', action: 'concord', description: 'Förhandla fram stöd från familjer och religiösa institutioner.', cost: 30 },
  scholar: { name: 'Läraren', ability: 'Kunglig akademi', action: 'academy', description: 'Grunda en bestående akademi som stärker kommande generationers utbildning.', cost: 60 },
  legislator: { name: 'Lagstiftaren', ability: 'Successionsreform', action: 'succession_law', description: 'Inför meriterad rådsutnämning eller återgå till arvsföljd; familjerna reagerar.', cost: 40 },
  guardian: { name: 'Beskyddaren', ability: 'Helgedomsfördrag', action: 'sanctuary', description: 'Säkra religiöst stöd genom ett tidsbundet fördrag.', cost: 30 },
  schemer: { name: 'Intrigören', ability: 'Underrättelsenät', action: 'network', description: 'Upptäck en dold plan och förbättra beredskapen mot maktövertagande.', cost: 25 },
  builder: { name: 'Byggherren', ability: 'Vattenledningsprogram', action: 'aqueduct', description: 'Anlägg vattenledningar. Projektet kan fortsätta under nästa ledare.', cost: 50 },
};
export const TRAITS = {
  ambitious: { name: 'Ambitiös', description: 'Värderar ämbete och erkännande; känner belastning av att ge upp makt.' },
  cautious: { name: 'Försiktig', description: 'Värderar trygghet och motsätter sig oförberedda risker.' },
  compassionate: { name: 'Medkännande', description: 'Vill skydda människor; lider av grymhet och svek.' },
  dutiful: { name: 'Plikttrogen', description: 'Vill fullgöra löften och ämbeten även under personlig konflikt.' },
  greedy: { name: 'Girig', description: 'Värderar egendom och inkomster; ogillar dyra gåvor.' },
  vengeful: { name: 'Hämndlysten', description: 'Minns oförrätter och söker återupprättelse.' },
  gregarious: { name: 'Sällskaplig', description: 'Söker relationer och kan återhämta sig genom gemenskap.' },
  devout: { name: 'From', description: 'Värderar den egna tron och religiösa förpliktelser.' },
  honest: { name: 'Ärlig', description: 'Säger sanningen även när den kostar något.' },
  deceitful: { name: 'Bedräglig', description: 'Ljuger lätt och döljer sina avsikter när det lönar sig.' },
  trusting: { name: 'Godtrogen', description: 'Tror gott om andra och märker sällan att någon spelar ett spel.' },
  paranoid: { name: 'Misstänksam', description: 'Ser hot bakom vänliga ord och litar knappt på någon.' },
  brave: { name: 'Modig', description: 'Möter fara med rak rygg och drar sig inte undan strid.' },
  craven: { name: 'Feg', description: 'Väjer för fara och söker skydd när det blir hett.' },
  calm: { name: 'Lugn', description: 'Behåller fattningen under tryck och väger sina ord.' },
  wrathful: { name: 'Vredgad', description: 'Brusar snabbt upp och handlar i vredesmod.' },
  generous: { name: 'Generös', description: 'Delar med sig av pengar och gunst utan att räkna.' },
  cruel: { name: 'Grym', description: 'Finner nöje i andras lidande och straffar hårt.' },
  diligent: { name: 'Flitig', description: 'Arbetar uthålligt och fullföljer det som är påbörjat.' },
  lazy: { name: 'Lat', description: 'Skyr möda och skjuter upp det som kräver ansträngning.' },
  content: { name: 'Förnöjsam', description: 'Nöjer sig med sin lott och söker sällan mer makt.' },
  zealous: { name: 'Nitisk', description: 'Driver sin tro och sina ideal med brinnande iver.' },
  cynical: { name: 'Cynisk', description: 'Tvivlar på höga ideal och räknar med att alla har baktankar.' },
  just: { name: 'Rättvis', description: 'Dömer efter lag och bevis och behandlar lika fall lika.' },
  arbitrary: { name: 'Godtycklig', description: 'Dömer efter humör och gunst snarare än efter regler.' },
  curious: { name: 'Nyfiken', description: 'Vill veta och prova nytt, gärna det som andra låter vara.' },
};
export const OPPOSITE_TRAITS = [['honest', 'deceitful'], ['trusting', 'paranoid'], ['brave', 'craven'], ['calm', 'wrathful'], ['generous', 'greedy'], ['compassionate', 'cruel'], ['diligent', 'lazy'], ['content', 'ambitious'], ['zealous', 'cynical'], ['just', 'arbitrary']];
export const RULE_PROVENANCE = [
  { id: 'generational-abilities', source: 'https://www.designer-notes.com/old-world-designer-notes-7-characters/', sourceDate: '2021-09-07', dlc: null, kind: 'own-adaptation', description: 'Personbundna förmågor; våra åtta förmågor, kostnader och varaktigheter är egen design.' },
  { id: 'personality-stress', source: 'https://www.reddit.com/r/CrusaderKings/comments/ha32zg/dev_diary_31_stress/', sourceDate: '2020-06-16', dlc: 'CK3 grundsystem', kind: 'own-adaptation', description: 'Personlig kostnad och AI-prioritering; vikter och trösklar är våra.' },
  { id: 'political-opinion', source: 'https://www.designer-notes.com/old-world-designer-notes-8-opinion/', sourceDate: '2021-09-15', dlc: null, kind: 'own-adaptation', description: 'Skilda person- och gruppkanaler. Tjänstelojalitet och stödformler är egna regler.' },
  { id: 'causal-stories', source: 'https://www.designer-notes.com/old-world-designer-notes-9-events/', sourceDate: '2021-09-30', dlc: null, kind: 'own-adaptation', description: 'Händelser återanvänder minnen och deltagare. Våra berättelser och kunskapsregler är egna.' },
  { id: 'separate-inheritance', source: 'https://store.steampowered.com/news/posts/?appids=1158310&enddate=1723550372&feed=steam_community_announcements', sourceDate: '2024-08-13', dlc: 'Roads to Power', kind: 'own-adaptation', description: 'Familjens maktbas skiljs från ämbetet; vår antika successionsmodell är egen.' },
  { id: 'governor-eligibility', source: 'https://mohawkgames.com/2025/05/28/old-world-update-135/', sourceDate: '2025-05-28', dlc: null, kind: 'own-design', description: 'Äldre Garrison-krav används inte. Vårt krav är myndighet, livsstatus och giltig utnämning.' },
  { id: 'campaign-identity', source: 'user-decision:2026-10-30', sourceDate: '2026-10-30', dlc: null, kind: 'user-decision', description: 'Spelaren väljer rike eller familj vid kampanjstart.' },
];
export const FAMILY_SEEDS = [
  { id: 'family-arel', name: 'Arel', color: '#c49b53', religionId: 'dawn', names: ['Arel', 'Iset', 'Sera', 'Tarek', 'Mira', 'Neri'], traits: ['dutiful', 'ambitious'], archetype: 'commander' },
  { id: 'family-namar', name: 'Namar', color: '#a65949', religionId: 'river', names: ['Namar', 'Dara', 'Kelan', 'Talia', 'Eren', 'Lysa'], traits: ['ambitious', 'vengeful'], archetype: 'schemer' },
  { id: 'family-eshmun', name: 'Eshmun', color: '#527c8b', religionId: 'river', names: ['Eshmun', 'Maren', 'Barek', 'Yara', 'Lior', 'Suri'], traits: ['greedy', 'cautious'], archetype: 'steward' },
  { id: 'family-safra', name: 'Safra', color: '#7b648e', religionId: 'dawn', names: ['Safra', 'Amat', 'Danel', 'Reva', 'Tamar', 'Zuri'], traits: ['devout', 'compassionate'], archetype: 'guardian' },
];
export const SKILL_LABELS = { command: 'Befäl', stewardship: 'Förvaltning', diplomacy: 'Diplomati', learning: 'Lärdom', intrigue: 'Intrig', prowess: 'Kampförmåga' };
export const NAME_POOL = ['Adara', 'Belen', 'Ciran', 'Dema', 'Eris', 'Fara', 'Galen', 'Hessa', 'Ilan', 'Jara', 'Keris', 'Luma', 'Meran', 'Nara', 'Orin', 'Pella', 'Ramin', 'Sela', 'Tiran', 'Vera'];
