/**
 * Analysekern. Importiert bewusst nichts aus "obsidian" (siehe Konzept 2.1),
 * damit dieser Ordner isoliert mit Vitest testbar bleibt.
 *
 * Stand M7: Fundament (M1), Lesbarkeits-/Rhythmus-Kennzahlen (M2),
 * Stilmarker (M3), Cursor-Satz-Ausschluss (M4), Editor-Markierungen (M5),
 * Passiv-Erkennung/Komposita (M6) plus Zielprofile (Konzept 4.3):
 * `status`/`ziel` der fünf profilgebundenen Kennzahlen (Schulstufe,
 * Ø Satzlänge, Lange Sätze, Nominalstil, Passivquote) werden jetzt gegen
 * `optionen.profil` bewertet, inkl. Hysterese (bewertung.ts) und
 * Frontmatter-Override (`textanalyse-profil: <id>`). Ohne `profil` bleibt
 * alles wie bisher `neutral` — rückwärtskompatibel zu M2-M6.
 */

import { maskiere } from "./vorbereitung";
import { segmentiereSaetze, tokenisiereWoerter } from "./tokenize";
import { pruefeSprache } from "./sprache";
import { berechneWSTF, berechneLIX, berechneSatzlaengenStatistik } from "./lesbarkeit";
import {
	berechneMAD,
	berechneVariationskoeffizient,
	klassifiziereRhythmus,
	findeGleichfoermigePassagen,
} from "./rhythmus";
import { analysiereWortschatz, alleBekanntQuelle, findeSeltenesWortBefunde } from "./wortschatz";
import type { Frequenzquelle } from "./wortschatz";
import { findeFuellwoerter } from "./stil/fuellwoerter";
import { findePerfektkonstruktionen } from "./stil/perfekt";
import { findeNominalstil } from "./stil/nominalstil";
import { findeStreckverben } from "./stil/streckverben";
import { findePassivkonstruktionen } from "./stil/passiv";
import { bewerte, liesProfilUeberschreibung } from "./bewertung";
import type { Ergebnis, Kennzahl, Befund, Profil, KennzahlStatus } from "./types";

export type { Ergebnis, Kategorie, Sicherheit, Befund, Kennzahl } from "./types";
export { maskiere } from "./vorbereitung";
export type { MaskierungsErgebnis } from "./vorbereitung";
export { segmentiereSaetze, tokenisiereWoerter } from "./tokenize";
export type { Satz, Wort } from "./tokenize";
export { zaehleSilben } from "./silben";
export { pruefeSprache, FUNKTIONSWOERTER } from "./sprache";
export {
	berechneWSTF,
	berechneLIX,
	berechneSatzlaengenStatistik,
} from "./lesbarkeit";
export {
	berechneMAD,
	berechneVariationskoeffizient,
	klassifiziereRhythmus,
	findeGleichfoermigePassagen,
} from "./rhythmus";
export {
	analysiereWortschatz,
	alleBekanntQuelle,
	ladeDerewoFrequenzquelle,
	mitUeberschreibungen,
	mitKompositazerlegung,
	findeSeltenesWortBefunde,
} from "./wortschatz";
export type { Frequenzquelle, WortschatzErgebnis } from "./wortschatz";
export { findeFuellwoerter, STANDARD_FUELLWOERTER } from "./stil/fuellwoerter";
export { findePerfektkonstruktionen, istWahrscheinlichPartizipZwei, SEIN_FORMEN } from "./stil/perfekt";
export { findeNominalstil, STANDARD_AUSNAHMEN } from "./stil/nominalstil";
export { findeStreckverben, STANDARD_STRECKVERBEN } from "./stil/streckverben";
export { findePassivkonstruktionen } from "./stil/passiv";
export { bewerte, liesProfilUeberschreibung } from "./bewertung";
export type { Profil, KennzahlStatus } from "./types";

