export interface Benutzer {
  id: string
  mandant_id: string
  name: string
  email: string
}

export interface CreateBenutzer {
  name: string
  email: string
  passwort: string
}

export interface UpdateBenutzer {
  name?: string
  email?: string
}

export interface Beihilfestelle {
  id: string
  mandant_id: string
  name: string
  dienstherr_typ: 'bund' | 'land' | 'kommune'
  personen_ids: string[]
}

export interface Pkv {
  id: string
  mandant_id: string
  name: string
  erstellt_am: string
  personen_ids: string[]
}

export interface CreatePkv {
  name: string
}

export interface UpdatePkv {
  name?: string
}

export interface CreateBeihilfestelle {
  name: string
  dienstherr_typ: 'bund' | 'land' | 'kommune'
}

export interface UpdateBeihilfestelle {
  name?: string
  dienstherr_typ?: 'bund' | 'land' | 'kommune'
}

export interface Person {
  id: string
  mandant_id: string
  name: string
  geburtsdatum: string
  typ: 'erwachsener' | 'kind'
  beihilfestelle_id: string | null
  beihilfe_satz: number
  pkv_satz: number
  bre_schwelle: number | null
}

export interface PersonSatzHistorie {
  id: string
  person_id: string
  beihilfe_satz: number
  pkv_satz: number
  gueltig_ab: string
  erstellt_am: string
}

export interface CreatePersonSatzHistorie {
  beihilfe_satz: number
  pkv_satz: number
  gueltig_ab: string
}

export interface CreatePerson {
  name: string
  geburtsdatum: string
  typ: 'erwachsener' | 'kind'
  beihilfestelle_id?: string
  beihilfe_satz: number
  pkv_satz: number
  bre_schwelle?: number | null
}

export interface UpdatePerson {
  name?: string
  geburtsdatum?: string
  typ?: 'erwachsener' | 'kind'
  beihilfestelle_id?: string
  beihilfe_satz?: number
  pkv_satz?: number
  bre_schwelle?: number | null
}

export interface Correspondent {
  id: string
  mandant_id: string
  name: string
  typ: 'arzt' | 'krankenhaus' | 'apotheke' | 'abrechnungsstelle'
}

export interface CreateCorrespondent {
  name: string
  typ: 'arzt' | 'krankenhaus' | 'apotheke' | 'abrechnungsstelle'
}

export interface UpdateCorrespondent {
  name?: string
  typ?: 'arzt' | 'krankenhaus' | 'apotheke' | 'abrechnungsstelle'
}

export interface Rechnung {
  id: string
  person_id: string
  leistungserbringer_id: string
  typ: 'arzt' | 'apotheke' | 'krankenhaus'
  betrag: number
  datum: string
  zahlungsziel: string | null
  bezahlt_am: string | null
  beihilfe_eingereicht_am: string | null
  pkv_eingereicht_am: string | null
  notiz: string | null
  archiviert_am: string | null
  referenz_nr: number | null
  beihilfe_erstattet_betrag: number | null
  pkv_erstattet_betrag: number | null
  zahlung_status: 'offen' | 'bezahlt'
  beihilfe_status: 'offen' | 'eingereicht' | 'beschieden' | null
  pkv_status: 'offen' | 'eingereicht' | 'beschieden'
  archiviert_status: 'aktiv' | 'archiviert'
  beihilfe_anteil_erwartet: number | null
  pkv_anteil_erwartet: number | null
  beihilfe_differenz: number | null
  pkv_differenz: number | null
  pkv_gescannt: boolean
  beihilfe_gescannt: boolean
  pkv_verzicht: boolean
  paperless_doc_id: number | null
  paperless_uebertragen_am: string | null
}

// Legacy (unused components still reference these)
export interface KanbanBoard {
  neu: Rechnung[]
  bezahlt: Rechnung[]
  beihilfe_eingereicht: Rechnung[]
  pkv_eingereicht: Rechnung[]
  abgeschlossen: Rechnung[]
}
export interface FinanzOverview { [key: string]: number }

