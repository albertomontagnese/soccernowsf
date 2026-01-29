import { getVotesCollection } from "../../helpers/firestoreClient";
import { serialize, parse } from 'cookie';
import crypto from 'crypto';

// Games to exclude from overall ratings calculation (e.g., test games)
const EXCLUDED_GAME_IDS = [
  '2026-01-22', // Test game with mocked data
];

// Cookie settings
const RATING_COOKIE_NAME = 'soccer_ratings';
const VOTER_ID_COOKIE_NAME = 'soccer_voter_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Generate a unique voter ID
 */
function generateVoterId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Parse ratings cookie to get user's ratings
 */
function parseRatingsCookie(cookieHeader) {
  if (!cookieHeader) return { ratings: {}, odId: null };
  const cookies = parse(cookieHeader);
  try {
    const ratings = cookies[RATING_COOKIE_NAME] ? JSON.parse(cookies[RATING_COOKIE_NAME]) : {};
    const odId = cookies[VOTER_ID_COOKIE_NAME] || null;
    return { ratings, odId };
  } catch (e) {
    return { ratings: {}, odId: null };
  }
}

/**
 * Create/update ratings cookie
 */
function createRatingsCookie(ratings) {
  return serialize(RATING_COOKIE_NAME, JSON.stringify(ratings), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });
}

/**
 * Create voter ID cookie
 */
function createVoterIdCookie(odId) {
  return serialize(VOTER_ID_COOKIE_NAME, odId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });
}

export default async function handler(req, res) {
  try {
    const { ratings: userRatings, odId: existingVoterId } = parseRatingsCookie(req.headers.cookie);
    
    // Generate or use existing voter ID
    const voterId = existingVoterId || generateVoterId();
    const isNewVoter = !existingVoterId;
    
    if (req.method === 'GET') {
      const { gameId, action } = req.query;
      
      if (action === 'my-ratings') {
        // Return user's ratings for a specific game
        const gameRatings = userRatings[gameId] || {};
        return res.status(200).json({ ratings: gameRatings });
      }
      
      if (action === 'leaderboard') {
        // Get overall player leaderboard (best and worst by average rating)
        const { gameId: leaderboardGameId } = req.query;
        
        const votesRef = getVotesCollection();
        let snapshot;
        
        // If gameId provided, get leaderboard for that game only
        if (leaderboardGameId) {
          snapshot = await votesRef.where('gameId', '==', leaderboardGameId).get();
        } else {
          snapshot = await votesRef.get();
        }
        
        // Aggregate ratings by player
        const playerStats = {};
        
        snapshot.docs.forEach(doc => {
          const vote = doc.data();
          
          // Skip votes from excluded games (test games) for overall leaderboard
          // Only apply this filter when calculating overall leaderboard (no specific gameId)
          if (!leaderboardGameId && EXCLUDED_GAME_IDS.includes(vote.gameId)) {
            return;
          }
          
          const playerId = vote.playerName;
          const rating = vote.rating || 0;
          
          if (!rating || rating < 1 || rating > 10) return;
          
          if (!playerStats[playerId]) {
            playerStats[playerId] = { 
              name: vote.playerName, 
              totalRating: 0,
              totalVotes: 0,
              avgRating: 0
            };
          }
          
          playerStats[playerId].totalRating += rating;
          playerStats[playerId].totalVotes++;
          playerStats[playerId].avgRating = playerStats[playerId].totalRating / playerStats[playerId].totalVotes;
        });
        
        const players = Object.values(playerStats);
        
        // Sort by average rating (high to low)
        const sortedByRating = [...players].sort((a, b) => b.avgRating - a.avgRating);
        
        // Best = top 5 highest ratings
        // Worst = bottom 5 lowest ratings
        const bestPlayers = sortedByRating.slice(0, 5);
        const worstPlayers = [...sortedByRating].reverse().slice(0, 5);
        
        return res.status(200).json({
          bestPlayers,
          worstPlayers,
          allPlayers: sortedByRating
        });
      }
      
      // Get ratings for a specific game
      if (!gameId) {
        return res.status(400).json({ message: 'gameId is required' });
      }
      
      const votesRef = getVotesCollection();
      const snapshot = await votesRef.where('gameId', '==', gameId).get();
      
      // Aggregate ratings by player
      const playerRatings = {};
      
      snapshot.docs.forEach(doc => {
        const vote = doc.data();
        const playerId = vote.playerName;
        const rating = vote.rating || 0;
        
        if (!rating || rating < 1 || rating > 10) return;
        
        if (!playerRatings[playerId]) {
          playerRatings[playerId] = { 
            name: vote.playerName,
            team: vote.team,
            totalRating: 0,
            totalVotes: 0,
            avgRating: 0
          };
        }
        
        playerRatings[playerId].totalRating += rating;
        playerRatings[playerId].totalVotes++;
        playerRatings[playerId].avgRating = playerRatings[playerId].totalRating / playerRatings[playerId].totalVotes;
      });
      
      // Get user's ratings for this game
      const myRatings = userRatings[gameId] || {};
      
      return res.status(200).json({ 
        ratings: Object.values(playerRatings),
        myRatings
      });
    }
    
    else if (req.method === 'POST') {
      // Submit a rating (1-10)
      const { gameId, playerName, team, rating } = req.body;
      
      if (!gameId || !playerName || !rating) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      const numRating = parseInt(rating, 10);
      if (isNaN(numRating) || numRating < 1 || numRating > 10) {
        return res.status(400).json({ message: 'Rating must be between 1 and 10' });
      }
      
      const votesRef = getVotesCollection();
      
      // Use voter ID (from cookie) so each browser session has unique ratings
      const voteId = `${gameId}_${playerName}_${voterId}`.replace(/[\/\s]/g, '_');
      
      await votesRef.doc(voteId).set({
        gameId,
        playerName,
        team: team || 'unknown',
        rating: numRating,
        voterId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      // Update user's ratings cookie
      if (!userRatings[gameId]) {
        userRatings[gameId] = {};
      }
      userRatings[gameId][playerName] = numRating;
      
      // Set cookies - include voter ID if new
      const cookies = [createRatingsCookie(userRatings)];
      if (isNewVoter) {
        cookies.push(createVoterIdCookie(voterId));
      }
      res.setHeader('Set-Cookie', cookies);
      
      return res.status(200).json({ 
        message: 'Rating recorded', 
        rating: { gameId, playerName, rating: numRating } 
      });
    }
    
    else if (req.method === 'DELETE') {
      // Remove a rating
      const { gameId, playerName } = req.body;
      
      if (!gameId || !playerName) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      const votesRef = getVotesCollection();
      const voteId = `${gameId}_${playerName}_${voterId}`.replace(/[\/\s]/g, '_');
      
      await votesRef.doc(voteId).delete();
      
      // Update user's ratings cookie
      if (userRatings[gameId]) {
        delete userRatings[gameId][playerName];
      }
      
      // Set cookies
      const cookies = [createRatingsCookie(userRatings)];
      if (isNewVoter) {
        cookies.push(createVoterIdCookie(voterId));
      }
      res.setHeader('Set-Cookie', cookies);
      
      return res.status(200).json({ message: 'Rating removed' });
    }
    
    else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('Votes API error:', error);
    return res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}
