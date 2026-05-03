'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatCurrency, getDefaultRange } from '@/lib/utils';
import { DateRange } from '@/lib/types';
import { Printer, Loader2, FileText, ArrowLeft } from 'lucide-react';

const MNAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function InformePage() {
  // Leer rango de la URL si viene del dashboard, sino default
  const [range, setRange] = useState<DateRange>(() => {
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href);
      const start = u.searchParams.get('start');
      const end = u.searchParams.get('end');
      if (start && end) {
        return {
          label: 'Personalizado',
          startDate: new Date(start),
          endDate: new Date(end),
        };
      }
    }
    return getDefaultRange('Últimos 3 meses');
  });
  const [dashboard, setDashboard] = useState<any>(null);
  const [brand, setBrand] = useState<any>(null);
  const [conciliacion, setConciliacion] = useState<any>(null);
  const [comunidad, setComunidad] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams({
        start: range.startDate.toISOString(),
        end: range.endDate.toISOString(),
      });
      try {
        const [d, b, c, cm] = await Promise.all([
          fetch(`/api/dashboard?${params}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/semper-brand?${params}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/conciliacion?${params}`).then(r => r.ok ? r.json() : null),
          fetch(`/api/comunidad?${params}`).then(r => r.ok ? r.json() : null),
        ]);
        setDashboard(d); setBrand(b); setConciliacion(c); setComunidad(cm);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [range]);

  const periodLabel = useMemo(() => {
    const s = range.startDate, e = range.endDate;
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${MNAMES[s.getMonth()]} ${s.getFullYear()}`;
    }
    return `${s.toLocaleDateString('es-ES')} → ${e.toLocaleDateString('es-ES')}`;
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-violet-600" size={32} />
        <span className="ml-3 text-gray-500">Cargando informe...</span>
      </div>
    );
  }

  const brandIngresos = brand?.income?.total || 0;
  const brandGastos = (brand?.expenses?.total || 0) + (brand?.expenses?.stripeFees || 0) + (brand?.expenses?.shopifyRefunds || 0) + (brand?.giftLoss || 0);
  const brandBeneficio = brandIngresos - brandGastos;
  const brandMargen = brandIngresos > 0 ? (brandBeneficio / brandIngresos) * 100 : 0;
  const stockVal = brand?.stockValuation;

  const comunidadIngresos = dashboard?.macroGroups?.diezmos?.income || 0;
  const comunidadGastos = dashboard?.macroGroups?.diezmos?.expenses || 0;
  const comunidadNeto = comunidadIngresos - comunidadGastos;

  const otrosIngresos = dashboard?.macroGroups?.otros?.income || 0;
  const otrosGastos = dashboard?.macroGroups?.otros?.expenses || 0;
  const otrosNeto = otrosIngresos - otrosGastos;

  const totalIngresos = comunidadIngresos + brandIngresos + otrosIngresos;
  const totalGastos = comunidadGastos + brandGastos + otrosGastos;
  const totalBeneficio = totalIngresos - totalGastos;

  return (
    <div className="bg-gray-50 min-h-screen print:bg-white">
      {/* Toolbar (oculto en print) */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-[210mm] mx-auto px-6 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} /> Volver al dashboard
          </a>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 shadow-md"
          >
            <Printer size={16} /> Descargar PDF
          </button>
        </div>
      </div>

      {/* Documento A4 */}
      <div className="max-w-[210mm] mx-auto bg-white print:max-w-none print:mx-0">

        {/* PORTADA */}
        <section className="page py-16 px-12 min-h-[297mm] print:min-h-[297mm] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileText size={28} className="text-violet-600" />
              <span className="text-xs font-bold text-gray-400 tracking-wider uppercase">Informe Financiero</span>
            </div>
            <h1 className="text-6xl font-bold text-gray-900 mb-3 leading-tight">Semper Jóvenes</h1>
            <p className="text-2xl text-gray-500 font-light">{periodLabel}</p>
          </div>

          <div className="space-y-6 my-12">
            <Big label="Ingresos totales" value={formatCurrency(totalIngresos)} color="emerald" />
            <Big label="Gastos totales" value={formatCurrency(totalGastos)} color="rose" />
            <Big label={totalBeneficio >= 0 ? "Beneficio neto" : "Pérdida neta"} value={formatCurrency(totalBeneficio)} color={totalBeneficio >= 0 ? 'emerald' : 'rose'} big />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="grid grid-cols-3 gap-4">
              <PortadaArea label="Comunidad" value={comunidadNeto} color="violet" />
              <PortadaArea label="Semper Brand" value={brandBeneficio} color="indigo" />
              <PortadaArea label="Otros" value={otrosNeto} color="amber" />
            </div>
            <p className="text-xs text-gray-400 mt-8">
              Generado el {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · economia.semperjovenes.com
            </p>
          </div>
        </section>

        {/* SECCIÓN 1: COMUNIDAD */}
        <section className="page page-break-before py-12 px-12">
          <SectionHeader number="01" title="Comunidad" subtitle="Diezmos, donativos y operación de la comunidad" color="violet" />

          <div className="grid grid-cols-3 gap-4 mb-8">
            <KPI label="Ingresos" value={formatCurrency(comunidadIngresos)} color="emerald" />
            <KPI label="Gastos" value={formatCurrency(comunidadGastos)} color="rose" />
            <KPI label={comunidadNeto >= 0 ? "Beneficio" : "Pérdida"} value={formatCurrency(comunidadNeto)} color={comunidadNeto >= 0 ? 'emerald' : 'rose'} highlight />
          </div>

          <Subsection title="Desglose Ingresos">
            <Table headers={['Categoría', 'Importe', '%']} rows={
              Object.entries(dashboard?.macroGroups?.diezmos?.tags || {})
                .filter((t: any) => t[1].income > 0)
                .sort((a: any, b: any) => b[1].income - a[1].income)
                .map((t: any) => [
                  t[1].tag || t[0],
                  formatCurrency(t[1].income),
                  comunidadIngresos > 0 ? `${((t[1].income / comunidadIngresos) * 100).toFixed(1)}%` : '0%',
                ])
            } />
          </Subsection>

          <Subsection title="Desglose Gastos">
            <Table headers={['Categoría', 'Importe', '%']} rows={
              Object.entries(dashboard?.macroGroups?.diezmos?.tags || {})
                .filter((t: any) => t[1].expenses > 0)
                .sort((a: any, b: any) => b[1].expenses - a[1].expenses)
                .map((t: any) => [
                  t[1].tag || t[0],
                  formatCurrency(t[1].expenses),
                  comunidadGastos > 0 ? `${((t[1].expenses / comunidadGastos) * 100).toFixed(1)}%` : '0%',
                ])
            } />
          </Subsection>

          {comunidad?.summary && (
            <Subsection title="Comunidades">
              <Table headers={['Comunidad', 'Miembros', 'Pagan', '%']} rows={
                (comunidad.communityStats || []).map((c: any) => [
                  c.name, c.totalMembers, c.payingMembers, `${c.totalMembers > 0 ? Math.round((c.payingMembers / c.totalMembers) * 100) : 0}%`,
                ])
              } />
            </Subsection>
          )}
        </section>

        {/* SECCIÓN 2: SEMPER BRAND */}
        <section className="page page-break-before py-12 px-12">
          <SectionHeader number="02" title="Semper Brand" subtitle="Ventas, stock e inversión inmovilizada" color="indigo" />

          <div className="grid grid-cols-3 gap-4 mb-8">
            <KPI label="Ingresos" value={formatCurrency(brandIngresos)} color="emerald" sub={`${brand?.income?.shopifyOrders || 0} pedidos · ${brand?.income?.ventasCount || 0} ventas`} />
            <KPI label="Gastos" value={formatCurrency(brandGastos)} color="rose" sub={`Devol. ${formatCurrency(brand?.expenses?.shopifyRefunds || 0)}`} />
            <KPI label={brandBeneficio >= 0 ? "Beneficio" : "Pérdida"} value={formatCurrency(brandBeneficio)} color={brandBeneficio >= 0 ? 'emerald' : 'rose'} sub={`${brandMargen.toFixed(1)}% margen`} highlight />
          </div>

          <Subsection title="Fuentes de ingresos">
            <Table headers={['Fuente', 'Importe', '%']} rows={[
              ['Shopify (online)', formatCurrency(brand?.income?.shopify || 0), brandIngresos > 0 ? `${(((brand?.income?.shopify || 0) / brandIngresos) * 100).toFixed(1)}%` : '0%'],
              ['Ventas presenciales', formatCurrency(brand?.income?.ventasPresenciales || 0), brandIngresos > 0 ? `${(((brand?.income?.ventasPresenciales || 0) / brandIngresos) * 100).toFixed(1)}%` : '0%'],
            ]} />
          </Subsection>

          <Subsection title="Gastos">
            <Table headers={['Concepto', 'Importe']} rows={[
              ['Devoluciones Shopify', formatCurrency(brand?.expenses?.shopifyRefunds || 0)],
              ['Comisiones Stripe', formatCurrency(brand?.expenses?.stripeFees || 0)],
              ['Pérdida regalos (coste)', formatCurrency(brand?.giftLoss || 0)],
              ['Otros (banco)', formatCurrency(brand?.expenses?.total || 0)],
            ].filter(r => parseFloat(String(r[1]).replace(/[^0-9.-]/g,'')) > 0)} />
          </Subsection>

          {stockVal && (
            <>
              <Subsection title="📦 Stock & Inversión inmovilizada">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <MiniKPI label="Unidades" value={stockVal.units?.toLocaleString('es-ES')} />
                  <MiniKPI label="€ Invertidos" value={formatCurrency(stockVal.costValue || 0)} color="orange" />
                  <MiniKPI label="Ingreso potencial" value={formatCurrency(stockVal.retailValue || 0)} color="blue" />
                  <MiniKPI label="Beneficio potencial" value={formatCurrency(stockVal.potentialProfit || 0)} color="emerald" sub={`${(stockVal.potentialMargin || 0).toFixed(1)}% margen`} />
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  ROI sobre inversión: <strong>{stockVal.costValue > 0 ? `${((stockVal.potentialProfit / stockVal.costValue) * 100).toFixed(0)}%` : '—'}</strong> ·
                  Productos con coste: {stockVal.productsWithCost} · Sin coste: {stockVal.productsWithoutCost}
                </p>
              </Subsection>

              <Subsection title="Top productos por valor potencial">
                <Table headers={['#', 'Producto', 'Unidades', 'PVP', 'Beneficio pot.']} rows={
                  (stockVal.topByValue || []).slice(0, 8).map((p: any, i: number) => [
                    `#${i+1}`, p.title, p.units, formatCurrency(p.retail), formatCurrency(p.potentialProfit),
                  ])
                } />
              </Subsection>
            </>
          )}

          {brand?.topProducts && (
            <Subsection title="Top productos vendidos (período)">
              <Table headers={['#', 'Producto', 'Uds', 'Ingresos']} rows={
                brand.topProducts.slice(0, 8).map((p: any, i: number) => [
                  `#${i+1}`, p.title, p.units, formatCurrency(p.revenue),
                ])
              } />
            </Subsection>
          )}
        </section>

        {/* SECCIÓN 3: OTROS */}
        <section className="page page-break-before py-12 px-12">
          <SectionHeader number="03" title="Otros" subtitle="Viajes, eventos y movimientos no clasificados como Comunidad o Brand" color="amber" />

          <div className="grid grid-cols-3 gap-4 mb-8">
            <KPI label="Ingresos" value={formatCurrency(otrosIngresos)} color="emerald" />
            <KPI label="Gastos" value={formatCurrency(otrosGastos)} color="rose" />
            <KPI label={otrosNeto >= 0 ? "Neto" : "Pérdida"} value={formatCurrency(otrosNeto)} color={otrosNeto >= 0 ? 'emerald' : 'rose'} highlight />
          </div>

          <Subsection title="Desglose ingresos">
            <Table headers={['Categoría', 'Importe', '%']} rows={
              Object.entries(dashboard?.macroGroups?.otros?.tags || {})
                .filter((t: any) => t[1].income > 0)
                .sort((a: any, b: any) => b[1].income - a[1].income)
                .map((t: any) => [
                  t[1].tag || t[0],
                  formatCurrency(t[1].income),
                  otrosIngresos > 0 ? `${((t[1].income / otrosIngresos) * 100).toFixed(1)}%` : '0%',
                ])
            } />
          </Subsection>

          <Subsection title="Desglose gastos (viajes, eventos, etc.)">
            <Table headers={['Categoría', 'Importe', '%']} rows={
              Object.entries(dashboard?.macroGroups?.otros?.tags || {})
                .filter((t: any) => t[1].expenses > 0)
                .sort((a: any, b: any) => b[1].expenses - a[1].expenses)
                .map((t: any) => [
                  t[1].tag || t[0],
                  formatCurrency(t[1].expenses),
                  otrosGastos > 0 ? `${((t[1].expenses / otrosGastos) * 100).toFixed(1)}%` : '0%',
                ])
            } />
          </Subsection>
        </section>

        {/* SECCIÓN 4: CONCILIACIÓN */}
        {conciliacion?.totals && (
          <section className="page page-break-before py-12 px-12">
            <SectionHeader number="04" title="Conciliación bancaria" subtitle="Ingresos teóricos (Shopify + Presencial) vs reales (banco)" color="blue" />

            <div className="grid grid-cols-3 gap-4 mb-8">
              <KPI label="Teórico" value={formatCurrency(conciliacion.totals.teoricoTotal)} color="violet" sub="Shopify + Presencial" />
              <KPI label="Real banco" value={formatCurrency(conciliacion.totals.realTotal)} color="blue" sub="Bizum + Transfer + Stripe" />
              <KPI
                label="Diferencia"
                value={formatCurrency(conciliacion.totals.teoricoTotal - conciliacion.totals.realTotal)}
                color={Math.abs(conciliacion.totals.teoricoTotal - conciliacion.totals.realTotal) <= conciliacion.totals.teoricoTotal * 0.05 ? 'emerald' : 'amber'}
                sub={conciliacion.totals.teoricoTotal > 0 ? `${(((conciliacion.totals.teoricoTotal - conciliacion.totals.realTotal) / conciliacion.totals.teoricoTotal) * 100).toFixed(1)}%` : '—'}
                highlight
              />
            </div>

            <Subsection title="Por mes">
              <Table headers={['Mes', 'Teórico', 'Real', 'Dif.', 'Estado']} rows={
                (conciliacion.months || []).map((m: any) => {
                  const pctAbs = Math.abs(m.pct);
                  const status = pctAbs <= 5 ? '✓ OK' : pctAbs <= 15 ? '⚠ Moderada' : '⚠ Alta';
                  return [m.month, formatCurrency(m.teorico.total), formatCurrency(m.real.total), formatCurrency(m.diferencia), status];
                })
              } />
            </Subsection>
          </section>
        )}

        {/* CONTRAPORTADA */}
        <section className="page page-break-before py-16 px-12 min-h-[200mm]">
          <SectionHeader number="—" title="Resumen ejecutivo" subtitle="Visión global del periodo" color="gray" />

          <div className="grid grid-cols-2 gap-6 my-8">
            <div className="bg-emerald-50 rounded-2xl p-6">
              <p className="text-xs uppercase font-bold text-emerald-700 mb-2">Ingresos totales</p>
              <p className="text-4xl font-bold text-emerald-700">{formatCurrency(totalIngresos)}</p>
              <p className="text-xs text-emerald-600 mt-2">
                {comunidadIngresos > 0 ? `Comunidad ${formatCurrency(comunidadIngresos)} · ` : ''}
                {brandIngresos > 0 ? `Brand ${formatCurrency(brandIngresos)} · ` : ''}
                {otrosIngresos > 0 ? `Otros ${formatCurrency(otrosIngresos)}` : ''}
              </p>
            </div>
            <div className="bg-rose-50 rounded-2xl p-6">
              <p className="text-xs uppercase font-bold text-rose-700 mb-2">Gastos totales</p>
              <p className="text-4xl font-bold text-rose-700">{formatCurrency(totalGastos)}</p>
            </div>
          </div>

          <div className={`${totalBeneficio >= 0 ? 'bg-emerald-100' : 'bg-rose-100'} rounded-2xl p-8 mb-8`}>
            <p className={`text-xs uppercase font-bold ${totalBeneficio >= 0 ? 'text-emerald-800' : 'text-rose-800'} mb-3`}>
              {totalBeneficio >= 0 ? 'Beneficio neto del periodo' : 'Pérdida neta del periodo'}
            </p>
            <p className={`text-6xl font-bold ${totalBeneficio >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(totalBeneficio)}
            </p>
            <p className={`text-sm ${totalBeneficio >= 0 ? 'text-emerald-600' : 'text-rose-600'} mt-2`}>
              Margen: {totalIngresos > 0 ? `${((totalBeneficio / totalIngresos) * 100).toFixed(1)}%` : '—'}
            </p>
          </div>

          {dashboard?.financials?.bankBalance && (
            <div className="bg-gray-50 rounded-2xl p-6 mb-8">
              <p className="text-xs uppercase font-bold text-gray-500 mb-2">Saldo bancario actual</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(dashboard.financials.bankBalance)}</p>
            </div>
          )}

          {stockVal && (
            <div className="border-2 border-indigo-200 bg-indigo-50/30 rounded-2xl p-6">
              <p className="text-xs uppercase font-bold text-indigo-700 mb-3">📦 Activo inmovilizado en stock</p>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-xs text-gray-500">Invertido</p><p className="text-xl font-bold text-orange-700">{formatCurrency(stockVal.costValue)}</p></div>
                <div><p className="text-xs text-gray-500">Valor venta</p><p className="text-xl font-bold text-blue-700">{formatCurrency(stockVal.retailValue)}</p></div>
                <div><p className="text-xs text-gray-500">Beneficio potencial</p><p className="text-xl font-bold text-emerald-700">{formatCurrency(stockVal.potentialProfit)}</p></div>
              </div>
            </div>
          )}

          <div className="mt-12 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">Semper Jóvenes · Informe financiero {periodLabel}</p>
            <p className="text-xs text-gray-400 mt-1">Generado automáticamente desde economia.semperjovenes.com el {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </section>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break-before { page-break-before: always; break-before: page; }
          .page { page-break-inside: avoid; }
        }
        .page { background: white; }
      `}</style>
    </div>
  );
}

