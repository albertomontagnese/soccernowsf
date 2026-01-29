import { getPaymentsCollection, getPlayersCollection } from "./firestoreClient";

/**
 * Auto-populate new player data based on existing player database and payment history
 */
export async function autoPopulatePlayerData(playerName, venmoName = null) {
  try {
    // 1. Check if player already exists in player config
    const existingPlayer = await findExistingPlayer(playerName);
    if (existingPlayer) {
      console.log(`Player ${playerName} already exists in config`);
      return existingPlayer;
    }

    // 2. Analyze payment history for this player
    const paymentHistory = await getPlayerPaymentHistory(playerName);
    
    // 3. Generate smart defaults based on data
    const smartDefaults = generateSmartDefaults(playerName, venmoName, paymentHistory);
    
    // 4. Create new player record with smart defaults
    const newPlayer = {
      name: playerName,
      venmoFullName: venmoName || playerName,
      whatsAppName: smartDefaults.whatsAppName,
      team: smartDefaults.preferredTeam,
      rating: smartDefaults.rating,
      position: smartDefaults.position,
      goalkeeper: smartDefaults.goalkeeper,
      paid: false,
      favorite: false,
      autoCreated: true,
      createdAt: new Date().toISOString(),
      lastPaymentDate: smartDefaults.lastPaymentDate
    };

    // 5. Save to player database
    await savePlayerToDatabase(newPlayer);
    
    console.log(`Auto-created player profile for ${playerName}:`, newPlayer);
    return newPlayer;

  } catch (error) {
    console.error('Error auto-populating player data:', error);
    // Return basic defaults if auto-population fails
    return {
      name: playerName,
      venmoFullName: venmoName || playerName,
      whatsAppName: playerName,
      team: 'white', // Default to white team
      rating: 7.0,   // Default rating
      position: 'midfielder',
      goalkeeper: false,
      paid: false,
      favorite: false,
      autoCreated: true,
      createdAt: new Date().toISOString()
    };
  }
}

/**
 * Check if player already exists in player config database
 */
async function findExistingPlayer(playerName) {
  try {
    const playersRef = getPlayersCollection();
    const snapshot = await playersRef.where('name', '==', playerName).get();
    
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
  } catch (error) {
    console.error('Error checking existing player:', error);
    return null;
  }
}

/**
 * Get payment history for a specific player
 */
async function getPlayerPaymentHistory(playerName) {
  try {
    const paymentsRef = getPaymentsCollection();
    const snapshot = await paymentsRef.where('name', '==', playerName).get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting payment history:', error);
    return [];
  }
}

/**
 * Generate smart defaults based on available data
 */
function generateSmartDefaults(playerName, venmoName, paymentHistory) {
  const defaults = {
    whatsAppName: playerName,
    preferredTeam: 'white',
    rating: 7.0,
    position: 'midfielder',
    goalkeeper: false,
    lastPaymentDate: null
  };

  if (paymentHistory.length > 0) {
    // Sort by date to get most recent preferences
    const sortedHistory = paymentHistory.sort((a, b) => 
      parseInt(b.date || 0) - parseInt(a.date || 0)
    );

    const recentPayment = sortedHistory[0];
    defaults.lastPaymentDate = recentPayment.date;

    // Use most common team preference
    const teamCounts = paymentHistory.reduce((acc, payment) => {
      const team = payment.team || 'white';
      acc[team] = (acc[team] || 0) + 1;
      return acc;
    }, {});

    const mostCommonTeam = Object.keys(teamCounts).reduce((a, b) => 
      teamCounts[a] > teamCounts[b] ? a : b, 'white'
    );

    defaults.preferredTeam = mostCommonTeam;

    // Check if they've ever been a goalkeeper
    const hasBeenGoalkeeper = paymentHistory.some(payment => payment.goalkeeper);
    if (hasBeenGoalkeeper) {
      defaults.goalkeeper = true;
      defaults.position = 'goalkeeper';
      defaults.rating = 8.0; // Goalkeepers typically get higher ratings
    }
  }

  // Smart name detection for WhatsApp
  if (venmoName && venmoName !== playerName) {
    // If Venmo name is different, it might be a better WhatsApp name
    defaults.whatsAppName = venmoName;
  }

  // Position inference based on name patterns (very basic)
  const lowerName = playerName.toLowerCase();
  if (lowerName.includes('gk') || lowerName.includes('keeper') || 
      lowerName.includes('goalie') || defaults.goalkeeper) {
    defaults.position = 'goalkeeper';
    defaults.goalkeeper = true;
    defaults.rating = 8.0;
  }

  return defaults;
}

/**
 * Save new player to database
 */
async function savePlayerToDatabase(player) {
  try {
    const playersRef = getPlayersCollection();
    // Use player name as document ID for easy lookup
    await playersRef.doc(player.name).set(player);
    console.log(`Successfully saved player ${player.name} to database`);
    return true;
  } catch (error) {
    console.error('Error saving player to database:', error);
    return false;
  }
}

/**
 * Check for new players in recent payments and auto-create their profiles
 */
export async function syncNewPlayersFromPayments() {
  try {
    console.log('Starting sync of new players from payments...');
    
    const playersRef = getPlayersCollection();
    const paymentsRef = getPaymentsCollection();
    
    // Get all existing players
    const existingPlayersSnapshot = await playersRef.get();
    const existingPlayerNames = new Set(
      existingPlayersSnapshot.docs.map(doc => doc.data().name)
    );

    // Get recent payments (last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const paymentsSnapshot = await paymentsRef.get();
    
    // Filter payments client-side (Firestore doesn't support string comparison for timestamps as easily)
    const payments = paymentsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(payment => parseInt(payment.date || 0) > thirtyDaysAgo);
    
    // Find unique new player names
    const newPlayerNames = new Set();
    payments.forEach(payment => {
      if (payment.name && !existingPlayerNames.has(payment.name)) {
        newPlayerNames.add(payment.name);
      }
    });

    console.log(`Found ${newPlayerNames.size} new players to create profiles for:`, [...newPlayerNames]);

    // Auto-create profiles for new players
    const createdPlayers = [];
    for (const playerName of newPlayerNames) {
      const playerPayments = payments.filter(p => p.name === playerName);
      const venmoName = playerPayments[0]?.venmoName || playerName;
      
      const newPlayer = await autoPopulatePlayerData(playerName, venmoName);
      createdPlayers.push(newPlayer);
    }

    return {
      success: true,
      newPlayersFound: newPlayerNames.size,
      playersCreated: createdPlayers.length,
      players: createdPlayers
    };

  } catch (error) {
    console.error('Error syncing new players from payments:', error);
    return {
      success: false,
      error: error.message,
      newPlayersFound: 0,
      playersCreated: 0,
      players: []
    };
  }
}