import { Link } from 'react-router';
import { ArrowRight, ClipboardList, Package, Warehouse } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function StoreKeeperDashboard() {
  const { user, schoolData } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Store Keeper</h1>
        <p className="mt-1 text-sm text-gray-500">{schoolData?.name || 'Your school'} · {user?.firstName} {user?.lastName}</p>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Warehouse className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">You manage the school store</h2>
            <p className="mt-1 text-sm text-gray-600">Add stock, record issues and adjustments, and keep quantities accurate. School Admins can view inventory but cannot change it.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/store-keeper/inventory" className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600"><Package className="h-5 w-5" /></div>
              <div>
                <p className="font-bold text-gray-900">Inventory</p>
                <p className="text-xs text-gray-500">Stock items, ledger and adjustments</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 transition group-hover:text-blue-600" />
          </div>
        </Link>

        <Link to="/store-keeper/inventory" className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600"><ClipboardList className="h-5 w-5" /></div>
              <div>
                <p className="font-bold text-gray-900">Movement ledger</p>
                <p className="text-xs text-gray-500">Received, issued, damaged and lost</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 transition group-hover:text-blue-600" />
          </div>
        </Link>
      </div>
    </div>
  );
}
