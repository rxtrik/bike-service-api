import { useEffect, useState } from 'react';

const API_URL = 'http://localhost:3000';

interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  estimatedMinutes: number;
  basePrice: string | number;
}

interface Part {
  id: string;
  sku: string;
  name: string;
  brand: string;
  stockQuantity: number;
  unitPrice: string | number;
}

interface Mechanic {
  id: string;
  fullName: string;
  email: string;
}

interface Bike {
  id: string;
  brand: string;
  model: string;
  frameNumber: string;
  year: number | null;
  owner: { fullName: string };
}

interface TimeSlot {
  start: string;
  end: string;
}

interface OrderHistoryItem {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledStart: string;
  scheduledEnd: string;
  totalPrice: string | number;
  mechanicNotes: string | null;
  mechanic: { fullName: string } | null;
  services: { id: string; priceAtBooking: string | number; serviceType: { name: string; estimatedMinutes: number } }[];
  parts: { id: string; quantity: number; priceAtBooking: string | number; part: { name: string; sku: string } }[];
}

interface BikeHistory {
  id: string;
  brand: string;
  model: string;
  frameNumber: string;
  year: number | null;
  owner: { fullName: string; email: string };
  orders: OrderHistoryItem[];
}

const STATUS_STYLES: Record<OrderHistoryItem['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 border-purple-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-rose-100 text-rose-800 border-rose-200',
};