export interface BreIndikator {
  person_id: string
  person_name: string
  bre_schwelle: number
  pkv_offen: number
  pkv_eingereicht: number
  bre_spielraum: number
}

export interface BescheidSummary {
  id: string
  antrag_id: string
  referenz_nr: number
  antrag_typ: 'beihilfe' | 'pkv'
  stelle: string | null
  bescheid_datum: string
  ws: boolean
  overridden: boolean
  erstattet: number
  abgelehnt: number
}

export interface DashboardKpis {
  eigenkosten_offen: number
  ausstehende_erstattung: number
  erstattet_ytd: number
  einzureichen_anzahl: number
}

export interface DashboardRechnung {
  id: string
  person_name: string
  betrag: number
  datum: string
  zahlungsziel: string | null
  leistungserbringer_name: string | null
  voraussichtlich: number
  beleg_count: number
}

export interface BhGruppe {
  beihilfestelle_id: string
  beihilfestelle_name: string
  voraussichtlich_gesamt: number
  anzahl: number
  rechnungen: DashboardRechnung[]
}

export interface PkvGruppe {
  pkv_id: string | null
  pkv_name: string
  voraussichtlich_gesamt: number
  anzahl: number
  rechnungen: DashboardRechnung[]
}

export interface LaufenderAntrag {
  id: string
  nr: string
  titel: string | null
  typ: 'beihilfe' | 'pkv'
  status: string
  stelle: string | null
  betrag: number
  versendet_am: string | null
  tage_offen: number | null
  anzahl_rechnungen: number
}

export interface DashboardData {
  benutzer_name: string
  aktuelles_jahr: number
  kpis: DashboardKpis
  bezahlen: DashboardRechnung[]
  bh_gruppen: BhGruppe[]
  pkv_gruppen: PkvGruppe[]
  laufende_antraege: LaufenderAntrag[]
  letzte_bescheide: BescheidSummary[]
  bre: BreIndikator[]
}

export interface Anhang {
  id: string
  rechnung_id: string
  dateiname: string
  groesse: number
  hochgeladen_am: string
}

export interface BescheidAnhang {
  id: string
  bescheid_id: string
  dateiname: string
  groesse: number
  hochgeladen_am: string
}

export type BelegTyp = 'rechnung' | 'erstbescheid' | 'widerspruchsbescheid' | 'rezept' | 'ueberweisung' | 'sonstiges'

export interface LinkedRechnung {
  id: string
  referenz_nr: number | null
  betrag: number        // Cent
  datum: string
  leistungserbringer: string
  person: string
}

export interface LinkedAntrag {
  id: string
  referenz_nr: number
  typ: 'beihilfe' | 'pkv'
  stelle: string | null
}

export interface Beleg {
  id: string
  dateiname: string
  bezeichnung: string | null
  groesse: number
  typ: BelegTyp | null
  notiz: string | null
  datum: string | null
  hochgeladen_am: string
  has_thumbnail: boolean
  ocr_text: string | null
  ocr_status: 'done' | 'failed' | 'unavailable' | null
  beihilfestelle_id: string | null
  pkv_id: string | null
  linked_rechnungen: LinkedRechnung[]
  linked_antraege: LinkedAntrag[]
}

export interface UpdateBeleg {
  bezeichnung?: string | null
  typ?: BelegTyp | null
  notiz?: string | null
  datum?: string | null
  beihilfestelle_id?: string | null
  pkv_id?: string | null
}

export type BulkAction = 'bezahlt' | 'beihilfe_eingereicht' | 'pkv_eingereicht' | 'archivieren' | 'dearchivieren'

export interface CreateRechnung {
  person_id: string
  leistungserbringer_id: string
  typ: 'arzt' | 'apotheke' | 'krankenhaus'
  betrag: number
  datum: string
  zahlungsziel?: string
  notiz?: string
  pkv_gescannt?: boolean
  beihilfe_gescannt?: boolean
}

