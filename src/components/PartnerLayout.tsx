import {
  Bars3Icon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  ShoppingBagIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnixiLogo } from './brand/AnixiLogo';
import { UserProfileMenu } from './page-layout/UserProfileMenu';
import { useAuth } from '../hooks/AuthContext';
import {
  djangoGetPartnerListing,
  djangoGetPartnerOrders,
  djangoUpdatePartnerListing,
  type PartnerListing,
  type PartnerOrder,
} from '../services/djangoApiService';

export const PARTNER_ORDERS_UPDATED_EVENT = 'partner-orders-updated';

const ORDERS_POLL_MS = 15_000;

type PartnerListingContextValue = {
  listing: PartnerListing | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  save: (patch: Partial<PartnerListing>) => Promise<PartnerListing>;
};

const PartnerListingContext = createContext<PartnerListingContextValue | undefined>(undefined);

export const usePartnerListing = (): PartnerListingContextValue => {
  const ctx = useContext(PartnerListingContext);
  if (!ctx) throw new Error('usePartnerListing must be used within PartnerLayout');
  return ctx;
};

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  pharmacyOnly?: boolean;
};

const mainNav: NavItem[] = [
  { name: 'Overview', href: '/partner', icon: HomeIcon },
  { name: 'Listing', href: '/partner/listing', icon: BuildingStorefrontIcon },
  { name: 'Offerings', href: '/partner/offerings', icon: ShoppingBagIcon },
  {
    name: 'Orders',
    href: '/partner/orders',
    icon: ClipboardDocumentListIcon,
    pharmacyOnly: true,
  },
  { name: 'Account', href: '/partner/account', icon: Cog6ToothIcon },
];

