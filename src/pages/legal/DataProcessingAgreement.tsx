import SEO from '@/components/SEO';
import { Handshake, Mail, Phone } from 'lucide-react';

export default function DataProcessingAgreement() {
  return (
    <>
      <SEO
        title="Data Processing Agreement - Zamifu Analytics"
        description="The Data Processing Agreement between subscribing schools (data controllers) and Zamifu Analytics (data processor)."
        path="/data-processing-agreement"
      />
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white py-12">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-4">
              <Handshake className="w-10 h-10" />
              <h1 className="text-3xl md:text-4xl font-bold">Data Processing Agreement</h1>
            </div>
            <p className="text-white/80 max-w-2xl">
              This agreement sets out the roles, obligations, and safeguards when subscribing
              schools engage Zamifu Analytics to process personal data, in line with the{' '}
              <strong>Data Protection Act, 2019</strong> and its regulations.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 max-w-4xl">
          <p className="text-sm text-gray-500 mb-8">
            <strong>Effective date:</strong> 9 August 2026 &nbsp;|&nbsp; <strong>Last updated:</strong>{' '}
            9 August 2026
          </p>

          <Section title="1. Parties and Roles">
            <ul>
              <li><strong>Data Controller:</strong> the subscribing school, which determines the purposes and means of processing learner, staff, and parent data.</li>
              <li><strong>Data Processor:</strong> Zamifu Analytics, which processes personal data on the documented instructions of the school to provide its services.</li>
            </ul>
          </Section>

          <Section title="2. Subject Matter and Duration">
            <p>
              Zamifu Analytics processes personal data for the purpose of providing school
              management, results, report card, fee, and communication services. Processing
              continues for the duration of the school's subscription, plus any period needed to
              complete data export or deletion requests.
            </p>
          </Section>

          <Section title="3. Categories of Data and Data Subjects">
            <ul>
              <li><strong>Data subjects:</strong> learners, parents/guardians, teachers, and school administrators.</li>
              <li><strong>Categories:</strong> names, admission numbers, photographs, contact details, attendance, assessment results, grades, fee records, and role/permission data.</li>
            </ul>
          </Section>

          <Section title="4. Processor Obligations">
            <ul>
              <li>Process personal data only on documented instructions from the school.</li>
              <li>Ensure all personnel with access are bound by confidentiality obligations.</li>
              <li>Implement the security measures described in our Privacy Policy (encryption in transit and at rest, role-based access, backups).</li>
              <li>Assist the school in fulfilling data subject access, correction, and deletion requests.</li>
              <li>Notify the school without undue delay upon becoming aware of a personal data breach, and cooperate in its investigation and remediation.</li>
              <li>Delete or return personal data at the end of the service, at the school's choice.</li>
            </ul>
          </Section>

          <Section title="5. Sub-Processors">
            <p>Zamifu Analytics uses the following categories of sub-processors:</p>
            <ul>
              <li><strong>Cloud hosting and database:</strong> Supabase (PostgreSQL cloud hosting).</li>
              <li><strong>Payment processing:</strong> Paystack.</li>
              <li><strong>SMS delivery:</strong> licensed SMS gateway providers for Kenya.</li>
              <li><strong>File delivery:</strong> Vercel (application hosting and static delivery).</li>
            </ul>
            <p>
              The school is notified of any material change in sub-processors. All sub-processors
              are bound by contractual obligations consistent with this agreement.
            </p>
          </Section>

          <Section title="6. International Transfers">
            <p>
              Hosting infrastructure may reside outside Kenya. Where personal data is transferred
              cross-border, we rely on appropriate safeguards, including contractual clauses and
              the safeguards recognized under Kenyan law and, where applicable, the GDPR.
            </p>
          </Section>

          <Section title="7. Audit and Compliance">
            <p>
              The school may request reasonable information demonstrating our compliance with this
              agreement. We will cooperate with audits required under the Data Protection Act, 2019
              and will assist the school in data protection impact assessments where required.
            </p>
          </Section>

          <Section title="8. Contact">
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
