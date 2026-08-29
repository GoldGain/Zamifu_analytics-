import SEO from '@/components/SEO';
import { Mail, ShieldCheck, Trash2 } from 'lucide-react';

export default function AccountDeletion() {
  return (
    <>
      <SEO
        title="Delete Your Zamifu Analytics Account"
        description="Request deletion of your Zamifu Analytics account and associated personal data."
        path="/delete-account"
      />
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white py-12">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="w-10 h-10" />
              <h1 className="text-3xl md:text-4xl font-bold">Delete Your Account</h1>
            </div>
            <p className="text-white/80 max-w-2xl">
              You can request deletion of your Zamifu Analytics account and the personal data associated
              with it. We will verify the request before taking action to protect school records and learners.
            </p>
          </div>
        </div>

        <main className="container mx-auto px-4 py-10 max-w-4xl">
          <p className="text-sm text-gray-500 mb-8">
            <strong>Last updated:</strong> 29 August 2026
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">How to request deletion</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p>
                Send an email to <a className="text-[#2563EB] underline" href="mailto:tutorsultimate@gmail.com">tutorsultimate@gmail.com</a> from
                the email address registered to your Zamifu Analytics account. Include the subject
                <strong> “Zamifu Analytics account deletion request”</strong> and provide your name,
                account email address, school name, and user role.
              </p>
              <p>
                If you cannot email us from the registered address, contact your school administrator
                first. School administrators may submit deletion requests for school-managed learner,
                teacher, and parent records after confirming the requester’s authority.
              </p>
              <p className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-4">
                <Mail className="w-5 h-5 text-[#2563EB] mt-0.5 shrink-0" />
                <span>
                  Email: <a className="text-[#2563EB] underline font-medium" href="mailto:tutorsultimate@gmail.com">tutorsultimate@gmail.com</a>
                  <br />
                  Phone support: 0712644205
                </span>
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">What will be deleted</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p>
                After verification, we will delete or anonymize the requested account profile and
                associated personal data that we control, including login details, profile information,
                and user-generated records where deletion is legally and operationally possible.
              </p>
              <p>
                For school-managed records, the school may be the data controller. We will coordinate
                with the authorized school administrator and follow the school’s lawful retention and
                deletion instructions. Some records may be retained when required by education, tax,
                fraud-prevention, or other legal obligations.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Processing time and verification</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p>
                We normally acknowledge a request within seven days and complete verified deletion or
                explain any lawful retention requirement within thirty days. Complex requests may take
                longer where permitted by applicable law, and we will communicate the reason.
              </p>
              <p>
                We may ask for additional information to confirm account ownership or school authority.
                Please do not include passwords, payment-card details, or other unnecessary sensitive
                information in your request.
              </p>
            </div>
          </section>

          <section className="rounded-lg bg-white border border-gray-200 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-[#2563EB] mt-0.5 shrink-0" />
              <p className="text-gray-700 leading-relaxed">
                For more information about how Zamifu Analytics handles personal data, please read our{' '}
                <a href="/privacy" className="text-[#2563EB] underline">Privacy Policy</a>.
              </p>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