function NavLink({
  item,
  isActive,
  onNavigate,
  badgeCount,
}: {
  item: NavItem;
  isActive: (path: string) => boolean;
  onNavigate?: () => void;
  badgeCount?: number;
}) {
  const Icon = item.icon;
  const active = isActive(item.href);
  const showBadge = Boolean(badgeCount && badgeCount > 0);

  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      className={clsx(
        'group flex w-full items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[14px] font-medium leading-snug transition-all duration-200',
        active
          ? 'bg-white text-[#344256] shadow-sm'
          : 'text-white/90 hover:bg-white/15 hover:text-white hover:shadow-sm',
      )}
    >
      <Icon
        className={clsx(
          'h-5 w-5 shrink-0',
          active ? 'text-anixi-green' : 'text-white/80 group-hover:text-white',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{item.name}</span>
      {showBadge ? (
        <span
          className={clsx(
            'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
            active ? 'bg-anixi-green text-white' : 'bg-white text-anixi-green',
          )}
        >
          {badgeCount! > 9 ? '9+' : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

function describeNewOrder(order: PartnerOrder): string {
  const patient = order.patientName?.trim() || 'a patient';
  const item =
    order.lineItems?.[0]?.name?.trim() ||
    (order.source === 'marketplace' ? 'Market order' : 'prescription');
  return `New order from ${patient}: ${item}`;
}

export const PartnerLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [listing, setListing] = useState<PartnerListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openOrderCount, setOpenOrderCount] = useState(0);
  const [orderAlert, setOrderAlert] = useState<string | null>(null);
  const knownOrderIdsRef = useRef<Set<string> | null>(null);
  const orderAlertTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const row = await djangoGetPartnerListing();
      setListing(row);
    } catch (err) {
      setListing(null);
      setError(err instanceof Error ? err.message : 'Could not load listing');
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (patch: Partial<PartnerListing>) => {
    const updated = await djangoUpdatePartnerListing(patch);
    setListing(updated);
    return updated;
  }, []);

  const showOrderAlert = useCallback((message: string) => {
    setOrderAlert(message);
    if (orderAlertTimerRef.current) {
      window.clearTimeout(orderAlertTimerRef.current);
    }
    orderAlertTimerRef.current = window.setTimeout(() => {
      setOrderAlert(null);
      orderAlertTimerRef.current = null;
    }, 8_000);
  }, []);

  const pollOrders = useCallback(async () => {
    if (listing?.partnerType !== 'pharmacy') return;
    try {
      const rows = await djangoGetPartnerOrders();
      const open = rows.filter(
        (o) => !['dispensed', 'cancelled'].includes(String(o.status || '').toLowerCase()),
      ).length;
      setOpenOrderCount(open);

      const ids = new Set(rows.map((row) => row.id));
      const known = knownOrderIdsRef.current;
      if (!known) {
        knownOrderIdsRef.current = ids;
        return;
      }

      const newcomers = rows.filter((row) => !known.has(row.id));
      knownOrderIdsRef.current = ids;
      if (newcomers.length === 0) return;

      window.dispatchEvent(new CustomEvent(PARTNER_ORDERS_UPDATED_EVENT));
      const newest = newcomers[0];
      const message =
        newcomers.length === 1
          ? describeNewOrder(newest)
          : `${newcomers.length} new orders just arrived`;
      showOrderAlert(message);
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification('New pharmacy order', { body: message });
      }
    } catch {
      // Keep the portal usable if polling fails between loads.
    }
  }, [listing?.partnerType, showOrderAlert]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (listing?.partnerType !== 'pharmacy') {
      knownOrderIdsRef.current = null;
      setOpenOrderCount(0);
      return;
    }
    void pollOrders();
    const timer = window.setInterval(() => {
      void pollOrders();
    }, ORDERS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [listing?.partnerType, pollOrders]);

  useEffect(() => {
    return () => {
      if (orderAlertTimerRef.current) {
        window.clearTimeout(orderAlertTimerRef.current);
      }
    };
  }, []);

  const isActive = (path: string) => {
    if (path === '/partner') return location.pathname === '/partner';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const visibleNav = useMemo(
    () =>
      mainNav.filter((item) => {
        if (item.pharmacyOnly && listing?.partnerType !== 'pharmacy') return false;
        return true;
      }),
    [listing?.partnerType],
  );

  const firstName = user?.displayName?.split(' ')[0] || 'Partner';
  const businessName = listing?.businessName || 'Market Partner';

  const ctxValue = useMemo(
    () => ({ listing, loading, error, refresh, save }),
    [listing, loading, error, refresh, save],
  );

  const sidebarNav = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col overflow-hidden px-3 pb-5 pt-2">
      <div className="flex-1 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => (
          <NavLink
            key={item.name}
            item={item}
            isActive={isActive}
            onNavigate={onNavigate}
            badgeCount={item.href === '/partner/orders' ? openOrderCount : undefined}
          />
        ))}
      </div>
      <div className="mt-4 border-t border-white/15 px-2 pt-4">
        <a
          href="mailto:support@anixihealth.com?subject=Market%20Partner%20support"
          onClick={onNavigate}
          className="group flex w-full items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[14px] font-medium leading-snug text-white/90 transition-all duration-200 hover:bg-white/15 hover:text-white hover:shadow-sm"
        >
          <QuestionMarkCircleIcon className="h-5 w-5 shrink-0 text-white/80 group-hover:text-white" />
          <span className="min-w-0 flex-1 truncate">Support</span>
        </a>
        <p className="mt-1.5 px-3.5 text-[11px] leading-relaxed text-white/50">
          support@anixihealth.com
        </p>
      </div>
    </nav>
  );

  return (
    <PartnerListingContext.Provider value={ctxValue}>
      <div className="flex h-screen overflow-hidden bg-[#f0f4f2]">
        {orderAlert ? (
          <div className="fixed left-1/2 top-6 z-[60] w-[min(92vw,28rem)] -translate-x-1/2">
            <div className="rounded-xl bg-green-700 px-4 py-3 text-white shadow-xl">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  className="flex-1 text-left text-sm font-medium"
                  onClick={() => {
                    setOrderAlert(null);
                    if (!location.pathname.startsWith('/partner/orders')) {
                      navigate('/partner/orders');
                    }
                  }}
                >
                  {orderAlert}
                  <span className="mt-1 block text-xs font-normal text-white/80">
                    Tap to open Orders
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderAlert(null)}
                  className="text-sm text-white/75 transition-colors hover:text-white"
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col bg-anixi-green">
          <div className="border-b border-white/10 px-4 py-5">
            <AnixiLogo variant="sidebar" subtitle="MARKET PARTNER" linkTo="/partner" />
          </div>
          {sidebarNav()}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col md:pl-64">
          <header className="sticky top-0 z-30 border-b border-[#dfe6e1] bg-white shadow-sm shadow-[#1a4d4d]/5">
            <div className="flex h-[4.25rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e1e7ef] text-[#65758b] md:hidden"
                aria-label="Open navigation"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-heading text-2xl font-bold tracking-tight text-[#1a4d4d] sm:text-[1.75rem]">
                  {businessName}
                </h1>
                <p className="truncate text-xs text-[#65758b] sm:text-sm">
                  {listing?.partnerType === 'pharmacy' ? 'Pharmacy partner' : 'Wellness partner'}
                  {listing?.verified ? ' · Verified' : ''}
                  {listing ? (listing.published ? ' · Live on Market' : ' · Hidden') : ''}
                </p>
              </div>
              <UserProfileMenu subtitle="Market Partner" displayLabel={firstName} />
            </div>
          </header>

          {mobileNavOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation"
              />
              <div className="absolute left-0 top-0 flex h-full w-[min(280px,88vw)] flex-col bg-anixi-green shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                  <AnixiLogo
                    variant="sidebar"
                    subtitle="MARKET PARTNER"
                    linkTo="/partner"
                    onClick={() => setMobileNavOpen(false)}
                  />
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
                    aria-label="Close navigation"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">
                  {sidebarNav(() => setMobileNavOpen(false))}
                  <div className="px-3 pb-6">
                    <UserProfileMenu
                      variant="mobile"
                      subtitle="Market Partner"
                      onNavigate={() => setMobileNavOpen(false)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </PartnerListingContext.Provider>
  );
};
