import { getPaymentsCollection, getPlayersCollection } from "../../helpers/firestoreClient";

/**
 * Batch create/update multiple payment records at once
 * Uses Firestore batch writes for better performance
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { payments } = req.body;

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ message: 'Invalid payments data' });
    }

    const paymentsRef = getPaymentsCollection();
    const playersRef = getPlayersCollection();
    const db = paymentsRef.firestore;
    const batch = db.batch();

    // Get all player configs upfront for team assignment
    const playersSnapshot = await playersRef.get();
    const playerConfigMap = new Map();
    playersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      playerConfigMap.set(data.name, data);
    });

    const results = [];

    for (const payment of payments) {
      const id = payment.id || payment.date || Date.now().toString();
      const docRef = paymentsRef.doc(id.toString());

      // Get player config for default team
      const playerConfig = playerConfigMap.get(payment.name);
      const team = payment.teamOverridden ? payment.team : (playerConfig?.team || payment.team || 'white');

      const paymentData = {
        id: id.toString(),
        name: payment.name || '',
        money: payment.money || 7,
        date: id.toString(),
        paid: payment.paid || false,
        team: team,
        goalkeeper: payment.goalkeeper || false,
        teamOverridden: payment.teamOverridden || false,
      };

      batch.set(docRef, paymentData, { merge: true });
      results.push({ id: id.toString(), name: payment.name, status: 'queued' });
    }

    // Commit all writes in a single batch operation
    await batch.commit();

    console.log(`Batch created ${payments.length} payment records`);

    res.status(200).json({
      message: `Successfully added ${payments.length} records`,
      data: results
    });

  } catch (error) {
    console.error('Batch payment error:', error);
    res.status(500).json({
      message: 'Error creating batch payments',
      error: error.message
    });
  }
}
