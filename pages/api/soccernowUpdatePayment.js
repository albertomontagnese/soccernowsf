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

function getCurrentCycleWindowUtc() {
  const now = new Date();
  const ptFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false
  });
  const ptParts = ptFormatter.formatToParts(now);
  const getPart = (type) => ptParts.find((p) => p.type === type)?.value;

  const ptYear = parseInt(getPart('year'), 10);
  const ptMonth = parseInt(getPart('month'), 10) - 1;
  const ptDay = parseInt(getPart('day'), 10);
  const ptHour = parseInt(getPart('hour'), 10);
  const todayInPT = new Date(ptYear, ptMonth, ptDay, ptHour, 0, 0, 0);
  const currentDayOfWeek = todayInPT.getDay();

  let daysToTargetThursday;
  if (currentDayOfWeek >= 5 || currentDayOfWeek === 0) {
    daysToTargetThursday = currentDayOfWeek === 5 ? 6 : currentDayOfWeek === 6 ? 5 : 4;
  } else {
    daysToTargetThursday = 4 - currentDayOfWeek;
  }

  const thursdayPT = new Date(ptYear, ptMonth, ptDay + daysToTargetThursday);
  const fridayPT = new Date(thursdayPT);
  fridayPT.setDate(thursdayPT.getDate() - 6);

  const PST_OFFSET_HOURS = 8;
  const cycleStartUtc = Date.UTC(
    fridayPT.getFullYear(),
    fridayPT.getMonth(),
    fridayPT.getDate(),
    PST_OFFSET_HOURS,
    1,
    0,
    0
  );
  const cycleEndUtc = Date.UTC(
    thursdayPT.getFullYear(),
    thursdayPT.getMonth(),
    thursdayPT.getDate(),
    23 + PST_OFFSET_HOURS,
    59,
    59,
    999
  );

  return { cycleStartUtc, cycleEndUtc };
}

export default async function updateUser(req, res) {
  try {
    let { id, name, money, date, paid, team, goalkeeper, teamOverridden, manualWaitlist } = req.body;
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
    let hasExistingRecord = false;
    const paymentsRef = getPaymentsCollection();
    const playersRef = getPlayersCollection();

    try {
      console.log("fetching user with id" + newId);

      // Try to get existing record by document ID first
      const docRef = paymentsRef.doc(newId.toString());
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        existingRecord = { id: docSnap.id, ...docSnap.data() };
        hasExistingRecord = true;
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
      const nowIso = new Date().toISOString();
      const nowTs = Date.now().toString();
      const existingPaid = Boolean(existingRecord?.paid);
      const incomingPaid = Boolean(paid);
      const resolvedManualWaitlist =
        manualWaitlist === undefined
          ? Boolean(existingRecord?.manualWaitlist)
          : Boolean(manualWaitlist);

      // Keep immutable creation ordering so manual edits do not affect queue order.
      const createdAt = existingRecord?.createdAt || date || newId || nowTs;

      // paidAt tracks when player entered the paid queue (first transition to paid=true).
      let paidAt = existingRecord?.paidAt || null;
      if (incomingPaid) {
        if (!existingPaid) {
          paidAt = nowTs;
        } else if (!paidAt) {
          paidAt = existingRecord?.date || newId || nowTs;
        }
      } else {
        paidAt = null;
      }

      const updatedUserData = {
        id: newId,
        name: name,
        money: money,
        date: date,
        paid: incomingPaid,
        team: team,
        goalkeeper: Boolean(goalkeeper),
        teamOverridden: teamOverridden,
        manualWaitlist: resolvedManualWaitlist,
        createdAt,
        paidAt,
        lastEditedAt: nowIso,
        createdByApiAt: existingRecord?.createdByApiAt || nowIso,
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

      // Auto-balance new players across teams unless explicitly overridden.
      // Rule:
      // - If one team already has >=8 and the other has <8, force new player to the other team.
      // - If both teams are full (>=8), keep assignment and let waitlist logic handle overflow.
      if (!hasExistingRecord && !teamOverridden) {
        try {
          const { cycleStartUtc, cycleEndUtc } = getCurrentCycleWindowUtc();
          const cycleSnapshot = await paymentsRef.where('money', '==', 7).get();
          const cycleItems = cycleSnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((item) => {
              const ts = parseInt(item.date || "0", 10);
              return ts >= cycleStartUtc && ts <= cycleEndUtc;
            });

          const groupedByName = cycleItems.reduce((acc, item) => {
            acc[item.name] = acc[item.name] || [];
            acc[item.name].push(item);
            return acc;
          }, {});

          const mergedCycle = Object.values(groupedByName).map((group) => {
            const sortedGroup = [...group].sort(
              (a, b) => parseInt(b.date || "0", 10) - parseInt(a.date || "0", 10)
            );
            return sortedGroup.find((item) => item.paid) || sortedGroup[0];
          });

          const whiteCount = mergedCycle.filter((item) => item.team === "white").length;
          const darkCount = mergedCycle.filter((item) => item.team === "dark").length;

          let autoAssignedTeam = finalUpdatedUserData.team || "dark";
          if (whiteCount >= 8 && darkCount < 8) {
            autoAssignedTeam = "dark";
          } else if (darkCount >= 8 && whiteCount < 8) {
            autoAssignedTeam = "white";
          }

          finalUpdatedUserData = {
            ...finalUpdatedUserData,
            team: autoAssignedTeam,
          };

          console.log(
            `Auto-balance assignment for ${name}: white=${whiteCount}, dark=${darkCount}, assigned=${autoAssignedTeam}`
          );
        } catch (balanceError) {
          console.error("Error auto-balancing team assignment:", balanceError);
        }
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