export interface AnalyseOptionen {
	/** Auslöserzeilen für den Schlussteil (Konzept 2.3, Schritt B). Ab M7 aus den Settings befüllt. */
	schlussteilAusloeser?: string[];
	/** Schwellwert für die Deutscherkennung (Konzept 2.5). Standard 5 %. */
	sprachSchwelle?: number;
	/**
	 * Standard: `alleBekanntQuelle` (keine Fachwort-Korrektur/Wortschatz-Signal).
	 * Die echte DeReWo-Wortliste lädt asynchron (`ladeDerewoFrequenzquelle()`,
	 * siehe wortschatz.ts) — einmal beim Plugin-Start laden (ab M4) und hier
	 * übergeben, damit `analysiere()` selbst synchron bleiben kann.
	 */
	frequenzquelle?: Frequenzquelle;
	/**
	 * Zeichenoffset der Cursorposition im Rohtext (Konzept 2.2). Wenn
	 * gesetzt und ein Satz gefunden wird, der diese Position enthält, wird
	 * genau dieser Satz vor der Auswertung aus der Satzliste entfernt —
	 * er ist beim Tippen fast immer unfertig und würde sonst als
	 * `sehr-langer-satz`/`seltenes-wort` falsch auffallen.
	 */
	cursorOffset?: number;
	/**
	 * Aktives Zielprofil (Konzept 4.3). Ohne Profil bleiben alle Kennzahlen
	 * `status: "neutral"` (wie bisher) — Rückwärtskompatibilität zu M2-M6.
	 * `profilUeberschreibungen` sind alle bekannten Profile (Standard +
	 * eigene, aus den Settings), damit ein `textanalyse-profil: <id>` im
	 * Frontmatter der Notiz das `profil`-Argument übersteuern kann; ohne
	 * Treffer dort gilt `profil`.
	 */
	profil?: Profil;
	profilUeberschreibungen?: Record<string, Profil>;
	/**
	 * Zuletzt angezeigter Status je Kennzahl-ID, für die Hysterese aus
	 * Konzept 2.4 ("kein Farbflackern"). Der Aufrufer (main.ts) hält diesen
	 * Zustand zwischen Analyseläufen und reicht ihn hier wieder herein —
	 * `analysiere()` selbst bleibt zustandslos.
	 */
	vorherigeStatus?: Partial<Record<string, KennzahlStatus>>;
	/** Wortlisten-Overrides (Konzept, Settings-Wortlisten-Editor). Ohne Angabe gelten die STANDARD_*-Listen der jeweiligen stil/*.ts-Module. */
	fuellwoerterListe?: string[];
	nominalstilAusnahmen?: Set<string>;
	streckverbenListe?: string[];
}

function zeileAusZeichenoffset(rohtext: string, offset: number): number {
	let zeile = 0;
	for (let i = 0; i < offset && i < rohtext.length; i++) {
		if (rohtext[i] === "\n") zeile++;
	}
	return zeile;
}

