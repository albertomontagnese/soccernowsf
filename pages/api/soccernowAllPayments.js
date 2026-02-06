import { getPaymentsCollection, getGamesCollection, getPlayersCollection } from "../../helpers/firestoreClient";

// Check if running in production (Vercel) or development
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';

/**
 * Auto-archive previous week's game if not already archived
 * This runs lazily on the first request of a new cycle
 */
async function autoArchivePreviousGame(todayInPT, allPayments) {
  const currentDayOfWeek = todayInPT.getDay();
  
  // Only attempt auto-archive on Fri/Sat/Sun (start of new cycle)
  // This gives a window to catch the archive on first visits after game day
  if (currentDayOfWeek !== 5 && currentDayOfWeek !== 6 && currentDayOfWeek !== 0) {
    return null; // Not in archive window
  }
  
  try {
    // Calculate previous Thursday's date
    let daysSincePrevThursday;
    if (currentDayOfWeek === 5) daysSincePrevThursday = 1; // Friday -> 1 day ago
    else if (currentDayOfWeek === 6) daysSincePrevThursday = 2; // Saturday -> 2 days ago
    else daysSincePrevThursday = 3; // Sunday -> 3 days ago
    
    const prevThursday = new Date(todayInPT);
    prevThursday.setDate(todayInPT.getDate() - daysSincePrevThursday);
    const prevThursdayId = prevThursday.toISOString().split('T')[0];
    
    // Check if game already archived
    const gamesRef = getGamesCollection();
    const existingGame = await gamesRef.doc(prevThursdayId).get();
    
    if (existingGame.exists) {
      console.log(`✅ Game ${prevThursdayId} already archived`);
      return null; // Already archived
    }
    
    console.log(`📦 Auto-archiving game for ${prevThursdayId}...`);
    
    // Calculate the previous cycle (Friday before prev Thursday to prev Thursday)
    const prevCycleStart = new Date(prevThursday);
    prevCycleStart.setDate(prevThursday.getDate() - 6);
    prevCycleStart.setHours(0, 1, 0, 0);
    
    const prevCycleEnd = new Date(prevThursday);
    prevCycleEnd.setHours(23, 59, 59, 999);
    
    const startTimestamp = prevCycleStart.getTime();
    const endTimestamp = prevCycleEnd.getTime();
    
    // Filter payments for previous cycle
    const prevCyclePayments = allPayments.filter((item) => {
      const itemTimestamp = parseInt(item.date, 10);
      return itemTimestamp >= startTimestamp && itemTimestamp <= endTimestamp;
    });
    
    if (prevCyclePayments.length < 4) {
      console.log(`⚠️ Only ${prevCyclePayments.length} players found for ${prevThursdayId}, skipping auto-archive`);
      return null; // Not enough players to archive
    }
    
    // Group by name and get most recent/paid entry
    const groupedByName = prevCyclePayments.reduce((acc, item) => {
      acc[item.name] = acc[item.name] || [];
      acc[item.name].push(item);
      return acc;
    }, {});
    
    const uniquePayments = Object.values(groupedByName).map((group) => {
      return group.find((item) => item.paid) || group[0];
    });
    
    // Get player ratings
    const playersRef = getPlayersCollection();
    const playersSnapshot = await playersRef.get();
    const allPlayers = playersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Build rosters with ratings
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
    
    // Calculate ratings and odds
    const whiteRating = whiteRoster.reduce((sum, p) => sum + (p.rating || 7.0), 0);
    const darkRating = darkRoster.reduce((sum, p) => sum + (p.rating || 7.0), 0);
    const total = whiteRating + darkRating;
    const whiteOdds = total > 0 ? parseFloat(((whiteRating / total) * 100).toFixed(1)) : 50;
    const darkOdds = parseFloat((100 - whiteOdds).toFixed(1));
    
    const gameData = {
      gameDate: prevThursdayId,
      archivedAt: new Date().toISOString(),
      autoArchived: true, // Mark as auto-archived
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
    
    await gamesRef.doc(prevThursdayId).set(gameData);
    console.log(`✅ Auto-archived game ${prevThursdayId} with ${uniquePayments.length} players`);
    
    return { id: prevThursdayId, ...gameData };
  } catch (error) {
    console.error('❌ Auto-archive failed:', error.message);
    return null; // Don't break the main request if archive fails
  }
}

export default async function user(req, res) {
  try {
    // Debug mode - return all payments without date filtering
    const { debug } = req.query;
    
    // Calculate the soccer week cycle: Friday 00:01 PST to Thursday 23:59 PST
    // Game is Thursday 7pm PST (19:00), cycle ends Thursday 23:59 PST  
    // New cycle starts Friday 00:01 PST
    const now = new Date();
    // Convert server time (UTC on Vercel) to Pacific Time for consistency
    const todayInPT = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    console.log(`Server time: ${now.toISOString()}, PT time: ${todayInPT} (day of week: ${todayInPT.getDay()})`);

    // Calculate cycle based on Friday 00:01 PST transitions
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
    thursdayGameDate.setHours(0, 0, 0, 0); // Start of Thursday for calculation

    // Cycle starts Friday 00:01 (day after previous Thursday)
    const cycleStartFriday = new Date(thursdayGameDate);
    cycleStartFriday.setDate(thursdayGameDate.getDate() - 6); // Previous Friday (6 days before Thursday)
    cycleStartFriday.setHours(0, 1, 0, 0); // 00:01 PST Friday

    // Cycle ends this Thursday at 23:59
    const cycleEndThursday = new Date(thursdayGameDate);
    cycleEndThursday.setHours(23, 59, 59, 999); // 23:59:59 PST Thursday

    const startTimestamp = cycleStartFriday.getTime();
    const endTimestamp = cycleEndThursday.getTime();

    console.log(`Soccer week cycle: ${cycleStartFriday} to ${cycleEndThursday}`);

    // Now do Firestore querying
    let dynamoData;
    
    // Try Firestore first, fall back to mock data if connection fails
    try {
      const paymentsRef = getPaymentsCollection();
      console.log('Attempting to connect to Firestore...');
      
      // Query for $7 payments (soccer game fee)
      const snapshot = await paymentsRef.where('money', '==', 7).get();
      
      dynamoData = {
        Items: snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      };
      
      console.log(`✅ Successfully retrieved ${dynamoData.Items?.length || 0} items from Firestore`);
      
      // Log first few items to debug
      if (dynamoData.Items?.length > 0) {
        console.log('First 3 records:');
        dynamoData.Items.slice(0, 3).forEach((item, i) => {
          console.log(`${i+1}. ${item.name} - ${new Date(parseInt(item.date)).toLocaleString()} - $${item.money}`);
        });
      }
      
      // Auto-archive previous game if needed (lazy archive on first request of new cycle)
      await autoArchivePreviousGame(todayInPT, dynamoData.Items);
      
    } catch (dbError) {
      console.error('❌ Firestore connection failed:', dbError.message);
      console.log('📝 Using mock data - check environment for correct Google credentials');
      dynamoData = {
        Items: getMockPaymentData()
      };
    }

    // Filter by the soccer week cycle (Friday 00:01 to Thursday 23:59)
    // Skip filtering if debug=true (for troubleshooting)
    const filteredData = debug === 'true' 
      ? dynamoData.Items 
      : dynamoData.Items.filter((item) => {
          const itemTimestamp = parseInt(item.date, 10);
          return itemTimestamp >= startTimestamp && itemTimestamp <= endTimestamp;
        });
    
    console.log(`📊 Debug - Total DB items: ${dynamoData.Items.length}, after date filter: ${filteredData.length}`);
    console.log(`📅 Current cycle: ${new Date(startTimestamp).toLocaleString()} to ${new Date(endTimestamp).toLocaleString()}`);
    
    // Log a few recent payments to debug
    const recentPayments = dynamoData.Items
      .sort((a, b) => parseInt(b.date) - parseInt(a.date))
      .slice(0, 5);
    console.log('Recent payments:');
    recentPayments.forEach((item, i) => {
      const itemTime = parseInt(item.date);
      const inCycle = itemTime >= startTimestamp && itemTime <= endTimestamp;
      console.log(`${i+1}. ${item.name} - ${new Date(itemTime).toLocaleString()} - In cycle: ${inCycle}`);
    });

    // Group by name and get the most recent entry for each person
    const groupedByName = filteredData.reduce((acc, item) => {
      acc[item.name] = acc[item.name] || [];
      acc[item.name].push(item);
      return acc;
    }, {});

    let mergedData = Object.values(groupedByName).map((group) => {
      return group.find((item) => item.paid) || group[0];
    });

    // Initialize team arrays
    let whiteTeam = [],
      darkTeam = [],
      waitlist = [];

    // Sort mergedData by timestamp to ensure latest records are processed last
    mergedData.sort((a, b) => parseInt(a.date) - parseInt(b.date));

    // Allocate to teams and potentially to waitlist
    mergedData.forEach((item) => {
      if (item.team === "white") {
        whiteTeam.push(item);
      } else if (item.team === "dark") {
        darkTeam.push(item);
      }
    });

    // Handle waitlist logic
    const totalPlayers = whiteTeam.length + darkTeam.length;
    if (totalPlayers > 16) {
      const overCount = totalPlayers - 16;
      const allPlayers = [...whiteTeam, ...darkTeam].sort(
        (a, b) => parseInt(b.date) - parseInt(a.date)
      ); // Latest first
      let unpaidPlayers = allPlayers.filter((item) => !item.paid);

      // Move latest unpaid players to waitlist
      waitlist = unpaidPlayers.slice(0, overCount);

      // Remove waitlisted players from their teams
      whiteTeam = whiteTeam.filter((item) => !waitlist.includes(item));
      darkTeam = darkTeam.filter((item) => !waitlist.includes(item));
    }

    waitlist.sort((a, b) => parseInt(a.date) - parseInt(b.date));

    res.status(200).json({
      message: "Data filtered successfully",
      data: mergedData,
      whiteTeam,
      darkTeam,
      waitlist,
              debug: {
          todayInPT: todayInPT.toString(),
          thursdayGameDate: thursdayGameDate.toString(),
          soccerWeekStart: cycleStartFriday.toString(),
          soccerWeekEnd: cycleEndThursday.toString(),
          totalFromDB: dynamoData.Items.length,
          afterDateFilter: filteredData.length,
          finalPlayerCount: mergedData.length,
          whiteTeamCount: whiteTeam.length,
          darkTeamCount: darkTeam.length,
          waitlistCount: waitlist.length
        }
    });
  } catch (error) {
    console.error("API Error details:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      message: "Internal server error",
      error: error.message || "Unknown error",
      data: [],
    });
  }
}

// Mock payment data for development
function getMockPaymentData() {
  const now = new Date().getTime();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
  
  return [
    {
      id: now,
      name: "Alberto Monta",
      money: 7,
      date: now.toString(),
      team: "white",
      paid: true
    },
    {
      id: oneDayAgo,
      name: "Gavin Jay", 
      money: 7,
      date: oneDayAgo.toString(),
      team: "white",
      paid: false
    },
    {
      id: twoDaysAgo,
      name: "Andrea Ciccardi",
      money: 7,
      date: twoDaysAgo.toString(),
      team: "dark",
      paid: true
    },
    {
      id: oneDayAgo - 1000,
      name: "Gabe",
      money: 7,
      date: oneDayAgo.toString(),
      team: "dark",
      paid: true
    },
    {
      id: now - 1000,
      name: "Marco Rossi",
      money: 7,
      date: now.toString(),
      team: "white",
      paid: false
    },
    {
      id: twoDaysAgo - 1000,
      name: "Luca Bianchi",
      money: 7,
      date: twoDaysAgo.toString(),
      team: "dark",
      paid: true
    }
  ];
}
