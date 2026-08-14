import React from 'react';
import { Link } from 'react-router-dom';
import { AnixiLogo } from '../components/brand/AnixiLogo';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'controller', label: 'Responsible party' },
  { id: 'scope', label: 'Who this covers' },
  { id: 'definitions', label: 'Key definitions' },
  { id: 'categories', label: 'Information we process' },
  { id: 'purposes', label: 'Purposes & legal bases' },
  { id: 'sources', label: 'How we collect' },
  { id: 'sharing', label: 'Sharing & operators' },
  { id: 'transfers', label: 'Cross-border transfers' },
  { id: 'security', label: 'Security measures' },
  { id: 'retention', label: 'Retention & deletion' },
  { id: 'rights', label: 'Your POPIA rights' },
  { id: 'cookies', label: 'Cookies & similar tech' },
  { id: 'children', label: 'Children & caregivers' },
  { id: 'marketing', label: 'Communications' },
  { id: 'ai', label: 'AI companion (Ayah)' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'changes', label: 'Updates' },
  { id: 'contact', label: 'Contact' },
] as const;

const Section: React.FC<{
  id: string;
  title: string;
  children: React.ReactNode;
}> = ({ id, title, children }) => (
  <section id={id} className="scroll-mt-28 border-b border-gray-100 py-8 last:border-b-0">
    <h2 className="font-heading text-xl font-semibold text-gray-900 sm:text-2xl">{title}</h2>
    <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-gray-700">{children}</div>
  </section>
);

