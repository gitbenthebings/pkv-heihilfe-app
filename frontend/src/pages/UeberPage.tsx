import React from 'react'

const VERSION = '2.3'
const LAST_UPDATE = '21.05.2026'

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '18px 20px',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-subtle)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 14,
}

const pill = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12,
  fontWeight: 500,
  color,
  background: color + '18',
  border: `1px solid ${color}33`,
  borderRadius: 20,
  padding: '3px 10px',
  whiteSpace: 'nowrap',
})

const rule: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text)',
  padding: '5px 0',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  gap: 10,
  alignItems: 'flex-start',
  lineHeight: 1.5,
}

const ruleNum: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--primary)',
  minWidth: 20,
  marginTop: 1,
  flexShrink: 0,
}

function Dot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: color, flexShrink: 0, marginTop: 5,
    }} />
  )
}

function StackGroup({ title, items }: { title: string; items: Array<{ label: string; sub?: string }> }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(({ label, sub }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dot color="var(--primary)" />
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>
            {sub && <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{sub}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function LayerArrow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 6 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text)', background: 'var(--surface-alt)',
        border: '1px solid var(--border)', borderRadius: 5, padding: '3px 10px',
      }}>Handler</div>
      <span style={{ fontSize: 11, color: 'var(--text-subtle)', margin: '0 6px' }}>→</span>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text)', background: 'var(--surface-alt)',
        border: '1px solid var(--border)', borderRadius: 5, padding: '3px 10px',
      }}>Service</div>
      <span style={{ fontSize: 11, color: 'var(--text-subtle)', margin: '0 6px' }}>→</span>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text)', background: 'var(--surface-alt)',
        border: '1px solid var(--border)', borderRadius: 5, padding: '3px 10px',
      }}>Repository</div>
      <span style={{ fontSize: 11, color: 'var(--text-subtle)', margin: '0 6px' }}>→</span>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text)', background: 'var(--surface-alt)',
        border: '1px solid var(--border)', borderRadius: 5, padding: '3px 10px',
      }}>SQLite</div>
    </div>
  )
}

function ModelNode({
  label, color, children,
}: { label: string; color: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color,
        background: color + '14', border: `1px solid ${color}33`,
        borderRadius: 6, padding: '4px 10px', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
      {children && (
        <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 4, top: 0, bottom: 0,
            width: 1, background: color + '44',
          }} />
          {children}
        </div>
      )}
    </div>
  )
}

function SubNode({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 8, height: 1, background: color + '44', flexShrink: 0 }} />
      <div style={{
        fontSize: 11, color,
        background: color + '0e', border: `1px solid ${color}22`,
        borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
    </div>
  )
}

