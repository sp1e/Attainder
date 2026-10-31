import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRuntimeState } from "../../runtime/useRuntimeState.js";
import { compareGameDates, parseGameDate } from "../../runtime/gameDates.js";
import { getCharacterPresentation } from "../../runtime/characters/index.js";
import {
  advanceCharacterYearWithModel,
  revealLatestCharacterTurn,
  readVisibleCharacterState,
  submitCharacterCommand,
} from "../../runtime/characterRuntime.js";
import { getModelCallCounts, subscribeModelCalls } from "../AI/modelCallCounter.js";
import "./characters.css";
import ActionBox, { SchemeList } from "./ActionBox.jsx";
import LocalModelConnect from "./LocalModelConnect.jsx";
import Portrait from "./Portrait.jsx";

const THEME_KEY = "oh:characters:theme";
const TABS = [
  ["council", "Överblick"], ["people", "Personer"], ["families", "Familjer"],
  ["offices", "Ämbeten & arv"], ["decisions", "Beslut"], ["chronicle", "Krönikan"],
];
const number = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(Number(value)) : "—";
const entries = (value) => Array.isArray(value) ? value : Object.values(value || {});
const text = (value, fallback = "—") => typeof value === "string" || typeof value === "number" ? String(value) : value?.label || value?.name || value?.title || fallback;
const dateLabel = (value) => {
  const date = parseGameDate(value);
  return date ? `${date.day}/${date.month} ${Math.abs(date.year)}${date.year < 0 ? " f.Kr." : " e.Kr."}` : text(value);
};
const initials = (name) => String(name || "?").split(/\s+/).slice(0, 2).map((word) => word[0]).join("");
const isAlive = (person) => person.alive !== false && !person.deathDate && !person.diedAt;
const signed = (value) => Number(value) > 0 ? `+${number(value)}` : number(value);
const stressLabel = (value) => /^-?\d+(\.\d+)?$/.test(String(value)) ? `Stress ${signed(value)}` : value;
const humanize = (value) => ({
  administration: "Förvaltning", diplomacy: "Diplomati", military: "Krigskonst", intrigue: "Intrig", command: "Befäl",
  learning: "Lärdom", stewardship: "Förvaltning", martial: "Krigskonst", wisdom: "Visdom",
  ambitious: "Ambitiös", cautious: "Försiktig", compassionate: "Medkännande", greedy: "Girig",
  dutiful: "Plikttrogen", loyal: "Lojal", brave: "Modig", proud: "Stolt", patient: "Tålmodig",
  vengeful: "Hämndlysten", honest: "Ärlig", generous: "Generös", calm: "Lugn", cruel: "Grym", gregarious: "Sällskaplig", devout: "From",
  active: "Pågår", completed: "Slutfört", paused: "Pausat", cancelled: "Avbrutet", failed: "Misslyckat",
  fulfilled: "Uppfyllt", broken: "Brutet", open: "Oavgjort", resolved: "Avgjort", pending: "Väntar",
  sheltered: "Under beskydd", homeless: "Skyddslöst hushåll", exiled: "I exil", homeland: "Hemvist",
}[value] || text(value));

function useCharacterTheme() {
  const [choice, setChoice] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || "system"; } catch { return "system"; }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(Boolean(media?.matches));
    media?.addEventListener?.("change", update);
    return () => media?.removeEventListener?.("change", update);
  }, []);
  const choose = (value) => {
    setChoice(value);
    try { value === "system" ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, value); } catch { /* The selected theme still works without storage. */ }
  };
  return { theme: choice === "system" ? (systemDark ? "dark" : "light") : choice, choice, choose };
}

function CivicMark() {
  return <svg width="42" height="42" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 17 24 6l19 11H5Zm2 24h34M10 37h28M12 20v14m8-14v14m8-14v14m8-14v14M10 20h4m4 0h4m4 0h4m4 0h4" /></svg>;
}