const PrivacyPolicyPage: React.FC = () => (
  <div className="min-h-screen bg-anixi-beige">
    <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-anixi-beige/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <AnixiLogo variant="header" linkTo="/join" showTagline subtitle="Doctor Portal" />
        <div className="flex items-center gap-3 text-sm">
          <Link to="/join" className="hidden text-gray-600 hover:text-anixi-green sm:inline">
            Join
          </Link>
          <Link
            to="/login"
            className="rounded-full bg-anixi-green px-4 py-2 font-semibold text-white hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10 lg:px-12">
        <p className="text-sm font-medium uppercase tracking-wide text-anixi-green">
          Protection of Personal Information Act, 4 of 2013
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-anixi-green sm:text-4xl">
          Privacy Notice
        </h1>
        <p className="mt-3 max-w-3xl text-base text-gray-600">
          This notice explains how Anixi Health (Pty) Ltd processes personal information when you
          use the Anixi Doctor Portal, clinic staff tools, caregiver access, and related services.
          It is intended to meet POPIA transparency requirements for health-sector operators.
        </p>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
          <span>Effective: 1 August 2026</span>
          <span>Last updated: 3 August 2026</span>
          <span>Version: Doctor Portal 2.0</span>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <aside className="mb-6 lg:mb-0">
          <nav
            aria-label="Privacy notice sections"
            className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">On this page</p>
            <ul className="mt-3 max-h-[70vh] space-y-1 overflow-y-auto text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block rounded-md px-2 py-1.5 text-gray-600 transition-colors hover:bg-[#eef4f1] hover:text-anixi-green"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="rounded-2xl border border-gray-200 bg-white px-6 py-2 shadow-sm sm:px-10 lg:px-12">
          <Section id="overview" title="1. Overview">
            <p>
              Anixi Health provides a digital platform that connects doctors, clinics, patients, and
              caregivers for scheduling, telemedicine, clinical documentation, invoicing, chronic-care
              monitoring, and AI-assisted support (Ayah). Because we process health and other special
              personal information, we apply heightened care under POPIA and applicable HPCSA and
              health-sector expectations.
            </p>
            <p>
              By creating an account, accepting a practice invite, or otherwise using the Doctor
              Portal, you acknowledge that you have read this notice. Where consent is required for a
              specific processing activity, we will ask for it separately and you may withdraw it
              where POPIA allows.
            </p>
          </Section>

          <Section id="controller" title="2. Responsible party & Information Officer">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-[#f8faf8] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Responsible party
                </p>
                <p className="mt-2 font-semibold text-gray-900">Anixi Health (Pty) Ltd</p>
                <p className="mt-1 text-sm text-gray-600">Registration: 2021/348960/07</p>
                <p className="mt-1 text-sm text-gray-600">South Africa</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-[#f8faf8] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Privacy contact
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  Email:{' '}
                  <a href="mailto:privacy@anixi.health" className="font-medium text-anixi-green underline">
                    privacy@anixi.health
                  </a>
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  General:{' '}
                  <a href="mailto:info@anixihealth.com" className="font-medium text-anixi-green underline">
                    info@anixihealth.com
                  </a>
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Requests under POPIA / PAIA should be directed to the Information Officer at the
                  privacy address above.
                </p>
              </div>
            </div>
          </Section>

          <Section id="scope" title="3. Who this notice covers">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Doctors and clinicians</strong> using the Doctor Portal (solo practitioners
                and clinic-affiliated doctors)
              </li>
              <li>
                <strong>Clinic / practice staff</strong> (reception, billing, practice managers)
                invited to a practice
              </li>
              <li>
                <strong>Caregivers</strong> granted portal access to support a patient
              </li>
              <li>
                <strong>Prospective users</strong> who visit join, invite, or registration pages
              </li>
            </ul>
            <p>
              Patient-facing mobile app processing is also governed by Anixi&apos;s platform Privacy
              Policy. Where a doctor or clinic captures patient clinical data in the portal, the
              treating practice typically remains the primary responsible party for that clinical
              record; Anixi acts as an operator (processor) providing hosting and tooling, except
              where Anixi itself determines purposes (for example platform security, product
              analytics in aggregated form, or Ayah features you enable).
            </p>
          </Section>

          <Section id="definitions" title="4. Key definitions (POPIA)">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Personal information</strong> means information relating to an identifiable
                living natural person (and, where applicable, an identifiable existing juristic
                person), including identity, contact details, professional registration, financial
                and health information.
              </li>
              <li>
                <strong>Special personal information</strong> includes health or sex life, biometric
                information, and certain criminal information. Clinical notes, vitals, adherence,
                mood, diagnoses, and prescriptions generally fall in this category.
              </li>
              <li>
                <strong>Processing</strong> means any operation on personal information, including
                collection, storage, use, sharing, updating, and destruction.
              </li>
              <li>
                <strong>Operator</strong> means a person who processes personal information for a
                responsible party in terms of a contract, without determining the purpose alone.
              </li>
            </ul>
          </Section>

          <Section id="categories" title="5. Categories of information we process">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-900">Account & identity</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Name, email, phone, password credentials (hashed), role, country, preferred
                  currency, verification status, and profile photo if provided.
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-900">Professional & practice</h3>
                <p className="mt-2 text-sm text-gray-600">
                  HPCSA / statutory registration numbers, specialty, BHF practice number, VAT /
                  tax identifiers, practice name, locations, clinic hours, soft blocks, and team
                  memberships / invites.
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-900">Scheduling & consults</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Appointments, diary entries, teleconsult session metadata, attendance, and
                  related communications.
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-900">Clinical & care data</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Visit notes, letters, prescriptions, ICD-10 / NAPPI codes where used, vitals,
                  adherence and mood inputs shared with the care team, and uploaded documents.
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-900">Billing</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Invoice line items, amounts, payment status, medical aid fields you enter, and
                  letterhead / banking details configured for your practice.
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 p-4">
                <h3 className="font-semibold text-gray-900">Technical & security</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Device / browser type, IP address, authentication events, audit logs, error
                  diagnostics, and cookies or local storage needed to keep you signed in.
                </p>
              </div>
            </div>
          </Section>

          <Section id="purposes" title="6. Purposes and lawful bases">
            <p>We process personal information only for specified purposes, including:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Contract / service delivery:</strong> creating accounts, practice setup,
                invites, scheduling, telemedicine, documentation, invoicing, and caregiver access.
              </li>
              <li>
                <strong>Legal obligation:</strong> retaining certain clinical, tax, and company
                records; responding to lawful requests; maintaining professional verification
                where required.
              </li>
              <li>
                <strong>Legitimate interests:</strong> securing the platform, preventing fraud,
                improving reliability, and producing aggregated, non-identifying product insights.
              </li>
              <li>
                <strong>Consent:</strong> optional marketing communications, certain AI features,
                and any processing where POPIA or HPCSA guidance requires explicit permission
                (including telemedicine consent obtained by the clinician before virtual consults).
              </li>
            </ul>
            <p>
              Special personal information is processed only where a POPIA condition applies, for
              example with consent, for medical treatment by a healthcare professional, or as
              otherwise permitted for health services and insurance administration.
            </p>
          </Section>

          <Section id="sources" title="7. How we collect information">
            <ul className="list-disc space-y-2 pl-5">
              <li>Directly from you during registration, profile completion, and portal use</li>
              <li>From practice owners or staff who invite you or register patients</li>
              <li>From patients or caregivers who share data with your practice via Anixi apps</li>
              <li>From devices and systems (logs, authentication, crash diagnostics)</li>
              <li>From third-party identity or payment providers you connect, if any</li>
            </ul>
          </Section>

          <Section id="sharing" title="8. Sharing, operators, and disclosures">
            <p>We do not sell personal information. We may share it with:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Your practice members</strong> according to role-based permissions you
                configure (for example reception viewing the diary)
              </li>
              <li>
                <strong>Patients and authorised caregivers</strong> for appointments, prescriptions,
                invoices, and shared care features
              </li>
              <li>
                <strong>Infrastructure operators</strong> (cloud hosting, authentication, email
                delivery, video for teleconsults) under written operator agreements requiring
                confidentiality and security
              </li>
              <li>
                <strong>Professional / regulatory bodies or courts</strong> when required by law
              </li>
              <li>
                <strong>Successors</strong> in a merger or acquisition, subject to continued
                protection consistent with this notice
              </li>
            </ul>
            <p>
              Clinic administrators remain responsible for inviting only authorised staff and for
              configuring access appropriately.
            </p>
          </Section>

          <Section id="transfers" title="9. Cross-border transfers">
            <p>
              Anixi is South Africa focused. Some operators (for example cloud infrastructure or
              email) may process data in other countries. Where we transfer personal information
              outside South Africa, we take steps intended to ensure an adequate level of
              protection, such as contractual clauses with operators and assessing the receiving
              environment, as contemplated by POPIA section 72.
            </p>
          </Section>

          <Section id="security" title="10. Security measures">
            <ul className="list-disc space-y-2 pl-5">
              <li>Encrypted transport (HTTPS / TLS) for portal traffic</li>
              <li>Authentication and session controls; hashed credential storage via our auth provider</li>
              <li>Role-based access within practices and Firestore security rules</li>
              <li>Audit-oriented logging of significant portal activity</li>
              <li>Operational access limited to personnel who need it to support the service</li>
            </ul>
            <p>
              No method of transmission or storage is perfectly secure. You must keep login details
              confidential, use a strong unique password, and obtain appropriate telemedicine
              consent before virtual consultations in line with HPCSA guidance. Report suspected
              incidents to{' '}
            <a href="mailto:privacy@anixi.health" className="text-anixi-green underline">
              privacy@anixi.health
              </a>{' '}
              promptly.
            </p>
          </Section>

          <Section id="retention" title="11. Retention and deletion">
            <p>
              We keep personal information only as long as needed for the purposes above, including:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Account profile:</strong> for the life of the account, then deleted or
                anonymised after closure, subject to lawful holds
              </li>
              <li>
                <strong>Clinical, appointment, and invoice records:</strong> retained for periods
                required by health-sector, tax, and company law (often several years; company
                records may be kept for at least 7 years under the Companies Act where applicable)
              </li>
              <li>
                <strong>Security logs:</strong> for a limited period needed to investigate incidents
                and protect the platform
              </li>
            </ul>
            <p>
              You may request account deletion in the portal. Deletion of clinical or financial
              records may be limited where retention is required by law or needed to establish,
              exercise, or defend legal claims.
            </p>
          </Section>

          <Section id="rights" title="12. Your rights under POPIA">
            <p>Subject to legal limits, you may:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Request access to personal information we hold about you (and related PAIA processes)</li>
              <li>Request correction of inaccurate, out-of-date, or incomplete information</li>
              <li>Request deletion or destruction where we are not required to retain it</li>
              <li>Object to processing in the circumstances set out in POPIA section 11(3)</li>
              <li>Withdraw consent where processing is based on consent</li>
              <li>Request information about operators and third parties with whom we share data</li>
          </ul>
            <p>
              To exercise these rights, email{' '}
              <a href="mailto:privacy@anixi.health" className="text-anixi-green underline">
                privacy@anixi.health
              </a>{' '}
              with enough detail for us to verify your identity and locate the records. We will
              respond within a reasonable time.
            </p>
            <p>
              It is your responsibility to keep professional and contact details up to date in the
              portal.
            </p>
          </Section>

          <Section id="cookies" title="13. Cookies and similar technologies">
            <p>
              The Doctor Portal uses essential cookies / local storage for authentication, session
              continuity, and security. We may use limited analytics to understand feature
              reliability. We do not use third-party advertising cookies on the Doctor Portal.
              You can clear site data in your browser; doing so may sign you out.
            </p>
          </Section>

          <Section id="children" title="14. Children and caregivers">
            <p>
              The Doctor Portal is designed for adult professionals and authorised caregivers.
              Where patient information relates to a child, clinicians and practices must ensure
              they have the necessary parental / guardian authority and consent before recording
              or sharing that information. Caregiver accounts should only be granted to people
              authorised by the patient or by law.
            </p>
          </Section>

          <Section id="marketing" title="15. Communications">
            <p>
              We send transactional messages required to operate the service (invites, security
              alerts, appointment-related notices). Optional product updates or marketing are sent
              only with appropriate consent or as otherwise permitted, and you can opt out of
              marketing emails using the unsubscribe link or by contacting us. Opting out of
              marketing does not stop essential service messages.
            </p>
          </Section>

          <Section id="ai" title="16. AI companion (Ayah) and automated processing">
            <p>
              Ayah and related clinical-support features may process prompts and health context you
              or your patients provide to generate responses. These tools are assistive and do not
              replace professional judgement. Do not enter information you are not authorised to
              process. We may use de-identified or aggregated interaction data to improve safety
              and quality. Where a feature relies on a third-party model provider, that provider
              acts as an operator under our instructions insofar as contractually arranged.
            </p>
          </Section>

          <Section id="complaints" title="17. Complaints">
            <p>
              Please contact us first so we can try to resolve your concern. You also have the right
              to lodge a complaint with the Information Regulator (South Africa):
            </p>
            <div className="rounded-xl border border-gray-100 bg-[#f8faf8] p-4 text-sm">
              <p className="font-semibold text-gray-900">Information Regulator (South Africa)</p>
              <p className="mt-2 text-gray-600">
                Website:{' '}
                <a
                  href="https://inforegulator.org.za"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-anixi-green underline"
                >
                  inforegulator.org.za
                </a>
              </p>
              <p className="mt-1 text-gray-600">
                Complaints:{' '}
                <a href="mailto:POPIAComplaints@inforegulator.org.za" className="text-anixi-green underline">
                  POPIAComplaints@inforegulator.org.za
                </a>
              </p>
            </div>
          </Section>

          <Section id="changes" title="18. Changes to this notice">
            <p>
              We may update this notice to reflect product, legal, or operational changes. The
              &quot;Last updated&quot; date at the top will change when we do. Material changes may
              be highlighted in the portal or by email where appropriate. Continued use after an
              update constitutes notice of the revised terms, except where consent is separately
              required.
            </p>
          </Section>

          <Section id="contact" title="19. Contact us">
            <p>
              For privacy questions, access requests, or security reports related to the Doctor
              Portal:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Privacy:{' '}
            <a href="mailto:privacy@anixi.health" className="text-anixi-green underline">
              privacy@anixi.health
            </a>
              </li>
              <li>
                General:{' '}
                <a href="mailto:info@anixihealth.com" className="text-anixi-green underline">
                  info@anixihealth.com
                </a>
              </li>
            </ul>
            <p className="text-sm text-gray-500">
              This notice is provided for transparency and does not constitute legal advice. Practices
              should obtain their own counsel for clinic-specific POPIA compliance.
            </p>
          </Section>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 py-8">
            <Link to="/login" className="text-sm font-semibold text-anixi-green hover:underline">
          Back to sign in
        </Link>
            <Link to="/join" className="text-sm font-medium text-gray-600 hover:text-anixi-green">
              Create an account
            </Link>
          </div>
        </article>
      </div>
    </div>
  </div>
);

export default PrivacyPolicyPage;