export interface UpdateRechnung {
  bezahlt_am?: string
  beihilfe_eingereicht_am?: string
  pkv_eingereicht_am?: string
  notiz?: string
  betrag?: number
  datum?: string
  zahlungsziel?: string
  leistungserbringer_id?: string
  typ?: string
  person_id?: string
  beihilfe_erstattet_betrag?: number | null
  pkv_erstattet_betrag?: number | null
  pkv_gescannt?: boolean
  beihilfe_gescannt?: boolean
  pkv_verzicht?: boolean
}

// ── Beihilfe-Anträge ─────────────────────────────────────────────────────────

export type AntragStatus = 'entwurf' | 'versendet' | 'in_bearbeitung' | 'beschieden' | 'archiviert'

export interface BeihilfeAntrag {
  id: string
  mandant_id: string
  typ: 'beihilfe' | 'pkv'
  beihilfestelle_id: string | null
  pkv_id: string | null
  pkv_versicherer: string | null
  referenz_nr: number
  titel: string | null
  status: AntragStatus
  versendet_am: string | null
  notiz: string | null
  paperless_share_url: string | null
  erstellt_am: string
}

export interface AntragRechnung {
  antrag_id: string
  rechnung_id: string
  widerspruch: boolean
  hinzugefuegt_am: string
}

export interface CreateBeihilfeAntrag {
  typ?: 'beihilfe' | 'pkv'
  beihilfestelle_id?: string
  pkv_id?: string
  pkv_versicherer?: string
  titel?: string
  notiz?: string
}

export interface UpdateBeihilfeAntrag {
  beihilfestelle_id?: string
  pkv_id?: string | null
  pkv_versicherer?: string | null
  titel?: string
  notiz?: string
  versendet_am?: string
  paperless_share_url?: string | null
}

export interface SetAntragStatus {
  status: AntragStatus
  versendet_am?: string
}

// ── Beihilfe-Bescheide ───────────────────────────────────────────────────────

export type BescheidTyp = 'erstbescheid' | 'widerspruchsbescheid'

export interface BeihilfeBescheid {
  id: string
  mandant_id: string
  antrag_id: string
  aktenzeichen: string | null
  bescheid_datum: string
  eingangsdatum: string | null
  erstattungsbetrag_gesamt: number // Cent
  typ: BescheidTyp
  notiz: string | null
  erstellt_am: string
}

export interface BescheidPosition {
  id: string
  bescheid_id: string
  rechnung_id: string
  tatsaechliche_kosten: number | null
  anerkannt_betrag: number | null
  abgelehnt_betrag: number | null
  ablehnungsgrund: string | null
}

export interface CreateBeihilfeBescheid {
  aktenzeichen?: string
  bescheid_datum: string
  eingangsdatum?: string
  erstattungsbetrag_gesamt: number
  typ?: BescheidTyp
  notiz?: string
}

export interface UpdateBeihilfeBescheid {
  aktenzeichen?: string
  bescheid_datum?: string
  eingangsdatum?: string
  erstattungsbetrag_gesamt?: number
  typ?: BescheidTyp
  notiz?: string
}

export interface CreateBescheidPosition {
  rechnung_id: string
  tatsaechliche_kosten?: number | null
  anerkannt_betrag?: number
  abgelehnt_betrag?: number
  ablehnungsgrund?: string
}

export interface UpdateBescheidPosition {
  tatsaechliche_kosten?: number | null
  anerkannt_betrag?: number
  abgelehnt_betrag?: number
  ablehnungsgrund?: string
}

// ── Aktivitätslog ────────────────────────────────────────────────────────────

export interface AktivitaetDiff {
  feld: string
  alt: string | null
  neu: string | null
}

export interface RechnungAktivitaet {
  id: string
  mandant_id: string
  rechnung_id: string
  benutzer_id: string | null
  aktion: string
  aenderungen: string // JSON-String
  erstellt_am: string
}
