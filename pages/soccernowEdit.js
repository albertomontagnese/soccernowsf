import React, { useState, useEffect } from "react";
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
import {
  allPlayers,
  loadPlayersFromConfig,
  timestampToReadableDate,
  Recap,
  basePlayers,
  renderTableRows,
} from "../helpers/playerData";
import { noCacheHeaders } from "../helpers/misc";

const HARDCODED_USERNAME = "alberto";
const HARDCODED_PASSWORD = "ForzaJuve+";

function EditSoccerNow({ isEditMode = true }) {
  const [isSmallDevice, setIsSmallDevice] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [record, setRecord] = useState({
    id: "",
    name: "",
    money: 0,
    date: "",
    paid: false,
    team: "dark", // Default to dark team
    goalkeeper: false,
  });
  const [payments, setPayments] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [openAddModal, setOpenAddModal] = useState(false);
  const [whiteTeam, setWhiteTeam] = useState([]);
  const [darkTeam, setDarkTeam] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [dynamicPlayers, setDynamicPlayers] = useState(allPlayers);
  const [isAutoPrefilled, setIsAutoPrefilled] = useState(false);

  useEffect(() => {
    const checkDeviceSize = () => {
      const screenWidth = window.innerWidth;
      setIsSmallDevice(screenWidth < 640);
    };

    checkDeviceSize();
    window.addEventListener("resize", checkDeviceSize);

    return () => window.removeEventListener("resize", checkDeviceSize);
  }, []);

  useEffect(() => {
    if (isAuthenticated || !isEditMode) {
      fetchPaymentsData();
      loadDynamicPlayers();
    }
  }, [isAuthenticated, isEditMode]);

  const loadDynamicPlayers = async () => {
    try {
      const players = await loadPlayersFromConfig();
      setDynamicPlayers(players);
    } catch (error) {
      console.error('Error loading dynamic players:', error);
      // Keep fallback players if loading fails
    }
  };

  const fetchPaymentsData = async () => {
    try {
      const response = await fetch(
        "/api/soccernowAllPayments?_=" + new Date().getTime(),
        {
          method: "GET",
          headers: noCacheHeaders,
          cache: "no-cache",
        }
      );

      const data = await response.json();

      setPayments(data.data);
      setWhiteTeam(data.whiteTeam);
      setDarkTeam(data.darkTeam);
      setWaitlist(data.waitlist);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleEdit = (id) => {
    const editedRecord = payments.find((payment) => payment.id === id);
    setRecord({ ...editedRecord, originalTeam: editedRecord.team });
    setEditingId(id);
  };

  const handleCancelEdit = () => {
    setRecord({
      id: "",
      name: "",
      money: 0,
      date: "",
      paid: false,
      team: "dark",
      goalkeeper: false,
    });
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    let updatedRecord = { ...record };
    
    // If team was changed in the edit modal, mark as overridden
    if (record.originalTeam && record.team !== record.originalTeam) {
      updatedRecord.teamOverridden = true;
      console.log(`Manual team change in edit modal for ${record.name}: ${record.originalTeam} -> ${record.team}`);
    }
    
    // Remove the temporary originalTeam field before saving
    delete updatedRecord.originalTeam;
    
    const response = await fetch("/api/soccernowUpdatePayment", {
      method: "PUT",
      body: JSON.stringify(updatedRecord),
      headers: noCacheHeaders,
      cache: "no-cache",
    });

    if (response.ok) {
      console.log("Record updated successfully");
      fetchPaymentsData();
      setRecord({
        id: "",
        name: "",
        money: 0,
        date: "",
        paid: false,
        team: "dark",
        goalkeeper: false,
      });
      setEditingId(null);
    } else {
      console.error("Error updating record");
    }
  };

  const handleAddRecord = async () => {
    setOpenAddModal(true);
  };

  const handleAddBaseRecords = async () => {
    let players = basePlayers;

    players = players.map((player) => ({
      ...player,
      date: player.date.getTime(),
    }));

    try {
      // Use batch endpoint for faster bulk inserts
      const response = await fetch("/api/soccernowBatchPayments", {
        method: "POST",
        body: JSON.stringify({ payments: players }),
        headers: noCacheHeaders,
        cache: "no-cache",
      });

      if (response.ok) {
        console.log(`All ${players.length} base records added successfully`);
        fetchPaymentsData();
      } else {
        console.error("Error adding base records:", await response.text());
      }
    } catch (error) {
      console.error("Error adding base records:", error);
    }
  };

  const handleResetToDefaultTeams = async () => {
    if (!confirm("Reset all team assignments to player config defaults? This will remove manual overrides.")) {
      return;
    }
    
    try {
      for (const payment of payments) {
        // Reset teamOverridden to false to trigger default team assignment
        const resetPayment = { 
          ...payment, 
          teamOverridden: false 
        };
        
        const response = await fetch("/api/soccernowUpdatePayment", {
          method: "PUT",
          body: JSON.stringify(resetPayment),
          headers: noCacheHeaders,
          cache: "no-cache",
        });
        
        if (!response.ok) {
          console.error(`Error resetting team for ${payment.name}:`, response.status);
        }
      }
      
      console.log("All team assignments reset to defaults");
      fetchPaymentsData(); // refresh data after resetting
    } catch (error) {
      console.error("Error resetting team assignments:", error);
    }
  };

  const handleDelete = async (id) => {
    const response = await fetch("/api/soccernowDeletePayment", {
      method: "POST",
      body: JSON.stringify({ id }),
      headers: noCacheHeaders,
      cache: "no-cache",
    });

    if (response.ok) {
      console.log("Record deleted successfully");
      fetchPaymentsData();
    } else {
      console.error("Error deleting record");
    }
  };

  const handleCloseAddModal = () => {
    setOpenAddModal(false);
    setIsAutoPrefilled(false); // Reset auto-prefill indicator when closing modal
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = value;
    
    if (type === "checkbox") {
      newValue = checked ? true : false;
    }

    setRecord({ ...record, [name]: newValue });
  };

  const handleSaveNewRecord = async () => {
    try {
      if (!record && !record?.name) {
        console.error("No player selected or player name is missing.");
        return;
      }

      const newRecord = {
        name: record?.name,
        money: 7,
        date: Date.now(),
        paid: record.paid,
        team: record.team,
        goalkeeper: Boolean(record.goalkeeper),
      };

      const response = await fetch("/api/soccernowUpdatePayment", {
        method: "POST",
        body: JSON.stringify(newRecord),
        headers: noCacheHeaders,
        cache: "no-cache",
      });

      if (response.ok) {
        console.log("New record added successfully");
        fetchPaymentsData();
        setOpenAddModal(false);
        setRecord({
          id: "",
          name: "",
          money: 0,
          date: "",
          paid: false,
          team: "dark",
          goalkeeper: false,
        });
      } else {
        console.error("Error adding new record");
      }
    } catch (error) {
      console.error("Error adding new record:", error);
    }
  };

  const handleInlineUpdate = async (id, field, value) => {
    const payment = payments.find(p => p.id === id);
    if (!payment) return;

    let updatedPayment = { ...payment, [field]: value };
    
    // If changing team, mark as manually overridden
    if (field === 'team') {
      updatedPayment.teamOverridden = true;
      console.log(`Manual team change for ${payment.name}: ${payment.team} -> ${value}`);
    }
    
    const response = await fetch("/api/soccernowUpdatePayment", {
      method: "PUT",
      body: JSON.stringify(updatedPayment),
      headers: noCacheHeaders,
      cache: "no-cache",
    });

    if (response.ok) {
      console.log(`${field} updated successfully`);
      fetchPaymentsData();
    } else {
      console.error(`Error updating ${field}`);
    }
  };

  const handleLogin = () => {
    if (username === HARDCODED_USERNAME && password === HARDCODED_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem("isAuthenticated", "true");
    } else {
      alert("Invalid username or password");
    }
  };

  useEffect(() => {
    const isAuth = localStorage.getItem("isAuthenticated") === "true";
    setIsAuthenticated(isAuth);
  }, []);

  if (isEditMode && !isAuthenticated) {
    return (
      <Container>
        <h2>Login</h2>
        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button onClick={handleLogin}>Login</Button>
      </Container>
    );
  }

  return (
    <Container className={!isEditMode ? "view-mode " : "py-10"}>
      <Recap
        payments={payments}
        darkTeam={darkTeam}
        whiteTeam={whiteTeam}
        waitlist={waitlist}
      />
      {isEditMode && (
        <div className="my-4">
          <Button
            className="mr-4 mb-4  w-full sm:w-auto "
            variant="contained"
            color="primary"
            onClick={handleAddRecord}
          >
            Add New Record
          </Button>
          <Button
            className="mr-4 mb-4 w-full sm:w-auto"
            variant="contained"
            color="primary"
            onClick={handleAddBaseRecords}
          >
            Add Alberto Gavin Andrea Keepers
          </Button>
          <Button
            className="mr-4 mb-4 w-full sm:w-auto"
            variant="outlined"
            color="secondary"
            onClick={handleResetToDefaultTeams}
          >
            🔄 Reset to Default Teams
          </Button>
        </div>
      )}
      
      {/* Venmo Request Links for Unpaid Players */}
      {isEditMode && payments.filter(p => !p.paid).length > 0 && (
        <Paper className="p-4 mb-4" style={{ backgroundColor: '#fff3e0' }}>
          <h3 className="text-lg font-bold mb-2">💸 Venmo Request Links (Unpaid Players)</h3>
          <p className="text-sm text-gray-600 mb-3">
            Click to open Venmo request for each player, or copy all links below.
          </p>
          <div className="space-y-2">
            {payments.filter(p => !p.paid).map(player => {
              const playerConfig = dynamicPlayers.find(dp => 
                dp.name?.toLowerCase().trim() === player.name?.toLowerCase().trim()
              );
              const venmoHandle = playerConfig?.venmoHandle?.replace('@', '') || '';
              const requestUrl = venmoHandle 
                ? `https://venmo.com/${venmoHandle}?txn=charge&amount=7&note=Soccer%20Thu%20${encodeURIComponent(player.name)}`
                : null;
              
              return (
                <div key={player.id} className="flex items-center gap-2">
                  <span className="w-40 truncate">{player.name}</span>
                  {venmoHandle ? (
                    <>
                      <a 
                        href={requestUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        @{venmoHandle}
                      </a>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => window.open(requestUrl, '_blank')}
                        style={{ fontSize: '0.7rem' }}
                      >
                        Request $7
                      </Button>
                    </>
                  ) : (
                    <span className="text-gray-400 text-sm italic">
                      No Venmo handle set - <a href="/playerConfig" className="text-blue-500 hover:underline">add in config</a>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Copy all Venmo handles for bulk message */}
          {payments.filter(p => !p.paid).some(player => {
            const pc = dynamicPlayers.find(dp => dp.name?.toLowerCase().trim() === player.name?.toLowerCase().trim());
            return pc?.venmoHandle;
          }) && (
            <div className="mt-4 pt-4 border-t border-orange-200">
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  const handles = payments
                    .filter(p => !p.paid)
                    .map(player => {
                      const pc = dynamicPlayers.find(dp => dp.name?.toLowerCase().trim() === player.name?.toLowerCase().trim());
                      return pc?.venmoHandle?.replace('@', '');
                    })
                    .filter(Boolean);
                  const text = handles.map(h => `@${h}`).join(', ');
                  navigator.clipboard.writeText(text);
                  alert(`Copied ${handles.length} Venmo handles: ${text}`);
                }}
                style={{ backgroundColor: '#008CFF' }}
              >
                📋 Copy All Venmo Handles
              </Button>
            </div>
          )}
        </Paper>
      )}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow className="bg-yellow-200 ">
              {isEditMode && !editingId && <TableCell>Id</TableCell>}
              {isEditMode && !editingId && <TableCell>Date</TableCell>}
              <TableCell> Name ({payments.length} tot)</TableCell>
              {isEditMode && !editingId && <TableCell>$</TableCell>}
              <TableCell>Paid</TableCell>
              <TableCell>{isEditMode ? "Team" : "Jersey Color"}</TableCell>
              {isEditMode && <TableCell>GK</TableCell>}
              {isEditMode && <TableCell>Edit</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {renderTableRows(
              whiteTeam,
              isEditMode,
              editingId,
              record,
              handleInputChange,
              setRecord,
              dynamicPlayers,
              handleSaveEdit,
              handleCancelEdit,
              handleEdit,
              handleDelete,
              isSmallDevice,
              handleInlineUpdate
            )}
            {renderTableRows(
              darkTeam,
              isEditMode,
              editingId,
              record,
              handleInputChange,
              setRecord,
              dynamicPlayers,
              handleSaveEdit,
              handleCancelEdit,
              handleEdit,
              handleDelete,
              isSmallDevice,
              handleInlineUpdate
            )}
          </TableBody>
        </Table>
        {payments.length > 16 && (
          <>
            <Table>
              <TableHead>
                <TableRow className="bg-yellow-100">
                  <TableCell colSpan={isEditMode ? 8 : 4}>
                    Waiting List 🚧
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {renderTableRows(
                  waitlist,
                  isEditMode,
                  editingId,
                  record,
                  handleInputChange,
                  setRecord,
                  dynamicPlayers,
                  handleSaveEdit,
                  handleCancelEdit,
                  handleEdit,
                  handleDelete,
                  isSmallDevice,
                  handleInlineUpdate
                )}
              </TableBody>
            </Table>
          </>
        )}
      </TableContainer>
      <Dialog
        open={openAddModal}
        onClose={handleCloseAddModal}
        style={{ width: "80%", margin: "0 auto" }}
      >
        <DialogTitle>Add New Record</DialogTitle>
        <DialogContent>
          <Autocomplete
            className="mb-5"
            value={record.name}
            onChange={(event, newValue) => {
              if (!newValue) {
                newValue = "";
                // Reset to default values when clearing
                setRecord((prevRecord) => ({
                  ...prevRecord,
                  name: "",
                  team: "dark", // default team
                  goalkeeper: false, // default goalkeeper status
                }));
                setIsAutoPrefilled(false);
                return;
              }

              const playerName = typeof newValue === "string" ? newValue : newValue?.name;
              
              // Find matching player in dynamicPlayers to get their preferences
              const matchingPlayer = dynamicPlayers.find(player => 
                (typeof player === "string" ? player : player.name) === playerName
              );

              if (matchingPlayer && typeof matchingPlayer === "object") {
                // Auto-prefill with player's preferences
                // Check both goalkeeper field and position field for goalkeeper status
                const isGoalkeeper = matchingPlayer.goalkeeper || matchingPlayer.position === "goalkeeper";
                
                setRecord((prevRecord) => ({
                  ...prevRecord,
                  name: playerName,
                  team: matchingPlayer.team || "dark", // Use player's preferred team or default to dark
                  goalkeeper: isGoalkeeper, // Use goalkeeper status or check position
                }));
                setIsAutoPrefilled(true);
                // Clear auto-prefill indicator after 3 seconds
                setTimeout(() => setIsAutoPrefilled(false), 3000);
              } else {
                // No matching player found, just set the name
                setRecord((prevRecord) => ({
                  ...prevRecord,
                  name: playerName,
                }));
                setIsAutoPrefilled(false);
              }
            }}
            options={dynamicPlayers}
            getOptionLabel={(option) =>
              typeof option === "string" ? option : option.name
            }
            onInputChange={(event, newValue) => {
              if (!newValue) {
                newValue = "";
              }
              setRecord((prevRecord) => ({
                ...prevRecord,
                name: typeof newValue === "string" ? newValue : newValue?.name,
              }));
            }}
            inputValue={record?.name}
            freeSolo
            renderInput={(params) => (
              <TextField 
                {...params} 
                variant="outlined" 
                label="Player Name"
                placeholder="Start typing or select a player (auto-fills preferences)"
              />
            )}
          />

          {isAutoPrefilled && (
            <div style={{ 
              color: '#4caf50', 
              fontSize: '0.875rem', 
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ✓ Auto-filled team preference and goalkeeper status
            </div>
          )}

          <FormControlLabel
            control={
              <Checkbox
                name="paid"
                checked={record.paid}
                onChange={handleInputChange}
              />
            }
            label="Paid"
          />
          <FormControl className="mr-4">
            <InputLabel id="team-label">Team</InputLabel>
            <Select
              labelId="team-label"
              name="team"
              value={record.team}
              onChange={handleInputChange}
            >
              <MenuItem value="white">White</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                name="goalkeeper"
                checked={record.goalkeeper}
                onChange={handleInputChange}
              />
            }
            label="Goalkeeper 🧤"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddModal} color="primary">
            Cancel
          </Button>
          <Button onClick={handleSaveNewRecord} color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default EditSoccerNow;