function Metric({ label, value, note, tone }) {
  return <div className={`char-metric${tone ? ` char-metric--${tone}` : ""}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function Meter({ label, value, max = 100, danger = false }) {
  const amount = Math.min(max, Math.max(0, Number(value) || 0));
  return <div className={`char-meter${danger ? " char-meter--danger" : ""}`}>
    <div><span>{label}</span><strong>{number(value)}<small> / {max}</small></strong></div>
    <div className="char-meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={amount}><span style={{ width: `${amount / max * 100}%` }} /></div>
  </div>;
}

function Empty({ title, children }) {
  return <div className="char-empty"><strong>{title}</strong><p>{children}</p></div>;
}

function PersonSummary({ person, compact = false }) {
  if (!person) return <Empty title="Ingen behörig företrädare">Ingen person kan företräda dig just nu. Läs mandatets status under Ämbeten & arv.</Empty>;
  return <div className={`char-person-summary${compact ? " char-person-summary--compact" : ""}`}>
    <Portrait person={person} size={compact ? "small" : "large"} />
    <div><span className="char-eyebrow">{person.familyName || "Familj"}{Number.isFinite(person.age) ? ` · ${person.age} år` : ""}</span>
      <h3>{person.name}</h3><p>{person.archetypeLabel || humanize(person.archetype)}{!isAlive(person) ? " · Avliden" : ""}</p>
      {person.portraitState?.visualState !== "healthy" && person.portraitState?.reasons?.length > 0 && <p className="char-health-summary">{person.portraitState.reasons.filter((reason) => reason.key !== "healthy").map((reason) => reason.label).join(" · ")}</p>}
      <div className="char-tags">{entries(person.traitLabels || person.traits || person.personality).map((trait, index) => <span key={text(trait, index)}>{humanize(text(trait))}</span>)}</div>
    </div>
  </div>;
}

const authorityReasons = {
  minority: "Förmyndarskap under omyndighet",
  incapacity: "Tillfälligt ombud vid allvarlig sjukdom eller skada",
  contested: "Omstridd överlämning",
};

function AuthoritySummary({ view }) {
  const people = entries(view.people);
  return <>{[["royal", "Rikets mandat", "Härskare"], ["household", "Familjens mandat", "Familjehuvud"]].map(([scope, label, principalLabel]) => {
    const mandate = view.authority?.[scope];
    if (!mandate || !(mandate.reason || mandate.blockedReason || (mandate.principalId && mandate.representativeId !== mandate.principalId))) return null;
    const principal = people.find((person) => person.id === mandate.principalId);
    const representative = people.find((person) => person.id === mandate.representativeId);
    return <section className="char-authority" aria-label={label} key={scope}>
      <h4>{label}</h4>
      {mandate.reason && <p className="char-caption">{authorityReasons[mandate.reason] || "Särskild mandatordning"}</p>}
      <div className="char-authority-people">
        <div><span className="char-eyebrow">{principalLabel}</span>{principal ? <PersonSummary person={principal} compact /> : <p>Ingen innehavare.</p>}</div>
        <div><span className="char-eyebrow">Handlande företrädare</span>{representative ? <PersonSummary person={representative} compact /> : <p>Ingen behörig företrädare finns just nu.</p>}</div>
      </div>
      {mandate.blockedReason && <p className="char-reason">{mandate.blockedReason}</p>}
    </section>;
  })}</>;
}

function ActionCard({ action, onCommand, busy }) {
  const fields = action.fields || [];
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.key, field.options?.[0]?.value ?? ""])));
  const missing = fields.some((field) => !values[field.key]);
  return <details className={`char-action${action.disabledReason ? " char-action--unavailable" : ""}`}>
    <summary><span><strong>{action.label}</strong><small>{action.cost || "Ingen myntkostnad"}{action.stress ? ` · ${stressLabel(action.stress)}` : ""}</small>{action.actorName ? <small>Utförs av: {action.actorName}</small> : action.actorName === null && <small>Ingen behörig aktör</small>}</span><span aria-hidden="true">＋</span></summary>
    <div className="char-action-body"><p>{action.description}</p>
      <form onSubmit={(event) => { event.preventDefault(); onCommand(action.type, values); }}>
        {fields.map((field) => <label key={field.key}>{field.label}<select value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} disabled={busy || Boolean(action.disabledReason)} required>
          {!field.options?.length && <option value="">Ingen giltig kandidat</option>}
          {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>)}
        {action.disabledReason && <p className="char-reason">{action.disabledReason}</p>}
        <button className="char-button char-button--primary" type="submit" disabled={busy || missing || Boolean(action.disabledReason)}>{action.label}</button>
      </form>
    </div>
  </details>;
}

function ChainDecisions({ steps }) {
  return <ol className="char-chain-decisions">{entries(steps).map((step, index) => <li key={`${step.date || "step"}-${index}`}>
    <strong>{step.title}</strong>{step.choice && <p>Val: {step.choice}</p>}
    <span className="char-caption">{[step.date && dateLabel(step.date), step.actorName && `Utfört av: ${step.actorName}`].filter(Boolean).join(" · ")}</span>
  </li>)}</ol>;
}

function ChainHistory({ chains }) {
  const history = entries(chains);
  if (!history.length) return null;
  return <section className="char-chain-history" aria-label="Händelsekedjornas historik">
    <div className="char-section-heading"><div><span className="char-eyebrow">Tidigare val och uppföljningar</span><h3>Händelsekedjor</h3></div></div>
    {history.map((chain) => <details className="char-card char-explanation" key={chain.id}>
      <summary><strong>{chain.title}</strong>{chain.statusLabel && <span className="char-badge">{chain.statusLabel}</span>}</summary>
      {chain.nextAt && <p className="char-caption">Nästa uppföljning: {dateLabel(chain.nextAt)}</p>}
      {chain.reason && <p>{chain.reason}</p>}
      {entries(chain.steps).length > 0 ? <ChainDecisions steps={chain.steps} /> : <p className="char-caption">Inga tidigare val att visa.</p>}
    </details>)}
  </section>;
}

function StoryCard({ story, person, onCommand, busy }) {
  const isChain = story.type === "event_chain";
  return <article className="char-story"><div className="char-story-heading"><span className="char-eyebrow">{isChain ? <>{story.chainTitle || "Händelsekedja"}{Number.isInteger(story.stepNumber) && story.stepNumber > 0 ? ` · Steg ${story.stepNumber}` : ""}</> : "Ett beslut väntar"}</span><span>{story.dueAt ? `Senast ${dateLabel(story.dueAt)}` : dateLabel(story.createdAt)}</span></div>
    {person && <div className="char-office-holder"><Portrait person={person} size="small" /><strong>{person.name}</strong></div>}
    <h3>{story.title}</h3><p>{story.description}</p>
    {story.triggerDescription && <p className="char-caption">Bakgrund: {story.triggerDescription}</p>}
    {story.causeTitle && <p className="char-caption">Tidigare minne: {story.causeTitle}</p>}
    {isChain && entries(story.previousChoices).length > 0 && <details className="char-explanation"><summary>Tidigare val ({entries(story.previousChoices).length})</summary><ChainDecisions steps={story.previousChoices} /></details>}
    {story.deadlineText ? <p className="char-caption">{story.deadlineText}</p> : story.fallbackDescription && <p className="char-caption">Om du avstår till tidsgränsen: {story.fallbackDescription}</p>}
    {isChain && story.nextAt && <p className="char-caption">Nästa uppföljning: {dateLabel(story.nextAt)}</p>}
    <div className="char-story-choices">{(story.choices || []).map((choice) => <button key={choice.id} type="button" className="char-choice" disabled={busy || Boolean(choice.disabledReason)} onClick={() => onCommand("resolve_story", { storyId: story.id, choiceId: choice.id })}>
      <strong>{choice.label}</strong><span>{choice.description}</span>{choice.scope !== "none" && (choice.actorName ? <small>Utförs av: {choice.actorName}</small> : choice.actorName === null && <small>Ingen behörig aktör</small>)}<small>{[choice.cost, stressLabel(choice.stress)].filter(Boolean).join(" · ")}</small>{choice.disabledReason && <em>{choice.disabledReason}</em>}
    </button>)}</div>
  </article>;
}

function CouncilView({ view, pending, onCommand, busy, setTab, selectPerson, runAction }) {
  const economy = view.economy || {};
  const representative = view.representative;
  const hasAuthorityDetail = Object.values(view.authority || {}).some((mandate) => mandate && (mandate.reason || mandate.blockedReason || (mandate.principalId && mandate.representativeId !== mandate.principalId)));
  const activeProjects = entries(view.projects).filter((project) => !["cancelled", "failed"].includes(project.status));
  const waitingStories = entries(view.stories).filter((story) => story.status === "waiting");
  return <>
    <div className="char-overview-grid"><section className="char-card char-leader-card"><div className="char-section-heading"><span className="char-eyebrow">{view.mode === "family" ? "Familjens företrädare" : "Rikets ledning"}</span><span className="char-seal" aria-hidden="true">◇</span></div>
      {hasAuthorityDetail ? <AuthoritySummary view={view} /> : <PersonSummary person={representative} />}
      <div className="char-leader-measures">{representative && <Meter label={`Stress · ${representative.name}`} value={representative.stress} danger />}<Meter label="Legitimitet" value={economy.legitimacy ?? view.ruler?.legitimacy ?? 0} /></div>
      {representative?.goalLabel && <p className="char-goal"><span>Personligt mål</span>{representative.goalLabel}</p>}
      {representative && <button className="char-button char-button--quiet" onClick={() => { selectPerson(representative.id); setTab("people"); }}>Lär känna {representative.name}<span aria-hidden="true"> ↗</span></button>}
    </section>
    <section className="char-card"><div className="char-section-heading"><div><span className="char-eyebrow">Makt och försörjning</span><h3>Rikets tillstånd</h3></div></div>
      <div className="char-metrics-grid"><Metric label="Statskassa" value={number(economy.treasury)} note="silver" /><Metric label="Årsintäkt" value={signed(economy.annualRevenue)} note="före årets beslut" /><Metric label="Handlingsutrymme" value={number(economy.actionPoints)} note="handlingar före nästa år" /><Metric label="Militär beredskap" value={`${number(economy.militaryReadiness)} %`} note="påverkas av befäl och stöd" /></div>
      {view.mode === "family" && <div className="char-household-summary"><Metric label="Familjens kassa" value={number(economy.familyTreasury)} note="silver, skild från statskassan" /><Metric label="Familjens årsnetto" value={signed(economy.familyIncome)} note="egendom och uppehälle" /></div>}
      <p className="char-caption">Familjernas stöd, ämbetsinnehavarnas förmåga och härskarens arbetssätt påverkar utfallet.</p>
      <button className="char-button char-button--quiet" onClick={() => setTab("decisions")}>Planera nästa beslut <span aria-hidden="true">→</span></button>
    </section></div>
    {Array.isArray(view.catalog) && <ActionBox view={view} busy={busy} runAction={runAction} CommandCard={ActionCard} />}
    <SchemeList schemes={view.schemes} busy={busy} onAbort={(schemeId) => onCommand("abort_scheme", { schemeId })}
      onEmpty={() => document.getElementById("char-action-text")?.focus()} />
    {pending.length > 0 && <section aria-label="Beslut som väntar"><div className="char-section-heading"><div><span className="char-eyebrow">Människorna bakom politiken</span><h3>{pending.length === 1 ? "Ett ärende kräver ditt beslut" : `${pending.length} ärenden kräver ditt beslut`}</h3></div></div>{pending.slice(0, 3).map((story) => <StoryCard key={story.id} story={story} person={view.people.find((person) => person.id === story.actorId)} onCommand={onCommand} busy={busy} />)}{pending.length > 3 && <button className="char-button" onClick={() => setTab("decisions")}>Visa alla ärenden</button>}</section>}
    {waitingStories.length > 0 && <section><div className="char-section-heading"><div><span className="char-eyebrow">Beslut med framtida följder</span><h3>Åtaganden som består</h3></div></div><div className="char-cities">{waitingStories.map((story) => <article className="char-card" key={story.id}><h4>{story.title}</h4><p>{story.description}</p><span className="char-caption">{story.actorName}{story.dueAt ? ` · Återkommer ${dateLabel(story.dueAt)}` : ""}</span></article>)}</div></section>}
    <div className="char-section-heading"><div><span className="char-eyebrow">Förvaltning</span><h3>Städerna bär riket</h3></div></div>
    <div className="char-cities">{entries(view.cities).map((city) => <article className="char-city char-card" key={city.id}><span className="char-eyebrow">{city.familyName || view.families?.find((family) => family.id === city.familyId)?.name || "Förvaltning"}</span><h4>{city.name}</h4><p>{city.governorName ? `Guvernör: ${city.governorName}` : "Guvernörsämbetet är vakant"}</p><div className="char-inline-stats"><span>Skatt <strong>{number(city.taxIncome)}</strong></span><span>Produktion <strong>{number(Number(city.productionMultiplier ?? 1) * 100)} %</strong></span><span>Oro <strong>{number(city.unrest)}</strong></span></div></article>)}</div>
    {activeProjects.length > 0 && <section><div className="char-section-heading"><div><span className="char-eyebrow">Beslut med varaktig följd</span><h3>Projekt och reformer</h3></div></div><div className="char-cities">{activeProjects.map((project) => <article className="char-card" key={project.id}><span className="char-badge">Projekt: {humanize(project.status)}</span>{project.effectActive === false && <span className="char-badge char-badge--warning">Effekten är inaktiv</span>}{project.effectActive === true && <span className="char-badge">Effekten är aktiv</span>}<h4>{project.title || project.name}</h4><p>{project.description || (project.personal ? "Ett personligt projekt med begränsad löptid." : "Ett bestående resultat som kan följa riket eller familjen över generationsskiften.")}</p>{project.effectReason && <p className="char-reason">{project.effectReason}</p>}{project.dueAt && <small>{project.personal ? "Slutdatum" : "Planerat slut"}: {dateLabel(project.dueAt)}</small>}{project.progress != null && <Meter label="Framsteg" value={project.progress} />}</article>)}</div></section>}
  </>;
}

function PeopleView({ view, selectedId, selectPerson }) {
  const [query, setQuery] = useState("");
  const [includeDead, setIncludeDead] = useState(false);
  const people = entries(view.people);
  const peopleById = Object.fromEntries(people.map((person) => [person.id, person]));
  const filtered = people.filter((person) => (includeDead || isAlive(person)) && `${person.name} ${person.familyName || ""} ${person.archetypeLabel || ""} ${(person.portraitState?.reasons || []).map((reason) => reason.label).join(" ")}`.toLocaleLowerCase("sv").includes(query.toLocaleLowerCase("sv")));
  const person = peopleById[selectedId] || filtered[0];
  const memories = entries(view.memories).filter((memory) => memory.personId === person?.id || memory.ownerId === person?.id || memory.participants?.includes(person?.id));
  const roles = entries(view.offices).filter((office) => (office.holderId || office.personId) === person?.id);
  return <><div className="char-section-heading"><div><span className="char-eyebrow">Liv, vilja och erfarenhet</span><h3>Människorna i din värld</h3></div><span className="char-count">{people.filter(isAlive).length} levande</span></div>
    <div className="char-person-layout"><div className="char-person-index"><label className="char-search-label">Sök person eller familj<input type="search" placeholder="Namn eller familj…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="char-checkbox"><input type="checkbox" checked={includeDead} onChange={(event) => setIncludeDead(event.target.checked)} />Visa även avlidna</label>
      <div className="char-person-list">{filtered.map((candidate) => <button type="button" key={candidate.id} className={`char-person-row${person?.id === candidate.id ? " is-selected" : ""}`} aria-pressed={person?.id === candidate.id} onClick={() => selectPerson(candidate.id)}><Portrait person={candidate} size="tiny" /><span><strong>{candidate.name}</strong><small>{candidate.familyName}{candidate.age != null ? ` · ${candidate.age} år` : ""}{!isAlive(candidate) ? " · Avliden" : ""}</small></span></button>)}{!filtered.length && <p className="char-caption">Ingen person matchar sökningen.</p>}</div>
    </div>
    {person ? <article className="char-card char-person-detail"><PersonSummary person={person} /><div className="char-tags">{roles.map((role) => <span key={role.id}>{role.name || role.title}</span>)}</div>
      <div className="char-skills">{Object.entries(person.skills || {}).map(([skill, value]) => <Metric key={skill} label={humanize(skill)} value={number(value)} />)}</div>
      <div className="char-leader-measures"><Meter label="Stress" value={person.stress} danger /><Meter label="Tjänstelojalitet" value={person.loyalty ?? person.serviceLoyalty} /></div>
      <dl className="char-facts"><div><dt>Åsikt om din företrädare</dt><dd>{signed(person.opinion)}</dd></div><div><dt>Tro</dt><dd>{person.religionName || view.religions?.find((religion) => religion.id === person.religionId)?.name || "Okänd"}</dd></div><div><dt>Född</dt><dd>{dateLabel(person.bornAt)}</dd></div>{!isAlive(person) && <div><dt>Avliden</dt><dd>{dateLabel(person.diedAt)}</dd></div>}<div><dt>Personlig egendom</dt><dd>{number(person.wealth)} silver</dd></div><div><dt>Hälsa</dt><dd>{number(person.health)} / 100</dd></div><div><dt>Rädsla</dt><dd>{number(person.fear)} / 100</dd></div></dl>
      {person.healthConditions?.length > 0 && <section className="char-health-record"><h4>Hälsa och återhämtning</h4><ul>{person.healthConditions.map((condition) => <li key={condition.id}><strong>{condition.label}</strong><span>{condition.stageLabel}</span>{condition.startedAt && <small>Sedan {dateLabel(condition.startedAt)}</small>}</li>)}</ul></section>}
      {person.opinionReasons?.length > 0 && <details className="char-explanation"><summary>Varför denna åsikt?</summary><ul>{person.opinionReasons.map((reason, index) => <li key={index}>{text(reason)}{reason.value != null ? `: ${signed(reason.value)}` : ""}</li>)}</ul></details>}
      {person.goalLabel && <div className="char-goal"><span>Mål och drivkrafter</span><p>{person.goalLabel}</p></div>}
      {person.lastDecision && <div className="char-reason-box"><strong>Senaste egna beslut</strong><p>{text(person.lastDecision.description || person.lastDecision.reason || person.lastDecision)}</p></div>}
      <h4>Familjeband</h4><div className="char-kinship">{entries(person.biologicalParentIds).map((id, index) => <span key={`parent-${index}`}>Biologisk förälder: {peopleById[id]?.name || "Okänd"}</span>)}{entries(person.legalParentIds).filter((id) => !(person.biologicalParentIds || []).includes(id)).map((id, index) => <span key={`legal-parent-${index}`}>Juridisk förälder: {peopleById[id]?.name || "Okänd"}</span>)}{person.spouseId && <span>Partner: {peopleById[person.spouseId]?.name || "Okänd"}</span>}{people.filter((candidate) => (candidate.legalParentIds || []).includes(person.id)).map((child) => <button key={child.id} className="char-text-button" onClick={() => selectPerson(child.id)}>Barn: {child.name}</button>)}</div>
      {person.relations?.length > 0 && <><h4>Personliga förbindelser</h4><div className="char-kinship">{person.relations.map((relation) => <button className="char-text-button" key={relation.targetId} onClick={() => selectPerson(relation.targetId)}>{relation.targetName} · {(relation.types || []).map((type) => ({ friend: "vän", rival: "rival", mentor: "mentor", spouse: "partner", ally: "allierad", patron: "beskyddare", resentment: "oförrätt" })[type] || humanize(type)).join(", ")}</button>)}</div></>}
      <h4>Minnen som följer personen</h4>{memories.length ? <MemoryList memories={memories.slice(-12).reverse()} people={peopleById} /> : <p className="char-caption">Inga kända personliga minnen har ännu registrerats.</p>}
    </article> : <Empty title="Ingen vald person">Välj en person i listan.</Empty>}</div></>;
}

function FamiliesView({ view }) {
  const people = Object.fromEntries(entries(view.people).map((person) => [person.id, person]));
  return <><div className="char-section-heading"><div><span className="char-eyebrow">Egendom, intressen och ställning</span><h3>Familjerna formar politiken</h3></div></div><p className="char-intro">En vänskap är personlig. Familjens stöd beror också på ämbeten, egendom och tidigare löften.</p>
    <div className="char-family-grid">{entries(view.families).map((family) => <article className={`char-card char-family-card${view.identity?.familyId === family.id ? " char-family-card--player" : ""}`} key={family.id}><div className="char-section-heading"><span className="char-eyebrow">{view.mode === "family" && view.identity?.familyId === family.id ? "Din familj" : "Politisk familj"}</span><span className="char-family-sigil" aria-hidden="true">{initials(family.name)}</span></div><h3>{family.name}</h3><p>Företrädare: <strong>{family.headName || people[family.headId]?.name || "Vakant"}</strong></p><div className="char-metrics-grid"><Metric label="Gemensam kassa" value={number(family.treasury)} note="mynt" /><Metric label="Inflytande" value={number(family.influence)} /><Metric label="Egendomar" value={typeof family.estates === "number" ? number(family.estates) : entries(family.estates || family.properties).length} /><Metric label="Politiskt stöd" value={signed(family.support)} /></div>{family.interest && <p className="char-goal"><span>Familjens intresse</span>{text(family.interest)}</p>}{family.statusLabel && <span className="char-badge">{family.statusLabel}</span>}{family.exiled && <span className="char-badge char-badge--warning">I exil</span>}
      {family.guardianName && <p className="char-caption">Förmyndare: <strong>{family.guardianName}</strong></p>}
      {family.exiled && <p className="char-caption">{family.hostPolityName ? <>Beskyddare: <strong>{family.hostPolityName}</strong></> : "Utan skydd. Familjen behöver finna en värd som kan ge den fristad."}</p>}
      <div className="char-family-members">{entries(view.people).filter((person) => person.familyId === family.id && isAlive(person)).map((person) => <span key={person.id}>{person.name}{person.age != null ? ` (${person.age})` : ""}</span>)}</div>
      {family.supportReasons?.length > 0 && <details className="char-explanation"><summary>Varför detta stöd?</summary><ul>{family.supportReasons.map((reason, index) => <li key={index}>{text(reason)}{reason.value != null ? `: ${signed(reason.value)}` : ""}</li>)}</ul></details>}
    </article>)}</div>
    <div className="char-section-heading"><div><span className="char-eyebrow">Tro och institutioner</span><h3>Religiösa samfund</h3></div></div><div className="char-family-grid">{entries(view.religions).map((religion) => <article className="char-card" key={religion.id}><h4>{religion.name}</h4><p>{religion.description || "Samfundets politiska stöd påverkar rikets sammanhållning."}</p><div className="char-inline-stats"><span>Stöd <strong>{signed(religion.support)}</strong></span>{religion.leaderId && <span>Ledare <strong>{people[religion.leaderId]?.name || "Okänd"}</strong></span>}</div></article>)}</div>
  </>;
}

function GovernanceSummary({ view }) {
  const governance = view.governance || view.succession || {};
  if (!governance.actualRulerName && governance.realmAlive !== false) return <AuthoritySummary view={view} />;
  return <section className="char-card char-governance"><span className="char-eyebrow">Makt och rättsligt anspråk</span><h3>{governance.realmAlive === false ? "Riket är upplöst" : governance.contestedCrown ? "Tronen är omstridd" : "Härskarmakt och arvsrätt"}</h3>
    <dl className="char-facts"><div><dt>Faktisk härskare</dt><dd>{governance.actualRulerName || "Ingen härskare"}</dd></div><div><dt>Rättsligt erkänd härskare</dt><dd>{governance.lawfulRulerName || "Inte avgjort"}</dd></div><div><dt>Rättslig arvinge</dt><dd>{governance.legalHeirName || "Ingen fastställd arvinge"}</dd></div></dl>
    {governance.contestedCrown && <p className="char-caption">Den som utövar makten och den som har det rättsliga anspråket är olika personer. Ett maktskifte tar inte automatiskt bort familjens arvsrätt.</p>}
    <AuthoritySummary view={view} />
    {entries(governance.regencies).map((regency) => <div className="char-goal" key={regency.id}><span>{authorityReasons[regency.phase] || "Regentskap"}</span>{regency.regentName ? regency.phase === "contested" ? <><strong>{regency.regentName}</strong> och {regency.principalName} har en olöst överlämning.</> : <><strong>{regency.regentName}</strong> förvaltar makten för {regency.principalName}.</> : <>Ingen behörig regent finns för {regency.principalName}.</>}{regency.regentName && regency.vetoedActions?.length > 0 && <p>Regenten kan stoppa {regency.vetoedActions.length} typer av beslut. Begär samtycke under Beslut.</p>}{regency.grants?.length > 0 && <p>{regency.grants.length} samtycken har beviljats.</p>}</div>)}
    {governance.claims?.length > 0 && <details className="char-explanation"><summary>Personer med tronanspråk</summary><ul>{governance.claims.map((claim, index) => <li key={`${claim.personId || claim.personName}-${index}`}><strong>{claim.personName}</strong>{claim.familyName ? ` · ${claim.familyName}` : ""}</li>)}</ul></details>}
  </section>;
}

function SuccessionForecast({ forecast }) {
  if (!forecast) return null;
  const personSummary = (person) => person ? <><strong>{person.name}</strong><p>{person.familyName} · {person.age} år · {person.archetypeLabel}</p><p>Förmåga: <strong>{person.ability?.label || 'Ingen angiven'}</strong></p><p className="char-caption">{person.ability?.description}</p></> : <p>Ingen levande innehavare.</p>;
  const projects = forecast.projects;
  const projectList = (items) => items.length ? <ul>{items.map((project) => <li key={project.id}><strong>{project.title}</strong> · Uppdragsgivare: {project.ownerName}{project.familyName ? ` · Ägare: ${project.familyName}` : ''}</li>)}</ul> : <p className="char-caption">Inga aktiva projekt i denna kategori.</p>;
  return <section className="char-card char-succession char-succession-forecast" aria-labelledby="succession-forecast-heading">
    <span className="char-eyebrow">Prognos från dagens läge</span>
    <h3 id="succession-forecast-heading">Om härskaren avlider</h3>
    <p>{forecast.basis}</p>
    <p>Faktisk härskare: <strong>{forecast.actualRuler?.name || 'Ingen'}</strong>. Rättslig pretendent: <strong>{forecast.lawfulRuler?.name || 'Ingen'}</strong>. Rättslig arvinge: <strong>{forecast.legalHeir?.name || 'Ingen'}</strong>.</p>
    {forecast.contestedCrown && <p className="char-badge char-badge--warning">Tronen är omstridd. Den rättsliga arvingen behöver inte bli faktisk härskare.</p>}
    <div className="char-succession-grid">
      <div><h4>{forecast.currentUsesRegent ? 'Nuvarande regent och förmåga' : 'Nuvarande härskare och förmåga'}</h4>{forecast.currentExercising ? personSummary(forecast.currentExercising) : <p>Ingen myndig person utövar mandatet.</p>}<p>{forecast.currentAuthority}</p></div>
      <div><h4>Väntad faktisk efterträdare</h4>{personSummary(forecast.expectedRuler)}<p>{forecast.authority}</p>
        {forecast.expectedRuler && <p>{forecast.requiresRegency ? 'Barnets arketyp visas som personuppgift, inte som regentens förmåga.' : forecast.abilityChanges ? 'Mandatet byter arketypförmåga.' : 'Mandatet behåller samma arketypförmåga.'}</p>}
      </div>
    </div>
    <p>{forecast.identity.description}</p>
    {forecast.identity.mode === 'family' && forecast.identity.familyKeepsThrone === false && <p className="char-badge char-badge--warning">Den väntade härskaren tillhör en annan familj. Din familj får inte automatiskt härskarmandat.</p>}
    <h4>Projekt vid härskarens död</h4>
    <div className="char-succession-grid">
      <div><h4>Personliga effekter som upphör</h4><p>Den avlidna härskarens egna tidsbundna effekter avslutas.</p>{projectList(projects.ending)}</div>
      <div><h4>Andra personers effekter</h4><p>Dessa tillhör en annan person. Härskarens död avslutar dem inte i sig. En regents effekt kan upphöra när regentmandatet upphör och ger bara stöd med rätt aktiv innehavare.</p>{projectList(projects.otherPersonal)}</div>
      <div><h4>Offentliga byggen fortsätter</h4><p>Akademier och vattenledningar behåller sitt byggschema vid ett personligt tronskifte. Ett upplöst rike kan inte fortsätta offentliga uppdrag.</p>{projectList(projects.publicConstruction)}{projects.academyEstablished && <p>Den färdiga akademin består vid ett tronskifte.</p>}</div>
      <div><h4>Familjens byggen fortsätter</h4><p>Familjeegendom behåller sin familjeägare och sitt byggschema.</p>{projectList(projects.familyEstates)}</div>
    </div>
  </section>;
}

function OfficesView({ view, setTab }) {
  const people = Object.fromEntries(entries(view.people).map((person) => [person.id, person]));
  const succession = view.succession || {};
  return <><div className="char-section-heading"><div><span className="char-eyebrow">Befogenheter följer ämbetet</span><h3>Vem förvaltar makten?</h3></div><button className="char-button" onClick={() => setTab("decisions")}>Utnämningar och beslut →</button></div><div className="char-offices">{entries(view.offices).map((office) => {
    const holder = people[office.holderId || office.personId];
    return <article className="char-card char-office" key={office.id}><div><span className="char-eyebrow">{office.typeLabel || humanize(office.type || "Ämbete")}</span><h4>{office.name || office.title}</h4><p>{office.description || office.mandate || "Ämbetet har egna befogenheter och skyldigheter."}</p></div><div className="char-office-holder">{holder ? <><Portrait person={holder} size="small" /><span><strong>{holder.name}</strong><small>{holder.familyName}</small></span></> : <span className="char-badge char-badge--warning">Vakant</span>}</div>{office.regentId && <p>Regent: <strong>{people[office.regentId]?.name}</strong></p>}</article>;
  })}</div><GovernanceSummary view={view} /><SuccessionForecast forecast={succession.forecast} />
  <section className="char-card char-succession"><span className="char-eyebrow">Nästa generation</span><h3>Succession och familjens framtid</h3><p>{succession.description || succession.lawLabel || "Härskarämbete, familjeledning och personlig egendom följer egna regler. Familjens gemensamma tillgångar består vid ett personligt arv."}</p><div className="char-succession-grid"><div><h4>Tronföljd</h4>{succession.heirName || succession.heirId ? <p>{succession.heirName || people[succession.heirId]?.name}</p> : <p className="char-caption">Kandidaternas behörighet och stöd avgör övergången.</p>}{entries(succession.candidates).map((candidate, index) => <div className="char-candidate" key={candidate.id || candidate.personId || index}><strong>{candidate.name || people[candidate.personId || candidate.id]?.name}</strong><span>{candidate.reason || candidate.description || [candidate.familyName, candidate.age != null ? `${candidate.age} år` : null, candidate.archetypeLabel].filter(Boolean).join(" · ")}</span></div>)}</div><div><h4>Familjeledning</h4><p>{view.mode === "family" ? "Du fortsätter följa samma familj även om den förlorar tronen. Ämbetets offentliga medel stannar i riket." : "Du fortsätter styra riket även när en ny familj tar makten. Den nya ledningens personlighet och förmågor gäller."}</p>{succession.familyHeadName && <p>Familjens nuvarande företrädare: <strong>{succession.familyHeadName}</strong></p>}{succession.regentName && <p>Regent: <strong>{succession.regentName}</strong></p>}<p className="char-caption">Personligt arv överför den avlidnes egendom och skulder. Det överför inte statens eller familjens gemensamma kassa.</p></div></div></section>
  </>;
}

function MemoryList({ memories, people = {} }) {
  const titles = Object.fromEntries(memories.map((memory) => [memory.id, memory.title]));
  return <ol className="char-memory-list">{memories.map((memory, index) => <li key={memory.id || index}><span className="char-memory-date">{dateLabel(memory.date || memory.createdAt)}</span><div><strong>{memory.title || humanize(memory.type)}</strong><p>{memory.description || memory.text}</p>{memory.participants?.length > 0 && <small>{memory.participants.map((id) => people[id]?.name).filter(Boolean).join(" · ")}</small>}{memory.causeId && <small className="char-memory-cause">Följd av: {memory.causeTitle || titles[memory.causeId] || "ett tidigare beslut"}</small>}</div></li>)}</ol>;
}

function ChronicleView({ view }) {
  const [filter, setFilter] = useState("memories");
  const people = Object.fromEntries(entries(view.people).map((person) => [person.id, person]));
  const records = [...(filter === "memories" ? entries(view.memories) : entries(view.log))].sort((a, b) => compareGameDates(b.date || b.createdAt, a.date || a.createdAt));
  return <><div className="char-section-heading"><div><span className="char-eyebrow">Besluten som världen minns</span><h3>Kampanjens krönika</h3></div><div className="char-segment" aria-label="Typ av historik"><button type="button" aria-pressed={filter === "memories"} onClick={() => setFilter("memories")}>Minnen</button><button type="button" aria-pressed={filter === "log"} onClick={() => setFilter("log")}>Årskrönika</button></div></div><p className="char-intro">En tillfällig känsla kan blekna medan minnet, ett löfte eller ett anspråk består. Här visas det din sida känner till.</p>
    <div className="char-card">{records.length ? <MemoryList memories={records} people={people} /> : <Empty title="En historia tar sin början">Beslut, relationer och generationsskiften kommer att lämna spår här.</Empty>}</div>
    <details className="char-explanation char-rules"><summary>Kampanjens regelversion</summary><dl className="char-facts">{Object.entries(view.versions || {}).filter(([key]) => key !== "provenance").map(([key, value]) => <div key={key}><dt>{({ schema: "Sparformat", rules: "Spelregler", content: "Innehåll" })[key] || key}</dt><dd>{text(value)}</dd></div>)}</dl><p>Regler och balans är egna anpassningar, med inspiration från Old World och Crusader Kings III.</p></details>
  </>;
}

export default function CharactersPanel({ open, onClose }) {
  const worldRevision = useRuntimeState("world", (world) => world?.characterSystem?.revision ?? null);
  const game = useRuntimeState("game");
  const events = useRuntimeState("events");
  const [state, setState] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("council");
  const [personId, setPersonId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [annualBusy, setAnnualBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [yearEvents, setYearEvents] = useState([]);
  const [reportLabel, setReportLabel] = useState("Årets händelser");
  const [interruption, setInterruption] = useState(null);
  const [modelConnectOpen, setModelConnectOpen] = useState(false);
  const [modelCalls, setModelCalls] = useState(() => getModelCallCounts().total);
  const busyRef = useRef(false);
  const readSequence = useRef(0);
  const panelRef = useRef(null);
  const { theme, choice, choose } = useCharacterTheme();
  const refresh = useCallback(async () => {
    const sequence = ++readSequence.current;
    try {
      const visible = await readVisibleCharacterState();
      if (sequence !== readSequence.current) return;
      setState(visible);
      setLoaded(true);
    } catch (reason) {
      if (sequence !== readSequence.current) return;
      setError(reason?.message || "Kampanjen kunde inte läsas.");
      setLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    refresh();
    return () => { readSequence.current += 1; };
  }, [open, worldRevision, game, events, refresh]);
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    panelRef.current?.querySelector("button")?.focus();
    return () => previousFocus?.focus?.();
  }, [open]);
  useEffect(() => { panelRef.current?.querySelector(".char-content")?.scrollTo({ top: 0 }); }, [tab, yearEvents]);
  useEffect(() => subscribeModelCalls((counts) => setModelCalls(counts.total)), []);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);
  useEffect(() => {
    const panel = panelRef.current;
    if (open && panel && !panel.contains(document.activeElement)) panel.querySelector("button:not(:disabled)")?.focus();
  }, [open, busy]);
  const view = useMemo(() => state ? getCharacterPresentation(state) : null, [state]);
  const pending = entries(view?.stories).filter((story) => ["open", "pending", "active"].includes(story.status));
  const perform = useCallback(async (operation, annual = false, withModel = annual, quiet = false) => {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setBusy(true); setAnnualBusy(withModel); setError(""); setNotice("");
    // The result goes back to the caller as well, so a control such as the scheme list can react to a refusal.
    let result;
    try {
      result = await operation();
      if (!result?.ok) { if (!quiet) setError(result?.error || "Handlingen kunde inte genomföras."); }
      else {
        setNotice(result.events?.length ? result.events.slice(-2).map((event) => event.title).join(" · ") : "Beslutet har sparats i kampanjen.");
        if (annual) {
          setYearEvents(result.events || []);
          setInterruption(result.interruption || null);
          setReportLabel(result.interruption ? "Händelser fram till beslutet" : withModel ? "Årets händelser" : "Senaste turens händelser");
        }
      }
      await refresh();
    } catch (reason) {
      result = { ok: false, error: reason?.message || "Handlingen kunde inte sparas. Försök igen." };
      if (!quiet) setError(result.error);
    } finally { busyRef.current = false; setBusy(false); setAnnualBusy(false); }
    return result;
  }, [refresh]);
  // The action box runs its own multi-step flow (interpret, estimate, attempt, narrate) under the same lock as a command.
  const runAction = useCallback(async (work) => {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setBusy(true); setError(""); setNotice("");
    try { return await work(); }
    catch (reason) { setError(reason?.message || "Handlingen kunde inte genomföras. Försök igen."); return undefined; }
    finally { busyRef.current = false; setBusy(false); await refresh(); }
  }, [refresh]);
  const command = (type, payload) => perform(() => submitCharacterCommand({ type, payload, expectedRevision: view?.revision, id: `ui-${crypto.randomUUID()}` }), false, false, type === "abort_scheme");
  const onKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const focusable = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')].filter((element) => element.getClientRects().length);
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  if (!open) return null;
  return <div className="char-backdrop" data-char-theme={theme} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="char-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="characters-title" onKeyDown={onKeyDown}>
      <header className="char-header"><div className="char-brand"><span className="char-brand-mark"><CivicMark /></span><div><span className="char-eyebrow">Open Historia · Dynastier</span><h2 id="characters-title">Rike & familjer</h2></div></div><div className="char-header-controls"><button type="button" className="char-button char-connect-model" aria-expanded={modelConnectOpen} onClick={() => setModelConnectOpen((current) => !current)}>Anslut modell</button><button type="button" className="char-icon-button" onClick={() => choose(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Byt till ljust läge" : "Byt till mörkt läge"} title={theme === "dark" ? "Ljust läge" : "Mörkt läge"}>{theme === "dark" ? "☀" : "☾"}</button><button type="button" className="char-theme-system" aria-pressed={choice === "system"} onClick={() => choose("system")}>Systemtema</button><button type="button" className="char-icon-button char-close" onClick={onClose} aria-label="Stäng Rike & familjer">×</button></div></header>
      {view && <div className="char-campaign-strip"><div><span className="char-mode">{view.mode === "family" ? "FÖLJ FAMILJEN" : "FÖLJ RIKET"}</span><strong>{view.mode === "family" ? view.families.find((family) => family.id === view.identity?.familyId)?.name : (view.identity?.realmName || view.economy?.polityName || "Riket")}</strong><span className="char-date">{dateLabel(view.date)}</span>{view.difficulty?.label && <span className="char-difficulty">Svårighetsgrad: {view.difficulty.label}</span>}</div><button type="button" className="char-button char-button--advance" disabled={busy || view.status?.ended || view.status === "ended"} onClick={() => perform(() => advanceCharacterYearWithModel(), true)}>{busy ? "Bearbetar…" : "Nästa år med modellen"}<span aria-hidden="true"> →</span></button></div>}
      <nav className="char-nav" aria-label="Rike och familjer">{TABS.map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>{label}{id === "decisions" && pending.length > 0 && <span className="char-tab-count">{pending.length}</span>}</button>)}</nav>
      <div className="char-content" aria-busy={busy}>
        {modelConnectOpen && <LocalModelConnect onAdvanced={() => window.dispatchEvent(new Event("oh:open-character-model-settings"))} />}
        {view && events?.length > 0 && !yearEvents.length && !error && <div className="char-section-heading"><button type="button" className="char-text-button" disabled={busy} title="Läs den senaste sparade turen utan att låta tiden gå" onClick={() => perform(revealLatestCharacterTurn, true, false)}>Visa senaste turens händelser →</button></div>}
        {error && <div className="char-feedback char-feedback--error" role="alert"><strong>Beslutet kunde inte genomföras</strong><span>{error}</span>{error.includes("Läs färdigt") && <button type="button" className="char-button" disabled={busy} onClick={() => perform(revealLatestCharacterTurn, true, false)}>Visa senaste turens händelser</button>}<button type="button" className="char-text-button" onClick={() => setError("")}>Stäng meddelandet</button></div>}
        {notice && <div className="char-feedback" role="status">{notice}</div>}
        {annualBusy && <div className="char-feedback" role="status"><strong>Modellen arbetar med årets händelser</strong><span>Det kan ta några minuter. Du kan läsa om personer och familjer eller stänga panelen under tiden. Årets resultat visas här när det är färdigt.</span></div>}
        {interruption && <div className="char-feedback char-care-notice" role="status"><strong>{interruption.type === "health-care" ? "Tiden stannade vid ett vårdärende" : "Tiden stannade vid en karaktärshändelse"}</strong><span>{interruption.message}</span>{pending.length > 0 && <button type="button" className="char-button" onClick={() => setTab("decisions")}>Gå till besluten →</button>}</div>}
        {yearEvents.length > 0 && <details className="char-card char-year-report" open><summary><span className="char-eyebrow">Berättelsen och beslutens följder</span><strong>{reportLabel} · {yearEvents.length}</strong></summary><MemoryList memories={yearEvents} people={Object.fromEntries(entries(view?.people).map((person) => [person.id, person]))} /></details>}
        {!loaded && <Empty title="Hovets handlingar hämtas…">Läser kampanjens aktuella tillstånd.</Empty>}
        {loaded && !view && <Empty title="Den här kampanjen har inget karaktärssystem">Starta en dynastikampanj från huvudmenyn för att välja mellan riket och familjen.</Empty>}
        {view && <>
          {view.governance?.realmAlive === false && !view.status?.ended && <div className="char-feedback"><strong>Riket har upplösts</strong><span>Familjen består, men de gamla riksämbetena ger ingen makt. Sök en fristad under Beslut och följ familjens tillgångar och beskyddare under Familjer.</span></div>}
          {(view.status?.ended || view.status === "ended") && <div className="char-feedback char-feedback--error"><strong>Kampanjen är avslutad</strong><span>{view.status?.reason || "Kampanjens fortsättningsvillkor är inte längre uppfyllda."}</span></div>}
          {tab === "council" && <CouncilView view={view} pending={pending} onCommand={command} busy={busy} setTab={setTab} selectPerson={setPersonId} runAction={runAction} />}
          {tab === "people" && <PeopleView view={view} selectedId={personId} selectPerson={setPersonId} />}
          {tab === "families" && <FamiliesView view={view} />}
          {tab === "offices" && <OfficesView view={view} setTab={setTab} />}
           {tab === "decisions" && <><div className="char-section-heading"><div><span className="char-eyebrow">Dina val formar nästa år</span><h3>Ärenden och handlingar</h3></div></div>{pending.map((story) => <StoryCard key={story.id} story={story} person={view.people.find((person) => person.id === story.actorId)} onCommand={command} busy={busy} />)}<p className="char-intro">Välj en handling för att se berörda personer och kostnader. Olika personer kan företräda riket och hushållet. Varje handling följer den ansvariga aktörens mandat, resurser och personlighet.</p><div className="char-actions-grid">{entries(view.actions).map((action) => <ActionCard key={`${action.type}-${view.revision}`} action={action} onCommand={command} busy={busy} />)}</div>{!view.actions?.length && <Empty title="Inga handlingar är möjliga just nu">Läs de pågående ärendena eller låt tiden gå till nästa beslutspunkt.</Empty>}<ChainHistory chains={view.chainHistory} /></>}
          {tab === "chronicle" && <ChronicleView view={view} />}
        </>}
      </div>
      <footer className="char-footer"><span>{view?.mode === "family" ? "Din familj består genom maktskiften." : "Dina ledare skiftar. Riket består."}</span><span>Modellanrop denna session: {modelCalls}</span><span>{busy ? "Arbetar med kampanjen…" : "Beslut sparas automatiskt"}</span></footer>
    </section>
  </div>;
}
