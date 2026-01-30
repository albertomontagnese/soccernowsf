import { getGamesCollection, getPlayersCollection, getPaymentsCollection, getVotesCollection, getCommentsCollection, getFirestore } from "../../helpers/firestoreClient";

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
 * Get the game date for a given Thursday (uses Pacific Time for consistency)
 * Returns the date string in format YYYY-MM-DD
 */
function getGameDateId(date = new Date()) {
  // Convert to Pacific Time for consistency
  const pacificTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const day = pacificTime.getDay(); // 0=Sun, 4=Thu, 5=Fri
  
  // Fri/Sat/Sun -> next Thursday, Mon-Thu -> this Thursday
  let daysToThursday;
  if (day >= 5 || day === 0) {
    daysToThursday = day === 5 ? 6 : day === 6 ? 5 : 4;
  } else {
    daysToThursday = 4 - day;
  }
  
  const thursday = new Date(pacificTime);
  thursday.setDate(pacificTime.getDate() + daysToThursday);
  
  // Format as YYYY-MM-DD
  const year = thursday.getFullYear();
  const month = String(thursday.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(thursday.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
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
      
      if (action === 'archive-past-week') {
        // Archive a past week's game by specifying a target Thursday date
        const { targetDate } = req.body; // e.g., "2026-01-29"
        
        if (!targetDate) {
          return res.status(400).json({ message: 'targetDate is required (YYYY-MM-DD format)' });
        }
        
        const playersRef = getPlayersCollection();
        const paymentsRef = getPaymentsCollection();
        const gamesRef = getGamesCollection();
        
        // Check if game already exists
        const existingGame = await gamesRef.doc(targetDate).get();
        if (existingGame.exists) {
          return res.status(400).json({ message: 'Game already archived for this date', game: existingGame.data() });
        }
        
        // Calculate the cycle for the target date (Friday before to Thursday)
        const targetThursday = new Date(targetDate + 'T12:00:00');
        
        // Cycle starts Friday 00:01 (6 days before Thursday)
        const cycleStartFriday = new Date(targetThursday);
        cycleStartFriday.setDate(targetThursday.getDate() - 6);
        cycleStartFriday.setHours(0, 1, 0, 0);
        
        // Cycle ends Thursday 23:59
        const cycleEndThursday = new Date(targetThursday);
        cycleEndThursday.setHours(23, 59, 59, 999);
        
        const startTimestamp = cycleStartFriday.getTime();
        const endTimestamp = cycleEndThursday.getTime();
        
        console.log(`Archiving game for ${targetDate}, cycle: ${cycleStartFriday} to ${cycleEndThursday}`);
        
        const [playersSnapshot, paymentsSnapshot] = await Promise.all([
          playersRef.get(),
          paymentsRef.where('money', '==', 7).get()
        ]);
        
        const allPlayers = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const allPayments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter payments to the target week cycle
        const payments = allPayments.filter((item) => {
          const itemTimestamp = parseInt(item.date, 10);
          return itemTimestamp >= startTimestamp && itemTimestamp <= endTimestamp;
        });
        
        if (payments.length === 0) {
          return res.status(400).json({ 
            message: 'No players found for this week', 
            debug: { startTimestamp, endTimestamp, totalPayments: allPayments.length }
          });
        }
        
        // Group by name and get most recent/paid entry
        const groupedByName = payments.reduce((acc, item) => {
          acc[item.name] = acc[item.name] || [];
          acc[item.name].push(item);
          return acc;
        }, {});
        
        const uniquePayments = Object.values(groupedByName).map((group) => {
          return group.find((item) => item.paid) || group[0];
        });
        
        // Build rosters with ratings (using case-insensitive matching)
        const whiteRoster = uniquePayments.filter(p => p.team === 'white').map(payment => {
          const paymentName = (payment.name || '').trim().toLowerCase();
          const playerData = allPlayers.find(player => 
            (player.name || '').trim().toLowerCase() === paymentName
          );
          return {
            name: payment.name,
            rating: playerData?.rating || 7.0,
            position: playerData?.position || 'midfielder',
            goalkeeper: payment.goalkeeper || false
          };
        });
        
        const darkRoster = uniquePayments.filter(p => p.team === 'dark').map(payment => {
          const paymentName = (payment.name || '').trim().toLowerCase();
          const playerData = allPlayers.find(player => 
            (player.name || '').trim().toLowerCase() === paymentName
          );
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
        
        const gameData = {
          gameDate: targetDate,
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
          totalPlayers: uniquePayments.length
        };
        
        // Save game with date as ID
        await gamesRef.doc(targetDate).set(gameData);
        
        return res.status(200).json({ 
          message: 'Past game archived successfully', 
          game: { id: targetDate, ...gameData } 
        });
      }
      
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
      const { action } = req.query;
      
      // Migration: move votes from one game ID to another
      if (action === 'migrate-votes') {
        const { fromGameId, toGameId } = req.body;
        
        if (!fromGameId || !toGameId) {
          return res.status(400).json({ message: 'fromGameId and toGameId are required' });
        }
        
        const votesRef = getVotesCollection();
        
        // Get all votes for the source game
        const snapshot = await votesRef.where('gameId', '==', fromGameId).get();
        
        if (snapshot.empty) {
          return res.status(400).json({ message: `No votes found for game ${fromGameId}` });
        }
        
        const batch = getFirestore().batch();
        let migratedCount = 0;
        
        snapshot.docs.forEach(doc => {
          const vote = doc.data();
          // Create new vote with updated gameId
          const newVoteId = doc.id.replace(fromGameId, toGameId);
          const newVoteRef = votesRef.doc(newVoteId);
          
          batch.set(newVoteRef, {
            ...vote,
            gameId: toGameId,
            migratedFrom: fromGameId,
            migratedAt: new Date().toISOString()
          });
          
          // Delete old vote
          batch.delete(doc.ref);
          migratedCount++;
        });
        
        await batch.commit();
        
        return res.status(200).json({ 
          message: `Migrated ${migratedCount} votes from ${fromGameId} to ${toGameId}` 
        });
      }
      
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
    
    else if (req.method === 'DELETE') {
      // Delete a game and its associated votes/comments
      const { gameId } = req.body;
      
      if (!gameId) {
        return res.status(400).json({ message: 'gameId is required' });
      }
      
      const gamesRef = getGamesCollection();
      const gameDoc = await gamesRef.doc(gameId).get();
      
      if (!gameDoc.exists) {
        return res.status(404).json({ message: 'Game not found' });
      }
      
      // Delete the game
      await gamesRef.doc(gameId).delete();
      
      // Also delete associated votes
      const votesRef = getVotesCollection();
      const votesSnapshot = await votesRef.where('gameId', '==', gameId).get();
      const voteBatch = getFirestore().batch();
      votesSnapshot.docs.forEach(doc => voteBatch.delete(doc.ref));
      if (!votesSnapshot.empty) {
        await voteBatch.commit();
      }
      
      // Also delete associated comments
      const commentsRef = getCommentsCollection();
      const commentsSnapshot = await commentsRef.where('gameId', '==', gameId).get();
      const commentBatch = getFirestore().batch();
      commentsSnapshot.docs.forEach(doc => commentBatch.delete(doc.ref));
      if (!commentsSnapshot.empty) {
        await commentBatch.commit();
      }
      
      return res.status(200).json({ 
        message: `Game ${gameId} deleted successfully`,
        deletedVotes: votesSnapshot.size,
        deletedComments: commentsSnapshot.size
      });
    }
    
    else {
      res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
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
