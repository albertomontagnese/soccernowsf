import { getCommentsCollection } from "../../helpers/firestoreClient";

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { gameId } = req.query;
      
      if (!gameId) {
        return res.status(400).json({ message: 'gameId is required' });
      }
      
      const commentsRef = getCommentsCollection();
      const snapshot = await commentsRef
        .where('gameId', '==', gameId)
        .limit(50)
        .get();
      
      // Sort in memory to avoid needing a composite index
      const comments = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return res.status(200).json({ comments });
    }
    
    else if (req.method === 'POST') {
      const { gameId, authorName, content } = req.body;
      
      if (!gameId || !authorName || !content) {
        return res.status(400).json({ message: 'Missing required fields (gameId, authorName, content)' });
      }
      
      // Validate input lengths
      if (authorName.length > 50) {
        return res.status(400).json({ message: 'Name must be 50 characters or less' });
      }
      
      if (content.length > 500) {
        return res.status(400).json({ message: 'Comment must be 500 characters or less' });
      }
      
      // Basic sanitization
      const sanitizedName = authorName.trim();
      const sanitizedContent = content.trim();
      
      if (sanitizedName.length === 0 || sanitizedContent.length === 0) {
        return res.status(400).json({ message: 'Name and comment cannot be empty' });
      }
      
      const commentsRef = getCommentsCollection();
      
      const commentData = {
        gameId,
        authorName: sanitizedName,
        content: sanitizedContent,
        createdAt: new Date().toISOString()
      };
      
      const docRef = await commentsRef.add(commentData);
      
      return res.status(200).json({ 
        message: 'Comment added', 
        comment: { id: docRef.id, ...commentData } 
      });
    }
    
    else if (req.method === 'DELETE') {
      // Admin only - delete a comment
      const { commentId } = req.body;
      
      if (!commentId) {
        return res.status(400).json({ message: 'commentId is required' });
      }
      
      // TODO: Add authentication check for admin
      
      const commentsRef = getCommentsCollection();
      await commentsRef.doc(commentId).delete();
      
      return res.status(200).json({ message: 'Comment deleted' });
    }
    
    else if (req.method === 'PATCH') {
      // Migrate comments from one game ID to another
      const { fromGameId, toGameId } = req.body;
      
      if (!fromGameId || !toGameId) {
        return res.status(400).json({ message: 'fromGameId and toGameId are required' });
      }
      
      const commentsRef = getCommentsCollection();
      const snapshot = await commentsRef.where('gameId', '==', fromGameId).get();
      
      if (snapshot.empty) {
        return res.status(400).json({ message: `No comments found for game ${fromGameId}` });
      }
      
      let migratedCount = 0;
      for (const doc of snapshot.docs) {
        await commentsRef.doc(doc.id).update({
          gameId: toGameId,
          migratedFrom: fromGameId,
          migratedAt: new Date().toISOString()
        });
        migratedCount++;
      }
      
      return res.status(200).json({ 
        message: `Migrated ${migratedCount} comments from ${fromGameId} to ${toGameId}` 
      });
    }
    
    else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE', 'PATCH']);
      return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('Comments API error:', error);
    return res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message,
      stack: error.stack
    });
  }
}
