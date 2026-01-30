import React, { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { noCacheHeaders } from "../helpers/misc";
import { trackEvent } from "./_app";

// Test games to mark in the UI (excluded from overall ratings)
const TEST_GAME_IDS = ['2026-01-22'];

// Game configuration
const GAME_CONFIG = {
  day: "Thursday",
  location: "Garfield Square",
  time: "6:45 PM",
  format: "8v8",
  fee: 7,
  venmoLink: "https://venmo.com/albertom1?txn=pay&note=soccerThu&amount=7.00",
  zellePhone: "+1 (312) 662-2579",
};

// Get upcoming Thursday date (or today if Thursday)
function getUpcomingThursday() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 4 = Thursday
  let daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  
  // If today is Thursday, show today's date
  if (daysUntilThursday === 0) {
    daysUntilThursday = 0;
  }
  
  const thursday = new Date(today);
  thursday.setDate(today.getDate() + daysUntilThursday);
  
  return thursday.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

// Get current Thursday's date ID
function getCurrentThursdayId() {
  const now = new Date();
  const day = now.getDay();
  const diff = day <= 4 ? 4 - day : 4 - day + 7;
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + diff);
  return thursday.toISOString().split('T')[0];
}

// Check if current game is still in progress (before 8pm Pacific Thursday)
function isGameInProgress() {
  const now = new Date();
  
  // Use Intl to get current time in Pacific timezone (handles DST automatically)
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  
  const day = pacificTime.getDay();
  const hour = pacificTime.getHours();
  
  // Thursday (4) and before 8pm Pacific
  if (day === 4 && hour < 20) return true;
  // Or any day before Thursday (Sun=0 counts as before next Thu)
  if (day >= 0 && day < 4) return true;
  return false;
}

// Odds Display Component - Enhanced Vegas Style
function OddsDisplay({ whiteOdds, darkOdds, whiteRating, darkRating }) {
  const favorite = whiteOdds > darkOdds ? 'white' : whiteOdds < darkOdds ? 'dark' : null;
  
  return (
    <div className="bg-slate-900/70 rounded-2xl p-5 border border-emerald-900/30 backdrop-blur shadow-[0_8px_32px_rgba(16,185,129,0.1)]">
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-2xl">🎰</span>
        <h4 className="text-lg font-bold text-emerald-300">Vegas Says...</h4>
      </div>
      
      <div className="flex items-center justify-center gap-6 mb-4">
        {/* White Team */}
        <div className={`flex-1 text-center p-4 rounded-xl transition ${favorite === 'white' ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-800/50'}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-4 h-4 rounded-full bg-white border-2 border-zinc-300 shadow-sm"></div>
            <span className="text-white font-bold">White</span>
            {favorite === 'white' && <span className="text-xs text-emerald-400">★ FAV</span>}
          </div>
          <div className={`text-4xl font-black ${favorite === 'white' ? 'text-emerald-400' : 'text-white'}`}>
            {whiteOdds}%
          </div>
          {whiteRating && (
            <div className="text-xs text-zinc-500 mt-1">Rating: {whiteRating}</div>
          )}
        </div>
        
        <div className="flex flex-col items-center">
          <span className="text-zinc-600 font-black text-xl">VS</span>
        </div>
        
        {/* Dark Team */}
        <div className={`flex-1 text-center p-4 rounded-xl transition ${favorite === 'dark' ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-800/50'}`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-600 shadow-sm"></div>
            <span className="text-white font-bold">Dark</span>
            {favorite === 'dark' && <span className="text-xs text-emerald-400">★ FAV</span>}
          </div>
          <div className={`text-4xl font-black ${favorite === 'dark' ? 'text-emerald-400' : 'text-white'}`}>
            {darkOdds}%
          </div>
          {darkRating && (
            <div className="text-xs text-zinc-500 mt-1">Rating: {darkRating}</div>
          )}
        </div>
      </div>
      
      {/* Enhanced Odds Bar */}
      <div className="relative">
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
          <div 
            className="bg-gradient-to-r from-zinc-200 to-white h-full transition-all duration-500" 
            style={{ width: `${whiteOdds}%` }} 
          />
          <div 
            className="bg-gradient-to-r from-zinc-700 to-zinc-900 h-full transition-all duration-500" 
            style={{ width: `${darkOdds}%` }} 
          />
        </div>
        {/* Center marker */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-emerald-400/50"></div>
      </div>
      
      {/* Matchup insight */}
      {favorite && Math.abs(whiteOdds - darkOdds) >= 5 && (
        <p className="text-center text-xs text-zinc-500 mt-3">
          {favorite === 'white' ? '⬜ White' : '⬛ Dark'} favored by {Math.abs(whiteOdds - darkOdds).toFixed(1)} points
        </p>
      )}
      {!favorite && (
        <p className="text-center text-xs text-emerald-400/70 mt-3">
          ⚖️ Even matchup — This one&apos;s a coin flip!
        </p>
      )}
    </div>
  );
}

// Player Rating Component - Shows average + allows editing
function PlayerRating({ player, myRating, avgRating, totalVotes, onRate, darkBg }) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(myRating || '');
  
  const handleSubmit = () => {
    const rating = parseFloat(inputValue);
    if (rating >= 1 && rating <= 10) {
      onRate(player.name, player.team, rating);
      setIsEditing(false);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue(myRating || '');
    }
  };
  
  // Edit mode
  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="1"
          max="10"
          step="0.5"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-16 px-2 py-1 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="1-10"
          style={{ color: '#111827', backgroundColor: '#ffffff', borderColor: '#9ca3af' }}
        />
        <button
          onClick={handleSubmit}
          className="text-sm font-bold px-2 py-1 rounded hover:opacity-90"
          style={{ backgroundColor: '#10b981', color: '#ffffff' }}
        >
          ✓
        </button>
        <button
          onClick={() => { setIsEditing(false); setInputValue(myRating || ''); }}
          className="text-sm px-2 py-1 rounded hover:opacity-90"
          style={{ backgroundColor: '#6b7280', color: '#ffffff' }}
        >
          ✕
        </button>
      </div>
    );
  }
  
  // Read-only display
  return (
    <div className="flex items-center gap-2">
      {/* Average rating display */}
      {totalVotes > 0 ? (
        <div className="flex items-center gap-1">
          <span className={`text-sm font-bold ${darkBg ? 'text-emerald-400' : 'text-gray-900'}`}>
            {avgRating.toFixed(1)}
          </span>
          <span className={`text-xs font-medium ${darkBg ? 'text-zinc-400' : 'text-gray-700'}`}>
            ({totalVotes})
          </span>
        </div>
      ) : (
        <span className={`text-xs font-medium ${darkBg ? 'text-zinc-500' : 'text-gray-500'}`}>
          —
        </span>
      )}
      
      {/* Rate CTA button */}
      <button
        onClick={() => { setIsEditing(true); setInputValue(myRating || ''); }}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-md hover:opacity-90 active:opacity-100"
        style={{ 
          backgroundColor: '#10b981', 
          color: '#ffffff', 
          border: '1px solid #059669' 
        }}
        title={myRating ? `Your rating: ${myRating}` : 'Rate this player'}
      >
        {myRating ? `✏️ ${myRating}` : '📊 Rate'}
      </button>
    </div>
  );
}