// =================== Helpers ===================
function Big({ label, value, color, big }: { label: string; value: string; color: string; big?: boolean }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-700 bg-emerald-50',
    rose: 'text-rose-700 bg-rose-50',
  };
  return (
    <div className={`flex items-center justify-between p-4 rounded-xl ${colors[color]}`}>
      <span className="text-sm font-semibold opacity-70">{label}</span>
      <span className={`font-bold ${big ? 'text-4xl' : 'text-2xl'}`}>{value}</span>
    </div>
  );
}

function PortadaArea({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  };
  return (
    <div className={`border rounded-xl p-3 ${colors[color]}`}>
      <p className="text-[10px] uppercase font-bold opacity-70">{label}</p>
      <p className="text-lg font-bold">{formatCurrency(value)}</p>
    </div>
  );
}

function SectionHeader({ number, title, subtitle, color }: { number: string; title: string; subtitle: string; color: string }) {
  const colors: Record<string, string> = {
    violet: 'text-violet-600 border-violet-200',
    indigo: 'text-indigo-600 border-indigo-200',
    amber: 'text-amber-600 border-amber-200',
    blue: 'text-blue-600 border-blue-200',
    gray: 'text-gray-600 border-gray-200',
  };
  return (
    <div className={`mb-8 pb-4 border-b-2 ${colors[color]}`}>
      <span className={`text-xs font-bold tracking-widest ${colors[color].split(' ')[0]}`}>{number}</span>
      <h2 className="text-4xl font-bold text-gray-900 mt-1">{title}</h2>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function KPI({ label, value, color, sub, highlight }: { label: string; value: string; color: string; sub?: string; highlight?: boolean }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    rose: 'text-rose-700 bg-rose-50 border-rose-200',
    violet: 'text-violet-700 bg-violet-50 border-violet-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
  };
  return (
    <div className={`border-2 rounded-xl p-4 ${colors[color]} ${highlight ? 'ring-2 ring-offset-2 ring-current' : ''}`}>
      <p className="text-xs uppercase font-bold opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  );
}

function MiniKPI({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  const colors: Record<string, string> = {
    orange: 'text-orange-700 bg-orange-50',
    blue: 'text-blue-700 bg-blue-50',
    emerald: 'text-emerald-700 bg-emerald-50',
  };
  return (
    <div className={`rounded-lg p-3 ${colors[color || ''] || 'text-gray-700 bg-gray-50'}`}>
      <p className="text-[10px] uppercase font-semibold opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
      {sub && <p className="text-[10px] opacity-60">{sub}</p>}
    </div>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: any[][] }) {
  if (!rows.length) return <p className="text-xs text-gray-400 italic">Sin datos</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-200">
          {headers.map((h, i) => (
            <th key={i} className={`px-3 py-2 text-xs font-bold text-gray-500 uppercase ${i === headers.length - 1 ? 'text-right' : 'text-left'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-gray-100">
            {row.map((cell, j) => (
              <td key={j} className={`px-3 py-2 ${j === row.length - 1 ? 'text-right font-semibold' : ''} ${j === 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