export function analysiere(rohtext: string, optionen: AnalyseOptionen = {}): Ergebnis {
	const start = performance.now();

	const maskierung = maskiere(rohtext, optionen.schlussteilAusloeser ?? []);
	const alleSaetze = segmentiereSaetze(maskierung.maskiert);

	let saetze = alleSaetze;
	let aktuellerSatzAusgenommen = false;
	if (optionen.cursorOffset !== undefined) {
		const cursor = optionen.cursorOffset;
		const index = alleSaetze.findIndex((s) => cursor >= s.von && cursor <= s.bis);
		if (index !== -1) {
			saetze = alleSaetze.filter((_, i) => i !== index);
			aktuellerSatzAusgenommen = true;
		}
	}

	const woerterAnalysiert = saetze.flatMap((s) => s.woerter);
	const woerterGesamt = tokenisiereWoerter(rohtext).length;
	const satzlaengen = saetze.map((s) => s.woerter.length);
	const quelle = optionen.frequenzquelle ?? alleBekanntQuelle;

	const profilUeberschreibungId = liesProfilUeberschreibung(rohtext);
	const profil =
		(profilUeberschreibungId && optionen.profilUeberschreibungen?.[profilUeberschreibungId]) ||
		optionen.profil;
	const vorherigeStatus = optionen.vorherigeStatus ?? {};

	const sprachpruefung = pruefeSprache(
		woerterAnalysiert.map((w) => w.text),
		optionen.sprachSchwelle
	);

	const kennzahlen: Kennzahl[] = [];
	let befunde: Befund[] = [];

	// Kennzahlen und Stilmarker nur berechnen, wenn es überhaupt Sätze gibt
	// und der Text als Deutsch erkannt wurde — sonst sind Mittelwerte etc.
	// undefiniert (0/0), und die Stilmarker-Wortlisten sind deutschspezifisch
	// (auf Englisch würde z. B. "-tion" ständig als Nominalstil anschlagen).
	if (sprachpruefung.istDeutsch && saetze.length > 0) {
		const wstf = berechneWSTF(woerterAnalysiert, satzlaengen, quelle);
		const lix = berechneLIX(woerterAnalysiert, satzlaengen);
		const satzstatistik = berechneSatzlaengenStatistik(satzlaengen);
		const mad = berechneMAD(satzlaengen);
		const rhythmusKlasse = klassifiziereRhythmus(mad);
		const wortschatz = analysiereWortschatz(woerterAnalysiert, quelle);

		const fuellwortBefunde = findeFuellwoerter(saetze, rohtext, optionen.fuellwoerterListe);
		const perfektBefunde = findePerfektkonstruktionen(saetze, rohtext);
		const nominalstilBefunde = findeNominalstil(saetze, rohtext, optionen.nominalstilAusnahmen);
		const streckverbBefunde = findeStreckverben(saetze, rohtext, optionen.streckverbenListe);
		const passivBefunde = findePassivkonstruktionen(saetze, rohtext);
		const woerterAnzahl = woerterAnalysiert.length;
		const proHundertWoerter = (anzahl: number) =>
			woerterAnzahl === 0 ? 0 : (anzahl / woerterAnzahl) * 100;

		befunde = [
			...findeGleichfoermigePassagen(saetze, rohtext),
			...fuellwortBefunde,
			...perfektBefunde,
			...nominalstilBefunde,
			...streckverbBefunde,
			...passivBefunde,
			...findeSeltenesWortBefunde(woerterAnalysiert, quelle, rohtext),
		];

		// Passivquote (Konzept 4.2): Anteil der SÄTZE mit mindestens einer
		// Passivkonstruktion, in % aller Sätze. Zustandspassiv zählt bewusst
		// nicht mit (siehe stil/passiv.ts).
		const echtePassivBefunde = passivBefunde.filter((b) => b.kategorie === "passiv");
		const saetzeMitPassiv = saetze.filter((s) =>
			echtePassivBefunde.some((b) => b.von >= s.von && b.bis <= s.bis)
		).length;
		const passivquote = saetze.length === 0 ? 0 : (saetzeMitPassiv / saetze.length) * 100;
		const zustandspassivAnzahl = passivBefunde.length - echtePassivBefunde.length;

		// Bewertung gegen das aktive Zielprofil (Konzept 4.3) — ohne Profil
		// (kein `optionen.profil` übergeben) bleibt alles "neutral", wie vor
		// M7. `zielBeschreibung` erscheint im Tooltip als Herkunftshinweis.
		const zielBeschreibung = profil ? `Profil ${profil.name}, gesetzter Wert` : "";
		const bewSchulstufe = bewerte(wstf.roh, profil?.zielSchulstufe, zielBeschreibung, vorherigeStatus.schulstufe);
		const bewSatzlaenge = bewerte(
			satzstatistik.mittelwert,
			profil?.zielSatzlaenge,
			zielBeschreibung,
			vorherigeStatus["satzlaenge-mittel"]
		);
		const bewLangeSaetze = bewerte(
			satzstatistik.anteilUeber20,
			profil?.zielLangeSaetze,
			zielBeschreibung,
			vorherigeStatus["lange-saetze"]
		);
		const bewPassivquote = bewerte(
			passivquote,
			profil?.zielPassivquote,
			zielBeschreibung,
			vorherigeStatus.passivquote
		);
		const nominalstilGesamt = nominalstilBefunde.length + streckverbBefunde.length;
		const bewNominalstil = bewerte(
			proHundertWoerter(nominalstilGesamt),
			profil?.zielNominalstil,
			zielBeschreibung,
			vorherigeStatus.nominalstil
		);

		kennzahlen.push(
			{
				id: "schulstufe",
				label: "Lesbarkeit (WSTF)",
				wert: wstf.roh,
				anzeige: `Schulstufe ${Math.round(wstf.roh)}`,
				nebenwert:
					wstf.ausgeschlosseneFachbegriffe > 0
						? `ohne ${wstf.ausgeschlosseneFachbegriffe} Fachbegriffe: Schulstufe ${Math.round(wstf.korrigiert)}`
						: undefined,
				status: bewSchulstufe.status,
				ziel: bewSchulstufe.ziel,
				sicherheit: "hoch",
				tooltip:
					"Wiener Sachtextformel 1. Miss überwiegend Wortlänge, nicht nur Satzbau — deshalb die Fachwort-Korrektur daneben. " +
					(profil ? "Zielwert ist gesetzt, nicht gemessen, und in den Settings anpassbar." : "Kein Zielprofil aktiv."),
			},
			{
				id: "lix",
				label: "LIX (zweite Meinung)",
				wert: lix,
				anzeige: `LIX ${lix.toFixed(1)}`,
				status: "neutral",
				sicherheit: "hoch",
				tooltip: "Läsbarhetsindex, zweite Formel zur Einordnung. Weicht sie stark von der Schulstufe ab, ist das selbst ein Signal.",
			},
			{
				id: "satzlaenge-mittel",
				label: "Ø Satzlänge",
				wert: satzstatistik.mittelwert,
				anzeige: `${satzstatistik.mittelwert.toFixed(1)} Wörter/Satz`,
				nebenwert: `Median ${satzstatistik.median}, Max ${satzstatistik.max}`,
				status: bewSatzlaenge.status,
				ziel: bewSatzlaenge.ziel,
				sicherheit: "hoch",
				tooltip: "Mittlere Satzlänge in Wörtern.",
			},
			{
				id: "lange-saetze",
				label: "Lange Sätze",
				wert: satzstatistik.anteilUeber20,
				anzeige: `${satzstatistik.anteilUeber20.toFixed(0)} % über 20 Wörter`,
				nebenwert: `${satzstatistik.anteilUeber30.toFixed(0)} % über 30 Wörter`,
				status: bewLangeSaetze.status,
				ziel: bewLangeSaetze.ziel,
				sicherheit: "hoch",
				tooltip: "Anteil der Sätze mit mehr als 20 bzw. 30 Wörtern, in % aller Sätze.",
			},
			{
				id: "rhythmus",
				label: "Rhythmus",
				wert: mad,
				anzeige: `MAD ${mad.toFixed(1)} — ${rhythmusKlasse}`,
				nebenwert: `Variationskoeffizient ${berechneVariationskoeffizient(satzlaengen).toFixed(2)}`,
				status: "neutral",
				sicherheit: "hoch",
				tooltip:
					"Mittlere absolute Differenz aufeinanderfolgender Satzlängen. Schwellen (gleichförmig <4, sprunghaft >10) sind gesetzt, nicht validiert.",
			},
			{
				id: "fachbegriffe",
				label: "Fachbegriffe",
				wert: wortschatz.anteilUnbekannt,
				anzeige: `${wortschatz.anteilUnbekannt.toFixed(0)} % nicht im Wörterbuch`,
				status: "neutral",
				sicherheit: "mittel",
				tooltip:
					"Anteil der Wörter außerhalb der DeReWo-Wortliste. Abweichung vom Konzept: Es liegt keine nach Häufigkeit sortierte Liste vor, " +
					"sondern nur ein Bekanntheits-Wörterbuch ohne Top-5.000/20.000-Abstufung (siehe scripts/derewo-aufbereiten.ts). " +
					"Eigennamen laufen mangels Erkennung als Fachbegriffe mit.",
			},
			{
				id: "fuellwoerter",
				label: "Füllwörter",
				wert: proHundertWoerter(fuellwortBefunde.length),
				anzeige: `${proHundertWoerter(fuellwortBefunde.length).toFixed(1)} je 100 Wörter`,
				status: "neutral",
				sicherheit: "hoch",
				tooltip: "Treffer aus der Füllwortliste je 100 Wörter. Liste editierbar in den Settings (noch nicht umgesetzt).",
			},
			{
				id: "nominalstil",
				label: "Nominalstil",
				wert: proHundertWoerter(nominalstilGesamt),
				anzeige: `${proHundertWoerter(nominalstilGesamt).toFixed(1)} je 100 Wörter`,
				nebenwert: `${streckverbBefunde.length} Streckverben darunter`,
				status: bewNominalstil.status,
				ziel: bewNominalstil.ziel,
				sicherheit: "mittel",
				tooltip:
					"Substantivierungen (Suffixe wie -ung, -heit, -tion) plus Streckverben (\"zur Anwendung kommen\") je 100 Wörter. " +
					"Sicherheit hängt an der Ausnahmeliste für echte Substantive.",
			},
			{
				id: "perfekt",
				label: "Perfekt",
				wert: proHundertWoerter(perfektBefunde.length),
				anzeige: `${proHundertWoerter(perfektBefunde.length).toFixed(1)} je 100 Wörter`,
				status: "neutral",
				sicherheit: "mittel",
				tooltip:
					"haben/sein + Partizip II im selben Satz, Abstand ≤ 12 Token. Informationswert, kein Zielprofil-Bezug im Konzept. " +
					"Partizip-II-Erkennung ist ohne Lexikon heuristisch.",
			},
			{
				id: "passivquote",
				label: "Passivquote",
				wert: passivquote,
				anzeige: `${passivquote.toFixed(0)} % der Sätze`,
				nebenwert: zustandspassivAnzahl > 0 ? `${zustandspassivAnzahl} Zustandspassiv, separat` : undefined,
				status: bewPassivquote.status,
				ziel: bewPassivquote.ziel,
				sicherheit: "mittel",
				tooltip:
					"Anteil der Sätze mit mindestens einer werden-Passiv- oder Perfekt-Passiv-Konstruktion. Zustandspassiv (sein + Partizip II ohne " +
					'"worden") zählt bewusst nicht mit, ist aber ohne Verblexikon nicht zuverlässig von aktivem Perfekt mit sein-Hilfsverb zu ' +
					'unterscheiden ("Er ist gekommen" vs. "Der Brief ist geschrieben") — Sicherheit deshalb mittel, nicht hoch.',
			}
		);
	}

	return {
		istDeutsch: sprachpruefung.istDeutsch,
		kennzahlen,
		befunde,
		woerter: woerterAnalysiert,
		satzlaengen,
		woerterGesamt,
		woerterMaskiert: Math.max(woerterGesamt - woerterAnalysiert.length, 0),
		aktuellerSatzAusgenommen,
		schlussteilAbZeile:
			maskierung.schlussteilAbZeichen !== undefined
				? zeileAusZeichenoffset(rohtext, maskierung.schlussteilAbZeichen)
				: undefined,
		dauerMs: performance.now() - start,
	};
}
