import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Directory() {
  const [players, setPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await fetch('/api/playerConfig');
      const data = await response.json();
      setPlayers(data.players || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = players
    .filter(p => {
      const term = searchTerm.toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(term) ||
        (p.venmoFullName || '').toLowerCase().includes(term) ||
        (p.venmoHandle || '').toLowerCase().includes(term) ||
        (p.whatsAppName || '').toLowerCase().includes(term)
      );
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const venmoPayLink = (handle) => {
    if (!handle) return null;
    const clean = handle.replace('@', '');
    return `https://venmo.com/${clean}`;
  };

  return (
    <>
      <Head>
        <title>Player Directory - Soccer Now SF</title>
        <meta name="description" content="Player directory with Venmo and WhatsApp info" />
      </Head>

      <div className="min-h-screen text-white bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-slate-950 to-slate-950" />
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <Link href="/" className="text-emerald-400 text-sm hover:underline mb-2 inline-block">
                ← Back to home
              </Link>
              <h1 className="text-3xl font-bold">Player Directory</h1>
              <p className="text-zinc-400 text-sm mt-1">
                {filtered.length} player{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search by name, Venmo, or WhatsApp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/70 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-zinc-500">Loading players...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">No players found</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {filtered.map((player) => (
                  <div
                    key={player.name}
                    className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-2"
                  >
                    <div className="font-bold text-lg">{player.name}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-zinc-500">Venmo Name</span>
                      <span>{player.venmoFullName || <span className="text-zinc-600">—</span>}</span>
                      <span className="text-zinc-500">Venmo Handle</span>
                      <span>
                        {player.venmoHandle ? (
                          <a
                            href={venmoPayLink(player.venmoHandle)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline"
                          >
                            @{player.venmoHandle.replace('@', '')}
                          </a>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </span>
                      <span className="text-zinc-500">WhatsApp</span>
                      <span>{player.whatsAppName || <span className="text-zinc-600">—</span>}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-sm text-zinc-400">
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4">Venmo Name</th>
                      <th className="pb-3 pr-4">Venmo Handle</th>
                      <th className="pb-3">WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((player) => (
                      <tr
                        key={player.name}
                        className="border-b border-slate-800/50 hover:bg-slate-900/50 transition"
                      >
                        <td className="py-3 pr-4 font-medium">{player.name}</td>
                        <td className="py-3 pr-4 text-zinc-300">
                          {player.venmoFullName || <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="py-3 pr-4">
                          {player.venmoHandle ? (
                            <a
                              href={venmoPayLink(player.venmoHandle)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:underline"
                            >
                              @{player.venmoHandle.replace('@', '')}
                            </a>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="py-3 text-zinc-300">
                          {player.whatsAppName || <span className="text-zinc-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
