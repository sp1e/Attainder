// Original Swedish story content. Rules and validation live in eventChains.js.
export default [
  {
    "id": "sickroom_seal",
    "title": "Sigillet utanför sjukrummet",
    "stages": [
      {
        "id": "door_list",
        "title": "Listan vid dörren",
        "prompt": "{steward} har samlat dagens besök på en lista utanför {principal}:s rum. {regent} behöver besked, men hushållets arbete har blivit liggande.",
        "delayMonths": 1,
        "variants": [],
        "choices": [
          {
            "id": "hire_relief",
            "label": "Bekosta hjälp i hushållet",
            "scope": "family",
            "description": "Familjen betalar 12 silver. {steward} får 20 mindre stress; ingen vård eller återhämtning utlovas.",
            "amount": 12,
            "effects": [
              {
                "kind": "stress",
                "target": "steward",
                "delta": -20
              }
            ],
            "flags": {
              "opening": "relief"
            },
            "next": "message_route",
            "tag": "generous"
          },
          {
            "id": "carry_message",
            "label": "Låt hushållets ombud bära fram frågorna",
            "scope": "family",
            "description": "Ingen silverkostnad. Den beslutande aktören får 5 stress av uppgiften; {steward}s åsikt om aktören ökar med 5.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 5
              },
              {
                "kind": "opinion",
                "target": "steward",
                "delta": 5
              }
            ],
            "flags": {
              "opening": "personal_errand"
            },
            "next": "message_route",
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Låt ordinarie rutiner fortsätta",
            "scope": "none",
            "description": "Inga nya åtaganden görs. Ärendet avslutas utan kostnad; den pågående sjukdomen och mandatet följer sina vanliga regler.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "message_route",
        "title": "Vem ska få hushållets frågor?",
        "prompt": "{steward} har samlat hushållets frågor. De kan framföras till {regent} eller gås igenom inom familjen först.",
        "delayMonths": 1,
        "variants": [
          {
            "when": {
              "flag": "opening",
              "equals": "relief"
            },
            "prompt": "Den betalda hjälpen gav {steward} tid att samla frågorna till {regent}. Vem ska få läsa dem först?"
          },
          {
            "when": {
              "flag": "opening",
              "equals": "personal_errand"
            },
            "prompt": "Efter det förra besöket vill {steward} skilja hushållets egna bekymmer från frågorna till {regent}."
          }
        ],
        "choices": [
          {
            "id": "send_questions",
            "label": "Skicka frågorna till regenten",
            "scope": "family",
            "description": "{regent}s åsikt om hushållets beslutande aktör ökar med 3. Aktören får 3 stress av att framföra frågorna; inget svar garanteras.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "regent",
                "delta": 3
              },
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 3
              }
            ],
            "flags": {
              "route": "regent"
            },
            "next": "waiting_work",
            "tag": "duty"
          },
          {
            "id": "family_meeting",
            "label": "Bekosta ett möte inom hushållet",
            "scope": "family",
            "description": "Familjen betalar 5 silver för mötet. {steward}s åsikt om den beslutande aktören ökar med 5; inget tal sker för regentens räkning.",
            "amount": 5,
            "effects": [
              {
                "kind": "opinion",
                "target": "steward",
                "delta": 5
              }
            ],
            "flags": {
              "route": "household"
            },
            "next": "waiting_work",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Lägg frågorna åt sidan",
            "scope": "none",
            "description": "Frågorna arkiveras och kedjan avslutas utan ny kostnad eller relationsförlust.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "waiting_work",
        "title": "Arbetet medan ni väntar",
        "prompt": "Vardagen kring {principal} fortsätter. {steward} frågar om hushållet kan avsätta mer hjälp eller ombudets egen tid.",
        "delayMonths": 1,
        "variants": [
          {
            "when": {
              "flag": "route",
              "equals": "regent"
            },
            "prompt": "Frågorna har skickats till {regent}. Medan hushållet väntar ber {steward} om hjälp med det dagliga arbetet."
          },
          {
            "when": {
              "flag": "route",
              "equals": "household"
            },
            "prompt": "Mötet inom hushållet har hållits. {steward} vill nu veta vem som ska ta hand om det dagliga arbetet."
          }
        ],
        "choices": [
          {
            "id": "fund_tasks",
            "label": "Betala för praktisk avlastning",
            "scope": "family",
            "description": "Familjen betalar 8 silver och {steward}s stress minskar med 10. {principal}:s hälsotillstånd ändras inte av valet.",
            "amount": 8,
            "effects": [
              {
                "kind": "stress",
                "target": "steward",
                "delta": -10
              }
            ],
            "flags": {
              "work": "paid"
            },
            "next": "household_record",
            "tag": "generous"
          },
          {
            "id": "actor_tasks",
            "label": "Låt ombudet ta den extra uppgiften",
            "scope": "family",
            "description": "Hushållets beslutande aktör får 6 stress och {steward} får 6 mindre stress. Ingen silverkostnad.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 6
              },
              {
                "kind": "stress",
                "target": "steward",
                "delta": -6
              }
            ],
            "flags": {
              "work": "actor"
            },
            "next": "household_record",
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Gör inga fler åtaganden",
            "scope": "none",
            "description": "Kedjan avslutas. Tidigare hjälp består som historia; ingen ny kostnad eller hälsopåverkan tillkommer.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "household_record",
        "title": "Vilka insatser ska nämnas?",
        "prompt": "{steward} vill avsluta anteckningarna om hushållets arbete under {principal}:s frånvaro. Vems insats vill du lyfta fram?",
        "delayMonths": 1,
        "variants": [
          {
            "when": {
              "flag": "work",
              "equals": "paid"
            },
            "prompt": "Utgifterna för avlastningen finns i hushållets anteckningar. {steward} ber att de berördas insatser också ska nämnas."
          },
          {
            "when": {
              "flag": "work",
              "equals": "actor"
            },
            "prompt": "Anteckningarna beskriver hur hushållets ombud tog den extra uppgiften. {steward} frågar hur perioden ska sammanfattas."
          }
        ],
        "choices": [
          {
            "id": "credit_steward",
            "label": "Tacka den som skötte hushållet",
            "scope": "family",
            "description": "{steward}s åsikt om den beslutande aktören ökar med 5. Kedjan avslutas; inga mandat eller sjukdomsförlopp ändras.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "steward",
                "delta": 5
              }
            ],
            "flags": {
              "ending": "steward_thanked"
            },
            "next": null,
            "tag": "duty"
          },
          {
            "id": "credit_regent",
            "label": "Tacka regenten för uppdraget",
            "scope": "family",
            "description": "{regent}s åsikt om den beslutande aktören ökar med 3. Tacket ger inga nya rättigheter eller tillgångar; kedjan avslutas.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "regent",
                "delta": 3
              }
            ],
            "flags": {
              "ending": "regent_thanked"
            },
            "next": null,
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Bevara anteckningarna utan särskilt tack",
            "scope": "none",
            "description": "Historiken bevaras och kedjan avslutas utan ny effekt eller kostnad.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      }
    ]
  },
  {
    "id": "returned_seal",
    "title": "Den tomma platsen bredvid rådsbordet",
    "stages": [
      {
        "id": "departure",
        "title": "När sigillet är återlämnat",
        "prompt": "{formerRegent} har lämnat tillbaka sigillet till {principal}. Vid nästa möte ber den förra regenten att insatsen ska få ett tydligt avslut.",
        "delayMonths": 3,
        "variants": [],
        "choices": [
          {
            "id": "public_thanks",
            "label": "Tacka inför rådet",
            "scope": "public",
            "description": "{formerRegent}s åsikt om den kungliga beslutsaktören ökar med 5. Ingen lön, titel eller fortsatt regentmakt utlovas.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "formerRegent",
                "delta": 5
              }
            ],
            "flags": {
              "departure": "public"
            },
            "next": "unfinished_notes",
            "tag": "duty"
          },
          {
            "id": "private_gift",
            "label": "Ge en gåva från hushållet",
            "scope": "family",
            "description": "Familjen betalar 12 silver för en privat gåva. {formerRegent}s åsikt om familjens beslutsaktör ökar med 10; statskassan berörs inte.",
            "amount": 12,
            "effects": [
              {
                "kind": "opinion",
                "target": "formerRegent",
                "delta": 10
              }
            ],
            "flags": {
              "departure": "private"
            },
            "next": "unfinished_notes",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta uppdraget utan ceremoni",
            "scope": "none",
            "description": "Det redan avslutade regentskapet förblir avslutat. Ingen ny effekt eller kostnad tillkommer.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "unfinished_notes",
        "title": "Anteckningarna som blev kvar",
        "prompt": "{formerRegent} har kvar anteckningar från sin tid vid rådet. De kan gås igenom vid ett sista samtal eller lämnas till hushållet.",
        "delayMonths": 3,
        "variants": [
          {
            "when": {
              "flag": "departure",
              "equals": "public"
            },
            "prompt": "Efter rådets tack ber {formerRegent} om ett sista samtal kring anteckningarna från regentperioden."
          },
          {
            "when": {
              "flag": "departure",
              "equals": "private"
            },
            "prompt": "{formerRegent} tackar för hushållets gåva och erbjuder sig att förklara de kvarlämnade anteckningarna."
          }
        ],
        "choices": [
          {
            "id": "hear_account",
            "label": "Avsätt kunglig tid för genomgången",
            "scope": "public",
            "description": "Den kungliga aktören får 4 stress av genomgången. {formerRegent}s åsikt om aktören ökar med 5; inga ämbeten byter innehavare.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 4
              },
              {
                "kind": "opinion",
                "target": "formerRegent",
                "delta": 5
              }
            ],
            "flags": {
              "notes": "heard"
            },
            "next": "new_distance",
            "tag": "duty"
          },
          {
            "id": "copy_notes",
            "label": "Bekosta en kopia åt hushållet",
            "scope": "family",
            "description": "Familjen betalar 6 silver för en privat kopia. Familjens beslutsaktör får 4 mindre stress; kopian ger ingen offentlig beslutanderätt.",
            "amount": 6,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": -4
              }
            ],
            "flags": {
              "notes": "copied"
            },
            "next": "new_distance",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avböj fortsatt genomgång",
            "scope": "none",
            "description": "Anteckningarna ger inga nya åtaganden. Kedjan avslutas utan kostnad eller förlust av tidigare effekter.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "new_distance",
        "title": "En annan plats i samtalet",
        "prompt": "{formerRegent} vill veta om kontakten ska fortsätta privat eller avslutas med ett offentligt erkännande.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "notes",
              "equals": "heard"
            },
            "prompt": "Genomgången är avslutad. {formerRegent} vill att rådets ledamöter ska veta att redogörelsen blev hörd."
          },
          {
            "when": {
              "flag": "notes",
              "equals": "copied"
            },
            "prompt": "Kopian ligger nu i hushållets arkiv. {formerRegent} ber om ett besked om hur kontakten ska fortsätta."
          }
        ],
        "choices": [
          {
            "id": "acknowledge_account",
            "label": "Bekräfta insatsen inför rådet",
            "scope": "public",
            "description": "{formerRegent}s åsikt om den kungliga aktören ökar med 3. Aktören får 3 stress; erkännandet ger ingen rätt till nästa ämbete.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "formerRegent",
                "delta": 3
              },
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 3
              }
            ],
            "flags": {
              "contact": "public_acknowledgment"
            },
            "next": "closing_visit",
            "tag": "duty"
          },
          {
            "id": "private_reception",
            "label": "Bekosta ett privat besök",
            "scope": "family",
            "description": "Familjen betalar 8 silver. {formerRegent}s åsikt om hushållets beslutsaktör ökar med 6; besöket sker utanför det kungliga uppdraget.",
            "amount": 8,
            "effects": [
              {
                "kind": "opinion",
                "target": "formerRegent",
                "delta": 6
              }
            ],
            "flags": {
              "contact": "private_visit"
            },
            "next": "closing_visit",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Låt den avslutade tjänsten vila",
            "scope": "none",
            "description": "Inga fler besök eller löften görs. Kedjan avslutas utan ny kostnad eller relationsförlust.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "closing_visit",
        "title": "Det sista tackbrevet",
        "prompt": "Ett sista brev från {formerRegent} ligger på bordet. Du kan lägga tid på ett svar eller låta hushållet ordna en avslutande gåva.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "contact",
              "equals": "public_acknowledgment"
            },
            "prompt": "{formerRegent} nämner rådets erkännande i sitt sista brev. Ett svar kan avsluta kontakten utan fler offentliga åtaganden."
          },
          {
            "when": {
              "flag": "contact",
              "equals": "private_visit"
            },
            "prompt": "{formerRegent} tackar för besöket hos hushållet. Nu återstår ett sista svar."
          }
        ],
        "choices": [
          {
            "id": "personal_reply",
            "label": "Låt hushållets ombud skriva svaret",
            "scope": "family",
            "description": "Familjens beslutsaktör får 3 stress; {formerRegent}s åsikt om aktören ökar med 4. Kedjan avslutas utan silverkostnad.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 3
              },
              {
                "kind": "opinion",
                "target": "formerRegent",
                "delta": 4
              }
            ],
            "flags": {
              "ending": "reply"
            },
            "next": null,
            "tag": "duty"
          },
          {
            "id": "farewell_gift",
            "label": "Skicka en sista familjegåva",
            "scope": "family",
            "description": "Familjen betalar 10 silver och {formerRegent}s åsikt om familjens aktör ökar med 7. Kedjan avslutas utan löfte om framtida makt.",
            "amount": 10,
            "effects": [
              {
                "kind": "opinion",
                "target": "formerRegent",
                "delta": 7
              }
            ],
            "flags": {
              "ending": "gift"
            },
            "next": null,
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Arkivera brevet",
            "scope": "none",
            "description": "Brevet bevaras som historia. Ingen ny kostnad, skuld eller mandatförändring uppstår.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      }
    ]
  },
  {
    "id": "heir_margin",
    "title": "Barnets första marginalanteckning",
    "stages": [
      {
        "id": "margin",
        "title": "Ett annat svar i kanten",
        "prompt": "{child} har skrivit ett annat svar i marginalen. {mentor} frågar om hushållet vill bekosta mer undervisning eller hjälpa till med den tid som redan finns.",
        "delayMonths": 3,
        "variants": [],
        "choices": [
          {
            "id": "extra_lessons",
            "label": "Betala för extra undervisning",
            "scope": "family",
            "description": "Familjen betalar 18 silver. {child}s lärdom ökar med 1, inom färdighetens vanliga gräns; utbildningsinriktningen ändras inte.",
            "amount": 18,
            "effects": [
              {
                "kind": "skill",
                "target": "child",
                "skill": "learning",
                "delta": 1
              }
            ],
            "flags": {
              "opening": "lessons"
            },
            "next": "lesson_time",
            "tag": "generous"
          },
          {
            "id": "hear_question",
            "label": "Låt ombudet lyssna på frågan",
            "scope": "family",
            "description": "Familjens beslutsaktör får 4 stress av den extra tiden. {child}s åsikt om aktören ökar med 6; ingen färdighetspoäng ges.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 4
              },
              {
                "kind": "opinion",
                "target": "child",
                "delta": 6
              }
            ],
            "flags": {
              "opening": "heard"
            },
            "next": "lesson_time",
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Låt den ordinarie utbildningen fortsätta",
            "scope": "none",
            "description": "Inga extra kostnader eller följder tillkommer. Den vanliga utbildningen fortsätter enligt kärnans regler.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "lesson_time",
        "title": "Tid för nästa lektion",
        "prompt": "{mentor} vill fortsätta arbetet med {child}, men ber hushållet välja vilket stöd som behövs mest.",
        "delayMonths": 3,
        "variants": [
          {
            "when": {
              "flag": "opening",
              "equals": "lessons"
            },
            "prompt": "De extra lektionerna har gett {child} mer att arbeta med. {mentor} ber om tid att följa upp frågorna."
          },
          {
            "when": {
              "flag": "opening",
              "equals": "heard"
            },
            "prompt": "{child} har återvänt till frågan som hushållets ombud lyssnade på. {mentor} vill ge nästa lektion mer arbetsro."
          }
        ],
        "choices": [
          {
            "id": "relieve_mentor",
            "label": "Bekosta avlastning för mentorn",
            "scope": "family",
            "description": "Familjen betalar 8 silver och {mentor}s stress minskar med 10. Valet byter inte mentor eller utbildningsmål.",
            "amount": 8,
            "effects": [
              {
                "kind": "stress",
                "target": "mentor",
                "delta": -10
              }
            ],
            "flags": {
              "support": "mentor_relief"
            },
            "next": "student_account",
            "tag": "generous"
          },
          {
            "id": "support_child",
            "label": "Låt ombudet stötta barnet mellan lektionerna",
            "scope": "family",
            "description": "{child}s stress minskar med 5 och familjens beslutsaktör får 5 stress. Ingen silverkostnad eller extra lärdomspoäng.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "child",
                "delta": -5
              },
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 5
              }
            ],
            "flags": {
              "support": "child_time"
            },
            "next": "student_account",
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Avsluta det extra stödet",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad. Redan vunnen lärdom och den vanliga mentorundervisningen påverkas inte.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "student_account",
        "title": "Barnet vill visa sitt arbete",
        "prompt": "{child} vill visa en färdig anteckning för familjen. {mentor} föreslår att arbetet antingen gås igenom noga eller får ett enkelt erkännande.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "support",
              "equals": "mentor_relief"
            },
            "prompt": "Efter avlastningen har {mentor} hunnit följa {child}s arbete. Barnet vill nu visa anteckningen för hushållet."
          },
          {
            "when": {
              "flag": "support",
              "equals": "child_time"
            },
            "prompt": "{child} vill visa vad arbetstiden med hushållets ombud har lett fram till. {mentor} tar med anteckningen till familjen."
          }
        ],
        "choices": [
          {
            "id": "review_work",
            "label": "Bekosta en fördjupad genomgång",
            "scope": "family",
            "description": "Familjen betalar 12 silver och {child}s lärdom ökar med 1 inom vanlig gräns. Ingen vuxen egenskap eller framtida arvsrätt bestäms.",
            "amount": 12,
            "effects": [
              {
                "kind": "skill",
                "target": "child",
                "skill": "learning",
                "delta": 1
              }
            ],
            "flags": {
              "work": "reviewed"
            },
            "next": "thanks",
            "tag": "generous"
          },
          {
            "id": "recognize_effort",
            "label": "Låt barnet själv berätta för ombudet",
            "scope": "family",
            "description": "{child}s åsikt om familjens beslutsaktör ökar med 5. Aktören får 3 stress av den avsatta tiden; ingen extra lärdomspoäng.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "child",
                "delta": 5
              },
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 3
              }
            ],
            "flags": {
              "work": "presented"
            },
            "next": "thanks",
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Spara anteckningen och avsluta uppföljningen",
            "scope": "none",
            "description": "Anteckningen bevaras utan ny effekt eller kostnad. Ordinarie utbildning fortsätter.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "thanks",
        "title": "Ett tack för arbetet",
        "prompt": "{child} och {mentor} lägger undan anteckningarna. Hushållet kan rikta sitt avslutande tack till eleven eller läraren.",
        "delayMonths": 3,
        "variants": [
          {
            "when": {
              "flag": "work",
              "equals": "reviewed"
            },
            "prompt": "Den fördjupade genomgången är färdig. {child} och {mentor} väntar på hushållets sista besked om arbetet."
          },
          {
            "when": {
              "flag": "work",
              "equals": "presented"
            },
            "prompt": "{child} har berättat om arbetet för hushållets ombud. Nu återstår ett avslutande tack."
          }
        ],
        "choices": [
          {
            "id": "thank_child",
            "label": "Uppmärksamma barnets ansträngning",
            "scope": "family",
            "description": "{child}s åsikt om familjens beslutsaktör ökar med 5. Kedjan avslutas utan att skapa en skyldighet att återgälda stödet.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "child",
                "delta": 5
              }
            ],
            "flags": {
              "ending": "child"
            },
            "next": null,
            "tag": "duty"
          },
          {
            "id": "thank_mentor",
            "label": "Uppmärksamma mentorns arbete",
            "scope": "family",
            "description": "{mentor}s åsikt om familjens beslutsaktör ökar med 5. Kedjan avslutas; mentorbandet ger ingen ny politisk rättighet.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "mentor",
                "delta": 5
              }
            ],
            "flags": {
              "ending": "mentor"
            },
            "next": null,
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Avsluta utan särskilt tack",
            "scope": "none",
            "description": "Utbildningshistoriken finns kvar. Ingen ny effekt, kostnad eller framtida skuld uppstår.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      }
    ]
  },
  {
    "id": "temple_steps",
    "title": "Brunnen vid tempeltrappan",
    "stages": [
      {
        "id": "funding",
        "title": "Vem ska stå för arbetet?",
        "prompt": "{governor} vill förbättra platsen vid brunnen i {city}. {religiousLeader} ber i stället om stöd till samfundets verksamhet vid trappan. De två begärandena gäller olika kassor och olika resultat.",
        "delayMonths": 3,
        "variants": [],
        "choices": [
          {
            "id": "city_improvement",
            "label": "Bekosta stadens förbättring",
            "scope": "public",
            "description": "Statskassan betalar 25 silver. Stadens oro minskar med 12 och infrastrukturen ökar med 1; detta är ett offentligt stadsarbete.",
            "amount": 25,
            "effects": [
              {
                "kind": "unrest",
                "target": "city",
                "delta": -12
              },
              {
                "kind": "infrastructure",
                "target": "city",
                "delta": 1
              }
            ],
            "flags": {
              "funding": "city"
            },
            "next": "credit",
            "tag": "generous"
          },
          {
            "id": "family_donation",
            "label": "Ge samfundet en privat familjegåva",
            "scope": "family",
            "description": "Familjen betalar 20 silver. Samfundets stöd ökar med 5 och ledarens åsikt om familjens aktör ökar med 8; gåvan bygger inget i staden.",
            "amount": 20,
            "effects": [
              {
                "kind": "religionSupport",
                "target": "religion",
                "delta": 5
              },
              {
                "kind": "opinion",
                "target": "religiousLeader",
                "delta": 8
              }
            ],
            "flags": {
              "funding": "religion"
            },
            "next": "credit",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avböj båda begärandena",
            "scope": "none",
            "description": "Inga pengar betalas och ingen ny effekt uppstår. Kedjan avslutas; staden följer sin vanliga utveckling.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "credit",
        "title": "När hjälpen ska beskrivas",
        "prompt": "{governor} och {religiousLeader} har olika önskemål om hur hjälpen ska beskrivas. Ett tack behöver inte ge någon ny bestämmanderätt.",
        "delayMonths": 3,
        "variants": [
          {
            "when": {
              "flag": "funding",
              "equals": "city"
            },
            "prompt": "Stadsarbetet har bekostats offentligt. {governor} vill få arbetet erkänt; {religiousLeader} vill att samfundets närvaro också ska nämnas."
          },
          {
            "when": {
              "flag": "funding",
              "equals": "religion"
            },
            "prompt": "Samfundet har fått familjens gåva, men inget stadsarbete betalades. {religiousLeader} vill framföra sitt tack; {governor} ber att offentlig och privat verksamhet hålls isär."
          }
        ],
        "choices": [
          {
            "id": "recognize_governor",
            "label": "Bekräfta guvernörens ansvar",
            "scope": "public",
            "description": "{governor}s åsikt om den kungliga beslutsaktören ökar med 5. Ingen extra infrastruktur eller samfundsbonus ges.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "governor",
                "delta": 5
              }
            ],
            "flags": {
              "credit": "governor"
            },
            "next": "separate_meetings",
            "tag": "duty"
          },
          {
            "id": "recognize_religion",
            "label": "Framför hushållets tack till samfundet",
            "scope": "family",
            "description": "{religiousLeader}s åsikt om familjens beslutsaktör ökar med 5. Hushållets tack ändrar inte vem som styr staden.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "religiousLeader",
                "delta": 5
              }
            ],
            "flags": {
              "credit": "religion"
            },
            "next": "separate_meetings",
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Avstå från ytterligare uttalanden",
            "scope": "none",
            "description": "Tidigare gåva eller stadsarbete består. Kedjan avslutas utan ny kostnad eller effekt.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "separate_meetings",
        "title": "Två olika samtal",
        "prompt": "Det finns fortfarande två personer med olika ansvar vid platsen. Du kan lägga kunglig tid på guvernören eller hushållets medel på ett möte med samfundsledaren.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "credit",
              "equals": "governor"
            },
            "prompt": "Guvernörens ansvar har bekräftats. {religiousLeader} efterfrågar ett eget samtal, medan {governor} vill gå igenom stadens arbete."
          },
          {
            "when": {
              "flag": "credit",
              "equals": "religion"
            },
            "prompt": "Hushållet har tackat samfundet. {governor} vill tala om den offentliga förvaltningen; {religiousLeader} erbjuder fortsatt privat kontakt."
          }
        ],
        "choices": [
          {
            "id": "governor_meeting",
            "label": "Avsätt kunglig tid för guvernören",
            "scope": "public",
            "description": "Den kungliga aktören får 5 stress och {governor}s åsikt om aktören ökar med 6. Ingen stadsoro tas bort genom samtalet.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 5
              },
              {
                "kind": "opinion",
                "target": "governor",
                "delta": 6
              }
            ],
            "flags": {
              "meeting": "governor"
            },
            "next": "closing_account",
            "tag": "duty"
          },
          {
            "id": "religious_meeting",
            "label": "Bekosta hushållets möte med samfundsledaren",
            "scope": "family",
            "description": "Familjen betalar 8 silver. {religiousLeader}s åsikt om familjens aktör ökar med 6; det löser inte automatiskt relationen mellan ledaren och guvernören.",
            "amount": 8,
            "effects": [
              {
                "kind": "opinion",
                "target": "religiousLeader",
                "delta": 6
              }
            ],
            "flags": {
              "meeting": "religion"
            },
            "next": "closing_account",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta kontakterna i denna fråga",
            "scope": "none",
            "description": "Kedjan avslutas utan ny effekt. Personernas befintliga relation och roller lämnas åt kärnans vanliga regler.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "closing_account",
        "title": "Den sista begäran vid trappan",
        "prompt": "{governor} och {religiousLeader} vill avsluta kontakten om platsen vid trappan. Du kan rikta ett sista stöd till förvaltaren eller samfundet.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "meeting",
              "equals": "governor"
            },
            "prompt": "Genomgången med {governor} är klar. Vid den sista avstämningen kan du stödja förvaltarens arbete eller ge samfundet en separat familjegåva."
          },
          {
            "when": {
              "flag": "meeting",
              "equals": "religion"
            },
            "prompt": "Hushållets möte med {religiousLeader} är avslutat. Ett sista stöd kan gå till samfundet eller till guvernörens praktiska arbetsbörda."
          }
        ],
        "choices": [
          {
            "id": "relieve_governor",
            "label": "Bekosta avlastning i förvaltningen",
            "scope": "public",
            "description": "Statskassan betalar 10 silver och {governor}s stress minskar med 10. Ingen ny byggnad eller ämbetsförändring skapas; kedjan avslutas.",
            "amount": 10,
            "effects": [
              {
                "kind": "stress",
                "target": "governor",
                "delta": -10
              }
            ],
            "flags": {
              "ending": "administration"
            },
            "next": null,
            "tag": "generous"
          },
          {
            "id": "support_religion",
            "label": "Ge ett sista privat bidrag till samfundet",
            "scope": "family",
            "description": "Familjen betalar 10 silver och samfundets stöd ökar med 2. Bidraget påverkar inte stadens infrastruktur eller guvernörens mandat; kedjan avslutas.",
            "amount": 10,
            "effects": [
              {
                "kind": "religionSupport",
                "target": "religion",
                "delta": 2
              }
            ],
            "flags": {
              "ending": "religion"
            },
            "next": null,
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta utan ytterligare stöd",
            "scope": "none",
            "description": "Historiken och tidigare effekter bevaras. Ingen ny kostnad eller följd tillkommer.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      }
    ]
  },
  {
    "id": "veterans_honor",
    "title": "Namnet på den slitna tjänstelistan",
    "stages": [
      {
        "id": "list",
        "title": "Ett namn på tjänstelistan",
        "prompt": "{veteran} visar en sliten lista från den dokumenterade tjänsten. {commander} vill diskutera arméns behov; hushållet vill kunna ge sin släkting tid att berätta.",
        "delayMonths": 3,
        "variants": [],
        "choices": [
          {
            "id": "public_provision",
            "label": "Bekosta förnödenheter till förbandet",
            "scope": "public",
            "description": "Statskassan betalar 10 silver och arméns styrka ökar med 2. Ingen personlig lön eller skuld betalas.",
            "amount": 10,
            "effects": [
              {
                "kind": "armyStrength",
                "target": "realm",
                "delta": 2
              }
            ],
            "flags": {
              "opening": "provision"
            },
            "next": "account",
            "tag": "generous"
          },
          {
            "id": "family_rest",
            "label": "Bekosta avlastning för veteranen",
            "scope": "family",
            "description": "Familjen betalar 6 silver och {veteran}s stress minskar med 8. Arméns styrka förändras inte.",
            "amount": 6,
            "effects": [
              {
                "kind": "stress",
                "target": "veteran",
                "delta": -8
              }
            ],
            "flags": {
              "opening": "rest"
            },
            "next": "account",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "account",
        "title": "Hur ska insatsen beskrivas?",
        "prompt": "{veteran} vill att tjänstelistan ska få en kort förklaring. Den kan tas upp i ett kungligt samtal eller gås igenom inom hushållet.",
        "delayMonths": 3,
        "variants": [
          {
            "when": {
              "flag": "opening",
              "equals": "rest"
            },
            "prompt": "Efter avlastningen vill {veteran} gå igenom den gamla tjänstelistan. Hushållet kan bekosta samtalet eller be det kungliga ombudet lyssna."
          }
        ],
        "choices": [
          {
            "id": "council_account",
            "label": "Låt det kungliga ombudet höra berättelsen",
            "scope": "public",
            "description": "Den kungliga beslutsaktören får 3 stress. {veteran}s åsikt om aktören ökar med 4; inget nytt militärt uppdrag ges.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 3
              },
              {
                "kind": "opinion",
                "target": "veteran",
                "delta": 4
              }
            ],
            "flags": {
              "record": "public"
            },
            "next": "followup",
            "tag": "duty"
          },
          {
            "id": "family_account",
            "label": "Bekosta en genomgång med familjen",
            "scope": "family",
            "description": "Familjen betalar 4 silver och {veteran}s åsikt om familjens aktör ökar med 5. Berättelsen stannar i hushållets minne.",
            "amount": 4,
            "effects": [
              {
                "kind": "opinion",
                "target": "veteran",
                "delta": 5
              }
            ],
            "flags": {
              "record": "family"
            },
            "next": "followup",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "followup",
        "title": "Förbandets behov och familjens tid",
        "prompt": "{commander} framför förbandets behov. Familjen kan i stället lägga sina egna resurser på veteranens vardag.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "record",
              "equals": "public"
            },
            "prompt": "Den offentligt framförda berättelsen finns kvar. {commander} framför förbandets behov, medan hushållet överväger praktisk hjälp åt {veteran}."
          }
        ],
        "choices": [
          {
            "id": "maintain_provision",
            "label": "Följ upp den tidigare förnödenhetsinsatsen",
            "scope": "public",
            "description": "Statskassan betalar 8 silver och arméns styrka ökar med 1. Detta är ett nytt, separat bidrag till förbandet.",
            "amount": 8,
            "effects": [
              {
                "kind": "armyStrength",
                "target": "realm",
                "delta": 1
              }
            ],
            "flags": {
              "followup": "unit"
            },
            "next": "closing",
            "tag": "generous",
            "requires": [
              {
                "flag": "opening",
                "equals": "provision"
              }
            ],
            "availabilityReason": "Kräver att förbandet fick förnödenheter i kedjans första steg."
          },
          {
            "id": "relieve_again",
            "label": "Bekosta hjälp åt veteranen",
            "scope": "family",
            "description": "Familjen betalar 5 silver och {veteran}s stress minskar med 6. Ingen statlig ersättning eller ärftlig förmån skapas.",
            "amount": 5,
            "effects": [
              {
                "kind": "stress",
                "target": "veteran",
                "delta": -6
              }
            ],
            "flags": {
              "followup": "household"
            },
            "next": "closing",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "closing",
        "title": "Vad ska familjen bära med sig?",
        "prompt": "Tjänstelistan ska läggas undan. Familjen kan lyfta fram den offentligt erkända insatsen eller tacka {veteran} i ett eget samtal.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "followup",
              "equals": "unit"
            },
            "prompt": "Förbandet har fått en andra förnödenhetsinsats. Nu återstår hur familjen vill minnas {veteran}s tidigare tjänst."
          }
        ],
        "choices": [
          {
            "id": "public_family_memory",
            "label": "Knyt familjens namn till den hörda berättelsen",
            "scope": "family",
            "description": "Familjens aktör får 3 stress och familjens inflytande ökar med 2. Ingen titel, ersättningsrätt eller rang följer med erkännandet.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 3
              },
              {
                "kind": "familyInfluence",
                "target": "family",
                "delta": 2
              }
            ],
            "flags": {
              "ending": "public_memory"
            },
            "next": null,
            "tag": "duty",
            "requires": [
              {
                "flag": "record",
                "equals": "public"
              }
            ],
            "availabilityReason": "Kräver att berättelsen tidigare framfördes för det kungliga ombudet."
          },
          {
            "id": "private_thanks",
            "label": "Tacka veteranen inom hushållet",
            "scope": "family",
            "description": "{veteran}s åsikt om familjens beslutsaktör ökar med 4. Kedjan avslutas utan silverkostnad eller militär förändring.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "veteran",
                "delta": 4
              }
            ],
            "flags": {
              "ending": "private_thanks"
            },
            "next": null,
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      }
    ]
  },
  {
    "id": "rival_office_grievance",
    "title": "Utanför ämbetets dörr",
    "stages": [
      {
        "id": "door",
        "title": "Familjens begäran",
        "prompt": "{petitioner} väntar utanför {office}. Ämbetet innehas redan av {officeHolder}, men rivalfamiljen vill bli hörd om sin ställning.",
        "delayMonths": 3,
        "variants": [],
        "choices": [
          {
            "id": "public_hearing",
            "label": "Avsätt ett kungligt samtal",
            "scope": "public",
            "description": "Den kungliga aktören får 4 stress. {petitioner}s åsikt om aktören ökar med 5; ingen utnämning eller framtida plats utlovas.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 4
              },
              {
                "kind": "opinion",
                "target": "petitioner",
                "delta": 5
              }
            ],
            "flags": {
              "opening": "hearing"
            },
            "next": "response",
            "tag": "duty"
          },
          {
            "id": "private_reception",
            "label": "Bekosta ett möte mellan hushållen",
            "scope": "family",
            "description": "Familjen betalar 8 silver och {petitioner}s åsikt om familjens aktör ökar med 5. Mötet ger ingen offentlig behörighet.",
            "amount": 8,
            "effects": [
              {
                "kind": "opinion",
                "target": "petitioner",
                "delta": 5
              }
            ],
            "flags": {
              "opening": "private"
            },
            "next": "response",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "response",
        "title": "Den som redan bär ansvaret",
        "prompt": "{officeHolder} vill få sitt nuvarande ansvar erkänt. {petitioner} vill veta om rivalfamiljens synpunkter har nått fram.",
        "delayMonths": 3,
        "variants": [
          {
            "when": {
              "flag": "opening",
              "equals": "hearing"
            },
            "prompt": "Efter det kungliga samtalet vill {petitioner} ha ett besked. {officeHolder} påminner om vem som fortfarande bär ansvaret för {office}."
          }
        ],
        "choices": [
          {
            "id": "confirm_holder",
            "label": "Bekräfta den nuvarande innehavarens arbete",
            "scope": "public",
            "description": "{officeHolder}s åsikt om den kungliga aktören ökar med 4. {petitioner}s åsikt om samma aktör minskar med 2; ämbetet ändras inte.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "officeHolder",
                "delta": 4
              },
              {
                "kind": "opinion",
                "target": "petitioner",
                "delta": -2
              }
            ],
            "flags": {
              "response": "holder"
            },
            "next": "record",
            "tag": "duty"
          },
          {
            "id": "private_explanation",
            "label": "Bekosta en privat förklaring till rivalfamiljen",
            "scope": "family",
            "description": "Familjen betalar 5 silver och {petitioner}s åsikt om familjens aktör ökar med 4. Förklaringen innehåller inget ämbetslöfte.",
            "amount": 5,
            "effects": [
              {
                "kind": "opinion",
                "target": "petitioner",
                "delta": 4
              }
            ],
            "flags": {
              "response": "explanation"
            },
            "next": "record",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "record",
        "title": "Vad ska stå i redogörelsen?",
        "prompt": "Rivalfamiljens begäran kan följas upp i ett offentligt besked om det hölls ett kungligt samtal. Annars återstår en privat sammanfattning.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "response",
              "equals": "holder"
            },
            "prompt": "Den nuvarande ämbetsinnehavarens arbete har bekräftats. Uppföljningen ska återge vad som faktiskt sades, utan ett nytt löfte till rivalfamiljen."
          }
        ],
        "choices": [
          {
            "id": "public_record",
            "label": "Sammanfatta det kungliga samtalet",
            "scope": "public",
            "description": "Den kungliga aktören får 3 stress och {petitioner}s åsikt om aktören ökar med 3. Redogörelsen skapar inget anspråk på ämbetet.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 3
              },
              {
                "kind": "opinion",
                "target": "petitioner",
                "delta": 3
              }
            ],
            "flags": {
              "record": "public"
            },
            "next": "farewell",
            "tag": "duty",
            "requires": [
              {
                "flag": "opening",
                "equals": "hearing"
              }
            ],
            "availabilityReason": "Kräver att ett kungligt samtal hölls i det första steget."
          },
          {
            "id": "household_record",
            "label": "Samla hushållets argument",
            "scope": "family",
            "description": "Familjen betalar 4 silver. Familjens beslutsaktör får 1 mer diplomati inom färdighetens vanliga gräns; rivalfamiljens rättigheter ändras inte.",
            "amount": 4,
            "effects": [
              {
                "kind": "skill",
                "target": "decisionActor",
                "delta": 1,
                "skill": "diplomacy"
              }
            ],
            "flags": {
              "record": "household"
            },
            "next": "farewell",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "farewell",
        "title": "Ett sista besked vid dörren",
        "prompt": "{petitioner} ber om ett sista besked innan denna fråga läggs åt sidan. Ett privat försoningsmöte eller ett kungligt tack till ämbetsinnehavaren avslutar kontakten.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "record",
              "equals": "public"
            },
            "prompt": "Det kungliga samtalet har sammanfattats. {petitioner} känner till beskedet; frågan kan nu avslutas utan nya löften."
          }
        ],
        "choices": [
          {
            "id": "reconcile",
            "label": "Följ upp den privata förklaringen",
            "scope": "family",
            "description": "Familjen betalar 6 silver och {petitioner}s åsikt om familjens aktör ökar med 6. Kedjan avslutas utan ämbetsbyte.",
            "amount": 6,
            "effects": [
              {
                "kind": "opinion",
                "target": "petitioner",
                "delta": 6
              }
            ],
            "flags": {
              "ending": "reconciled"
            },
            "next": null,
            "tag": "generous",
            "requires": [
              {
                "flag": "response",
                "equals": "explanation"
              }
            ],
            "availabilityReason": "Kräver att hushållet tidigare gav rivalfamiljen en privat förklaring."
          },
          {
            "id": "thank_holder",
            "label": "Tacka den nuvarande ämbetsinnehavaren",
            "scope": "public",
            "description": "{officeHolder}s åsikt om den kungliga aktören ökar med 3. Kedjan avslutas; varken tjänstetid eller befogenheter utökas.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "officeHolder",
                "delta": 3
              }
            ],
            "flags": {
              "ending": "holder_thanked"
            },
            "next": null,
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      }
    ]
  },
  {
    "id": "exile_contacts",
    "title": "Inbjudan hos värdfamiljen",
    "stages": [
      {
        "id": "invitation",
        "title": "Ett besök som kostar",
        "prompt": "{envoy} har kontakt med {hostHead} hos den accepterade värdfamiljen. Hushållet kan bekosta ett besök eller låta sitt ombud förbereda ett brev.",
        "delayMonths": 3,
        "variants": [],
        "choices": [
          {
            "id": "fund_visit",
            "label": "Bekosta sändebudets besök",
            "scope": "family",
            "description": "Familjen betalar 6 silver och familjens inflytande ökar med 2. Besöket ändrar inte beskyddare eller hemvist.",
            "amount": 6,
            "effects": [
              {
                "kind": "familyInfluence",
                "target": "family",
                "delta": 2
              }
            ],
            "flags": {
              "opening": "visit"
            },
            "next": "credit",
            "tag": "generous"
          },
          {
            "id": "prepare_letter",
            "label": "Låt ombudet förbereda ett brev",
            "scope": "family",
            "description": "Familjens beslutsaktör får 4 stress och {envoy}s åsikt om aktören ökar med 4. Inga silver betalas och inget nytt skydd utlovas.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 4
              },
              {
                "kind": "opinion",
                "target": "envoy",
                "delta": 4
              }
            ],
            "flags": {
              "opening": "letter"
            },
            "next": "credit",
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "credit",
        "title": "Vem ska få tacket?",
        "prompt": "{envoy} vill veta hur hushållet ska tala om värdfamiljens stöd. Ett tydligt tack till värden skiljer sig från att hålla arbetet inom den egna familjen.",
        "delayMonths": 3,
        "variants": [
          {
            "when": {
              "flag": "opening",
              "equals": "visit"
            },
            "prompt": "Det betalda besöket är genomfört. {envoy} vill veta om hushållet ska tacka {hostHead} direkt eller lägga resurser på sändebudets fortsatta arbete."
          }
        ],
        "choices": [
          {
            "id": "thank_host",
            "label": "Tacka värdfamiljens huvud",
            "scope": "family",
            "description": "{hostHead}s åsikt om familjens beslutsaktör ökar med 4. Tacket ger ingen ny juridisk eller ekonomisk förpliktelse.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "hostHead",
                "delta": 4
              }
            ],
            "flags": {
              "credit": "host"
            },
            "next": "followup",
            "tag": "duty"
          },
          {
            "id": "relieve_envoy",
            "label": "Bekosta avlastning för sändebudet",
            "scope": "family",
            "description": "Familjen betalar 4 silver och {envoy}s stress minskar med 6. Värdens stöd förändras inte.",
            "amount": 4,
            "effects": [
              {
                "kind": "stress",
                "target": "envoy",
                "delta": -6
              }
            ],
            "flags": {
              "credit": "envoy"
            },
            "next": "followup",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "followup",
        "title": "En kontakt att vårda",
        "prompt": "Hushållet kan följa upp ett tidigare betalt besök eller arbeta vidare med det egna ombudets förmåga att föra familjens talan.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "credit",
              "equals": "host"
            },
            "prompt": "Tacket till {hostHead} är framfört. Hushållet överväger nu om ett tidigare besök ska följas upp eller om ombudet behöver bättre förberedelser."
          }
        ],
        "choices": [
          {
            "id": "second_visit",
            "label": "Följ upp det första besöket",
            "scope": "family",
            "description": "Familjen betalar 5 silver och familjens inflytande ökar med 2. Besöket sker hos samma accepterade värd, utan nytt beskyddaravtal.",
            "amount": 5,
            "effects": [
              {
                "kind": "familyInfluence",
                "target": "family",
                "delta": 2
              }
            ],
            "flags": {
              "followup": "visit"
            },
            "next": "winter",
            "tag": "generous",
            "requires": [
              {
                "flag": "opening",
                "equals": "visit"
              }
            ],
            "availabilityReason": "Kräver att hushållet bekostade det första besöket."
          },
          {
            "id": "prepare_arguments",
            "label": "Låt ombudet öva familjens framställan",
            "scope": "family",
            "description": "Familjens beslutsaktör får 4 stress och 1 mer diplomati inom vanlig gräns. Ingen värd lovar stöd genom valet.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 4
              },
              {
                "kind": "skill",
                "target": "decisionActor",
                "delta": 1,
                "skill": "diplomacy"
              }
            ],
            "flags": {
              "followup": "practice"
            },
            "next": "winter",
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "winter",
        "title": "När kontakten ska få vila",
        "prompt": "{envoy} ber om ett sista besked om kontakten med värdfamiljen. Hushållet kan följa upp sitt tidigare tack eller ge sändebudet ett eget erkännande.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "followup",
              "equals": "practice"
            },
            "prompt": "Familjens ombud har övat sin framställan. {envoy} frågar hur arbetet ska avslutas innan denna kontaktuppföljning läggs åt sidan."
          }
        ],
        "choices": [
          {
            "id": "host_gift",
            "label": "Följ upp tacket med en liten familjegåva",
            "scope": "family",
            "description": "Familjen betalar 6 silver och {hostHead}s åsikt om familjens aktör ökar med 5. Gåvan köper varken ämbete eller skyddsgaranti.",
            "amount": 6,
            "effects": [
              {
                "kind": "opinion",
                "target": "hostHead",
                "delta": 5
              }
            ],
            "flags": {
              "ending": "host_gift"
            },
            "next": null,
            "tag": "generous",
            "requires": [
              {
                "flag": "credit",
                "equals": "host"
              }
            ],
            "availabilityReason": "Kräver att hushållet redan tackade värdfamiljens huvud."
          },
          {
            "id": "envoy_thanks",
            "label": "Tacka sändebudet för arbetet",
            "scope": "family",
            "description": "{envoy}s åsikt om familjens aktör ökar med 4. Kedjan avslutas utan ny kostnad eller ändrad exilstatus.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "envoy",
                "delta": 4
              }
            ],
            "flags": {
              "ending": "envoy_thanks"
            },
            "next": null,
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      }
    ]
  },
  {
    "id": "family_letter",
    "title": "Brevet bland familjens papper",
    "stages": [
      {
        "id": "letter",
        "title": "Ett gammalt tack återfinns",
        "prompt": "Bland familjens papper nämns den dokumenterade kontakten mellan {deceased} och {participant}. Hushållet kan fråga den levande deltagaren om minnet eller samla sin egen redogörelse.",
        "delayMonths": 3,
        "variants": [],
        "choices": [
          {
            "id": "contact_participant",
            "label": "Låt ombudet fråga om det gamla minnet",
            "scope": "family",
            "description": "Familjens aktör får 3 stress och {participant}s åsikt om aktören ökar med 3. Frågan tar inte över någon av den avlidnes förpliktelser.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 3
              },
              {
                "kind": "opinion",
                "target": "participant",
                "delta": 3
              }
            ],
            "flags": {
              "opening": "contact"
            },
            "next": "meaning",
            "tag": "duty"
          },
          {
            "id": "collect_record",
            "label": "Bekosta en genomgång av familjens uppgifter",
            "scope": "family",
            "description": "Familjen betalar 4 silver och familjens aktör får 1 mer lärdom inom vanlig gräns. Genomgången fastställer ingen arvinge eller ekonomisk skuld.",
            "amount": 4,
            "effects": [
              {
                "kind": "skill",
                "target": "decisionActor",
                "delta": 1,
                "skill": "learning"
              }
            ],
            "flags": {
              "opening": "record"
            },
            "next": "meaning",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "meaning",
        "title": "Vad betyder minnet för oss?",
        "prompt": "{participant} lever ännu, men {deceased}s tidigare handlingar binder inte dagens hushåll. Familjen kan rikta ett frivilligt erkännande till deltagaren eller arbeta med sin egen förståelse.",
        "delayMonths": 3,
        "variants": [
          {
            "when": {
              "flag": "opening",
              "equals": "contact"
            },
            "prompt": "Hushållet har redan tagit kontakt om det offentliga minnet. Du kan nu framföra ett frivilligt erkännande till {participant} eller låta familjen fortsätta sin egen genomgång."
          }
        ],
        "choices": [
          {
            "id": "acknowledge",
            "label": "Framför ett frivilligt erkännande",
            "scope": "family",
            "description": "{participant}s åsikt om familjens beslutsaktör ökar med 4. Erkännandet skapar ingen rätt till pengar eller framtida tjänster.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "participant",
                "delta": 4
              }
            ],
            "flags": {
              "response": "acknowledge"
            },
            "next": "revisit",
            "tag": "duty"
          },
          {
            "id": "study_record",
            "label": "Bekosta fortsatt läsning av uppgifterna",
            "scope": "family",
            "description": "Familjen betalar 3 silver och familjens aktör får 1 mer lärdom inom vanlig gräns. Inga relationer eller skyldigheter skrivs om.",
            "amount": 3,
            "effects": [
              {
                "kind": "skill",
                "target": "decisionActor",
                "delta": 1,
                "skill": "learning"
              }
            ],
            "flags": {
              "response": "study"
            },
            "next": "revisit",
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "revisit",
        "title": "Om ni vill tala vidare",
        "prompt": "Det gamla minnet kan få en personlig uppföljning om hushållet tidigare tog kontakt. Annars återstår familjens eget arbete med berättelsen.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "response",
              "equals": "acknowledge"
            },
            "prompt": "Det frivilliga erkännandet har framförts. Hushållet kan följa upp en tidigare kontakt med {participant} eller lägga tid på familjens egen berättelse."
          }
        ],
        "choices": [
          {
            "id": "fund_visit",
            "label": "Bekosta ett uppföljande besök",
            "scope": "family",
            "description": "Familjen betalar 6 silver och {participant}s åsikt om familjens aktör ökar med 5. Besöket reglerar ingen skuld och kräver ingen motgåva.",
            "amount": 6,
            "effects": [
              {
                "kind": "opinion",
                "target": "participant",
                "delta": 5
              }
            ],
            "flags": {
              "followup": "visit"
            },
            "next": "archive",
            "tag": "generous",
            "requires": [
              {
                "flag": "opening",
                "equals": "contact"
              }
            ],
            "availabilityReason": "Kräver att hushållet tidigare tog kontakt om minnet."
          },
          {
            "id": "family_discussion",
            "label": "Låt ombudet gå igenom berättelsen med familjen",
            "scope": "family",
            "description": "Familjens aktör får 3 stress och 1 mer diplomati inom vanlig gräns. Inget stöd eller silver tas från den levande deltagaren.",
            "amount": 0,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": 3
              },
              {
                "kind": "skill",
                "target": "decisionActor",
                "delta": 1,
                "skill": "diplomacy"
              }
            ],
            "flags": {
              "followup": "discussion"
            },
            "next": "archive",
            "tag": "duty"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      },
      {
        "id": "archive",
        "title": "När brevet läggs tillbaka",
        "prompt": "Det gamla minnet ska åter få sin plats bland familjens papper. Ett avslutande tack eller en ordnad sammanställning kan avsluta hushållets egen uppföljning.",
        "delayMonths": 6,
        "variants": [
          {
            "when": {
              "flag": "followup",
              "equals": "visit"
            },
            "prompt": "Besöket hos {participant} är genomfört. Nu kan hushållet avsluta sitt frivilliga tack eller lägga tillbaka uppgifterna i ordnad form."
          }
        ],
        "choices": [
          {
            "id": "closing_thanks",
            "label": "Avsluta det tidigare erkännandet med ett tack",
            "scope": "family",
            "description": "{participant}s åsikt om familjens aktör ökar med 3. Tackbrevet avslutar kedjan utan ärftlig förpliktelse eller krav på återbetalning.",
            "amount": 0,
            "effects": [
              {
                "kind": "opinion",
                "target": "participant",
                "delta": 3
              }
            ],
            "flags": {
              "ending": "thanks"
            },
            "next": null,
            "tag": "duty",
            "requires": [
              {
                "flag": "response",
                "equals": "acknowledge"
              }
            ],
            "availabilityReason": "Kräver att hushållet tidigare framförde ett frivilligt erkännande."
          },
          {
            "id": "ordered_archive",
            "label": "Bekosta en ordnad sammanställning",
            "scope": "family",
            "description": "Familjen betalar 3 silver och familjens beslutsaktör får 4 mindre stress. Sammanställningen ändrar inga rättigheter eller historiska deltagare.",
            "amount": 3,
            "effects": [
              {
                "kind": "stress",
                "target": "decisionActor",
                "delta": -4
              }
            ],
            "flags": {
              "ending": "archive"
            },
            "next": null,
            "tag": "generous"
          },
          {
            "id": "close",
            "label": "Avsluta denna uppföljning",
            "scope": "none",
            "description": "Kedjan avslutas utan ny kostnad, stress eller relationsförlust. Tidigare effekter och den faktiska historiken bevaras.",
            "amount": 0,
            "effects": [],
            "flags": {},
            "next": null,
            "tag": "neutral"
          }
        ]
      }
    ]
  }
];
