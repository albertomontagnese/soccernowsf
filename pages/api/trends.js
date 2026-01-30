import { getGamesCollection, getVotesCollection } from "../../helpers/firestoreClient";

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }

    const gamesRef = getGamesCollection();
    const votesRef = getVotesCollection();
    
    // Get all games sorted by date
    const gamesSnapshot = await gamesRef.orderBy('gameDate', 'asc').get();
    const games = gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get all votes
    const votesSnapshot = await votesRef.get();
    const votes = votesSnapshot.docs.map(doc => doc.data());
    
    // Calculate team win history
    const teamWins = {
      white: 0,
      dark: 0,
      ties: 0
    };
    
    const gameResults = [];
    
    games.forEach(game => {
      const score = game.finalScore;
      if (score && score.white !== null && score.dark !== null) {
        if (score.white > score.dark) {
          teamWins.white++;
          gameResults.push({ date: game.gameDate, winner: 'white', score: `${score.white}-${score.dark}` });
        } else if (score.dark > score.white) {
          teamWins.dark++;
          gameResults.push({ date: game.gameDate, winner: 'dark', score: `${score.white}-${score.dark}` });
        } else {
          teamWins.ties++;
          gameResults.push({ date: game.gameDate, winner: 'tie', score: `${score.white}-${score.dark}` });
        }
      }
    });
    
    // Calculate player performance trends (ratings per game)
    const playerGameRatings = {};
    
    votes.forEach(vote => {
      if (!vote.playerName || !vote.gameId || !vote.rating) return;
      
      if (!playerGameRatings[vote.playerName]) {
        playerGameRatings[vote.playerName] = {};
      }
      
      if (!playerGameRatings[vote.playerName][vote.gameId]) {
        playerGameRatings[vote.playerName][vote.gameId] = { total: 0, count: 0 };
      }
      
      playerGameRatings[vote.playerName][vote.gameId].total += vote.rating;
      playerGameRatings[vote.playerName][vote.gameId].count++;
    });
    
    // Convert to trends format
    const playerTrends = {};
    Object.keys(playerGameRatings).forEach(playerName => {
      const gameRatings = playerGameRatings[playerName];
      playerTrends[playerName] = Object.keys(gameRatings)
        .sort() // Sort by gameId (date format)
        .map(gameId => ({
          gameId,
          avgRating: gameRatings[gameId].total / gameRatings[gameId].count,
          votes: gameRatings[gameId].count
        }));
    });
    
    // Get top players by total games played
    const topPlayers = Object.entries(playerTrends)
      .map(([name, trend]) => ({
        name,
        gamesPlayed: trend.length,
        avgRating: trend.reduce((sum, g) => sum + g.avgRating, 0) / trend.length,
        trend
      }))
      .filter(p => p.gamesPlayed >= 1)
      .sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.avgRating - a.avgRating)
      .slice(0, 10);
    
    // Game dates for x-axis
    const gameDates = games.map(g => g.gameDate).sort();
    
    return res.status(200).json({
      teamWins,
      gameResults,
      playerTrends: topPlayers,
      gameDates,
      totalGames: games.length,
      gamesWithScores: gameResults.length
    });
    
  } catch (error) {
    console.error('Trends API error:', error);
    return res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}
