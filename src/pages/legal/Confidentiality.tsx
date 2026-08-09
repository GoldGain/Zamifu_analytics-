import SEO from '@/components/SEO';
import { Lock, Mail, Phone } from 'lucide-react';

export default function Confidentiality() {
  return (
    <>
      <SEO
        title="Confidentiality Policy - Zamifu Analytics"
        description="How Zamifu Analytics protects the confidentiality of school, learner, and staff information."
        path="/confidentiality"
      />
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white py-12">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-10 h-10" />
              <h1 className="text-3xl md:text-4xl font-bold">Confidentiality Policy</h1>
            </div>
            <p className="text-white/80 max-w-2xl">
              Zamifu Analytics treats school, learner, and staff information as strictly
              confidential. This policy describes how confidentiality is maintained across the
              platform.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 max-w-4xl">
          <p className="text-sm text-gray-500 mb-8">
            <strong>Effective date:</strong> 9 August 2026 &nbsp;|&nbsp; <strong>Last updated:</strong>{' '}
            9 August 2026
          </p>

          <Section title="1. Scope of Confidential Information">
            <p>Confidential information includes, without limitation:</p>
            <ul>
              <li>Learner results, grades, report cards, and performance analytics.</li>
              <li>Personal details of learners, parents, teachers, and administrators.</li>
              <li>Fee structures, invoices, payment records, and financial data.</li>
              <li>School configurations, timetables, assessments, and internal communications.</li>
              <li>Any non-public information shared with Zamifu Analytics during onboarding or support.</li>
            </ul>
          </Section>

          <Section title="2. Confidentiality Obligations">
            <ul>
              <li>Zamifu Analytics staff access school data only when necessary to provide or support the service, and under confidentiality agreements.</li>
              <li>School staff must access only the data authorized for their role; sharing login credentials is prohibited.</li>
              <li>Parents may view only their own children's records through the parent portal.</li>
              <li>Confidential information must not be disclosed to any third party without lawful authority or the data controller's consent.</li>
            </ul>
          </Section>

          <Section title="3. Technical Safeguards">
            <ul>
              <li>All data is transmitted over encrypted connections (TLS/HTTPS).</li>
              <li>Databases are encrypted at rest and access is strictly role-based.</li>
              <li>Session management includes automatic expiry of inactive sessions.</li>
              <li>AI-generated content (Copilot) is generated within the platform and is not shared with external parties for training purposes beyond the configured service provider's standard safeguards.</li>
            </ul>
          </Section>

          <Section title="4. Exceptions">
            <p>Disclosure may occur only where required by Kenyan law, a valid court order, or a
              lawful request from the Office of the Data Protection Commissioner, and only to the
              extent required.</p>
          </Section>

          <Section title="5. Breach Notification">
            <p>
              In the event of a breach affecting the confidentiality of school data, Zamifu
              Analytics will notify the affected school without undue delay and cooperate in
              containment and remediation, consistent with the{' '}
              <a href="/data-processing-agreement" className="text-[#2563EB] underline">Data Processing Agreement</a>.
            </p>
          </Section>

          <Section title="6. Term">
            <p>
              Confidentiality obligations survive the termination of a school's subscription for as
              long as the information remains confidential.
            </p>
          </Section>

          <Section title="7. Contact">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-gray-700"><Mail className="w-4 h-4 text-[#2563EB]" /> tutorsultimate@gmail.com</p>
              <p className="flex items-center gap-2 text-gray-700"><Phone className="w-4 h-4 text-[#2563EB]" /> 0712644205</p>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-700 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}
