import { App, PluginSettingTab, Setting } from "obsidian";
import type TextanalysePlugin from "../main";
import type { Profil } from "../analyse/types";

/**
 * SettingTab, Profilverwaltung, Wortlisten-Editor (Konzept 2.1).
 *
 * Liest/schreibt bewusst direkt auf öffentliche Felder von
 * TextanalysePlugin (siehe main.ts) statt über ein zusätzliches
 * Getter/Setter-Geflecht — Settings.ts ist ohnehin Obsidian-spezifisches
 * UI-Glue, kein Teil des testbaren Analysekerns.
 *
 * Ungetestet in dieser Sandbox (keine echte Obsidian-Instanz verfügbar,
 * siehe main.ts-Kommentar zu holeEditorView) — die Logik dahinter
 * (bewerte(), Profil-Overrides, Wortlisten-Parsing) ist in
 * tests/bewertung.test.ts und tests/index.test.ts abgedeckt.
 */
export class TextanalyseSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: TextanalysePlugin
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Zielprofile" });
		containerEl.createEl("p", {
			text:
				"Zielwerte sind gesetzt, nicht gemessen (Konzept 4.3) — hier direkt anpassbar. " +
				'Profil "Frei" hat keine Zielwerte: Kennzahlen bleiben dann Zahlen ohne Ampelfarbe.',
			cls: "setting-item-description",
		});

		new Setting(containerEl).setName("Standardprofil für neue Notizen").addDropdown((drop) => {
			for (const p of this.plugin.profile) drop.addOption(p.id, p.name);
			drop.setValue(this.plugin.profilStandardId);
			drop.onChange(async (value) => {
				this.plugin.profilStandardId = value;
				await this.plugin.persistiereUndAktualisiere();
			});
		});
		containerEl.createEl("p", {
			text: 'Pro Notiz per Frontmatter überschreibbar: "textanalyse-profil: <id>", z. B. "pressemitteilung".',
			cls: "setting-item-description",
		});

		for (const profil of this.plugin.profile) {
			this.baueProfilSektion(containerEl, profil);
		}

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText("+ Neues Profil")
				.setCta()
				.onClick(async () => {
					const id = `profil-${Date.now()}`;
					this.plugin.profile.push({ id, name: "Neues Profil" });
					await this.plugin.persistiereUndAktualisiere();
					this.display();
				})
		);

		containerEl.createEl("h2", { text: "Wortlisten" });

		this.baueListenFeld(
			containerEl,
			"Füllwörter",
			"Ein Eintrag pro Zeile. Mehrwortige Phrasen erlaubt (\"im Grunde genommen\").",
			() => this.plugin.fuellwoerterListe,
			(zeilen) => {
				this.plugin.fuellwoerterListe = zeilen;
			}
		);
		this.baueListenFeld(
			containerEl,
			"Nominalstil-Ausnahmen",
			"Echte Substantive, die zufällig auf einen Nominalstil-Suffix enden (z. B. \"Zeitung\").",
			() => this.plugin.nominalstilAusnahmenListe,
			(zeilen) => {
				this.plugin.nominalstilAusnahmenListe = zeilen;
			}
		);
		this.baueListenFeld(
			containerEl,
			"Streckverben",
			"Feste Phrasen wie \"zur Anwendung kommen\".",
			() => this.plugin.streckverbenListe,
			(zeilen) => {
				this.plugin.streckverbenListe = zeilen;
			}
		);
		this.baueListenFeld(
			containerEl,
			"Schlussteil-Auslöser",
			'Ab der ersten Zeile, die mit einem dieser Texte beginnt, wird der Rest der Notiz von der Analyse ausgenommen (Konzept 2.3, Schritt B) — z. B. "Zur Studie:", "Kontakt für die Medien:".',
			() => this.plugin.schlussteilAusloeser,
			(zeilen) => {
				this.plugin.schlussteilAusloeser = zeilen;
			}
		);

		containerEl.createEl("h2", { text: "Wortschatz" });
		containerEl.createEl("p", {
			text: 'Gegenstück zur "kenne ich"-Aktion im Panel (Konzept 3.5) — hier vollständig einsehbar und editierbar.',
			cls: "setting-item-description",
		});
		this.baueListenFeld(
			containerEl,
			"Ignorierte Wörter",
			"Gelten als bekannt — weder als seltenes Wort gemeldet noch aus der WSTF-Fachwort-Korrektur herausgerechnet.",
			() => this.plugin.getIgnorierteWoerterZeilen().split("\n").filter(Boolean),
			(zeilen) => this.plugin.setIgnorierteWoerterZeilen(zeilen)
		);
		this.baueListenFeld(
			containerEl,
			"Immer markieren",
			"Gelten als unbekannt, auch wenn das Wörterbuch sie kennt.",
			() => this.plugin.getImmerMarkierenZeilen().split("\n").filter(Boolean),
			(zeilen) => this.plugin.setImmerMarkierenZeilen(zeilen)
		);
	}

	private baueProfilSektion(containerEl: HTMLElement, profil: Profil): void {
		containerEl.createEl("h3", { text: profil.name });

		new Setting(containerEl).setName("Name").addText((t) =>
			t.setValue(profil.name).onChange(async (v) => {
				profil.name = v;
				await this.plugin.persistiereUndAktualisiere();
			})
		);

		this.baueZahlenfeld(containerEl, "Ziel-Schulstufe (WSTF)", profil, "zielSchulstufe");
		this.baueZahlenfeld(containerEl, "Ø Satzlänge (Wörter)", profil, "zielSatzlaenge");
		this.baueZahlenfeld(containerEl, "Passivquote (%)", profil, "zielPassivquote");
		this.baueZahlenfeld(containerEl, "Nominalstil (Treffer je 100 Wörter)", profil, "zielNominalstil");
		this.baueZahlenfeld(containerEl, "Lange Sätze (%)", profil, "zielLangeSaetze");

		if (this.plugin.profile.length > 1) {
			new Setting(containerEl).addButton((btn) =>
				btn.setButtonText("Profil löschen").onClick(async () => {
					this.plugin.profile = this.plugin.profile.filter((p) => p.id !== profil.id);
					if (this.plugin.profilStandardId === profil.id) {
						this.plugin.profilStandardId = this.plugin.profile[0].id;
					}
					await this.plugin.persistiereUndAktualisiere();
					this.display();
				})
			);
		}
	}

	private baueZahlenfeld(
		containerEl: HTMLElement,
		label: string,
		profil: Profil,
		feld: "zielSchulstufe" | "zielSatzlaenge" | "zielPassivquote" | "zielNominalstil" | "zielLangeSaetze"
	): void {
		new Setting(containerEl).setName(label).addText((t) => {
			t.setValue(profil[feld] !== undefined ? String(profil[feld]) : "");
			t.setPlaceholder("kein Zielwert (neutral)");
			t.onChange(async (wert) => {
				const getrimmt = wert.trim();
				if (getrimmt.length === 0) {
					profil[feld] = undefined;
				} else {
					const zahl = Number(getrimmt);
					if (Number.isFinite(zahl)) profil[feld] = zahl;
				}
				await this.plugin.persistiereUndAktualisiere();
			});
		});
	}

	private baueListenFeld(
		containerEl: HTMLElement,
		label: string,
		beschreibung: string,
		getWert: () => string[],
		setWert: (zeilen: string[]) => void
	): void {
		new Setting(containerEl)
			.setName(label)
			.setDesc(beschreibung)
			.addTextArea((ta) => {
				ta.setValue(getWert().join("\n"));
				ta.inputEl.rows = 4;
				ta.inputEl.addClass("textanalyse-settings-textarea");
				ta.onChange(async (wert) => {
					const zeilen = wert
						.split("\n")
						.map((z) => z.trim())
						.filter((z) => z.length > 0);
					setWert(zeilen);
					await this.plugin.persistiereUndAktualisiere();
				});
			});
	}
}