export default function UeberPage() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 0 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero ── */}
      <div style={{
        ...card,
        background: 'linear-gradient(135deg, var(--primary-dim) 0%, var(--surface) 60%)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
              PKV-Abrechnung
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Self-hosted Verwaltung von Arzt-, Apotheken- und Krankenhausrechnungen
              für PKV und Beihilfe (Beamtenstatus)
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={pill('var(--primary)')}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <circle cx="5" cy="5" r="4" opacity="0.3"/>
                <circle cx="5" cy="5" r="2"/>
              </svg>
              v{VERSION}
            </span>
            <span style={pill('var(--text-subtle)')}>
              Stand: {LAST_UPDATE}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {[
            { label: 'Rust · Axum', color: 'var(--amber)' },
            { label: 'SQLite · SQLx', color: 'var(--teal)' },
            { label: 'React · TypeScript', color: 'var(--blue)' },
            { label: 'Tailwind CSS', color: 'var(--violet)' },
            { label: 'Docker', color: 'var(--emerald)' },
          ].map(({ label, color }) => (
            <span key={label} style={pill(color)}>{label}</span>
          ))}
        </div>
      </div>

      {/* ── Two-column grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>

        {/* Tech-Stack */}
        <div style={card}>
          <p style={sectionTitle}>Tech-Stack</p>
          <StackGroup title="Backend" items={[
            { label: 'Rust', sub: 'Edition 2021' },
            { label: 'Axum 0.7', sub: 'HTTP-Framework' },
            { label: 'SQLx 0.7', sub: 'Async SQLite' },
            { label: 'jsonwebtoken 9', sub: 'JWT-Auth (HS256)' },
            { label: 'bcrypt 0.15', sub: 'Passwort-Hashing' },
            { label: 'Tokio 1', sub: 'Async-Runtime' },
            { label: 'Tesseract + pdftoppm', sub: 'OCR' },
          ]} />
          <StackGroup title="Frontend" items={[
            { label: 'React 18 + TypeScript' },
            { label: 'TanStack Query v5', sub: 'Server State' },
            { label: 'React Router v6' },
            { label: 'Tailwind CSS 3' },
            { label: 'Lucide React', sub: 'Icons' },
          ]} />
          <StackGroup title="Infra" items={[
            { label: 'Docker + Docker Compose' },
            { label: 'SQLite', sub: './data/pkv.db' },
            { label: 'Migrations (sqlx-cli)' },
          ]} />
        </div>

        {/* Architektur */}
        <div style={card}>
          <p style={sectionTitle}>Architektur</p>

          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Schichten (Backend)</p>
          <LayerArrow />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, marginTop: 4 }}>
            {[
              { layer: 'Handler', desc: 'HTTP-Request/Response, Parametervalidierung' },
              { layer: 'Service', desc: 'Fachliche Logik, Validierungsregeln' },
              { layer: 'Repository', desc: 'SQL-Queries via SQLx' },
            ].map(({ layer, desc }) => (
              <div key={layer} style={{ fontSize: 12, color: 'var(--text-subtle)', paddingLeft: 4 }}>
                <strong style={{ color: 'var(--text-muted)' }}>{layer}:</strong> {desc}
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Schlüsselprinzipien</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { title: 'Derived State', desc: 'Status immer berechnet, nie gespeichert' },
              { title: 'PATCH via COALESCE', desc: 'Optionale Felder: null → alter Wert bleibt' },
              { title: 'Bescheid-Sync', desc: 'beihilfe_erstattet_betrag nur durch Sync-Service' },
              { title: 'Aktivitätslog', desc: 'Jede Änderung mit Diff persistent erfasst' },
              { title: 'Magic-Bytes-Check', desc: 'Anhänge auf PDF validiert (nicht nur Dateiname)' },
            ].map(({ title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: 8, fontSize: 12, paddingLeft: 4 }}>
                <Dot color="var(--primary)" />
                <span><strong style={{ color: 'var(--text)', fontWeight: 600 }}>{title}</strong>
                  <span style={{ color: 'var(--text-subtle)' }}> – {desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Datenmodell */}
        <div style={card}>
          <p style={sectionTitle}>Datenmodell (Kern)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
            <ModelNode label="mandant" color="var(--text-muted)">
              <SubNode label="benutzer" color="var(--text-muted)" />
              <ModelNode label="person" color="var(--teal)">
                <SubNode label="satz_historie" color="var(--teal)" />
              </ModelNode>
              <SubNode label="beihilfestelle" color="var(--blue)" />
              <SubNode label="pkv (Stammdaten)" color="var(--violet)" />
              <SubNode label="correspondent" color="var(--text-subtle)" />
              <ModelNode label="rechnung" color="var(--primary)">
                <SubNode label="anhang" color="var(--primary)" />
                <SubNode label="aktivitaet" color="var(--primary)" />
                <SubNode label="beleg (via rechnung_beleg)" color="var(--emerald)" />
              </ModelNode>
              <ModelNode label="beihilfe_antrag" color="var(--amber)">
                <SubNode label="→ rechnung (n:m)" color="var(--amber)" />
                <ModelNode label="bescheid" color="var(--rose)">
                  <SubNode label="position (→ rechnung)" color="var(--rose)" />
                  <SubNode label="anhang" color="var(--rose)" />
                </ModelNode>
                <SubNode label="beleg (via antrag_beleg)" color="var(--emerald)" />
              </ModelNode>
              <ModelNode label="beleg" color="var(--emerald)">
                <SubNode label="ocr_text, ocr_status" color="var(--emerald)" />
              </ModelNode>
              <SubNode label="einstellungen (k/v)" color="var(--text-subtle)" />
            </ModelNode>
          </div>
        </div>

        {/* Status-Felder */}
        <div style={card}>
          <p style={sectionTitle}>Berechnete Status-Felder</p>
          <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 12 }}>
            Werden immer aus Rohdaten berechnet, nie gespeichert.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { field: 'zahlung_status', src: 'bezahlt_am', vals: 'offen | bezahlt' },
              { field: 'beihilfe_status', src: 'beihilfe_eingereicht_am', vals: 'offen | eingereicht | null' },
              { field: 'pkv_status', src: 'pkv_eingereicht_am', vals: 'offen | eingereicht' },
              { field: 'archiviert_status', src: 'archiviert_am', vals: 'aktiv | archiviert' },
              { field: 'beihilfe_anteil_erwartet', src: 'betrag × beihilfe_satz', vals: '÷ 100' },
              { field: 'pkv_anteil_erwartet', src: 'betrag × pkv_satz', vals: '÷ 100' },
              { field: 'beihilfe_differenz', src: 'tatsächlich − erwartet', vals: '' },
            ].map(({ field, src, vals }) => (
              <div key={field} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <code style={{ fontSize: 11, color: 'var(--primary)', background: 'var(--primary-dim)', padding: '1px 4px', borderRadius: 3 }}>{field}</code>
                  <span style={{ fontSize: 11, color: 'var(--text-subtle)', marginLeft: 5 }}>← {src}</span>
                </div>
                {vals && <span style={{ fontSize: 10, color: 'var(--text-subtle)', alignSelf: 'center' }}>{vals}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Benutzer-Flows */}
        <div style={card}>
          <p style={sectionTitle}>Kernprozesse</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                title: 'Rechnung → Antrag → Bescheid',
                steps: ['Rechnung erfassen (Betrag, Datum, Leistungserbringer)', 'Beihilfe- oder PKV-Antrag anlegen', 'Rechnungen dem Antrag zuweisen', 'Antrag versenden → beihilfe_eingereicht_am gesetzt', 'Bescheid erfassen mit Positionen', 'Sync: rechnung.beihilfe_erstattet_betrag aktualisiert'],
                color: 'var(--primary)',
              },
              {
                title: 'Beleg-Workflow',
                steps: ['Beleg hochladen (Drag & Drop oder Kamera)', 'OCR läuft im Hintergrund (deu+eng)', 'Beleg mit Rechnung oder Antrag verknüpfen', 'Aus Bescheid-Beleg direkt Bescheid anlegen'],
                color: 'var(--emerald)',
              },
              {
                title: 'Dashboard-Buckets',
                steps: ['zu_bezahlen · beihilfe_einreichen · pkv_einreichen', 'warten_beihilfe · warten_pkv · bereit_archivieren', 'BRE-Indikator pro Person (Schwelle / Spielraum)', 'Pipeline: einreichbar → eingereicht → erstattet'],
                color: 'var(--amber)',
              },
            ].map(({ title, steps, color }) => (
              <div key={title}>
                <p style={{ fontSize: 12, fontWeight: 700, color, margin: '0 0 5px' }}>{title}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, fontSize: 11, color: 'var(--text-subtle)' }}>
                      <span style={{ color, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deployment */}
        <div style={card}>
          <p style={sectionTitle}>Deployment</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Ports (Standard)</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={pill('var(--primary)')}>Backend :3000</span>
                <span style={pill('var(--teal)')}>Frontend :8090</span>
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Volumes</p>
              {[
                { path: './data/', desc: 'SQLite-DB + seed.json' },
                { path: 'uploads (named)', desc: '/uploads/{rechnung_id}/{id}.pdf' },
                { path: './data/exports/', desc: 'Exportierte PDFs' },
              ].map(({ path, desc }) => (
                <div key={path} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '3px 0', color: 'var(--text-subtle)' }}>
                  <code style={{ fontSize: 11, color: 'var(--primary)', background: 'var(--primary-dim)', padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap' }}>{path}</code>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Umgebungsvariablen</p>
              {[
                'JWT_SECRET (≥ 32 Zeichen)',
                'PORT · UI_PORT',
                'MULTIPAGE_SCAN (true/false)',
                'PAPERLESS_NGX_URL / TOKEN',
                'SEED_FILE (Pfad zu seed.json)',
              ].map(v => (
                <div key={v} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '2px 0', color: 'var(--text-subtle)' }}>
                  <Dot color="var(--text-subtle)" />
                  <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v}</code>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── Geschäftsregeln (full-width) ── */}
      <div style={card}>
        <p style={sectionTitle}>Geschäftsregeln</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0 32px' }}>
          {[
            'Rechnungsstatus wird immer berechnet, nie gespeichert',
            'Personen ohne Beihilfestelle: beihilfe_status = NULL',
            'Massenaktionen: bezahlt · beihilfe_eingereicht · pkv_eingereicht · archivieren',
            'Archivierte Rechnungen erscheinen nicht im Dashboard',
            'referenz_nr: MAX(referenz_nr) + 1 pro Mandant',
            'Löschen referenzierter Stammdaten → 409 Conflict',
            'Benutzer können sich nicht selbst löschen',
            'Anhänge: nur PDF (Magic-Bytes-Prüfung); Bilder → PDF im Frontend',
            'pkv_verzicht: Rechnung bleibt in Bucket „PKV einreichen" als zurückgestellt',
            'Einstellungen: .env-Werte als Fallback, DB-Werte überschreiben',
            'Antrag versendet → beihilfe_eingereicht_am auf allen Rechnungen (sofern NULL)',
            'Rechnung kann in mehreren Anträgen erscheinen (Widerspruchsfall)',
            'Aktivitätslog: jede Änderung mit Diff; benutzer_id = NULL für Systemaktionen',
            'beihilfe_erstattet_betrag: nur durch sync_beihilfe_erstattet() (nie manuell)',
            'PKV-Antrag: pkv_id referenziert Stammdaten; pkv_versicherer = Freitext-Fallback',
            'Personen-Zuordnung bei BH/PKV schränkt hinzufügbare Rechnungen ein',
          ].map((text, i) => (
            <div key={i} style={rule}>
              <span style={ruleNum}>{i + 1}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── API-Routen ── */}
      <div style={card}>
        <p style={sectionTitle}>API-Überblick</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {[
            { resource: '/api/auth', methods: 'POST login' },
            { resource: '/api/benutzer', methods: 'GET · POST · PATCH · DELETE · passwort' },
            { resource: '/api/personen', methods: 'CRUD + satz-historie' },
            { resource: '/api/beihilfestellen', methods: 'CRUD + personen' },
            { resource: '/api/pkv', methods: 'CRUD + personen' },
            { resource: '/api/correspondents', methods: 'CRUD' },
            { resource: '/api/rechnungen', methods: 'CRUD + bulk + anhaenge + aktivitaet' },
            { resource: '/api/beihilfe-antraege', methods: 'CRUD + status + rechnungen + bescheide + belege' },
            { resource: '/api/beihilfe-antraege/:id/bescheide', methods: 'CRUD + positionen + anhaenge' },
            { resource: '/api/belege', methods: 'CRUD + datei + thumbnail' },
            { resource: '/api/dashboard', methods: 'GET' },
            { resource: '/api/einstellungen', methods: 'GET · PATCH · tests' },
            { resource: '/api/aktivitaet', methods: 'GET' },
            { resource: '/api/export', methods: 'POST (lokal + GDrive)' },
            { resource: '/api/config', methods: 'GET' },
          ].map(({ resource, methods }) => (
            <div key={resource} style={{
              background: 'var(--surface-alt)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '8px 10px',
            }}>
              <code style={{ fontSize: 11, color: 'var(--primary)', display: 'block', marginBottom: 3 }}>{resource}</code>
              <span style={{ fontSize: 10, color: 'var(--text-subtle)' }}>{methods}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
