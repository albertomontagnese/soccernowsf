import {
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  FormLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

// Load players from config file
export const loadPlayersFromConfig = async () => {
  try {
    const response = await fetch('/api/playerConfig');
    const data = await response.json();
    return data.players || [];
  } catch (error) {
    console.error('Error loading players from config:', error);
    return fallbackPlayers;
  }
};

// Fallback players array (kept for compatibility)
const fallbackPlayers = [
  {
    name: "Theo Guenais",
    venmoFullName: "Theo Guenais",
    phoneNumber: "",
    whatsAppName: "Theo Guenais",
    team: "dark",
    goalkeeper: false,
    paid: false,
    rating: 7.5,
    position: "midfielder"
  },
  {
    name: "Edward Okey",
    venmoFullName: "Edward Okey",
    phoneNumber: "",
    whatsAppName: "Edward Okey",
    team: "dark",
    goalkeeper: false,
    paid: false,
    rating: 6.8,
    position: "defender"
  },
  {
    name: "Mike Ng",
    venmoFullName: "Mike Ng",
    phoneNumber: "",
    whatsAppName: "Mike Ng",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Domenico Geria",
    venmoFullName: "Domenico Geria",
    phoneNumber: "",
    whatsAppName: "Domenico Geria",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Antonino Raviele",
    venmoFullName: "Antonino Raviele",
    phoneNumber: "",
    whatsAppName: "Antonino Raviele",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Lucas Ramadan",
    venmoFullName: "Lucas Ramadan",
    phoneNumber: "",
    whatsAppName: "Lucas Ramadan",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Nick Susac",
    venmoFullName: "Nick Susac",
    phoneNumber: "",
    whatsAppName: "Nick Susac",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Austen Zhu",
    venmoFullName: "Austen Zhu",
    phoneNumber: "",
    whatsAppName: "Austen",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Andrea Ciccardi",
    venmoFullName: "Andrea Ciccardi",
    phoneNumber: "",
    whatsAppName: "Andrea Ciccardi",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Riccardo Giraldi",
    venmoFullName: "Riccardo Giraldi",
    phoneNumber: "",
    whatsAppName: "Riccardo Giraldi",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Meghdad Abbaszadegan",
    venmoFullName: "Meghdad Abbaszadegan",
    phoneNumber: "",
    whatsAppName: "Meghdad Abbaszadegan",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Sean Tao",
    venmoFullName: "Sean Tao",
    phoneNumber: "",
    whatsAppName: "Sean Tao",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Corina Benavides",
    venmoFullName: "Corina Benavides",
    phoneNumber: "",
    whatsAppName: "Corina Benavides",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Wilmer Baron",
    venmoFullName: "Wilmer Baron",
    phoneNumber: "",
    whatsAppName: "Wilmer Baron",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Maceo Inocencio",
    venmoFullName: "Maceo Inocencio",
    phoneNumber: "",
    whatsAppName: "Maceo Inocencio",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Alex Kaveh Senemar",
    venmoFullName: "Alex Kaveh Senemar",
    phoneNumber: "",
    whatsAppName: "Alex Kaveh Senemar",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Nicolas Mesa",
    venmoFullName: "Nicolas Mesa",
    phoneNumber: "",
    whatsAppName: "Nicolas Mesa",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Alberto Monta",
    venmoFullName: "Alberto Monta",
    phoneNumber: "",
    whatsAppName: "Alberto Monta",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Gavin Jay",
    venmoFullName: "Gavin Jay",
    phoneNumber: "",
    whatsAppName: "Gavin Jay",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Gabe",
    venmoFullName: "Gabe",
    phoneNumber: "",
    whatsAppName: "Gabe",
    team: "white",
    goalkeeper: true,
    paid: true,
  },
  {
    name: "Carson",
    venmoFullName: "Carson",
    phoneNumber: "",
    whatsAppName: "Carson",
    team: "white",
    goalkeeper: true,
    paid: true,
  },
  {
    name: "Brian",
    venmoFullName: "Brian",
    phoneNumber: "",
    whatsAppName: "Brian",
    team: "white",
    goalkeeper: true,
    paid: true,
  },
  {
    name: "Skinner",
    venmoFullName: "Gabe",
    phoneNumber: "",
    whatsAppName: "Gabe",
    team: "white",
    goalkeeper: true,
    paid: true,
  },
  {
    name: "Sebastian Riano",
    venmoFullName: "Sebastian Riano",
    phoneNumber: "",
    whatsAppName: "Sebastian Riano",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Diego Canales",
    venmoFullName: "Diego Canales",
    phoneNumber: "",
    whatsAppName: "Diego Canales",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Eduardo Portet",
    venmoFullName: "Eduardo Portet",
    phoneNumber: "",
    whatsAppName: "Eduardo Portet Soccer",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Francesco Di Lauro",
    venmoFullName: "Francesco Di Lauro",
    phoneNumber: "",
    whatsAppName: "Francesco Di Lauro",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "David Udo-Imeh",
    venmoFullName: "David Udo-Imeh",
    phoneNumber: "",
    whatsAppName: "David Udo-Imeh",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Temi Adetunji",
    venmoFullName: "Temi Adetunji",
    phoneNumber: "",
    whatsAppName: "Temi Adetunji",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Benjamin Lopategui",
    venmoFullName: "Benjamin Lopategui",
    phoneNumber: "",
    whatsAppName: "Benjamin Lopategui",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Matteo Del Mastro",
    venmoFullName: "Matteo Del Mastro",
    phoneNumber: "",
    whatsAppName: "Matteo",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Christian Morales",
    venmoFullName: "Christian Morales",
    phoneNumber: "",
    whatsAppName: "Christian Morales",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Michael Alexanian",
    venmoFullName: "Michael Alexanian",
    phoneNumber: "",
    whatsAppName: "MichaeL Alexanian",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Onur Bildik",
    venmoFullName: "Onur Bildik",
    phoneNumber: "",
    whatsAppName: "Onur Bildik",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Kosidichinma Emmanuel-Anyim",
    venmoFullName: "Kosidichinma Emmanuel-Anyim",
    phoneNumber: "",
    whatsAppName: "Kosidichinma Emmanuel-Anyim",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Henar Urteaga Juangarcia",
    venmoFullName: "Henar Urteaga Juangarcia",
    phoneNumber: "",
    whatsAppName: "Henar Urteaga Juangarcia",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Henri Thunberg",
    venmoFullName: "Henri Thunberg",
    phoneNumber: "",
    whatsAppName: "Henri Thunberg",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Tahj Atkinson",
    venmoFullName: "Tahj Atkinson",
    phoneNumber: "",
    whatsAppName: "Tahj Atkinson",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Ramone Doyley",
    venmoFullName: "Ramone Doyley",
    phoneNumber: "",
    whatsAppName: "Ramone Doyley",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Boston Nyer",
    venmoFullName: "Boston Nyer",
    phoneNumber: "",
    whatsAppName: "Boston Nyer",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Kerim Ozbey",
    venmoFullName: "Kerim Ozbey",
    phoneNumber: "",
    whatsAppName: "Kerim Ozbey",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Carlos Cobo",
    venmoFullName: "Carlos Cobo",
    phoneNumber: "",
    whatsAppName: "Carlos Cobo",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Eric Sassano",
    venmoFullName: "Eric Sassano",
    phoneNumber: "",
    whatsAppName: "Eric Sassano",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Babak Bafandeh",
    venmoFullName: "Babak Bafandeh",
    phoneNumber: "",
    whatsAppName: "Babak Bafandeh",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Bobby Howie",
    venmoFullName: "Bobby Howie",
    phoneNumber: "",
    whatsAppName: "Bobby Howie",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Chase Bishov",
    venmoFullName: "Chase Bishov",
    phoneNumber: "",
    whatsAppName: "Chase Bishov",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Adam Proschek",
    venmoFullName: "Adam Proschek",
    phoneNumber: "",
    whatsAppName: "Adam Proschek",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Juan Mendez Portet",
    venmoFullName: "Juan Mendez Portet",
    phoneNumber: "",
    whatsAppName: "Juan Manuel",
    team: "white",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Terence Le Huu Phuong",
    venmoFullName: "Terence Le Huu Phuong",
    phoneNumber: "",
    whatsAppName: "Terence Le Huu Phuong",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
  {
    name: "Julio Martinez Ballester",
    venmoFullName: "Julio Martinez Ballester",
    phoneNumber: "",
    whatsAppName: "Julio Martinez Ballester",
    team: "dark",
    goalkeeper: false,
    paid: false,
  },
];

// Export allPlayers for backward compatibility, but recommend using loadPlayersFromConfig
export const allPlayers = fallbackPlayers;

export const basePlayers = [
  {
    name: "Alberto",
    money: 7,
    date: new Date(Date.now() + 10000), // Add 10 seconds
    paid: true,
    team: "white",
    goalkeeper: false,
  },
  {
    name: "Gavin",
    money: 7,
    date: new Date(Date.now() + 20000), // Add 20 seconds
    paid: true,
    team: "white",
    goalkeeper: false,
  },
  // {
  //   name: "Andrea",
  //   money: 7,
  //   date: new Date(Date.now() + 30000), // Add 30 seconds
  //   paid: true,
  //   team: "white",
  //   goalkeeper: false,
  // },
  {
    name: "Skinner",
    money: 7,
    date: new Date(Date.now() + 40000), // Add 40 seconds
    paid: true,
    team: "dark",
    goalkeeper: true,
  },
  {
    name: "Gabe",
    money: 7,
    date: new Date(Date.now() + 50000), // Add 50 seconds
    paid: true,
    team: "white",
    goalkeeper: true,
  },
];
export function timestampToReadableDate(timestamp, isEditMode) {
  const date = new Date(parseInt(timestamp)); // Parse the timestamp as an integer
  if (!isNaN(date)) {
    // Check if the date is valid
    const opt = isEditMode
      ? {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
        }
      : {
          month: "numeric",
          day: "numeric",
        };
    const dateString = date.toLocaleDateString("en-US", opt);
    return dateString;
  } else {
    return "Invalid date";
  }
}

export function Recap({ payments, darkTeam, whiteTeam }) {
  // Add null/undefined checks for all arrays
  const safePayments = payments || [];
  const safeDarkTeam = darkTeam || [];
  const safeWhiteTeam = whiteTeam || [];
  
  const unpaidWhite = safeWhiteTeam.filter(
    (payment) => payment.team === "white" && !payment.paid
  );
  const unpaidDark = safeDarkTeam.filter(
    (payment) => payment.team === "dark" && !payment.paid
  );
  const allUnpaid = unpaidWhite.concat(unpaidDark);
  const formatUnpaidPlayers = (unpaid) =>
    unpaid
      .map((player) => {
        const matchingPlayer = allPlayers.find((p) => p.name === player.name);
        return matchingPlayer ? `@${matchingPlayer.whatsAppName}` : player.name;
      })
      .join(", ");

  return (
    <>
      <div className="recap">
        {safePayments.filter((payment) => payment.team === "white").length >= 8 ? (
          <p>
            <span role="img" aria-label="checkmark">
              ✅
            </span>{" "}
            White team is complete
          </p>
        ) : (
          <p>
            <span role="img" aria-label="crossmark">
              ❌
            </span>{" "}
            White is missing{" "}
            <strong>
              {8 -
                safePayments.filter((payment) => payment.team === "white").length}
            </strong>{" "}
            player(s)
          </p>
        )}
      </div>
      <div className="recap">
        {safePayments.filter((payment) => payment.team === "dark").length >= 8 ? (
          <p>
            <span role="img" aria-label="checkmark">
              ✅
            </span>{" "}
            Dark team is complete
          </p>
        ) : (
          <p>
            <span role="img" aria-label="crossmark">
              ❌
            </span>{" "}
            Dark is missing{" "}
            <strong>
              {8 - safePayments.filter((payment) => payment.team === "dark").length}
            </strong>{" "}
            player(s)
          </p>
        )}
      </div>
      <div className="recap">
        {safePayments.filter((payment) => payment.goalkeeper).length === 2 ? (
          <p>
            <span role="img" aria-label="checkmark">
              ✅
            </span>{" "}
            We have 2 goalkeepers
          </p>
        ) : (
          <p>
            <span role="img" aria-label="crossmark">
              ❌
            </span>{" "}
            We're missing{" "}
            <strong>
              {2 - safePayments.filter((payment) => payment.goalkeeper).length}
            </strong>{" "}
            goalkeeper(s)
          </p>
        )}
      </div>
      {/* Unpaid players check for White team */}
      <div className="recap">
        {allUnpaid.length > 0 ? (
          <p>
            <span role="img" aria-label="crossmark">
              ❌
            </span>{" "}
            Missing venmos from:{" "}
            <span style={{ color: "red", fontWeight: "bold" }}>
              {formatUnpaidPlayers(allUnpaid)}
            </span>
            , $7 ${`-> `}
            <a
              href="https://venmo.com/albertom1?txn=pay&note=soccerThu&amount=7.00"
              style={{ color: "blue" }}
            >
              https://venmo.com/albertom1?txn=pay&note=soccerThu&amount=7.00
            </a>{" "}
            to confirm your spot
          </p>
        ) : (
          <p>
            <span role="img" aria-label="checkmark">
              ✅
            </span>{" "}
            All players confirmed
          </p>
        )}
      </div>
    </>
  );
}

export function renderTableRows(
  payments,
  isEditMode,
  editingId,
  record,
  handleInputChange,
  setRecord,
  allPlayers,
  handleSaveEdit,
  handleCancelEdit,
  handleEdit,
  handleDelete,
  isSmallDevice,
  handleInlineUpdate
) {
  // Add null/undefined check for payments array
  if (!payments || !Array.isArray(payments)) {
    console.warn('renderTableRows: payments is not a valid array:', payments);
    return [];
  }

  return payments.map((payment, idx) => {
    const curId =
      payment.team === "white"
        ? idx + 1
        : idx +
          1 -
          payments.filter((payment) => payment.team === "white").length;
    return (
      <TableRow
        key={payment.id}
        className={`${payment.team !== "white" ? "dark-team" : ""} ${
          !payment.paid ? "not-paid" : ""
        } ${"cur-id-" + curId}`}
      >
        {isEditMode && !editingId && (
          <TableCell>
            {isSmallDevice ? (
              <div>{payment.id?.toString().slice(-2) || 'N/A'}</div>
            ) : (
              <div>{payment.id?.toString() || 'N/A'}</div>
            )}
          </TableCell>
        )}
        {isEditMode && !editingId && (
          <TableCell>
            {isSmallDevice ? (
              <div></div>
            ) : (
              <div>{payment.id ? timestampToReadableDate(payment.id, isEditMode) : 'N/A'}</div>
            )}
          </TableCell>
        )}
        <TableCell>
          {editingId === payment.id ? (
            <Autocomplete
              value={record.name}
              onChange={(event, newValue) => {
                if (!newValue) {
                  newValue = "";
                }
                setRecord((prevRecord) => ({
                  ...prevRecord,
                  name:
                    typeof newValue === "string" ? newValue : newValue?.name,
                }));
              }}
              options={allPlayers}
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option?.name
              }
              onInputChange={(event, newValue) => {
                if (!newValue) {
                  newValue = "";
                }
                setRecord((prevRecord) => ({
                  ...prevRecord,
                  name:
                    typeof newValue === "string" ? newValue : newValue?.name,
                }));
              }}
              inputValue={record?.name}
              freeSolo
              renderInput={(params) => (
                <TextField {...params} variant="outlined" />
              )}
            />
          ) : (
            `${idx + 1}) ${payment.goalkeeper ? "🧤" : ""} ${payment.name}`
          )}
        </TableCell>
        {isEditMode && !editingId && (
          <TableCell>
            {editingId === payment.id ? (
              <TextField
                name="money"
                type="number"
                value={record.money}
                onChange={handleInputChange}
              />
            ) : (
              `${payment.money.toFixed(0)}`
            )}
          </TableCell>
        )}
        <TableCell>
          {editingId === payment.id ? (
            <Checkbox
              name="paid"
              checked={record.paid}
              onChange={handleInputChange}
            />
          ) : isEditMode ? (
            <Checkbox
              checked={payment.paid}
              onChange={(e) => handleInlineUpdate(payment.id, 'paid', e.target.checked)}
            />
          ) : payment.paid ? (
            "✅"
          ) : (
            ""
          )}
        </TableCell>
        <TableCell>
          {editingId === payment.id ? (
            <FormControl>
              <InputLabel id="team-label">Team</InputLabel>
              <Select
                labelId="team-label"
                name="team"
                value={record.team}
                onChange={handleInputChange}
              >
                <MenuItem value="white">🏳️</MenuItem>
                <MenuItem value="dark">🏴</MenuItem>
              </Select>
            </FormControl>
          ) : isEditMode ? (
            <Button
              onClick={() => handleInlineUpdate(payment.id, 'team', payment.team === 'white' ? 'dark' : 'white')}
              style={{ minWidth: '60px' }}
            >
              {payment.team === "white" ? "🏳️" : "🏴"}
            </Button>
          ) : payment.team === "white" ? (
            `🏳️  ${payment.team}`
          ) : (
            `🏴 dark`
          )}
        </TableCell>
        {isEditMode && (
          <TableCell>
            {editingId === payment.id ? (
              <FormControl component="fieldset">
                <FormLabel component="legend">GK</FormLabel>
                <RadioGroup
                  name="goalkeeper"
                  value={record?.goalkeeper?.toString()}
                  onChange={handleInputChange}
                >
                  <FormControlLabel value="true" control={<Radio />} label="Y" />
                  <FormControlLabel value="false" control={<Radio />} label="N" />
                </RadioGroup>
              </FormControl>
            ) : (
              <Checkbox
                checked={payment.goalkeeper}
                onChange={(e) => handleInlineUpdate(payment.id, 'goalkeeper', e.target.checked)}
              />
            )}
          </TableCell>
        )}
        {isEditMode && (
          <TableCell>
            {editingId === payment.id ? (
              <>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveEdit}
                  className="mr-2 mb-4 w-full sm:w-auto"
                >
                  Save
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCancelEdit}
                  className="mr-2 mb-4 w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleEdit(payment.id)}
                >
                  Edit
                </Button>
                <Button
                  color="secondary"
                  onClick={() => handleDelete(payment.id)}
                >
                  <DeleteIcon />
                </Button>
              </>
            )}
          </TableCell>
        )}
      </TableRow>
    );
  });
}
