import { syncNewPlayersFromPayments, autoPopulatePlayerData } from "../../helpers/playerAutoPopulation";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check if this is a manual player creation or auto-sync
    if (req.body && req.body.playerName) {
      // Manual player creation with auto-population
      const { playerName, venmoName } = req.body;
      
      console.log(`Manual auto-population requested for: ${playerName}`);
      const newPlayer = await autoPopulatePlayerData(playerName, venmoName);
      
      return res.status(200).json({
        success: true,
        message: 'Player auto-populated successfully',
        player: newPlayer
      });
      
    } else {
      // Auto-sync all new players from payments
      console.log('Auto-sync of new players from payments requested');
      const syncResult = await syncNewPlayersFromPayments();
      
      return res.status(200).json({
        success: syncResult.success,
        message: syncResult.success 
          ? `Successfully synced ${syncResult.playersCreated} new players`
          : 'Failed to sync new players',
        ...syncResult
      });
    }
    
  } catch (error) {
    console.error('Error in syncNewPlayers API:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}