/**
 * Deutscherkennung (Konzept 2.5). Vor der eigentlichen Analyse wird der
 * Anteil der Tokens geprüft, die zu den häufigsten deutschen
 * Funktionswörtern gehören. Liegt er unter der Schwelle, sind Formeln und
 * Wortlisten nicht anwendbar.
 */

const STANDARD_SCHWELLE = 0.05;

/** Die häufigsten deutschen Funktionswörter (Artikel, Pronomen, Konjunktionen, Präpositionen, Hilfsverben). */
export const FUNKTIONSWOERTER = new Set([
	"der", "die", "das", "den", "dem", "des",
	"ein", "eine", "einer", "eines", "einem", "einen",
	"und", "oder", "aber", "doch", "dass", "weil", "wenn", "als", "wie",
	"ist", "sind", "war", "waren", "sei", "seien",
	"hat", "haben", "hatte", "hatten",
	"wird", "werden", "wurde", "wurden", "worden",
	"ich", "du", "er", "sie", "es", "wir", "ihr",
	"mich", "dich", "sich", "uns", "euch",
	"mein", "dein", "sein", "ihre", "unser", "euer",
	"nicht", "kein", "keine", "auch", "noch", "nur", "schon", "sehr",
	"mehr", "viel", "viele", "alle", "alles", "etwas", "nichts",
	"man", "jemand", "niemand",
	"hier", "dort", "da", "jetzt", "dann", "immer", "nie",
	"in", "an", "auf", "aus", "bei", "mit", "nach", "seit", "von", "vor",
	"zu", "zum", "zur", "zwischen", "über", "unter", "durch", "für", "gegen", "ohne", "um",
	"so", "denn", "also", "zwar", "sondern", "jedoch", "trotzdem",
	"deshalb", "damit", "obwohl", "während", "bevor", "nachdem", "bis",
	"kann", "können", "muss", "müssen", "soll", "sollen",
	"will", "wollen", "darf", "dürfen", "mag", "mögen",
	"würde", "würden", "wäre", "wären", "hätte", "hätten",
]);

export interface SprachpruefungsErgebnis {
	istDeutsch: boolean;
	anteilFunktionswoerter: number;
}

export function pruefeSprache(
	wortformen: string[],
	schwelle: number = STANDARD_SCHWELLE
): SprachpruefungsErgebnis {
	if (wortformen.length === 0) {
		return { istDeutsch: false, anteilFunktionswoerter: 0 };
	}
	let treffer = 0;
	for (const wort of wortformen) {
		if (FUNKTIONSWOERTER.has(wort.toLowerCase())) treffer++;
	}
	const anteil = treffer / wortformen.length;
	return { istDeutsch: anteil >= schwelle, anteilFunktionswoerter: anteil };
}
