import { getPaymentsCollection, getPlayersCollection } from "../../helpers/firestoreClient";
import { autoPopulatePlayerData } from "../../helpers/playerAutoPopulation";

function dateToTimestamp(dateString) {
  const timestamp = Date.parse(dateString);

  if (!isNaN(timestamp)) {
    // If Date.parse successfully converted the string to a timestamp
    return timestamp.toString();
  } else {
    // If Date.parse couldn't parse the string, try to convert it using a specific format
    const parsedDate = new Date(dateString);

    if (!isNaN(parsedDate)) {
      return parsedDate.getTime().toString();
    } else {
      // If all conversion attempts failed, return null or any other default value
      return Date.now().toString();
    }
  }
}

export default async function updateUser(req, res) {
  try {
    let { id, name, money, date, paid, team, goalkeeper, teamOverridden } = req.body;
    // for any of this if it's undefined make it = "". paid make it false

    const newId = id ? id : dateToTimestamp(date);
    date = newId;
    if (name === undefined) {
      name = "";
    }
    if (money === undefined) {
      money = 0.0;
    }
    if (date === undefined) {
      date = "";
    }
    if (paid === undefined) {
      paid = false;
    }
    if (team === undefined) {
      team = "dark"; // Default to dark team
    }
    if (goalkeeper === undefined) {
      goalkeeper = false;
    }
    if (teamOverridden === undefined) {
      teamOverridden = false;
    }

    let existingRecord = {};
    const paymentsRef = getPaymentsCollection();
    const playersRef = getPlayersCollection();

    try {
      console.log("fetching user with id" + newId);

      // Try to get existing record by document ID first
      const docRef = paymentsRef.doc(newId.toString());
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        existingRecord = { id: docSnap.id, ...docSnap.data() };
      } else {
        console.log("No existing record found");
      }
    } catch (err) {
      console.log("Error", err.stack);
      res.status(500).json({ message: "Error fetching data", error: err });
      return;
    }
    try {
      // Modify the user data
      const updatedUserData = {
        id: newId,
        name: name,
        money: money,
        date: date,
        paid: paid,
        team: team,
        goalkeeper: goalkeeper,
        teamOverridden: teamOverridden,
      };

      console.log("data to be stored");
      console.log(updatedUserData);

      // First, check if player exists in config to get their preferred team/rating
      let finalUpdatedUserData = updatedUserData;
      
      try {
        console.log(`Checking player config for: ${name}`);
        
        // Get player config data from Firestore
        const playerSnapshot = await playersRef.where('name', '==', name).get();
        
        if (!playerSnapshot.empty) {
          // Player exists in config
          const playerConfig = playerSnapshot.docs[0].data();
          
          // Only use playerConfig team if this is NOT a manual override
          if (!teamOverridden) {
            console.log(`Found player config for ${name}, using their preferred team: ${playerConfig.team}`);
            finalUpdatedUserData = {
              ...updatedUserData,
              team: playerConfig.team || updatedUserData.team,
            };
          } else {
            console.log(`Team override detected for ${name}, keeping manual assignment: ${team}`);
            // Keep the manual team assignment and mark as overridden
            finalUpdatedUserData = {
              ...updatedUserData,
              teamOverridden: true,
            };
          }
        } else {
          // Player doesn't exist in config - will auto-create profile after payment is saved
          console.log(`Player ${name} not found in config, will auto-create profile`);
        }
      } catch (playerError) {
        console.error('Error checking player config:', playerError);
        // Continue with original data if config check fails
      }

      // Merge existing record with updated data
      const finalData = { ...existingRecord, ...finalUpdatedUserData };

      try {
        // Save to Firestore using document ID
        await paymentsRef.doc(newId.toString()).set(finalData, { merge: true });
        console.log('Payment record saved with config data');

        // Auto-create player profile only if this is a new player (not in config)
        try {
          const playerSnapshot = await playersRef.where('name', '==', name).get();

          if (playerSnapshot.empty) {
            console.log(`Auto-populating player data for new player: ${name}`);
            const playerProfile = await autoPopulatePlayerData(name, name);
            console.log(`Player profile created:`, playerProfile);
          }
        } catch (playerError) {
          console.error('Error auto-populating player data:', playerError);
          // Don't fail the payment if player creation fails
        }

        res
          .status(200)
          .json({ message: "Data updated successfully", data: finalData });
      } catch (err) {
        console.log("Error", err.stack);
        res.status(500).json({ message: "Error updating data", error: err });
      }
    } catch (err) {
      console.log("Error", err.stack);
      res.status(500).json({ message: "Error fetching data", error: err });
    }
  } catch (err) {
    console.log("Error", err.stack);
    res.status(500).json({ message: "Internal server error", error: err });
  }
}