// Game Card Component (for history)
function GameCard({ game, isExpanded, onToggle }) {
  const [ratings, setRatings] = useState([]);
  const [myRatings, setMyRatings] = useState({});
  const [gameLeaderboard, setGameLeaderboard] = useState({ bestPlayers: [], worstPlayers: [] });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState({ name: '', content: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedName, setSavedName] = useState('');
  const [finalScore, setFinalScore] = useState(game.finalScore || { white: null, dark: null });
  const [isEditingScore, setIsEditingScore] = useState(false);
  const [scoreInput, setScoreInput] = useState({ white: '', dark: '' });

  const isCurrent = game.isCurrent === true;
  const isTestGame = TEST_GAME_IDS.includes(game.id) || TEST_GAME_IDS.includes(game.gameDate);
  const gameInProgress = isCurrent && isGameInProgress();
  const canRate = !gameInProgress; // Can only rate after game is over (8pm Thursday)

  // Load saved commenter name from localStorage
  useEffect(() => {
    const name = localStorage.getItem('soccer_commenter_name') || '';
    setSavedName(name);
    setNewComment(prev => ({ ...prev, name }));
  }, []);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T19:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const fetchRatings = useCallback(async () => {
    try {
      const res = await fetch(`/api/votes?gameId=${game.id}`);
      const data = await res.json();
      setRatings(data.ratings || []);
      setMyRatings(data.myRatings || {});
    } catch (error) {
      console.error('Error fetching ratings:', error);
    }
  }, [game.id]);

  const fetchGameLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/votes?action=leaderboard&gameId=${game.id}`);
      const data = await res.json();
      setGameLeaderboard({
        bestPlayers: data.bestPlayers || [],
        worstPlayers: data.worstPlayers || []
      });
    } catch (error) {
      console.error('Error fetching game leaderboard:', error);
    }
  }, [game.id]);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?gameId=${game.id}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  }, [game.id]);

  useEffect(() => {
    if (isExpanded) {
      fetchRatings();
      fetchGameLeaderboard();
      fetchComments();
    }
  }, [isExpanded, fetchRatings, fetchGameLeaderboard, fetchComments]);

  const handleRate = async (playerName, team, rating) => {
    if (!canRate) return; // Don't allow rating during live game
    try {
      await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, playerName, team, rating })
      });
      // Update local state immediately
      setMyRatings(prev => ({ ...prev, [playerName]: rating }));
      fetchRatings();
      fetchGameLeaderboard();
    } catch (error) {
      console.error('Error rating:', error);
    }
  };

  const handleSaveScore = async () => {
    try {
      await fetch('/api/games', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          whiteScore: scoreInput.white,
          darkScore: scoreInput.dark
        })
      });
      setFinalScore({ white: parseInt(scoreInput.white) || 0, dark: parseInt(scoreInput.dark) || 0 });
      setIsEditingScore(false);
    } catch (error) {
      console.error('Error saving score:', error);
    }
  };

  // Determine if result was an upset
  const getUpsetInfo = () => {
    if (finalScore.white === null || finalScore.dark === null) return null;
    const whiteWon = finalScore.white > finalScore.dark;
    const darkWon = finalScore.dark > finalScore.white;
    const tie = finalScore.white === finalScore.dark;
    
    if (tie) return null;
    
    const whiteOdds = game.whiteTeam?.winProbability || 50;
    const darkOdds = game.darkTeam?.winProbability || 50;
    
    // Upset if underdog won (team with <50% odds won)
    if (whiteWon && whiteOdds < 50) return { team: 'white', odds: whiteOdds };
    if (darkWon && darkOdds < 50) return { team: 'dark', odds: darkOdds };
    return null;
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.name.trim() || !newComment.content.trim()) return;
    
    setIsSubmitting(true);
    try {
      // Save name to localStorage
      localStorage.setItem('soccer_commenter_name', newComment.name.trim());
      
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          authorName: newComment.name,
          content: newComment.content
        })
      });
      const data = await res.json();
      
      if (!res.ok) {
        console.error('Comment API error:', data);
        alert('Failed to post comment: ' + (data.error || data.message));
        return;
      }
      
      // Add the new comment to local state immediately
      if (data.comment) {
        setComments(prev => [data.comment, ...prev]);
      }
      setNewComment({ name: newComment.name, content: '' });
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      const res = await fetch('/api/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId })
      });
      if (res.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const getPlayerRatingData = (player) => {
    const ratingData = ratings.find(r => r.name === player.name) || { avgRating: 0, totalVotes: 0 };
    return {
      avgRating: ratingData.avgRating || 0,
      totalVotes: ratingData.totalVotes || 0,
      myRating: myRatings[player.name] || 0
    };
  };

  return (
    <div className={`bg-slate-900/70 rounded-2xl border overflow-hidden mb-4 backdrop-blur ${
      isCurrent ? 'border-emerald-400/40 shadow-[0_10px_30px_rgba(16,185,129,0.15)]' : 'border-slate-800/80'
    }`}>
      {/* Header */}
      <button 
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-900/80 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{isCurrent ? '🔴' : isTestGame ? '🧪' : '📅'}</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{formatDate(game.gameDate)}</span>
              {isCurrent && (
                <span className="text-xs bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full">LIVE</span>
              )}
              {isTestGame && (
                <span className="text-xs bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">TEST</span>
              )}
            </div>
            <span className="text-zinc-400 text-sm">{game.totalPlayers} players{isTestGame && ' • Not counted in overall ratings'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="text-zinc-300">⬜ {game.whiteTeam?.winProbability || 50}%</span>
            <span className="text-zinc-500">vs</span>
            <span className="text-zinc-300">⬛ {game.darkTeam?.winProbability || 50}%</span>
          </div>
          <span className="text-zinc-500">{isExpanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-800/80">
          {/* Test game notice */}
          {isTestGame && (
            <div className="border-b px-4 py-3 text-center bg-amber-900/20 border-amber-700/40">
              <p className="text-sm text-amber-400">
                🧪 Test game — Ratings from this game are not included in overall player rankings
              </p>
            </div>
          )}
          {/* Current game notice */}
          {isCurrent && !isTestGame && (
            <div className={`border-b px-4 py-3 text-center ${gameInProgress ? 'bg-amber-900/20 border-amber-700/40' : 'bg-emerald-900/20 border-emerald-700/40'}`}>
              <p className={`text-sm ${gameInProgress ? 'text-amber-400' : 'text-emerald-400'}`}>
                {gameInProgress 
                  ? '🔴 Live game in progress — Ratings available after 8pm PST'
                  : '✅ Game over — Rate players now!'}
              </p>
            </div>
          )}

          {/* Vegas Said + Final Score */}
          <div className="p-4 space-y-4">
            {/* Vegas Odds */}
            <div className="bg-slate-900/70 rounded-2xl p-4 border border-emerald-900/30 backdrop-blur">
              <h4 className="text-sm font-medium text-emerald-200/80 mb-3 text-center">🎰 Vegas Said...</h4>
              <div className="flex items-center justify-center gap-4">
                <div className="flex-1 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-white border border-zinc-300"></div>
                    <span className="text-white font-medium text-sm">White</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{game.whiteTeam?.winProbability || 50}%</div>
                </div>
                
                <span className="text-zinc-500 font-bold">VS</span>
                
                <div className="flex-1 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-zinc-700 border border-zinc-500"></div>
                    <span className="text-white font-medium text-sm">Dark</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{game.darkTeam?.winProbability || 50}%</div>
                </div>
              </div>
              
              {/* Odds Bar */}
              <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden flex">
                <div className="bg-white h-full transition-all" style={{ width: `${game.whiteTeam?.winProbability || 50}%` }} />
                <div className="bg-slate-950 h-full transition-all" style={{ width: `${game.darkTeam?.winProbability || 50}%` }} />
              </div>
            </div>

            {/* Final Score - Only for non-live games */}
            {!gameInProgress && (
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-white">📋 Final Score</h4>
                  {!isEditingScore && (
                    <button
                      onClick={() => {
                        setScoreInput({ 
                          white: finalScore.white?.toString() || '', 
                          dark: finalScore.dark?.toString() || '' 
                        });
                        setIsEditingScore(true);
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>
                
                {isEditingScore ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm">⬜</span>
                      <input
                        type="number"
                        min="0"
                        value={scoreInput.white}
                        onChange={(e) => setScoreInput(prev => ({ ...prev, white: e.target.value }))}
                        className="w-16 px-2 py-1 text-center text-lg font-bold rounded"
                        style={{ color: '#111827', backgroundColor: '#ffffff' }}
                      />
                    </div>
                    <span className="text-zinc-400 font-bold">-</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={scoreInput.dark}
                        onChange={(e) => setScoreInput(prev => ({ ...prev, dark: e.target.value }))}
                        className="w-16 px-2 py-1 text-center text-lg font-bold rounded"
                        style={{ color: '#111827', backgroundColor: '#ffffff' }}
                      />
                      <span className="text-white text-sm">⬛</span>
                    </div>
                    <button
                      onClick={handleSaveScore}
                      className="ml-2 px-3 py-1 rounded text-sm font-medium"
                      style={{ backgroundColor: '#10b981', color: '#ffffff' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingScore(false)}
                      className="px-2 py-1 rounded text-sm"
                      style={{ backgroundColor: '#6b7280', color: '#ffffff' }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-4">
                    {finalScore.white !== null && finalScore.dark !== null ? (
                      <>
                        <div className="text-center">
                          <span className="text-white text-sm">⬜ White</span>
                          <div className={`text-3xl font-bold ${finalScore.white > finalScore.dark ? 'text-emerald-400' : 'text-white'}`}>
                            {finalScore.white}
                          </div>
                        </div>
                        <span className="text-zinc-500 text-2xl font-bold">-</span>
                        <div className="text-center">
                          <span className="text-white text-sm">⬛ Dark</span>
                          <div className={`text-3xl font-bold ${finalScore.dark > finalScore.white ? 'text-emerald-400' : 'text-white'}`}>
                            {finalScore.dark}
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="text-zinc-500">No score recorded yet</span>
                    )}
                  </div>
                )}
                
                {/* Upset indicator */}
                {(() => {
                  const upset = getUpsetInfo();
                  if (upset) {
                    return (
                      <div className="mt-3 text-center">
                        <span className="inline-block bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-bold">
                          🚨 UPSET! {upset.team === 'white' ? 'White' : 'Dark'} won with only {upset.odds}% odds!
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* Per-Game Leaderboard */}
            {(gameLeaderboard.bestPlayers.length > 0 || gameLeaderboard.worstPlayers.length > 0) && (
              <div className="grid md:grid-cols-2 gap-3">
                {/* Best This Game */}
                {gameLeaderboard.bestPlayers.length > 0 && (
                  <div className="bg-emerald-900/20 rounded-xl p-3 border border-emerald-700/30">
                    <h4 className="text-emerald-300 font-bold text-sm mb-2">⭐ Top This Game</h4>
                    <div className="space-y-1">
                      {gameLeaderboard.bestPlayers.slice(0, 3).map((player, idx) => (
                        <div key={player.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400 font-bold w-4">#{idx + 1}</span>
                            <span className="text-white">{player.name}</span>
                          </div>
                          <span className="text-emerald-300 font-medium">{player.avgRating?.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Worst This Game */}
                {gameLeaderboard.worstPlayers.length > 0 && (
                  <div className="bg-red-900/20 rounded-xl p-3 border border-red-700/30">
                    <h4 className="text-red-300 font-bold text-sm mb-2">📉 Struggled This Game</h4>
                    <div className="space-y-1">
                      {gameLeaderboard.worstPlayers.slice(0, 3).map((player, idx) => (
                        <div key={player.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-red-400 font-bold w-4">#{idx + 1}</span>
                            <span className="text-white">{player.name}</span>
                          </div>
                          <span className="text-red-300 font-medium">{player.avgRating?.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rosters */}
          <div className="p-4 pt-0">
            <div className="grid md:grid-cols-2 gap-4">
              {/* White Team */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-white border border-zinc-300"></div>
                  <span className="text-white font-medium">White Team ({game.whiteTeam?.roster?.length || 0})</span>
                </div>
                <div className="space-y-1">
                  {(game.whiteTeam?.roster || []).map((player, idx) => {
                    const ratingData = getPlayerRatingData(player);
                    return (
                      <div key={idx} className="flex items-center justify-between rounded-lg px-3 py-2 border border-zinc-400" style={{ backgroundColor: '#fafafa' }}>
                        <div className="flex items-center gap-2">
                          <span style={{ color: '#52525b' }} className="text-sm w-5">{idx + 1}.</span>
                          {player.goalkeeper && <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">🧤</span>}
                          <span style={{ color: '#18181b' }} className="font-medium">{player.name}</span>
                        </div>
                        {canRate ? (
                          <PlayerRating 
                            player={{ name: player.name, team: 'white' }}
                            myRating={ratingData.myRating}
                            avgRating={ratingData.avgRating}
                            totalVotes={ratingData.totalVotes}
                            onRate={handleRate}
                            darkBg={false}
                          />
                        ) : (
                          <span className="text-xs text-gray-500">Rating after game</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dark Team */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-zinc-700 border border-zinc-500"></div>
                  <span className="text-white font-medium">Dark Team ({game.darkTeam?.roster?.length || 0})</span>
                </div>
                <div className="space-y-1">
                  {(game.darkTeam?.roster || []).map((player, idx) => {
                    const ratingData = getPlayerRatingData(player);
                    return (
                      <div key={idx} className="flex items-center justify-between bg-slate-900/80 rounded-lg px-3 py-2 border border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 text-sm w-5">{idx + 1}.</span>
                          {player.goalkeeper && <span>🧤</span>}
                          <span className="text-white">{player.name}</span>
                        </div>
                        {canRate ? (
                          <PlayerRating 
                            player={{ name: player.name, team: 'dark' }}
                            myRating={ratingData.myRating}
                            avgRating={ratingData.avgRating}
                            totalVotes={ratingData.totalVotes}
                            onRate={handleRate}
                            darkBg={true}
                          />
                        ) : (
                          <span className="text-xs text-zinc-500">Rating after game</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Comments Section - Always at bottom */}
          <div className="border-t border-slate-800/80 p-4">
            <h4 className="text-white font-medium mb-3 flex items-center gap-2">
              💬 {isCurrent ? 'Live Chat' : 'Comments'} ({comments.length})
            </h4>
              
              {/* Comment Form */}
              <form onSubmit={handleSubmitComment} className="mb-4">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={newComment.name}
                    onChange={(e) => setNewComment({ ...newComment, name: e.target.value })}
                    maxLength={50}
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    style={{ backgroundColor: '#27272a', color: '#f4f4f5', border: '1px solid #3f3f46' }}
                  />
                </div>
                <div className="flex gap-2">
                  <textarea
                    placeholder="Write a comment..."
                    value={newComment.content}
                    onChange={(e) => setNewComment({ ...newComment, content: e.target.value })}
                    maxLength={500}
                    rows={2}
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                    style={{ backgroundColor: '#27272a', color: '#f4f4f5', border: '1px solid #3f3f46' }}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !newComment.name.trim() || !newComment.content.trim()}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-slate-950 px-4 py-2 rounded-lg font-medium text-sm transition"
                  >
                    {isSubmitting ? '...' : 'Post'}
                  </button>
                </div>
              </form>

              {/* Comments List */}
              <div className="space-y-2">
                {comments.length === 0 ? (
                  <p className="text-zinc-400 text-center py-4">No comments yet. Be the first!</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-slate-900/70 rounded-lg p-3 border border-slate-800/70">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">{comment.authorName}</span>
                          <span className="text-zinc-500 text-xs">
                            {new Date(comment.createdAt).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-zinc-600 hover:text-red-400 text-xs transition"
                          title="Delete comment"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-zinc-300 text-sm">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
        </div>
      )}
    </div>
  );
}

// Overall Player Leaderboard Component (across all games)
function Leaderboard({ bestPlayers, worstPlayers }) {
  if (bestPlayers.length === 0 && worstPlayers.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-white mb-3">📊 Overall Player Ratings</h3>
      <div className="grid md:grid-cols-2 gap-4">
        {/* Best Players */}
        <div className="bg-emerald-900/20 rounded-2xl p-4 border border-emerald-700/30 backdrop-blur">
          <h4 className="text-emerald-300 font-bold mb-3 flex items-center gap-2">
            🏆 Top Rated
          </h4>
          {bestPlayers.length === 0 ? (
            <p className="text-zinc-500 text-sm">No ratings yet</p>
          ) : (
            <div className="space-y-2">
              {bestPlayers.slice(0, 5).map((player, idx) => (
                <div key={player.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-300 font-bold w-5">#{idx + 1}</span>
                    <span className="text-white">{player.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-300 font-medium">{player.avgRating?.toFixed(1) || '0.0'}</span>
                    <span className="text-zinc-500 text-xs">({player.totalVotes})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs Improvement */}
        <div className="bg-red-900/20 rounded-2xl p-4 border border-red-700/30 backdrop-blur">
          <h4 className="text-red-300 font-bold mb-3 flex items-center gap-2">
            📉 Lowest Rated
          </h4>
          {worstPlayers.length === 0 ? (
            <p className="text-zinc-500 text-sm">No ratings yet</p>
          ) : (
            <div className="space-y-2">
              {worstPlayers.slice(0, 5).map((player, idx) => (
                <div key={player.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-red-300 font-bold w-5">#{idx + 1}</span>
                    <span className="text-white">{player.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-300 font-medium">{player.avgRating?.toFixed(1) || '0.0'}</span>
                    <span className="text-zinc-500 text-xs">({player.totalVotes})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SoccerLanding() {
  const router = useRouter();
  const [payments, setPayments] = useState([]);
  const [whiteTeam, setWhiteTeam] = useState([]);
  const [darkTeam, setDarkTeam] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // History state
  const [gameHistory, setGameHistory] = useState([]);
  const [currentGameData, setCurrentGameData] = useState(null);
  const [expandedGameId, setExpandedGameId] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ bestPlayers: [], worstPlayers: [] });
  const [currentOdds, setCurrentOdds] = useState(null);
  
  // Live chat state for current game
  const [liveComments, setLiveComments] = useState([]);
  const [newComment, setNewComment] = useState({ name: '', content: '' });
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [savedCommenterName, setSavedCommenterName] = useState('');

  // Get active section from URL query param
  const activeSection = router.query.tab === 'history' ? 'history' : 'current';

  const setActiveSection = (section) => {
    trackEvent('click', 'navigation', `tab_${section}`);
    router.push({
      pathname: '/',
      query: section === 'history' ? { tab: 'history' } : {}
    }, undefined, { shallow: true });
  };

  useEffect(() => {
    fetchPaymentsData();
    fetchCurrentOdds();
    fetchGameHistory();
    fetchLeaderboard();
    
    // Load saved commenter name
    const name = localStorage.getItem('soccer_commenter_name') || '';
    setSavedCommenterName(name);
    setNewComment(prev => ({ ...prev, name }));
  }, []);
  
  // Fetch live comments for current game
  useEffect(() => {
    const gameId = getCurrentThursdayId();
    fetchLiveComments(gameId);
    
    // Poll for new comments every 30 seconds
    const interval = setInterval(() => fetchLiveComments(gameId), 30000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchLiveComments = async (gameId) => {
    try {
      const res = await fetch(`/api/comments?gameId=${gameId}`);
      const data = await res.json();
      setLiveComments(data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };
  
  const handleSubmitLiveComment = async (e) => {
    e.preventDefault();
    if (!newComment.name.trim() || !newComment.content.trim()) return;
    
    setIsSubmittingComment(true);
    try {
      localStorage.setItem('soccer_commenter_name', newComment.name.trim());
      
      const gameId = getCurrentThursdayId();
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          authorName: newComment.name,
          content: newComment.content
        })
      });
      const data = await res.json();
      
      if (res.ok && data.comment) {
        setLiveComments(prev => [data.comment, ...prev]);
        trackEvent('submit', 'engagement', 'live_chat_message');
      }
      setNewComment({ name: newComment.name, content: '' });
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };
  
  const handleDeleteLiveComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      const res = await fetch('/api/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId })
      });
      if (res.ok) {
        setLiveComments(prev => prev.filter(c => c.id !== commentId));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const fetchPaymentsData = async () => {
    try {
      const response = await fetch(
        "/api/soccernowAllPayments?_=" + new Date().getTime(),
        { method: "GET", headers: noCacheHeaders, cache: "no-cache" }
      );
      const data = await response.json();
      setPayments(data.data || []);
      setWhiteTeam(data.whiteTeam || []);
      setDarkTeam(data.darkTeam || []);
      setWaitlist(data.waitlist || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentOdds = async () => {
    try {
      const response = await fetch('/api/games?action=current-odds');
      const data = await response.json();
      setCurrentOdds(data);
      
      // Build current game data for history display
      if (data.whiteTeam.players.length > 0 || data.darkTeam.players.length > 0) {
        const gameId = getCurrentThursdayId();
        setCurrentGameData({
          id: gameId,
          gameDate: gameId,
          isCurrent: true,
          whiteTeam: {
            roster: data.whiteTeam.players.map(p => ({
              name: p.name,
              rating: p.rating || 7.0,
              goalkeeper: p.goalkeeper || false
            })),
            totalRating: data.whiteTeam.totalRating,
            avgRating: data.whiteTeam.avgRating,
            winProbability: data.whiteTeam.winProbability
          },
          darkTeam: {
            roster: data.darkTeam.players.map(p => ({
              name: p.name,
              rating: p.rating || 7.0,
              goalkeeper: p.goalkeeper || false
            })),
            totalRating: data.darkTeam.totalRating,
            avgRating: data.darkTeam.avgRating,
            winProbability: data.darkTeam.winProbability
          },
          totalPlayers: data.whiteTeam.players.length + data.darkTeam.players.length
        });
      }
    } catch (error) {
      console.error("Error fetching odds:", error);
    }
  };

  const fetchGameHistory = async () => {
    try {
      const response = await fetch('/api/games');
      const data = await response.json();
      setGameHistory(data.games || []);
    } catch (error) {
      console.error("Error fetching game history:", error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/votes?action=leaderboard');
      const data = await response.json();
      setLeaderboard({
        bestPlayers: data.bestPlayers || [],
        worstPlayers: data.worstPlayers || []
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    }
  };

  const whiteComplete = whiteTeam.length >= 8;
  const darkComplete = darkTeam.length >= 8;
  const goalkeepers = [...whiteTeam, ...darkTeam].filter(p => p.goalkeeper).length;
  const allPaid = payments.length > 0 && payments.every(p => p.paid);

  // Combine current game with history for display
  const allGames = currentGameData 
    ? [currentGameData, ...gameHistory.filter(g => g.id !== currentGameData.id)]
    : gameHistory;

  return (
    <>
      <Head>
        <title>Soccer Now SF - {activeSection === 'history' ? 'Game History' : 'Thursday Pickup Games'}</title>
        <meta name="description" content="Weekly pickup soccer in San Francisco" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen text-white bg-slate-950 relative overflow-hidden">
        {/* Pitch background */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div
            className="absolute inset-0 bg-fixed"
            style={{
              backgroundImage: [
                "radial-gradient(circle at 20% 10%, rgba(16,185,129,0.18), transparent 45%)",
                "radial-gradient(circle at 80% 80%, rgba(34,197,94,0.2), transparent 40%)",
                "linear-gradient(180deg, rgba(2,6,23,0.96), rgba(2,6,23,0.98))"
              ].join(", ")
            }}
          />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: [
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 130px)",
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 90px)"
              ].join(", ")
            }}
          />
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage: [
                "radial-gradient(circle at center, rgba(255,255,255,0.08) 0 120px, transparent 121px)",
                "radial-gradient(circle at center, transparent 0 260px, rgba(255,255,255,0.08) 261px, transparent 262px)"
              ].join(", ")
            }}
          />
          
          {/* Floating Soccer Balls - Parallax Effect */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Large ball - slow drift */}
            <div 
              className="absolute animate-float-slow opacity-[0.04]"
              style={{ top: '10%', left: '5%' }}
            >
              <svg width="200" height="200" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="1" className="text-emerald-400"/>
                <path d="M50 2 L50 20 M50 80 L50 98 M2 50 L20 50 M80 50 L98 50" stroke="currentColor" strokeWidth="0.5" className="text-emerald-400"/>
                <polygon points="50,20 35,45 65,45" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-emerald-400"/>
                <polygon points="50,80 35,55 65,55" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-emerald-400"/>
                <polygon points="20,50 45,35 45,65" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-emerald-400"/>
                <polygon points="80,50 55,35 55,65" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-emerald-400"/>
              </svg>
            </div>
            
            {/* Medium ball - medium drift */}
            <div 
              className="absolute animate-float-medium opacity-[0.03]"
              style={{ top: '60%', right: '8%' }}
            >
              <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="1.5" className="text-white"/>
                <path d="M50 2 L50 20 M50 80 L50 98 M2 50 L20 50 M80 50 L98 50" stroke="currentColor" strokeWidth="0.5" className="text-white"/>
                <polygon points="50,20 35,45 65,45" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-white"/>
                <polygon points="50,80 35,55 65,55" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-white"/>
              </svg>
            </div>
            
            {/* Small ball - fast drift */}
            <div 
              className="absolute animate-float-fast opacity-[0.05]"
              style={{ top: '30%', right: '20%' }}
            >
              <svg width="60" height="60" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="2" className="text-emerald-300"/>
              </svg>
            </div>
            
            {/* Golden Gate silhouette hint */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-32 opacity-[0.03]"
              style={{
                background: 'linear-gradient(to top, rgba(16,185,129,0.1), transparent)',
              }}
            />
          </div>
        </div>
        
        {/* Header */}
        <header className="border-b border-emerald-900/40 bg-slate-950/70 backdrop-blur sticky top-0 z-20">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/favicon.png" 
                alt="Soccer Now SF" 
                className="w-10 h-10 rounded-full shadow-lg"
              />
              <div>
                <span className="font-bold text-lg tracking-wide">Soccer Now SF</span>
                <p className="text-xs text-emerald-300/70">Thursday pickup • Garfield Square</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-1 bg-slate-900/70 border border-emerald-900/40 rounded-full p-1">
                <button
                  onClick={() => setActiveSection('current')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    activeSection === 'current' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setActiveSection('history')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    activeSection === 'history' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  History
                </button>
              </div>
              <a href="mailto:alberto.montagnese@gmail.com" className="hidden sm:block text-zinc-500 hover:text-zinc-300 text-xs transition">
                Contact
              </a>
            </div>
          </div>
        </header>

        {activeSection === 'current' ? (
          <main className="max-w-5xl mx-auto px-4 py-10 space-y-10 relative z-10">
            
            {/* Hero */}
            <div className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-slate-900/60 backdrop-blur p-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
              <div className="absolute -right-12 -top-10 h-40 w-40 rounded-full bg-emerald-500/20 blur-2xl"></div>
              <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl"></div>
              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-400/20 px-3 py-1 text-emerald-200 text-xs uppercase tracking-widest mb-4">
                  Matchday
                </div>
                <h1 className="text-5xl font-bold text-emerald-300 mb-2">{GAME_CONFIG.day}</h1>
                <p className="text-2xl text-zinc-200">{GAME_CONFIG.location} • {GAME_CONFIG.time}</p>
                <p className="text-zinc-400 mt-2">{GAME_CONFIG.format} • Turf • Rain or Shine</p>
              </div>
            </div>

            {/* Rules Card */}
            <div className="bg-slate-900/70 rounded-2xl border border-emerald-900/30 backdrop-blur overflow-hidden">
              {/* Header */}
              <div className="bg-emerald-500/10 border-b border-emerald-900/30 px-6 py-4">
                <h2 className="text-lg font-bold text-white flex items-center justify-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-base">📋</span>
                  The 5 Rules
                </h2>
              </div>
              
              {/* Rules Grid */}
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { icon: '💵', title: `Pay $${GAME_CONFIG.fee}`, sub: 'Secures your spot' },
                    { icon: '👕', title: 'Wear team color', sub: 'Check below' },
                    { icon: '🔄', title: 'Both jerseys', sub: 'White & dark' },
                    { icon: '⚽', title: 'Bring a ball', sub: 'Your own' },
                    { icon: '⏰', title: 'Be on time', sub: 'Or bring 🍺' },
                  ].map((rule, idx) => (
                    <div key={idx} className="text-center group py-2">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-800/50 flex items-center justify-center text-2xl group-hover:scale-105 group-hover:from-emerald-900/30 group-hover:to-slate-800/50 transition-all duration-200">
                        {rule.icon}
                      </div>
                      <p className="text-zinc-200 font-medium text-sm">{rule.title}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">{rule.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Buttons */}
              <div className="px-5 pb-5">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <p className="text-zinc-400 text-xs text-center mb-3 uppercase tracking-wider">Secure your spot</p>
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={GAME_CONFIG.venmoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackEvent('click', 'payment', 'venmo_main', 7)}
                      className="bg-[#008CFF] hover:bg-[#0070CC] text-white font-semibold py-3.5 px-4 rounded-xl text-center transition shadow-lg flex items-center justify-center gap-2"
                    >
                      <span className="text-lg">💳</span>
                      Venmo
                    </a>
                    <a
                      href={`sms:${GAME_CONFIG.zellePhone}`}
                      onClick={() => trackEvent('click', 'payment', 'zelle_main', 7)}
                      className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold py-3.5 px-4 rounded-xl text-center transition shadow-lg"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg">💸</span>
                        Zelle
                      </div>
                      <div className="text-xs font-normal opacity-80 mt-0.5">{GAME_CONFIG.zellePhone}</div>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* ========== THIS WEEK'S MATCH CONTAINER ========== */}
            <div className="bg-slate-900/80 rounded-3xl border border-emerald-900/40 backdrop-blur overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              
              {/* Match Header */}
              <div className="bg-emerald-500/10 border-b border-emerald-900/30 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <div>
                      <h2 className="text-lg font-bold text-emerald-300">This Week&apos;s Match</h2>
                      <p className="text-zinc-400 text-sm">{getUpcomingThursday()}</p>
                    </div>
                  </div>
                  {/* Compact Stats */}
                  <div className="hidden sm:flex items-center gap-3 text-sm">
                    <span className={`px-2 py-1 rounded ${whiteComplete && darkComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}>
                      {whiteTeam.length + darkTeam.length}/16 players
                    </span>
                    <span className={`px-2 py-1 rounded ${goalkeepers >= 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      🧤 {goalkeepers}/2
                    </span>
                    <span className={`px-2 py-1 rounded ${allPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                      {allPaid ? '✓ All Paid' : `${payments.filter(p => !p.paid).length} unpaid`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vegas Odds - Compact */}
              {currentOdds && (currentOdds.whiteTeam.players.length > 0 || currentOdds.darkTeam.players.length > 0) && (
                <div className="px-4 py-3 border-b border-slate-800/50 bg-slate-900/50">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🎰</span>
                      <span className="text-xs text-zinc-500">Vegas Says</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-white font-bold text-sm">⬜ {currentOdds.whiteTeam.winProbability}%</span>
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden flex">
                        <div className="bg-white h-full" style={{ width: `${currentOdds.whiteTeam.winProbability}%` }} />
                        <div className="bg-zinc-700 h-full" style={{ width: `${currentOdds.darkTeam.winProbability}%` }} />
                      </div>
                      <span className="text-white font-bold text-sm">{currentOdds.darkTeam.winProbability}% ⬛</span>
                    </div>
                    {currentOdds.whiteTeam.winProbability !== currentOdds.darkTeam.winProbability && (
                      <span className="text-xs text-emerald-400">
                        {currentOdds.whiteTeam.winProbability > currentOdds.darkTeam.winProbability ? '⬜ fav' : '⬛ fav'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Teams Grid */}
              <div className="p-4">
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent mx-auto"></div>
                    <p className="text-zinc-500 mt-4">Loading...</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* White Team */}
                    <div className={`rounded-xl overflow-hidden border bg-slate-900 ${whiteTeam.filter(p => p.goalkeeper).length === 0 && whiteTeam.length > 0 ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-slate-700'}`}>
                      <div className={`px-3 py-2 flex items-center justify-between border-b ${whiteTeam.filter(p => p.goalkeeper).length === 0 && whiteTeam.length > 0 ? 'bg-red-900/30 border-red-800/50' : 'bg-slate-800 border-slate-700'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border-2 border-zinc-400 bg-white"></div>
                          <span className="font-bold text-white text-sm">White</span>
                          {whiteTeam.length < darkTeam.length && whiteTeam.length > 0 && (
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">-{darkTeam.length - whiteTeam.length}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {whiteTeam.filter(p => p.goalkeeper).length === 0 && whiteTeam.length > 0 ? (
                            <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold animate-pulse">🧤 NEED GK!</span>
                          ) : (
                            <span className="text-xs text-zinc-500">🧤 {whiteTeam.filter(p => p.goalkeeper).length}</span>
                          )}
                          <span className={`text-sm font-medium ${whiteComplete ? 'text-emerald-400' : 'text-zinc-400'}`}>{whiteTeam.length}/8</span>
                        </div>
                      </div>
                      <div className="bg-gray-100">
                        {whiteTeam.length === 0 ? (
                          <p style={{ color: '#6b7280' }} className="text-center py-4 text-sm">No players yet</p>
                        ) : (
                          whiteTeam.map((player, i) => (
                            <div key={player.id || i} className="flex items-center px-3 py-2 border-b border-gray-200 last:border-0 bg-white">
                              <span className="w-5 text-xs" style={{ color: '#9ca3af' }}>{i + 1}</span>
                              <span className="flex-1 font-medium text-sm" style={{ color: '#111827' }}>
                                {player.goalkeeper && "🧤 "}{player.name}
                              </span>
                              {player.paid ? (
                                <span style={{ color: '#059669' }} className="font-bold text-sm">✓</span>
                              ) : (
                                <a 
                                  href={`${GAME_CONFIG.venmoLink}&note=soccer-${player.name.split(' ')[0]}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => trackEvent('click', 'payment', `venmo_player_${player.name}`, 7)}
                                  className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded hover:bg-red-200 transition"
                                >
                                  Pay $7
                                </a>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Dark Team */}
                    <div className={`rounded-xl overflow-hidden border bg-slate-900 ${darkTeam.filter(p => p.goalkeeper).length === 0 && darkTeam.length > 0 ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-slate-700'}`}>
                      <div className={`px-3 py-2 flex items-center justify-between border-b ${darkTeam.filter(p => p.goalkeeper).length === 0 && darkTeam.length > 0 ? 'bg-red-900/30 border-red-800/50' : 'bg-slate-800 border-slate-700'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border-2 border-zinc-600 bg-zinc-800"></div>
                          <span className="font-bold text-white text-sm">Dark</span>
                          {darkTeam.length < whiteTeam.length && darkTeam.length > 0 && (
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">-{whiteTeam.length - darkTeam.length}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {darkTeam.filter(p => p.goalkeeper).length === 0 && darkTeam.length > 0 ? (
                            <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold animate-pulse">🧤 NEED GK!</span>
                          ) : (
                            <span className="text-xs text-zinc-500">🧤 {darkTeam.filter(p => p.goalkeeper).length}</span>
                          )}
                          <span className={`text-sm font-medium ${darkComplete ? 'text-emerald-400' : 'text-zinc-400'}`}>{darkTeam.length}/8</span>
                        </div>
                      </div>
                      <div className="bg-slate-900">
                        {darkTeam.length === 0 ? (
                          <p className="text-zinc-500 text-center py-4 text-sm">No players yet</p>
                        ) : (
                          darkTeam.map((player, i) => (
                            <div key={player.id || i} className="flex items-center px-3 py-2 border-b border-slate-800 last:border-0">
                              <span className="w-5 text-zinc-600 text-xs">{i + 1}</span>
                              <span className="flex-1 text-white font-medium text-sm">
                                {player.goalkeeper && "🧤 "}{player.name}
                              </span>
                              {player.paid ? (
                                <span className="text-emerald-400 font-bold text-sm">✓</span>
                              ) : (
                                <a 
                                  href={`${GAME_CONFIG.venmoLink}&note=soccer-${player.name.split(' ')[0]}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => trackEvent('click', 'payment', `venmo_player_${player.name}`, 7)}
                                  className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded hover:bg-red-900/70 transition"
                                >
                                  Pay $7
                                </a>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Waitlist */}
                {waitlist.length > 0 && (
                  <div className="mt-4 bg-amber-900/20 border border-amber-700/40 rounded-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-amber-700/40">
                      <span className="font-bold text-amber-400 text-sm">🚧 Waitlist ({waitlist.length})</span>
                    </div>
                    <div>
                      {waitlist.map((player, i) => (
                        <div key={player.id || i} className="flex items-center px-3 py-2 border-b border-amber-700/30 last:border-0 text-sm">
                          <span className="w-5 text-amber-600 text-xs">{i + 1}</span>
                          <span className="flex-1 text-amber-100">{player.name}</span>
                          <span className="text-amber-500 text-xs">{player.team}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unpaid Players Callout */}
                {payments.filter(p => !p.paid).length > 0 && (
                  <div className="mt-4 bg-red-900/20 border border-red-700/40 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">💸</span>
                      <div className="flex-1">
                        <h4 className="text-red-400 font-bold text-sm mb-2">Payment Needed</h4>
                        <p className="text-red-300/80 text-sm mb-3">
                          {payments.filter(p => !p.paid).map(p => p.name).join(', ')} — please pay $7 to confirm your spot!
                        </p>
                        <a
                          href={GAME_CONFIG.venmoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackEvent('click', 'payment', 'venmo_unpaid_callout', 7)}
                          className="inline-flex items-center gap-2 bg-[#008CFF] hover:bg-[#0070CC] text-white font-semibold py-2 px-4 rounded-lg text-sm transition"
                        >
                          💳 Pay via Venmo
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Chat - Inside Match Container */}
              <div className="border-t border-slate-800/80">
                <div className="px-4 py-3 flex items-center justify-between bg-slate-900/50">
                  <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                    <span>💬</span>
                    Match Chat
                    <span className="text-zinc-500 font-normal">({liveComments.length})</span>
                  </h3>
                  <span className="text-xs text-emerald-400 animate-pulse">● Live</span>
                </div>
                
                <div className="px-4 pb-4">
                  {/* Comment Form */}
                  <form onSubmit={handleSubmitLiveComment} className="mb-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Name"
                        value={newComment.name}
                        onChange={(e) => setNewComment({ ...newComment, name: e.target.value })}
                        maxLength={50}
                        className="w-24 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        style={{ backgroundColor: '#27272a', color: '#f4f4f5', border: '1px solid #3f3f46' }}
                      />
                      <input
                        type="text"
                        placeholder="Say something..."
                        value={newComment.content}
                        onChange={(e) => setNewComment({ ...newComment, content: e.target.value })}
                        maxLength={500}
                        className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        style={{ backgroundColor: '#27272a', color: '#f4f4f5', border: '1px solid #3f3f46' }}
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingComment || !newComment.name.trim() || !newComment.content.trim()}
                        className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-slate-950 px-3 py-1.5 rounded-lg font-medium text-sm transition"
                      >
                        {isSubmittingComment ? '...' : 'Send'}
                      </button>
                    </div>
                  </form>

                  {/* Comments List */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {liveComments.length === 0 ? (
                      <p className="text-zinc-500 text-center py-3 text-xs">No messages yet. Start the conversation!</p>
                    ) : (
                      liveComments.map((comment) => (
                        <div key={comment.id} className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium text-sm">{comment.authorName}</span>
                              <span className="text-zinc-500 text-xs">
                                {new Date(comment.createdAt).toLocaleTimeString('en-US', {
                                  hour: 'numeric', minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <button
                              onClick={() => handleDeleteLiveComment(comment.id)}
                              className="text-zinc-600 hover:text-red-400 text-xs transition"
                            >
                              ✕
                            </button>
                          </div>
                          <p className="text-zinc-300 text-sm mt-0.5">{comment.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Location - Compact */}
            <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800/50 backdrop-blur">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📍</span>
                  <div>
                    <h3 className="font-bold text-white text-sm">{GAME_CONFIG.location}</h3>
                    <p className="text-zinc-500 text-xs">San Francisco, CA</p>
                  </div>
                </div>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Garfield+Square+San+Francisco"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-slate-800 hover:bg-slate-700 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                >
                  Directions →
                </a>
              </div>
              <iframe
                src="https://maps.google.com/maps?q=Garfield+Square+San+Francisco+CA&t=&z=15&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="120"
                style={{ border: 0, opacity: 0.8 }}
                loading="lazy"
              />
            </div>

          </main>
        ) : (
          /* HISTORY SECTION */
          <main className="max-w-5xl mx-auto px-4 py-10 relative z-10">
            <div className="rounded-3xl border border-emerald-400/20 bg-slate-900/60 backdrop-blur p-6 mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">📜 Game History</h2>
              <p className="text-zinc-400">
              Browse all games, vote for players, and leave comments on past matches.
              </p>
            </div>

            {/* Leaderboard */}
            <Leaderboard bestPlayers={leaderboard.bestPlayers} worstPlayers={leaderboard.worstPlayers} />

            {/* Games List */}
            {allGames.length === 0 ? (
              <div className="bg-slate-900/70 rounded-2xl p-8 border border-emerald-900/30 text-center">
                <p className="text-zinc-400">No games yet.</p>
                <p className="text-zinc-500 text-sm mt-2">Games appear here after they're played.</p>
              </div>
            ) : (
              <div>
                <p className="text-zinc-400 text-sm mb-4">
                  {allGames.length} game{allGames.length !== 1 ? 's' : ''} • Click to expand
                </p>
                {allGames.map((game) => (
                  <GameCard 
                    key={game.id}
                    game={game}
                    isExpanded={expandedGameId === game.id}
                    onToggle={() => {
                      const willExpand = expandedGameId !== game.id;
                      if (willExpand) trackEvent('click', 'engagement', `expand_game_${game.id}`);
                      setExpandedGameId(willExpand ? game.id : null);
                    }}
                  />
                ))}
              </div>
            )}
          </main>
        )}

        {/* Footer */}
        <footer className="border-t border-slate-800/50 mt-auto">
          <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-zinc-600">
            © {new Date().getFullYear()} Soccer Now SF
          </div>
        </footer>

      </div>
    </>
  );
}

// Status card component
function StatusCard({ label, value, ok }) {
  return (
    <div className={`rounded-xl p-3 text-center backdrop-blur ${ok ? 'bg-emerald-900/30 border border-emerald-700/50' : 'bg-slate-900/70 border border-slate-800/70'}`}>
      <p className="text-zinc-400 text-xs uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold ${ok ? 'text-emerald-300' : 'text-zinc-200'}`}>
        {ok && "✓ "}{value}
      </p>
    </div>
  );
}

export default SoccerLanding;
