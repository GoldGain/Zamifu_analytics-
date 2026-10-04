import FeeWorkspace from '@/pages/dashboard/school-admin/Fees';

/**
 * Bursar-only entry point for the existing fee workspace.
 * Access is enforced by the /bursar/fees route in App.tsx.
 */
export default function BursarFees() {
  return <FeeWorkspace />;
}
