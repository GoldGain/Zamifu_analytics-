import SEO from '@/components/SEO';
import { FileText, Mail, Phone } from 'lucide-react';

export default function TermsOfService() {
  return (
    <>
      <SEO
        title="Terms of Service - Zamifu Analytics"
        description="Terms governing the use of the Zamifu Analytics school management platform."
        path="/terms"
      />
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white py-12">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-10 h-10" />
              <h1 className="text-3xl md:text-4xl font-bold">Terms of Service</h1>
            </div>
            <p className="text-white/80 max-w-2xl">
              These terms govern your access to and use of the Zamifu Analytics platform. Please
              read them carefully before using the service.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 max-w-4xl">
          <p className="text-sm text-gray-500 mb-8">
            <strong>Effective date:</strong> 9 August 2026 &nbsp;|&nbsp; <strong>Last updated:</strong>{' '}
            9 August 2026
          </p>

          <Section title="1. Acceptance of Terms">
            <p>
              By registering for or using Zamifu Analytics, the subscribing school and its
              authorized users agree to be bound by these Terms of Service. If you do not agree, do
              not use the platform.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              Zamifu Analytics is a cloud-based school management system providing learner
              management, results processing and CBE grading, report card generation, fee tracking,
              timetabling, announcements, analytics, and parent communication tools. We also offer
              the Zamifu Copilot AI assistant and the Pathway Finder career guidance tool.
            </p>
          </Section>

          <Section title="3. Accounts and Responsibilities">
            <ul>
              <li>The subscribing school is responsible for the accuracy of the data it enters and for authorizing appropriate staff roles.</li>
              <li>Schools must obtain all necessary parental consents for processing learner data before entering it into the platform.</li>
              <li>Users must keep credentials confidential and notify us immediately of any unauthorized access.</li>
              <li>Users must be at least 18 years old or acting under the authority of a subscribing school.</li>
            </ul>
          </Section>

          <Section title="4. Subscriptions and Payments">
            <ul>
              <li>Subscription fees are charged according to the plan selected at registration or by the reseller.</li>
              <li>Payments are processed securely via Paystack. We do not store card details.</li>
              <li>Fees are generally non-refundable once a billing period has started, except as required by law.</li>
              <li>We may change pricing with at least 30 days' notice; existing subscriptions are honored for their current term.</li>
            </ul>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You agree not to:</p>
            <ul>
              <li>Use the platform for any unlawful purpose or in violation of Kenyan law.</li>
              <li>Access, copy, or disclose data you are not authorized to see (e.g., other learners' results).</li>
              <li>Reverse-engineer, scrape, or overload the platform's infrastructure.</li>
              <li>Upload malicious code, viruses, or content that infringes third-party rights.</li>
              <li>Use generated report cards or results for fraudulent purposes.</li>
            </ul>
          </Section>

          <Section title="6. Intellectual Property">
            <p>
              The platform, its software, designs, and content are owned by Zamifu Analytics and are
              protected by copyright and other intellectual property laws. Schools retain ownership
              of their own data. Report card designs provided through the platform are licensed for
              the school's internal use.
            </p>
          </Section>

          <Section title="7. Data Protection">
            <p>
              Personal data is processed in accordance with our{' '}
              <a href="/privacy" className="text-[#2563EB] underline">Privacy Policy</a> and the
              Data Protection Act, 2019. A{' '}
              <a href="/data-processing-agreement" className="text-[#2563EB] underline">Data Processing Agreement</a>{' '}
              is available for subscribing schools.
            </p>
          </Section>

          <Section title="8. Disclaimers and Limitation of Liability">
            <p>
              The platform is provided "as is" without warranties of any kind beyond those required
              by law. To the maximum extent permitted by law, Zamifu Analytics shall not be liable
              for indirect or consequential damages, including loss of data caused by user error.
              Nothing in these terms excludes liability for gross negligence or wilful misconduct.
            </p>
          </Section>

          <Section title="9. AI-Generated Content">
            <p>
              Zamifu Copilot, AI comments, and Pathway Finder recommendations are generated
              automatically to assist educators. They should be reviewed by qualified staff before
              use; they do not replace professional judgment or official academic decisions.
            </p>
          </Section>

          <Section title="10. Term and Termination">
            <p>
              Either party may terminate the subscription at the end of a billing cycle with
              notice. We may suspend access for material breach of these terms. Upon termination,
              the school may request an export of its data within 30 days.
            </p>
          </Section>

          <Section title="11. Governing Law">
            <p>
              These terms are governed by the laws of the Republic of Kenya. Disputes shall first
              be addressed through good-faith negotiation, failing which they shall be submitted to
              the courts of Kenya.
            </p>
          </Section>

          <Section title="12. Contact">
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
