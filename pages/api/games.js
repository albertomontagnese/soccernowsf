import { getGamesCollection, getPlayersCollection, getPaymentsCollection } from "../../helpers/firestoreClient";

/**
 * Calculate team rating from roster
 */
function calculateTeamRating(roster) {
  if (!roster || roster.length === 0) return 0;
  const totalRating = roster.reduce((sum, player) => sum + (player.rating || 7.0), 0);
  return totalRating;
}

/**
 * Calculate win probability based on team ratings
 * Uses a simple ratio formula with 1 decimal place
 */
function calculateWinProbability(teamARating, teamBRating) {
  if (teamARating === 0 && teamBRating === 0) return 50;
  const total = teamARating + teamBRating;
  // Return with 1 decimal for more precision (e.g. 50.4% vs 49.6%)
  return parseFloat(((teamARating / total) * 100).toFixed(1));
}

/**
 * Get the game date for a given Thursday
 * Returns the date string in format YYYY-MM-DD
 */
function getGameDateId(date = new Date()) {
  // Get the Thursday of the current week
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 4); // Adjust to Thursday
  const thursday = new Date(d.setDate(diff));
  return thursday.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Get game history or specific game
      const { gameId, action } = req.query;
      
      if (action === 'current-odds') {
        // Get current game odds from payments/players
        const playersRef = getPlayersCollection();
        const paymentsRef = getPaymentsCollection();
        
        const [playersSnapshot, paymentsSnapshot] = await Promise.all([
          playersRef.get(),
          paymentsRef.get()
        ]);
        
        const allPlayers = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allPayments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Calculate the soccer week cycle: Friday 00:01 PST to Thursday 23:59 PST
        const now = new Date();
        const todayInPT = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
        const currentDayOfWeek = todayInPT.getDay(); // 0=Sunday, 5=Friday, 4=Thursday

        let daysToTargetThursday;
        if (currentDayOfWeek >= 5 || currentDayOfWeek === 0) {
          // It's Fri/Sat/Sun - show next Thursday's game
          daysToTargetThursday = currentDayOfWeek === 5 ? 6 : // Friday -> 6 days to Thursday
                               currentDayOfWeek === 6 ? 5 : // Saturday -> 5 days to Thursday  
                               4; // Sunday -> 4 days to Thursday
        } else {
          // It's Mon/Tue/Wed/Thu - show this Thursday's game
          daysToTargetThursday = 4 - currentDayOfWeek; // Days to this Thursday
        }

        // Find the current cycle's Thursday game date
        const thursdayGameDate = new Date(todayInPT);
        thursdayGameDate.setDate(todayInPT.getDate() + daysToTargetThursday);
        thursdayGameDate.setHours(0, 0, 0, 0);

        // Cycle starts Friday 00:01 (day after previous Thursday)
        const cycleStartFriday = new Date(thursdayGameDate);
        cycleStartFriday.setDate(thursdayGameDate.getDate() - 6);
        cycleStartFriday.setHours(0, 1, 0, 0);

        // Cycle ends this Thursday at 23:59
        const cycleEndThursday = new Date(thursdayGameDate);
        cycleEndThursday.setHours(23, 59, 59, 999);

        const startTimestamp = cycleStartFriday.getTime();
        const endTimestamp = cycleEndThursday.getTime();

        // Filter payments to current soccer week cycle
        const payments = allPayments.filter((item) => {
          const itemTimestamp = parseInt(item.date, 10);
          return itemTimestamp >= startTimestamp && itemTimestamp <= endTimestamp;
        });

        // Group by name and get the most recent entry for each person
        const groupedByName = payments.reduce((acc, item) => {
          acc[item.name] = acc[item.name] || [];
          acc[item.name].push(item);
          return acc;
        }, {});

        const uniquePayments = Object.values(groupedByName).map((group) => {
          return group.find((item) => item.paid) || group[0];
        });
        
        // Get players who are playing this week (have payments)
        // Use case-insensitive, trimmed name matching
        const whiteTeam = uniquePayments.filter(p => p.team === 'white').map(payment => {
          const paymentName = (payment.name || '').trim().toLowerCase();
          const playerData = allPlayers.find(player => 
            (player.name || '').trim().toLowerCase() === paymentName
          );
          const rating = playerData?.rating || 7.0;
          console.log(`White: ${payment.name} -> rating: ${rating} (found: ${!!playerData})`);
          return { ...payment, rating };
        });
        
        const darkTeam = uniquePayments.filter(p => p.team === 'dark').map(payment => {
          const paymentName = (payment.name || '').trim().toLowerCase();
          const playerData = allPlayers.find(player => 
            (player.name || '').trim().toLowerCase() === paymentName
          );
          const rating = playerData?.rating || 7.0;
          console.log(`Dark: ${payment.name} -> rating: ${rating} (found: ${!!playerData})`);
          return { ...payment, rating };
        });
        
        const whiteRating = calculateTeamRating(whiteTeam);
        const darkRating = calculateTeamRating(darkTeam);
        const whiteOdds = calculateWinProbability(whiteRating, darkRating);
        
        const darkOdds = parseFloat((100 - whiteOdds).toFixed(1));
        
        return res.status(200).json({
          whiteTeam: { 
            players: whiteTeam, 
            totalRating: whiteRating,
            avgRating: whiteTeam.length > 0 ? (whiteRating / whiteTeam.length).toFixed(1) : 0,
            winProbability: whiteOdds 
          },
          darkTeam: { 
            players: darkTeam, 
            totalRating: darkRating,
            avgRating: darkTeam.length > 0 ? (darkRating / darkTeam.length).toFixed(1) : 0,
            winProbability: darkOdds 
          }
        });
      }
      
      if (gameId) {
        // Get specific game
        const gamesRef = getGamesCollection();
        const doc = await gamesRef.doc(gameId).get();
        
        if (!doc.exists) {
          return res.status(404).json({ message: 'Game not found' });
        }
        
        return res.status(200).json({ game: { id: doc.id, ...doc.data() } });
      }
      
      // Get all games (history)
      const gamesRef = getGamesCollection();
      const snapshot = await gamesRef.orderBy('gameDate', 'desc').limit(20).get();
      const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      return res.status(200).json({ games });
    }
    
    else if (req.method === 'POST') {
      // Save a game to history (typically called after game ends, or manually)
      const { action } = req.query;
      
      if (action === 'archive-current') {
        // Archive the current game
        const playersRef = getPlayersCollection();
        const paymentsRef = getPaymentsCollection();
        const gamesRef = getGamesCollection();
        
        const [playersSnapshot, paymentsSnapshot] = await Promise.all([
          playersRef.get(),
          paymentsRef.get()
        ]);
        
        const allPlayers = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (payments.length === 0) {
          return res.status(400).json({ message: 'No players in current game to archive' });
        }
        
        // Build rosters with ratings
        const whiteRoster = payments.filter(p => p.team === 'white').map(payment => {
          const playerData = allPlayers.find(player => player.name === payment.name);
          return {
            name: payment.name,
            rating: playerData?.rating || 7.0,
            position: playerData?.position || 'midfielder',
            goalkeeper: payment.goalkeeper || false
          };
        });
        
        const darkRoster = payments.filter(p => p.team === 'dark').map(payment => {
          const playerData = allPlayers.find(player => player.name === payment.name);
          return {
            name: payment.name,
            rating: playerData?.rating || 7.0,
            position: playerData?.position || 'midfielder',
            goalkeeper: payment.goalkeeper || false
          };
        });
        
        const whiteRating = calculateTeamRating(whiteRoster);
        const darkRating = calculateTeamRating(darkRoster);
        const whiteOdds = calculateWinProbability(whiteRating, darkRating);
        const darkOdds = parseFloat((100 - whiteOdds).toFixed(1));
        
        const gameDate = getGameDateId();
        const gameData = {
          gameDate,
          archivedAt: new Date().toISOString(),
          whiteTeam: {
            roster: whiteRoster,
            totalRating: whiteRating,
            avgRating: whiteRoster.length > 0 ? (whiteRating / whiteRoster.length).toFixed(1) : 0,
            winProbability: whiteOdds
          },
          darkTeam: {
            roster: darkRoster,
            totalRating: darkRating,
            avgRating: darkRoster.length > 0 ? (darkRating / darkRoster.length).toFixed(1) : 0,
            winProbability: darkOdds
          },
          totalPlayers: payments.length
        };
        
        // Save game with date as ID
        await gamesRef.doc(gameDate).set(gameData);
        
        return res.status(200).json({ 
          message: 'Game archived successfully', 
          game: { id: gameDate, ...gameData } 
        });
      }
      
      // Manual game creation
      const { gameDate, whiteTeam, darkTeam } = req.body;
      
      if (!gameDate || !whiteTeam || !darkTeam) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      const gamesRef = getGamesCollection();
      
      const whiteRating = calculateTeamRating(whiteTeam.roster);
      const darkRating = calculateTeamRating(darkTeam.roster);
      const whiteOdds = calculateWinProbability(whiteRating, darkRating);
      const darkOdds = parseFloat((100 - whiteOdds).toFixed(1));
      
      const gameData = {
        gameDate,
        createdAt: new Date().toISOString(),
        whiteTeam: {
          roster: whiteTeam.roster,
          totalRating: whiteRating,
          avgRating: whiteTeam.roster.length > 0 ? (whiteRating / whiteTeam.roster.length).toFixed(1) : 0,
          winProbability: whiteOdds
        },
        darkTeam: {
          roster: darkTeam.roster,
          totalRating: darkRating,
          avgRating: darkTeam.roster.length > 0 ? (darkRating / darkTeam.roster.length).toFixed(1) : 0,
          winProbability: darkOdds
        },
        totalPlayers: whiteTeam.roster.length + darkTeam.roster.length
      };
      
      await gamesRef.doc(gameDate).set(gameData);
      
      return res.status(200).json({ message: 'Game created successfully', game: { id: gameDate, ...gameData } });
    }
    
    else if (req.method === 'PATCH') {
      // Update game score
      const { gameId, whiteScore, darkScore } = req.body;
      
      if (!gameId) {
        return res.status(400).json({ message: 'gameId is required' });
      }
      
      const gamesRef = getGamesCollection();
      const gameDoc = await gamesRef.doc(gameId).get();
      
      if (!gameDoc.exists) {
        return res.status(404).json({ message: 'Game not found' });
      }
      
      await gamesRef.doc(gameId).update({
        'finalScore.white': parseInt(whiteScore) || 0,
        'finalScore.dark': parseInt(darkScore) || 0,
        'finalScore.updatedAt': new Date().toISOString()
      });
      
      return res.status(200).json({ 
        message: 'Score updated successfully',
        finalScore: { white: whiteScore, dark: darkScore }
      });
    }
    
    else {
      res.setHeader('Allow', ['GET', 'POST', 'PATCH']);
      return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('Games API error:', error);
    return res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}
