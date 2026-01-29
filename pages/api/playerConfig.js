import fs from 'fs';
import path from 'path';
import { getPlayersCollection } from "../../helpers/firestoreClient";

const PLAYERS_FILE_PATH = path.join(process.cwd(), 'data', 'players.json');

// Check if running in production (Vercel) or development
const isProduction = process.env.VERCEL || process.env.NODE_ENV === 'production';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (isProduction) {
        // Use Firestore in production
        try {
          const playersRef = getPlayersCollection();
          const snapshot = await playersRef.get();
          const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          return res.status(200).json({ players });
        } catch (dbError) {
          console.error('Firestore error:', dbError);
          
          // For errors, return default players but log the error
          console.error('Firestore error, falling back to default players:', dbError);
          return res.status(200).json({ players: getDefaultPlayers() });
        }
      } else {
        // Use file system in development
        if (!fs.existsSync(PLAYERS_FILE_PATH)) {
          return res.status(404).json({ message: 'Players config file not found' });
        }
        
        const playersData = fs.readFileSync(PLAYERS_FILE_PATH, 'utf8');
        const players = JSON.parse(playersData);
        
        return res.status(200).json(players);
      }
    } 
    
    else if (req.method === 'POST') {
      const { players } = req.body;
      
      if (!players || !Array.isArray(players)) {
        return res.status(400).json({ message: 'Invalid players data' });
      }
      
      if (isProduction) {
        // Use Firestore in production
        try {
          const playersRef = getPlayersCollection();
          
          // First, clear existing players
          const existingSnapshot = await playersRef.get();
          const batch = playersRef.firestore.batch();
          
          // Delete existing items
          existingSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          // Insert new players (use player name as document ID)
          for (const player of players) {
            const docRef = playersRef.doc(player.name);
            batch.set(docRef, {
              name: player.name,
              venmoFullName: player.venmoFullName || '',
              phoneNumber: player.phoneNumber || '',
              whatsAppName: player.whatsAppName || '',
              team: player.team || 'white',
              goalkeeper: player.goalkeeper || false,
              paid: player.paid || false,
              rating: player.rating || 7.0,
              position: player.position || 'midfielder',
              favorite: player.favorite || false,
              updatedAt: new Date().toISOString()
            });
          }
          
          await batch.commit();
          
          return res.status(200).json({ message: 'Players config updated successfully' });
        } catch (dbError) {
          console.error('Firestore write error:', dbError);
          return res.status(500).json({ 
            message: 'Database error', 
            error: dbError.message 
          });
        }
      } else {
        // Use file system in development
        const playersData = { players };
        
        // Ensure data directory exists
        const dataDir = path.dirname(PLAYERS_FILE_PATH);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(PLAYERS_FILE_PATH, JSON.stringify(playersData, null, 2));
        
        return res.status(200).json({ message: 'Players config updated successfully' });
      }
    }
    
    else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('Player config API error:', error);
    return res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}

// Default players fallback
function getDefaultPlayers() {
  return [
    {
      name: "Alberto Monta",
      venmoFullName: "Alberto Monta",
      whatsAppName: "Alberto Monta",
      team: "white",
      rating: 8.5,
      position: "striker",
      goalkeeper: false,
      paid: false,
      favorite: true
    },
    {
      name: "Gavin Jay", 
      venmoFullName: "Gavin Jay",
      whatsAppName: "Gavin Jay",
      team: "white",
      rating: 8.0,
      position: "midfielder", 
      goalkeeper: false,
      paid: false,
      favorite: false
    },
    {
      name: "Andrea Ciccardi",
      venmoFullName: "Andrea Ciccardi", 
      whatsAppName: "Andrea Ciccardi",
      team: "white",
      rating: 8.2,
      position: "striker",
      goalkeeper: false,
      paid: false,
      favorite: false
    },
    {
      name: "Gabe",
      venmoFullName: "Gabe",
      whatsAppName: "Gabe", 
      team: "white",
      rating: 8.8,
      position: "goalkeeper",
      goalkeeper: true,
      paid: true,
      favorite: true
    }
    // Add more default players as needed
  ];
}