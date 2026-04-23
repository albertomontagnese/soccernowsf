import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Directory() {
  const [players, setPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

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

  const cleanHandle = (h) => (h || '').replace('@', '').trim();

  const venmoPayLink = (handle) => {
    const clean = cleanHandle(handle);
    if (!clean) return null;
    return `https://venmo.com/${clean}?txn=pay&note=soccerThu&amount=7.00`;
  };

  const venmoProfileLink = (handle) => {
    const clean = cleanHandle(handle);
    if (!clean) return null;
    return `https://venmo.com/${clean}`;
  };

  const startEdit = (playerName, currentHandle) => {
    setEditingPlayer(playerName);
    setEditValue(cleanHandle(currentHandle));
  };

  const cancelEdit = () => {
    setEditingPlayer(null);
    setEditValue('');
  };

  const saveHandle = async (playerName) => {
    setSaving(true);
    try {
      const response = await fetch('/api/playerConfig', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, venmoHandle: editValue }),
      });

      if (response.ok) {
        setPlayers(prev =>
          prev.map(p =>
            p.name === playerName ? { ...p, venmoHandle: cleanHandle(editValue) } : p
          )
        );
        setEditingPlayer(null);
        setEditValue('');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditKeyDown = (e, playerName) => {
    if (e.key === 'Enter') saveHandle(playerName);
    if (e.key === 'Escape') cancelEdit();
  };

  const HandleCell = ({ player }) => {
    const isEditing = editingPlayer === player.name;
    const handle = cleanHandle(player.venmoHandle);

    if (isEditing) {
      return (
        <span className="flex items-center gap-2">
          <span className="text-zinc-500">@</span>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleEditKeyDown(e, player.name)}
            autoFocus
            placeholder="username"
            className="bg-slate-800 border border-emerald-500 rounded px-2 py-1 text-white text-sm w-32 focus:outline-none"
          />
          <button
            onClick={() => saveHandle(player.name)}
            disabled={saving}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded transition disabled:opacity-50"
          >
            {saving ? '...' : 'Save'}
          </button>
          <button
            onClick={cancelEdit}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            Cancel
          </button>
        </span>
      );
    }

    if (handle) {
      return (
        <span className="flex items-center gap-2">
          <a
            href={venmoProfileLink(handle)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            @{handle}
          </a>
          <button
            onClick={() => startEdit(player.name, handle)}
            className="text-zinc-600 hover:text-zinc-400 text-xs transition"
            title="Edit handle"
          >
            ✏️
          </button>
        </span>
      );
    }

    return (
      <button
        onClick={() => startEdit(player.name, '')}
        className="text-amber-400/80 hover:text-amber-300 text-sm border border-amber-500/30 rounded px-2 py-0.5 hover:bg-amber-500/10 transition"
      >
        + Add Venmo
      </button>
    );
  };

  const PayButton = ({ player }) => {
    const link = venmoPayLink(player.venmoHandle);
    if (!link) return <span className="text-zinc-700 text-sm">—</span>;
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg transition font-medium"
      >
        💸 Pay $7
      </a>
    );
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

        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <Link href="/" className="text-emerald-400 text-sm hover:underline mb-2 inline-block">
                ← Back to home
              </Link>
              <h1 className="text-3xl font-bold">Player Directory</h1>
              <p className="text-zinc-400 text-sm mt-1">
                {filtered.length} player{filtered.length !== 1 ? 's' : ''}
                {' · '}
                <span className="text-amber-400/70">
                  {players.filter(p => !cleanHandle(p.venmoHandle)).length} missing Venmo
                </span>
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
                    className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-lg">{player.name}</div>
                      <PayButton player={player} />
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Venmo Name</span>
                        <span>{player.venmoFullName || <span className="text-zinc-600">—</span>}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Venmo Handle</span>
                        <HandleCell player={player} />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">WhatsApp</span>
                        <span>{player.whatsAppName || <span className="text-zinc-600">—</span>}</span>
                      </div>
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
                      <th className="pb-3 pr-4">WhatsApp</th>
                      <th className="pb-3 text-center">Pay</th>
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
                          <HandleCell player={player} />
                        </td>
                        <td className="py-3 pr-4 text-zinc-300">
                          {player.whatsAppName || <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="py-3 text-center">
                          <PayButton player={player} />
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
