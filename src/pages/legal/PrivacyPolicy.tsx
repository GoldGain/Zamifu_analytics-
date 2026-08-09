import SEO from '@/components/SEO';
import { ShieldCheck, Mail, Phone } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <>
      <SEO
        title="Privacy Policy - Zamifu Analytics"
        description="How Zamifu Analytics collects, uses, and protects your personal data in compliance with the Kenya Data Protection Act, 2019."
        path="/privacy"
      />
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white py-12">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-10 h-10" />
              <h1 className="text-3xl md:text-4xl font-bold">Privacy Policy</h1>
            </div>
            <p className="text-white/80 max-w-2xl">
              Zamifu Analytics is committed to protecting your privacy. This policy explains how we
              collect, use, and safeguard personal data in compliance with the{' '}
              <strong>Data Protection Act, 2019 (Kenya)</strong> and the GDPR where applicable.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 max-w-4xl">
          <p className="text-sm text-gray-500 mb-8">
            <strong>Effective date:</strong> 9 August 2026 &nbsp;|&nbsp; <strong>Last updated:</strong>{' '}
            9 August 2026
          </p>

          <Section title="1. Introduction" >
            <p>
              Zamifu Analytics ("we", "us", "our") is a school management platform serving Kenyan
              schools. This Privacy Policy applies to all users of the platform, including school
              administrators, teachers, students, and parents or guardians ("you").
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>We collect the following categories of personal data to operate the platform:</p>
            <ul>
              <li><strong>School data:</strong> school name, address, contacts, and subscription details provided during registration.</li>
              <li><strong>Staff data:</strong> names, email addresses, roles, and teaching assignments for administrators and teachers.</li>
              <li><strong>Learner data:</strong> names, admission numbers, class enrolment, photographs, attendance records, assessment results, and grades.</li>
              <li><strong>Parent/guardian data:</strong> names, contact phone numbers, and SMS delivery preferences.</li>
              <li><strong>Financial data:</strong> fee invoices, payment records, and receipts (no card details are stored by us; payments are processed by Paystack).</li>
              <li><strong>Usage data:</strong> IP addresses, browser type, device information, and log data collected automatically.</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul>
              <li>To provide and maintain the school management, results, and fee tracking services.</li>
              <li>To generate report cards, academic analytics, and performance trends.</li>
              <li>To send results and announcements to parents via SMS (only with the school's consent and the parent's contact details provided by the school).</li>
              <li>To process school subscriptions and payments securely.</li>
              <li>To enforce role-based access control and protect the security of the platform.</li>
              <li>To comply with legal obligations and resolve disputes.</li>
            </ul>
          </Section>

          <Section title="4. Legal Basis for Processing">
            <p>
              Under the Data Protection Act, 2019 we process personal data on the following bases:
              performance of a contract with the subscribing school; consent (for example, SMS
              notifications to parents); compliance with legal obligations; and the legitimate
              interests of operating and securing the platform.
            </p>
          </Section>

          <Section title="5. Data Sharing and Disclosure">
            <p>We do not sell personal data. We may share data only with:</p>
            <ul>
              <li><strong>Service providers:</strong> SMS gateway operators and payment processors (Paystack) strictly as needed to deliver the service.</li>
              <li><strong>Authorized users:</strong> school staff access only the data permitted by their role.</li>
              <li><strong>Regulators:</strong> where required by Kenyan law, court order, or lawful government request.</li>
            </ul>
          </Section>

          <Section title="6. Data Security">
            <p>
              We implement industry-standard safeguards including encryption in transit (HTTPS),
              encrypted database storage, role-based access controls, and regular security reviews.
              Access to learner data is restricted to authorized school personnel and the
              learner's own parent/guardian portal.
            </p>
          </Section>

          <Section title="7. Data Retention">
            <p>
              Personal data is retained for as long as the school's subscription is active, plus the
              period required by Kenyan education and tax regulations. On termination, the school
              may request export or deletion of its data.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>Under the Data Protection Act, 2019 you have the right to:</p>
            <ul>
              <li>Request access to, and a copy of, your personal data.</li>
              <li>Request correction of inaccurate or incomplete data.</li>
              <li>Request deletion or restriction of processing, subject to legal obligations.</li>
              <li>Object to processing and lodge a complaint with the Office of the Data Protection Commissioner (ODPC), Kenya.</li>
            </ul>
            <p>
              Requests should be directed to the school's administrator first, or to us directly
              using the contact details below.
            </p>
          </Section>

          <Section title="9. Children's Data">
            <p>
              The platform processes data of minors in the context of their education. Schools are
              responsible for obtaining the necessary parental consent. Parents can review their
              child's data through the parent portal at any time.
            </p>
          </Section>

          <Section title="10. Cookies and Local Storage">
            <p>
              We use essential cookies and browser local storage for authentication, session
              management, and preferences. No third-party advertising cookies are used. See our{' '}
              <a href="/cookie-policy" className="text-[#2563EB] underline">Cookie Policy</a> for details.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this policy from time to time. Material changes will be communicated
              through the platform or by email. Continued use of the platform after changes take
              effect constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>If you have any questions about this Privacy Policy or your data, contact us:</p>
            <div className="mt-4 space-y-2">
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
