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
  beihilfe_status: 'offen' | 'eingereicht' | null
  pkv_status: 'offen' | 'eingereicht'
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

export interface KanbanBoard {
  neu: Rechnung[]
  bezahlt: Rechnung[]
  beihilfe_eingereicht: Rechnung[]
  pkv_eingereicht: Rechnung[]
  abgeschlossen: Rechnung[]
}

export interface FinanzOverview {
  offen_unbezahlt: number
  offen_unbezahlt_beihilfe: number
  offen_unbezahlt_pkv: number
  bezahlt_pkv_offen: number
  bezahlt_pkv_offen_pkv: number
  bezahlt_beihilfe_offen: number
  bezahlt_beihilfe_offen_beihilfe: number
  abgeschlossen: number
  abgeschlossen_beihilfe: number
  abgeschlossen_pkv: number
}

export interface BreIndikator {
  person_id: string
  person_name: string
  bre_schwelle: number
  pkv_offen: number
  bre_spielraum: number
}

export interface DashboardData {
  kanban: KanbanBoard
  finanzen: FinanzOverview
  bre: BreIndikator[]
}

export interface Anhang {
  id: string
  rechnung_id: string
  dateiname: string
  groesse: number
  hochgeladen_am: string
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

// ── PKV ───────────────────────────────────────────────────────────────────────

export interface Pkv {
  id: string
  mandant_id: string
  name: string
  personen_ids: string[]
}

export interface CreatePkv {
  name: string
}

export interface UpdatePkv {
  name?: string
}

// ── Satz-Historie ─────────────────────────────────────────────────────────────

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

// ── Anträge ───────────────────────────────────────────────────────────────────

export type AntragStatus = 'entwurf' | 'versendet' | 'in_bearbeitung' | 'beschieden' | 'archiviert'

export interface BeihilfeAntrag {
  id: string
  mandant_id: string
  typ: 'beihilfe' | 'pkv'
  status: AntragStatus
  referenz_nr: number | null
  titel: string | null
  notiz: string | null
  beihilfestelle_id: string | null
  pkv_id: string | null
  pkv_versicherer: string | null
  paperless_share_url: string | null
  versendet_am: string | null
  erstellt_am: string
  aktualisiert_am: string
}

export interface CreateBeihilfeAntrag {
  typ: 'beihilfe' | 'pkv'
  titel?: string
  notiz?: string
  beihilfestelle_id?: string
  pkv_id?: string
  pkv_versicherer?: string
}

export interface UpdateBeihilfeAntrag {
  titel?: string
  notiz?: string
  beihilfestelle_id?: string | null
  pkv_id?: string | null
  pkv_versicherer?: string | null
  paperless_share_url?: string | null
}

export interface AntragRechnung {
  antrag_id: string
  rechnung_id: string
  widerspruch: boolean
}

// ── Bescheide & Positionen ────────────────────────────────────────────────────

export interface BeihilfeBescheid {
  id: string
  antrag_id: string
  typ: 'bescheid' | 'widerspruchsbescheid'
  dateiname: string
  groesse: number
  analyse_status: 'ausstehend' | 'wird_analysiert' | 'abgeschlossen' | 'fehler'
  analyse_fehler: string | null
  datum: string | null
  aktenzeichen: string | null
  erstellt_am: string
}

export interface BeihilfePosition {
  id: string
  bescheid_id: string
  lfd_nr: number
  rechnungsdatum: string | null
  leistungserbringer: string | null
  rechnungsbetrag: number | null
  anerkannt_betrag: number | null
  abgelehnt_betrag: number | null
  beihilfe_betrag: number | null
  ablehnungsgrund: string | null
  rechnung_id: string | null
  zugeordnet_am: string | null
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
