'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Settings,
  CreditCard,
  Store,
  Landmark,
  Church,
  BarChart3,
  Tag,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navSections = [
  {
    title: 'General',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Semper Brand',
    items: [
      { href: '/semper-brand', label: 'Resultado (P&L)', icon: BarChart3 },
      { href: '/orders', label: 'Órdenes', icon: ShoppingCart },
      { href: '/products', label: 'Inventario', icon: Package },
      { href: '/ventas', label: 'Ventas Presenciales', icon: Store },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      { href: '/categorias', label: 'Categorías', icon: Tag },
      { href: '/extracto', label: 'Extracto Bancario', icon: Landmark },
      { href: '/stripe', label: 'Stripe', icon: CreditCard },
    ],
  },
  {
    title: 'Comunidad',
    items: [
      { href: '/diezmos', label: 'Diezmos', icon: Church },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-gray-900 text-white transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-sm font-bold">
              SD
            </div>
            <div>
              <h1 className="text-sm font-semibold">Semper Dashboard</h1>
              <p className="text-xs text-gray-400">Financial Hub</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{section.title}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-violet-600/20 text-violet-400'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      )}
                    >
                      <item.icon size={18} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-4 border-t border-gray-800">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <Settings size={18} />
            Configuración
          </Link>
        </div>
      </aside>
    </>
  );
}
