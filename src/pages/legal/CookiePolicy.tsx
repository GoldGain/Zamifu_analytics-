import SEO from '@/components/SEO';
import { Cookie, Mail } from 'lucide-react';

export default function CookiePolicy() {
  return (
    <>
      <SEO
        title="Cookie Policy - Zamifu Analytics"
        description="Cookies and browser storage used by the Zamifu Analytics platform."
        path="/cookie-policy"
      />
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white py-12">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-4">
              <Cookie className="w-10 h-10" />
              <h1 className="text-3xl md:text-4xl font-bold">Cookie Policy</h1>
            </div>
            <p className="text-white/80 max-w-2xl">
              Zamifu Analytics uses only the cookies and browser storage essential to operate the
              platform. We do not use advertising or tracking cookies.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 max-w-4xl">
          <p className="text-sm text-gray-500 mb-8">
            <strong>Effective date:</strong> 9 August 2026 &nbsp;|&nbsp; <strong>Last updated:</strong>{' '}
            9 August 2026
          </p>

          <Section title="1. What Are Cookies and Local Storage?">
            <p>
              Cookies are small text files stored by your browser, and local storage is a similar
              mechanism built into modern browsers. Both are used to remember information about
              your visit, such as your login session and preferences.
            </p>
          </Section>

          <Section title="2. Cookies and Storage We Use">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#1a237e] text-white">
                    <th className="border border-gray-200 px-3 py-2 text-left">Type</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Storage</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Purpose</th>
                    <th className="border border-gray-200 px-3 py-2 text-left">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-medium">Authentication</td>
                    <td className="border border-gray-200 px-3 py-2">Local storage + session</td>
                    <td className="border border-gray-200 px-3 py-2">Keeps you signed in to your portal</td>
                    <td className="border border-gray-200 px-3 py-2">Session / until logout</td>
                  </tr>
                  <tr className="bg-gray-100">
                    <td className="border border-gray-200 px-3 py-2 font-medium">Preferences</td>
                    <td className="border border-gray-200 px-3 py-2">Local storage</td>
                    <td className="border border-gray-200 px-3 py-2">Copilot position, dashboard layout, theme</td>
                    <td className="border border-gray-200 px-3 py-2">Persistent</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-medium">Security</td>
                    <td className="border border-gray-200 px-3 py-2">HttpOnly cookies</td>
                    <td className="border border-gray-200 px-3 py-2">Session integrity (Supabase)</td>
                    <td className="border border-gray-200 px-3 py-2">Session</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="3. Third-Party Services">
            <p>
              The platform integrates Paystack for payments, which sets its own cookies on its
              secure payment domain, governed by Paystack's own cookie policy. We do not control
              these cookies.
            </p>
          </Section>

          <Section title="4. Managing Cookies">
            <p>
              You can delete or block cookies through your browser settings. Blocking essential
              storage will prevent the platform from keeping you signed in. No consent banner is
              shown because we use only strictly necessary storage.
            </p>
          </Section>

          <Section title="5. Updates">
            <p>
              This policy may be updated as the platform evolves. The effective date above reflects
              the latest version.
            </p>
          </Section>

          <Section title="6. Contact">
            <p className="flex items-center gap-2 text-gray-700">
              <Mail className="w-4 h-4 text-[#2563EB]" /> tutorsultimate@gmail.com
            </p>
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
