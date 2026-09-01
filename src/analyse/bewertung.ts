/**
 * Bewertung gegen Zielprofile (Konzept 4). Reine Funktionen, kein
 * Obsidian-Import — die Profile selbst (Zielwertprofile, Konzept 4.3)
 * liegen in settings/profiles.ts, weil dort auch die Verwaltung eigener
 * Profile passiert; dieses Modul kennt nur den `Profil`-Typ.
 */

import type { KennzahlStatus } from "./types";

/**
 * Wie weit über dem Zielwert eine Kennzahl noch "gelb" statt "rot" ist.
 * Vom Konzept nicht spezifiziert (4.3 nennt nur die "≤"-Obergrenze selbst,
 * keine Gelb/Rot-Bänder) — gesetzt, nicht gemessen, wie die Zielwerte
 * selbst. Anpassbar, falls sich das in der Praxis als zu eng/weit erweist.
 */
const ROT_FAKTOR = 1.3;

/** Hysterese-Breite (Konzept 2.4): 5 % unter der Schwelle, bevor eine Kennzahl "zurückspringt". */
const HYSTERESE = 0.05;

export interface BewertungsErgebnis {
	status: KennzahlStatus;
	ziel?: string;
}

const STATUS_RANG: Record<KennzahlStatus, number> = { gruen: 0, gelb: 1, neutral: 1, rot: 2 };

/**
 * Bewertet `wert` gegen eine "≤"-Zielobergrenze. Ohne `ziel` (Profil "Frei"
 * oder eine Kennzahl, die im Profil nicht definiert ist) bleibt der Status
 * `neutral` — "keine Schwellen, nur Zahlen" (Konzept 4.3).
 *
 * Hysterese (Konzept 2.4): Eine Verbesserung (rot→gelb, gelb/rot→grün)
 * wird erst übernommen, wenn der Wert die jeweilige Schwelle um 5 %
 * unterschreitet; eine Verschlechterung greift sofort. Ohne
 * `vorherigerStatus` (erster Analyselauf) gilt der reine Schwellenwert.
 */
export function bewerte(
	wert: number,
	ziel: number | undefined,
	zielBeschreibung: string,
	vorherigerStatus?: KennzahlStatus
): BewertungsErgebnis {
	if (ziel === undefined) return { status: "neutral" };

	const gruenGrenze = ziel;
	const rotGrenze = ziel * ROT_FAKTOR;
	const roh: KennzahlStatus = wert <= gruenGrenze ? "gruen" : wert <= rotGrenze ? "gelb" : "rot";

	let status = roh;
	if (vorherigerStatus && vorherigerStatus !== "neutral" && STATUS_RANG[roh] < STATUS_RANG[vorherigerStatus]) {
		if (roh === "gruen" && wert > gruenGrenze * (1 - HYSTERESE)) {
			status = vorherigerStatus;
		} else if (roh === "gelb" && vorherigerStatus === "rot" && wert > rotGrenze * (1 - HYSTERESE)) {
			status = vorherigerStatus;
		}
	}

	return { status, ziel: `≤ ${ziel} (${zielBeschreibung})` };
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;
const PROFIL_FELD_REGEX = /^[ \t]*textanalyse-profil[ \t]*:[ \t]*["']?([a-zA-Z0-9_-]+)["']?[ \t]*$/im;

/**
 * Liest `textanalyse-profil: <id>` aus dem Frontmatter (Konzept 4.3: "pro
 * Notiz per Frontmatter überschreibbar"). Liefert `undefined`, wenn es
 * kein Frontmatter oder kein solches Feld gibt — der Aufrufer entscheidet,
 * ob die genannte ID zu einem bekannten Profil gehört.
 */
export function liesProfilUeberschreibung(rohtext: string): string | undefined {
	const frontmatterMatch = FRONTMATTER_REGEX.exec(rohtext);
	if (!frontmatterMatch) return undefined;
	const feldMatch = PROFIL_FELD_REGEX.exec(frontmatterMatch[1]);
	return feldMatch?.[1];
}