export function App() {
  const [services, setServices] = useState<ServiceType[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [bikes, setBikes] = useState<Bike[]>([]);

  // Formularz rezerwacji
  const [selectedBikeId, setSelectedBikeId] = useState('');
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [date, setDate] = useState('2026-11-26');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedParts, setSelectedParts] = useState<Record<string, number>>({});
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [notes, setNotes] = useState('');

  // Książka serwisowa
  const [searchFrame, setSearchFrame] = useState('R09401H22B0145');
  const [bikeHistory, setBikeHistory] = useState<BikeHistory | null>(null);

  // Komunikaty
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadInitialData = async () => {
    try {
      const [catRes, resRes] = await Promise.all([
        fetch(`${API_URL}/api/catalog`),
        fetch(`${API_URL}/api/resources`),
      ]);
      const catData = await catRes.json();
      const resData = await resRes.json();

      setServices(catData.services || []);
      setParts(catData.parts || []);
      setMechanics(resData.mechanics || []);
      setBikes(resData.bikes || []);

      if (resData.bikes?.length && !selectedBikeId) {
        setSelectedBikeId(resData.bikes[0].id);
      }
      if (resData.mechanics?.length && !selectedMechanicId) {
        setSelectedMechanicId(resData.mechanics[0].id);
      }
    } catch {
      setFeedback({ type: 'error', text: 'Brak połączenia z API (sprawdź czy backend działa na porcie 3000).' });
    }
  };

  const fetchHistory = async (frame: string) => {
    if (!frame.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/orders/bike/${encodeURIComponent(frame.trim())}`);
      if (!res.ok) {
        setBikeHistory(null);
        return;
      }
      const data = await res.json();
      setBikeHistory(data);
    } catch {
      setBikeHistory(null);
    }
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [catRes, resRes, histRes] = await Promise.all([
          fetch(`${API_URL}/api/catalog`),
          fetch(`${API_URL}/api/resources`),
          fetch(`${API_URL}/api/orders/bike/R09401H22B0145`),
        ]);
        if (!active) return;

        const catData = await catRes.json();
        const resData = await resRes.json();

        setServices(catData.services || []);
        setParts(catData.parts || []);
        setMechanics(resData.mechanics || []);
        setBikes(resData.bikes || []);

        if (resData.bikes?.length) {
          setSelectedBikeId((prev) => prev || resData.bikes[0].id);
        }
        if (resData.mechanics?.length) {
          setSelectedMechanicId((prev) => prev || resData.mechanics[0].id);
        }

        if (histRes.ok) {
          const histData = await histRes.json();
          setBikeHistory(histData);
        }
      } catch {
        if (active) {
          setFeedback({
            type: 'error',
            text: 'Brak połączenia z API (sprawdź czy backend działa na porcie 3000).',
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const totalMinutes = services
    .filter((s) => selectedServiceIds.includes(s.id))
    .reduce((sum, s) => sum + s.estimatedMinutes, 0);

  useEffect(() => {
    if (!selectedMechanicId || !date || totalMinutes === 0) return;

    let active = true;
    const params = new URLSearchParams({
      mechanicId: selectedMechanicId,
      date,
      durationMinutes: String(totalMinutes),
    });

    fetch(`${API_URL}/api/orders/availability?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setSlots(data.availableSlots || []);
          setSelectedSlot('');
        }
      })
      .catch(() => {
        if (active) setSlots([]);
      });

    return () => {
      active = false;
    };
  }, [selectedMechanicId, date, totalMinutes]);

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const updatePartQty = (partId: string, qty: number) => {
    setSelectedParts((prev) => {
      const copy = { ...prev };
      if (qty <= 0) {
        delete copy[partId];
      } else {
        copy[partId] = qty;
      }
      return copy;
    });
  };

  const servicesCost = services
    .filter((s) => selectedServiceIds.includes(s.id))
    .reduce((sum, s) => sum + Number(s.basePrice), 0);

  const partsCost = Object.entries(selectedParts).reduce((sum, [partId, qty]) => {
    const part = parts.find((p) => p.id === partId);
    return sum + (part ? Number(part.unitPrice) * qty : 0);
  }, 0);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setFeedback({ type: 'error', text: 'Wybierz usługę oraz wolną godzinę wizyty.' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const payload = {
        bikeId: selectedBikeId,
        mechanicId: selectedMechanicId,
        scheduledStart: selectedSlot,
        serviceIds: selectedServiceIds,
        parts: Object.entries(selectedParts).map(([partId, quantity]) => ({ partId, quantity })),
        mechanicNotes: notes.trim() || undefined,
      };

      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Błąd podczas tworzenia zlecenia.' });
        return;
      }

      setFeedback({ type: 'success', text: `Zarezerwowano wizytę! Kwota całkowita: ${Number(data.totalPrice).toFixed(2)} PLN.` });
      setSelectedParts({});
      setNotes('');
      setSelectedSlot('');
      await loadInitialData();

      const bookedBike = bikes.find((b) => b.id === selectedBikeId);
      if (bookedBike) {
        setSearchFrame(bookedBike.frameNumber);
        await fetchHistory(bookedBike.frameNumber);
      }
    } catch {
      setFeedback({ type: 'error', text: 'Błąd połączenia z serwerem.' });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, status: OrderHistoryItem['status']) => {
    setFeedback(null);
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Nie udało się zmienić statusu.' });
        return;
      }

      setFeedback({
        type: 'success',
        text:
          status === 'CANCELLED'
            ? 'Zlecenie anulowane — zarezerwowane części wróciły na magazyn.'
            : `Zmieniono status zlecenia na ${status}.`,
      });
      await Promise.all([loadInitialData(), fetchHistory(searchFrame)]);
    } catch {
      setFeedback({ type: 'error', text: 'Błąd sieci przy zmianie statusu.' });
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Bike Service & Digital Maintenance Log
            </h1>
            <p className="text-xs text-slate-400">
              System rezerwacji serwisu, kontroli magazynu i historii po numerze ramy
            </p>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            API: localhost:3000
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {feedback && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* LEWA KOLUMNA: NOWA REZERWACJA */}
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Nowe zlecenie serwisowe</h2>

            <form onSubmit={handleCreateOrder} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Rower</label>
                  <select
                    value={selectedBikeId}
                    onChange={(e) => setSelectedBikeId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {bikes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.brand} {b.model} ({b.frameNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Mechanik</label>
                  <select
                    value={selectedMechanicId}
                    onChange={(e) => setSelectedMechanicId(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {mechanics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">
                  1. Zakres prac (wybierz usługi)
                </label>
                <div className="space-y-2">
                  {services.map((service) => {
                    const checked = selectedServiceIds.includes(service.id);
                    return (
                      <label
                        key={service.id}
                        className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition ${
                          checked
                            ? 'border-emerald-500/60 bg-emerald-500/10'
                            : 'border-slate-800 bg-slate-800/50 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleService(service.id)}
                            className="mt-1 accent-emerald-500"
                          />
                          <div>
                            <div className="text-sm font-medium text-white">{service.name}</div>
                            <div className="text-xs text-slate-400">{service.estimatedMinutes} min</div>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-emerald-400">
                          {Number(service.basePrice).toFixed(2)} PLN
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-400">
                    2. Data i wolne okienka (czas trwania: {totalMinutes} min)
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-white"
                  />
                </div>

                {totalMinutes === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-800 p-3 text-xs text-slate-500">
                    Zaznacz przynajmniej jedną usługę powyżej, aby wyliczyć dostępne godziny.
                  </p>
                ) : slots.length === 0 ? (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">
                    Brak wolnych terminów u tego mechanika w wybranym dniu.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((slot) => (
                      <button
                        type="button"
                        key={slot.start}
                        onClick={() => setSelectedSlot(slot.start)}
                        className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                          selectedSlot === slot.start
                            ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                            : 'border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        {formatTime(slot.start)} – {formatTime(slot.end)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-400">
                  3. Części z magazynu (opcjonalnie)
                </label>
                <div className="space-y-2">
                  {parts.map((part) => {
                    const qty = selectedParts[part.id] || 0;
                    return (
                      <div
                        key={part.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2"
                      >
                        <div>
                          <div className="text-sm text-white">{part.name}</div>
                          <div className="text-xs text-slate-400">
                            {Number(part.unitPrice).toFixed(2)} PLN • Na stanie:{' '}
                            <span className={part.stockQuantity > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {part.stockQuantity} szt.
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={qty === 0}
                            onClick={() => updatePartQty(part.id, qty - 1)}
                            className="h-7 w-7 rounded bg-slate-700 text-sm font-bold disabled:opacity-40"
                          >
                            -
                          </button>
                          <span className="w-5 text-center text-sm">{qty}</span>
                          <button
                            type="button"
                            disabled={qty >= part.stockQuantity}
                            onClick={() => updatePartQty(part.id, qty + 1)}
                            className="h-7 w-7 rounded bg-slate-700 text-sm font-bold disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Uwagi do zlecenia</label>
                <input
                  type="text"
                  placeholder="np. Sprawdzenie haka przerzutki, woskowanie łańcucha..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                <div>
                  <div className="text-xs text-slate-400">Szacowany koszt całkowity</div>
                  <div className="text-xl font-bold text-white">
                    {(servicesCost + partsCost).toFixed(2)} PLN
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !selectedSlot}
                  className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? 'Zapisywanie...' : 'Zarezerwuj termin'}
                </button>
              </div>
            </form>
          </section>

          {/* PRAWA KOLUMNA: KSIĄŻKA SERWISOWA + MAGAZYN */}
          <div className="space-y-8 lg:col-span-6">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">Cyfrowa książka serwisowa</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchFrame}
                    onChange={(e) => setSearchFrame(e.target.value)}
                    placeholder="Numer ramy..."
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => fetchHistory(searchFrame)}
                    className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
                  >
                    Szukaj
                  </button>
                </div>
              </div>

              {!bikeHistory ? (
                <p className="text-sm text-slate-400">Nie znaleziono roweru o podanym numerze ramy.</p>
              ) : (
                <div>
                  <div className="mb-4 rounded-lg border border-slate-800 bg-slate-800/40 p-3 text-xs">
                    <div className="font-semibold text-white">
                      {bikeHistory.brand} {bikeHistory.model} ({bikeHistory.year ?? 'brak rocznika'})
                    </div>
                    <div className="text-slate-400">
                      Nr ramy: <span className="font-mono text-slate-200">{bikeHistory.frameNumber}</span> •
                      Właściciel: {bikeHistory.owner.fullName}
                    </div>
                  </div>

                  {bikeHistory.orders.length === 0 ? (
                    <p className="text-xs text-slate-500">Brak wpisów serwisowych dla tego roweru.</p>
                  ) : (
                    <div className="space-y-3">
                      {bikeHistory.orders.map((order) => {
                        const isFinal = order.status === 'COMPLETED' || order.status === 'CANCELLED';
                        return (
                          <div
                            key={order.id}
                            className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="font-medium text-slate-300">
                                {order.scheduledStart.slice(0, 10)} • {formatTime(order.scheduledStart)}–
                                {formatTime(order.scheduledEnd)}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                  STATUS_STYLES[order.status]
                                }`}
                              >
                                {order.status}
                              </span>
                            </div>

                            <ul className="mb-2 space-y-1 text-slate-300">
                              {order.services.map((s) => (
                                <li key={s.id}>• {s.serviceType.name}</li>
                              ))}
                              {order.parts.map((p) => (
                                <li key={p.id} className="text-emerald-300">
                                  + Część: {p.part.name} (x{p.quantity})
                                </li>
                              ))}
                            </ul>

                            {order.mechanicNotes && (
                              <p className="mb-2 italic text-slate-400">„{order.mechanicNotes}”</p>
                            )}

                            <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                              <span className="font-semibold text-white">
                                Razem: {Number(order.totalPrice).toFixed(2)} PLN
                              </span>

                              {!isFinal && (
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(order.id, 'IN_PROGRESS')}
                                    className="rounded bg-purple-500/20 px-2 py-1 text-[11px] font-medium text-purple-300 hover:bg-purple-500/30"
                                  >
                                    W trakcie
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(order.id, 'COMPLETED')}
                                    className="rounded bg-emerald-500/20 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/30"
                                  >
                                    Zakończ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(order.id, 'CANCELLED')}
                                    className="rounded bg-rose-500/20 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/30"
                                  >
                                    Anuluj
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* PODGLĄD MAGAZYNU */}
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Stan magazynu części na żywo
              </h2>
              <div className="divide-y divide-slate-800 text-xs">
                {parts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <span className="font-mono text-slate-400">[{p.sku}]</span>{' '}
                      <span className="font-medium text-white">{p.name}</span>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 font-semibold ${
                        p.stockQuantity > 2
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {p.stockQuantity} szt.
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;