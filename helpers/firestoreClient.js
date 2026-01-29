import { Firestore } from '@google-cloud/firestore';

let firestoreClient = null;

/**
 * Get or create a Firestore client singleton
 * Uses the 'soccernow' database in the 'liftmeapp-prod' project
 */
export function getFirestore() {
  if (firestoreClient) {
    return firestoreClient;
  }

  // Configuration for Firestore
  const config = {
    projectId: 'liftmeapp-prod',
    databaseId: 'soccernow',
  };

  // In production (Vercel), use GOOGLE_CREDENTIALS environment variable
  // which should contain the service account JSON as a string
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      config.credentials = credentials;
    } catch (e) {
      console.error('Failed to parse GOOGLE_CREDENTIALS:', e.message);
    }
  }
  // In development, rely on GOOGLE_APPLICATION_CREDENTIALS env var
  // which points to a service account JSON file path

  firestoreClient = new Firestore(config);
  console.log('Firestore client initialized for project:', config.projectId, 'database:', config.databaseId);
  
  return firestoreClient;
}

/**
 * Get the payments collection reference
 */
export function getPaymentsCollection() {
  return getFirestore().collection('payments');
}

/**
 * Get the players collection reference
 */
export function getPlayersCollection() {
  return getFirestore().collection('players');
}

/**
 * Get the games collection reference (for historical games)
 */
export function getGamesCollection() {
  return getFirestore().collection('games');
}

/**
 * Get the votes collection reference (for player votes)
 */
export function getVotesCollection() {
  return getFirestore().collection('votes');
}

/**
 * Get the comments collection reference (for game comments)
 */
export function getCommentsCollection() {
  return getFirestore().collection('comments');
}

// Export for backward compatibility with existing code patterns
export { firestoreClient };
