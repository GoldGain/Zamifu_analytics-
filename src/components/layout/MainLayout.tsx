import { Link, useNavigate } from 'react-router';
import { GraduationCap, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PWAInstallButton from '@/components/PWAInstallButton';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#F5F3EF]/95 backdrop-blur-sm border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <img src="/images/logo.png" alt="Zamifu Analytics" className="w-9 h-9 object-contain rounded-lg" />
              <span className="text-xl font-bold text-[#111111]">Zamifu Analytics</span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              <Link to="/pathway-finder" className="text-sm text-[#666666] hover:text-[#111111] transition-colors">Pathway Finder</Link>
              <a href="#features" className="text-sm text-[#666666] hover:text-[#111111] transition-colors">Features</a>
              <a href="#testimonials" className="text-sm text-[#666666] hover:text-[#111111] transition-colors">Testimonials</a>
              <a href="#faq" className="text-sm text-[#666666] hover:text-[#111111] transition-colors">FAQ</a>
              <PWAInstallButton variant="nav" />
              {user ? (
                <div className="flex items-center gap-3">
                  <Link 
                    to={user.role === 'master_super_admin' ? '/master-admin' : user.role === 'reseller_super_admin' ? '/reseller-admin' : `/${user.role.replace(/_/g, '-')}`}
                    className="text-sm font-medium bg-[#2563EB] text-white px-4 py-2 rounded-full hover:bg-[#1d4ed8] transition-colors"
                  >
                    Dashboard
                  </Link>
                  <button 
                    onClick={handleLogout}
                    className="text-sm text-[#666666] hover:text-[#111111] transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/auth/login" className="text-sm text-[#666666] hover:text-[#111111] transition-colors">Login</Link>
                  <Link to="/register-school" className="text-sm font-medium bg-[#2563EB] text-white px-4 py-2 rounded-full hover:bg-[#1d4ed8] transition-colors">
                    Get Started
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile Nav */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-[#E5E5E5]">
              <div className="flex flex-col gap-3">
                <Link to="/pathway-finder" className="text-sm text-[#666666] py-2" onClick={() => setMobileMenuOpen(false)}>Pathway Finder</Link>
                <a href="#features" className="text-sm text-[#666666] py-2" onClick={() => setMobileMenuOpen(false)}>Features</a>
                <a href="#testimonials" className="text-sm text-[#666666] py-2" onClick={() => setMobileMenuOpen(false)}>Testimonials</a>
                <a href="#faq" className="text-sm text-[#666666] py-2" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
                {user ? (
                  <>
                    <Link to={user.role === 'master_super_admin' ? '/master-admin' : user.role === 'reseller_super_admin' ? '/reseller-admin' : `/${user.role.replace(/_/g, '-')}`} className="text-sm font-medium bg-[#2563EB] text-white px-4 py-2 rounded-full text-center" onClick={() => setMobileMenuOpen(false)}>
                      Dashboard
                    </Link>
                    <button onClick={handleLogout} className="text-sm text-[#666666] py-2 text-left">Logout</button>
                  </>
                ) : (
                  <>
                    <Link to="/auth/login" className="text-sm text-[#666666] py-2" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                    <Link to="/register-school" className="text-sm font-medium bg-[#2563EB] text-white px-4 py-2 rounded-full text-center" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {children}

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/images/logo.png" alt="Zamifu Analytics" className="w-9 h-9 object-contain rounded-lg" />
                <span className="text-lg font-bold">Zamifu Analytics</span>
              </div>
              <p className="text-sm text-gray-400">Connecting Schools, Students, and Parents for a brighter future in Kenyan education. Smarter Schools, Brighter Futures.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <div className="flex flex-col gap-2 text-sm text-gray-400">
                <a href="#features" className="hover:text-white transition-colors">Features</a>
                <a href="#" className="hover:text-white transition-colors">Integrations</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Support</h4>
              <div className="flex flex-col gap-2 text-sm text-gray-400">
                <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                <a href="#" className="hover:text-white transition-colors">Documentation</a>
              </div>
            </div>

          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">&copy; 2025 Zamifu Analytics. All rights reserved.</p>
            <p className="text-sm text-gray-400">Designed for Kenyan Schools</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
