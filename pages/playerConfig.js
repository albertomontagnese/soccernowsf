import React, { useState, useEffect } from 'react';
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
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { noCacheHeaders } from '../helpers/misc';

const HARDCODED_USERNAME = "alberto";
const HARDCODED_PASSWORD = "ForzaJuve+";

function PlayerConfig() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [players, setPlayers] = useState([]);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editingField, setEditingField] = useState(null); // Track which field is being edited
  const [openAddModal, setOpenAddModal] = useState(false);
  const [currentGameData, setCurrentGameData] = useState(null);
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    venmoFullName: '',
    venmoHandle: '', // @username for Venmo requests
    whatsAppName: '',
    team: 'dark', // Default to dark team
    rating: 7.0,
    position: 'midfielder',
    goalkeeper: false,
    paid: false,
    favorite: false
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [editingAnalysisRating, setEditingAnalysisRating] = useState(null);
  const [editingAnalysisPosition, setEditingAnalysisPosition] = useState(null);
  const [ratingFilter, setRatingFilter] = useState(7.5);

  useEffect(() => {
    const isAuth = localStorage.getItem("isAuthenticated") === "true";
    setIsAuthenticated(isAuth);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPlayersConfig();
      fetchCurrentGameData();
    }
  }, [isAuthenticated]);

  const fetchPlayersConfig = async () => {
    try {
      const response = await fetch('/api/playerConfig', {
        method: 'GET',
        headers: noCacheHeaders,
      });
      const data = await response.json();
      setPlayers(data.players || []);
    } catch (error) {
      console.error('Error fetching players config:', error);
    }
  };

  const fetchCurrentGameData = async () => {
    try {
      const response = await fetch('/api/soccernowAllPayments', {
        method: 'GET',
        headers: noCacheHeaders,
      });
      const data = await response.json();
      setCurrentGameData(data);
    } catch (error) {
      console.error('Error fetching current game data:', error);
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

  const autoSavePlayersConfig = async (updatedPlayers) => {
    try {
      const response = await fetch('/api/playerConfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...noCacheHeaders,
        },
        body: JSON.stringify({ players: updatedPlayers }),
      });

      if (!response.ok) {
        console.error('Auto-save failed:', response.statusText);
        // Could show a subtle notification here instead of alert
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    }
  };

  const handleEditField = (player, field) => {
    setEditingPlayer({ ...player });
    setEditingField(`${player.name}-${field}`);
  };

  const handleSaveEdit = (overridePlayer = null) => {
    const playerToSave = overridePlayer || editingPlayer;
    if (!playerToSave) return;
    
    const updatedPlayers = players.map(p => 
      p.name === playerToSave.name ? playerToSave : p
    );
    setPlayers(updatedPlayers);
    setEditingPlayer(null);
    setEditingField(null);
    // Auto-save after edit
    autoSavePlayersConfig(updatedPlayers);
  };

  const handleCancelEdit = () => {
    setEditingPlayer(null);
    setEditingField(null);
  };

  const handleFieldKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleFieldBlur = () => {
    // Save on blur (when clicking outside the field)
    handleSaveEdit();
  };

  const handleAddPlayer = () => {
    setOpenAddModal(true);
  };

  const handleSaveNewPlayer = async () => {
    if (!newPlayer.name.trim()) {
      alert('Player name is required');
      return;
    }
    
    try {
      // Check if we should auto-populate data for this player
      const shouldAutoPopulate = !newPlayer.venmoFullName && !newPlayer.whatsAppName;
      
      let finalPlayer = { ...newPlayer };
      
      if (shouldAutoPopulate) {
        // Try to auto-populate player data
        try {
          const response = await fetch('/api/syncNewPlayers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              playerName: newPlayer.name,
              venmoName: newPlayer.name
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.player) {
              // Use auto-populated data but keep manual overrides
              finalPlayer = {
                ...result.player,
                ...newPlayer, // Manual input takes precedence
                name: newPlayer.name // Always use the manually entered name
              };
              console.log('Auto-populated player data:', finalPlayer);
            }
          }
        } catch (autoPopError) {
          console.error('Auto-population failed, using manual data:', autoPopError);
          // Continue with manual data if auto-population fails
        }
      }
      
      const updatedPlayers = [...players, finalPlayer];
      setPlayers(updatedPlayers);
      setNewPlayer({
        name: '',
        venmoFullName: '',
        venmoHandle: '',
        whatsAppName: '',
        team: 'dark',
        rating: 7.0,
        position: 'midfielder',
        goalkeeper: false,
        paid: false,
        favorite: false
      });
      setOpenAddModal(false);
      // Auto-save after adding new player
      autoSavePlayersConfig(updatedPlayers);
    } catch (error) {
      console.error('Error saving new player:', error);
      alert('Error saving player. Please try again.');
    }
  };

  const handleDeletePlayer = (playerName) => {
    if (confirm(`Are you sure you want to delete ${playerName}?`)) {
      const updatedPlayers = players.filter(p => p.name !== playerName);
      setPlayers(updatedPlayers);
      // Auto-save after deletion
      autoSavePlayersConfig(updatedPlayers);
    }
  };

  const handleAnalysisRatingUpdate = (playerName, newRating) => {
    const existingPlayerIndex = players.findIndex(p => p.name === playerName);
    
    if (existingPlayerIndex !== -1) {
      // Player exists in config - update their rating
      const updatedPlayers = players.map(p => 
        p.name === playerName ? {...p, rating: parseFloat(newRating)} : p
      );
      setPlayers(updatedPlayers);
      autoSavePlayersConfig(updatedPlayers);
    } else {
      // Player doesn't exist in config - create new player entry
      const newPlayer = {
        name: playerName,
        venmoFullName: playerName,
        whatsAppName: playerName,
        team: 'white', // Default team
        rating: parseFloat(newRating),
        position: 'midfielder', // Default position
        goalkeeper: false,
        paid: false,
        favorite: false
      };
      
      const updatedPlayers = [...players, newPlayer];
      setPlayers(updatedPlayers);
      autoSavePlayersConfig(updatedPlayers);
    }
    
    setEditingAnalysisRating(null);
  };

  const handleAnalysisPositionUpdate = (playerName, newPosition) => {
    const existingPlayerIndex = players.findIndex(p => p.name === playerName);
    
    if (existingPlayerIndex !== -1) {
      // Player exists in config - update their position
      const updatedPlayers = players.map(p => 
        p.name === playerName ? {
          ...p, 
          position: newPosition,
          goalkeeper: newPosition === 'goalkeeper' ? true : p.goalkeeper
        } : p
      );
      setPlayers(updatedPlayers);
      autoSavePlayersConfig(updatedPlayers);
    } else {
      // Player doesn't exist in config - create new player entry
      const newPlayer = {
        name: playerName,
        venmoFullName: playerName,
        whatsAppName: playerName,
        team: 'white', // Default team
        rating: 7.0, // Default rating
        position: newPosition,
        goalkeeper: newPosition === 'goalkeeper',
        paid: false,
        favorite: false
      };
      
      const updatedPlayers = [...players, newPlayer];
      setPlayers(updatedPlayers);
      autoSavePlayersConfig(updatedPlayers);
    }
    
    setEditingAnalysisPosition(null);
  };

  const handleGameTeamSwitch = async (playerName, currentTeam) => {
    try {
      // Find the player in current game data to get their payment ID
      const allGamePlayers = [...(currentGameData?.whiteTeam || []), ...(currentGameData?.darkTeam || [])];
      const gamePlayer = allGamePlayers.find(p => p.name === playerName);
      
      if (!gamePlayer) {
        console.error(`Player ${playerName} not found in current game`);
        return;
      }

      const newTeam = currentTeam === 'white' ? 'dark' : 'white';
      
      // Update the payment record with team override
      const updatedPayment = {
        ...gamePlayer,
        team: newTeam,
        teamOverridden: true
      };
      
      const response = await fetch('/api/soccernowUpdatePayment', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...noCacheHeaders,
        },
        body: JSON.stringify(updatedPayment),
      });

      if (response.ok) {
        console.log(`${playerName} switched from ${currentTeam} to ${newTeam} team`);
        // Refresh the current game data
        fetchCurrentGameData();
      } else {
        console.error(`Failed to switch team for ${playerName}`);
      }
    } catch (error) {
      console.error('Error switching team:', error);
    }
  };

  const getTeamAnalysis = () => {
    if (!currentGameData) return null;

    const { whiteTeam, darkTeam } = currentGameData;
    
    const analyzeTeam = (team, teamName) => {
      if (!team || !Array.isArray(team)) {
        return {
          name: teamName,
          players: [],
          avgRating: '0.0',
          totalPlayers: 0,
          positions: {}
        };
      }
      
      const teamPlayers = team.map(gamePlayer => {
        const configPlayer = players.find(p => p.name === gamePlayer.name);
        return configPlayer || { ...gamePlayer, rating: 7.0, position: 'midfielder' };
      });

      const avgRating = teamPlayers.length > 0 
        ? teamPlayers.reduce((sum, p) => sum + p.rating, 0) / teamPlayers.length 
        : 0;

      const positions = teamPlayers.reduce((acc, p) => {
        acc[p.position] = (acc[p.position] || 0) + 1;
        return acc;
      }, {});

      return {
        name: teamName,
        players: teamPlayers,
        avgRating: avgRating.toFixed(1),
        totalPlayers: teamPlayers.length,
        positions
      };
    };

    const whiteAnalysis = analyzeTeam(whiteTeam, 'White');
    const darkAnalysis = analyzeTeam(darkTeam, 'Dark');

    return { white: whiteAnalysis, dark: darkAnalysis };
  };

  const analysis = getTeamAnalysis();

  // Filter and sort players
  const getFilteredAndSortedPlayers = () => {
    let filteredPlayers = players.filter(player => {
      const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           player.venmoFullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           player.whatsAppName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTeam = teamFilter === 'all' || player.team === teamFilter;
      const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
      
      return matchesSearch && matchesTeam && matchesPosition;
    });

    // Sort players
    filteredPlayers.sort((a, b) => {
      // Always show favorites first
      if (a.favorite !== b.favorite) {
        return b.favorite - a.favorite;
      }

      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'name' || sortBy === 'venmoFullName' || sortBy === 'whatsAppName' || sortBy === 'position') {
        aValue = (aValue || '').toLowerCase();
        bValue = (bValue || '').toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filteredPlayers;
  };

  const displayedPlayers = getFilteredAndSortedPlayers();

  if (!isAuthenticated) {
    return (
      <Container>
        <Typography variant="h4" gutterBottom>Player Config - Login Required</Typography>
        <Box sx={{ mt: 2 }}>
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            sx={{ mr: 2 }}
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mr: 2 }}
          />
          <Button variant="contained" onClick={handleLogin}>Login</Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Player Configuration & Analysis</Typography>
      
      {/* Current Game Analysis */}
      {analysis && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom>Current Game Analysis</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="body2">Filter players with rating ≥</Typography>
              <TextField
                type="number"
                value={ratingFilter}
                onChange={(e) => setRatingFilter(parseFloat(e.target.value) || 0)}
                inputProps={{ min: 0, max: 10, step: 0.1 }}
                size="small"
                sx={{ width: 80 }}
              />
              <Typography variant="body2" color="text.secondary">
                White: {analysis.white.players.filter(p => (p.rating || 0) >= ratingFilter).length} | 
                Dark: {analysis.dark.players.filter(p => (p.rating || 0) >= ratingFilter).length}
              </Typography>
            </Box>
          </Grid>
          
          {/* White Team Analysis */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  🏳️ White Team ({analysis.white.totalPlayers} players)
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Average Rating:</strong> {analysis.white.avgRating}/10
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Total Rating:</strong> {analysis.white.players.reduce((sum, p) => sum + (p.rating || 0), 0).toFixed(1)}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Goalkeepers:</strong> {analysis.white.players.filter(p => p.goalkeeper).length}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>High Rating (≥{ratingFilter}):</strong> {analysis.white.players.filter(p => (p.rating || 0) >= ratingFilter).length}
                </Typography>
                <Typography variant="subtitle2" gutterBottom>Position Distribution:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {Object.entries(analysis.white.positions).map(([position, count]) => (
                    <Chip 
                      key={position} 
                      label={`${position}: ${count}`} 
                      size="small" 
                      color="primary"
                    />
                  ))}
                </Box>
                <Typography variant="subtitle2" gutterBottom>Players:</Typography>
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {analysis.white.players.map((player, idx) => (
                    <Typography 
                      key={idx} 
                      variant="body2" 
                      sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        py: 0.5,
                        borderBottom: '1px solid #f0f0f0',
                        bgcolor: (player.rating || 0) >= ratingFilter ? '#e8f5e8' : 'transparent',
                        fontWeight: (player.rating || 0) >= ratingFilter ? 'bold' : 'normal'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <span>
                          {player.goalkeeper ? '🧤' : ''} {player.name}
                        </span>
                        {editingAnalysisPosition === `white-${player.name}` ? (
                          <FormControl size="small" sx={{ minWidth: 80 }}>
                            <Select
                              value={player.position}
                              onChange={(e) => handleAnalysisPositionUpdate(player.name, e.target.value)}
                              autoFocus
                              sx={{ fontSize: '0.7rem' }}
                            >
                              <MenuItem value="goalkeeper">Goalkeeper</MenuItem>
                              <MenuItem value="defender">Defender</MenuItem>
                              <MenuItem value="midfielder">Midfielder</MenuItem>
                              <MenuItem value="striker">Striker</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <Chip 
                            label={player.position} 
                            size="small" 
                            variant="outlined" 
                            sx={{ fontSize: '0.7rem', cursor: 'pointer' }}
                            onClick={() => setEditingAnalysisPosition(`white-${player.name}`)}
                          />
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleGameTeamSwitch(player.name, 'white')}
                          sx={{ 
                            minWidth: '60px', 
                            fontSize: '0.7rem',
                            py: 0.2,
                            px: 1
                          }}
                        >
                          → 🏴
                        </Button>
                      </span>
                      {editingAnalysisRating === `white-${player.name}` ? (
                        <TextField
                          type="number"
                          inputProps={{ min: 1, max: 10, step: 0.1 }}
                          defaultValue={player.rating}
                          onBlur={(e) => handleAnalysisRatingUpdate(player.name, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAnalysisRatingUpdate(player.name, e.target.value);
                            if (e.key === 'Escape') setEditingAnalysisRating(null);
                          }}
                          size="small"
                          sx={{ width: 60, ml: 1 }}
                          autoFocus
                        />
                      ) : (
                        <span 
                          style={{ fontWeight: 'bold', cursor: 'pointer' }}
                          onClick={() => setEditingAnalysisRating(`white-${player.name}`)}
                        >
                          ⭐ {player.rating || 'N/A'}
                        </span>
                      )}
                    </Typography>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Dark Team Analysis */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  🏴 Dark Team ({analysis.dark.totalPlayers} players)
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Average Rating:</strong> {analysis.dark.avgRating}/10
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Total Rating:</strong> {analysis.dark.players.reduce((sum, p) => sum + (p.rating || 0), 0).toFixed(1)}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Goalkeepers:</strong> {analysis.dark.players.filter(p => p.goalkeeper).length}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>High Rating (≥{ratingFilter}):</strong> {analysis.dark.players.filter(p => (p.rating || 0) >= ratingFilter).length}
                </Typography>
                <Typography variant="subtitle2" gutterBottom>Position Distribution:</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {Object.entries(analysis.dark.positions).map(([position, count]) => (
                    <Chip 
                      key={position} 
                      label={`${position}: ${count}`} 
                      size="small" 
                      color="secondary"
                    />
                  ))}
                </Box>
                <Typography variant="subtitle2" gutterBottom>Players:</Typography>
                <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {analysis.dark.players.map((player, idx) => (
                    <Typography 
                      key={idx} 
                      variant="body2" 
                      sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        py: 0.5,
                        borderBottom: '1px solid #f0f0f0',
                        bgcolor: (player.rating || 0) >= ratingFilter ? '#e8f5e8' : 'transparent',
                        fontWeight: (player.rating || 0) >= ratingFilter ? 'bold' : 'normal'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <span>
                          {player.goalkeeper ? '🧤' : ''} {player.name}
                        </span>
                        {editingAnalysisPosition === `dark-${player.name}` ? (
                          <FormControl size="small" sx={{ minWidth: 80 }}>
                            <Select
                              value={player.position}
                              onChange={(e) => handleAnalysisPositionUpdate(player.name, e.target.value)}
                              autoFocus
                              sx={{ fontSize: '0.7rem' }}
                            >
                              <MenuItem value="goalkeeper">Goalkeeper</MenuItem>
                              <MenuItem value="defender">Defender</MenuItem>
                              <MenuItem value="midfielder">Midfielder</MenuItem>
                              <MenuItem value="striker">Striker</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <Chip 
                            label={player.position} 
                            size="small" 
                            variant="outlined" 
                            sx={{ fontSize: '0.7rem', cursor: 'pointer' }}
                            onClick={() => setEditingAnalysisPosition(`dark-${player.name}`)}
                          />
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleGameTeamSwitch(player.name, 'dark')}
                          sx={{ 
                            minWidth: '60px', 
                            fontSize: '0.7rem',
                            py: 0.2,
                            px: 1
                          }}
                        >
                          → 🏳️
                        </Button>
                      </span>
                      {editingAnalysisRating === `dark-${player.name}` ? (
                        <TextField
                          type="number"
                          inputProps={{ min: 1, max: 10, step: 0.1 }}
                          defaultValue={player.rating}
                          onBlur={(e) => handleAnalysisRatingUpdate(player.name, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAnalysisRatingUpdate(player.name, e.target.value);
                            if (e.key === 'Escape') setEditingAnalysisRating(null);
                          }}
                          size="small"
                          sx={{ width: 60, ml: 1 }}
                          autoFocus
                        />
                      ) : (
                        <span 
                          style={{ fontWeight: 'bold', cursor: 'pointer' }}
                          onClick={() => setEditingAnalysisRating(`dark-${player.name}`)}
                        >
                          ⭐ {player.rating || 'N/A'}
                        </span>
                      )}
                    </Typography>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Team Balance Comparison */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>⚖️ Team Balance & Statistics</Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body1" gutterBottom>
                      <strong>Average Rating Difference:</strong> {Math.abs(analysis.white.avgRating - analysis.dark.avgRating).toFixed(1)} 
                      {analysis.white.avgRating > analysis.dark.avgRating 
                        ? " (🏳️ White stronger)" 
                        : analysis.dark.avgRating > analysis.white.avgRating 
                          ? " (🏴 Dark stronger)" 
                          : " (✅ Balanced)"
                      }
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      <strong>Total Rating Difference:</strong> {Math.abs(
                        analysis.white.players.reduce((sum, p) => sum + (p.rating || 0), 0) -
                        analysis.dark.players.reduce((sum, p) => sum + (p.rating || 0), 0)
                      ).toFixed(1)}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Typography variant="body1" gutterBottom>
                      <strong>Player Count:</strong> {analysis.white.totalPlayers} vs {analysis.dark.totalPlayers}
                      {analysis.white.totalPlayers !== analysis.dark.totalPlayers && " ⚠️ Unbalanced"}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      <strong>Goalkeepers:</strong> {analysis.white.players.filter(p => p.goalkeeper).length} vs {analysis.dark.players.filter(p => p.goalkeeper).length}
                      {analysis.white.players.filter(p => p.goalkeeper).length !== analysis.dark.players.filter(p => p.goalkeeper).length && " ⚠️ Unbalanced"}
                      {analysis.white.players.filter(p => p.goalkeeper).length === 0 && " 🚨 White has no GK"}
                      {analysis.dark.players.filter(p => p.goalkeeper).length === 0 && " 🚨 Dark has no GK"}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      <strong>Defenders:</strong> {analysis.white.players.filter(p => p.position === 'defender').length} vs {analysis.dark.players.filter(p => p.position === 'defender').length}
                      {analysis.white.players.filter(p => p.position === 'defender').length < 2 && " 🚨 White < 2 defenders"}
                      {analysis.dark.players.filter(p => p.position === 'defender').length < 2 && " 🚨 Dark < 2 defenders"}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      <strong>High Rating (≥{ratingFilter}):</strong> {analysis.white.players.filter(p => (p.rating || 0) >= ratingFilter).length} vs {analysis.dark.players.filter(p => (p.rating || 0) >= ratingFilter).length}
                      {analysis.white.players.filter(p => (p.rating || 0) >= ratingFilter).length !== analysis.dark.players.filter(p => (p.rating || 0) >= ratingFilter).length && " ⚠️ Unbalanced"}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Typography variant="body1" gutterBottom>
                      <strong>Total Players:</strong> {analysis.white.totalPlayers + analysis.dark.totalPlayers}
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      <strong>Overall Average Rating:</strong> {(
                        (analysis.white.players.reduce((sum, p) => sum + (p.rating || 0), 0) + 
                         analysis.dark.players.reduce((sum, p) => sum + (p.rating || 0), 0)) / 
                        (analysis.white.totalPlayers + analysis.dark.totalPlayers)
                      ).toFixed(1)}/10
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Player Management */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={handleAddPlayer}>
          Add New Player
        </Button>
        <Button 
          variant="outlined" 
          color="secondary"
          onClick={async () => {
            try {
              const response = await fetch('/api/syncNewPlayers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              const result = await response.json();
              if (result.success) {
                alert(`Synced ${result.playersCreated} new players from payments!`);
                fetchPlayersConfig(); // Refresh the list
              } else {
                alert('Sync failed: ' + result.message);
              }
            } catch (error) {
              console.error('Sync error:', error);
              alert('Failed to sync new players');
            }
          }}
        >
          🔄 Sync New Players from Payments
        </Button>
      </Box>

      {/* Filtering and Sorting Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Filter & Sort Players</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Search players"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name, Venmo, WhatsApp..."
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Team</InputLabel>
              <Select
                value={teamFilter}
                label="Team"
                onChange={(e) => setTeamFilter(e.target.value)}
              >
                <MenuItem value="all">All Teams</MenuItem>
                <MenuItem value="white">🏳️ White</MenuItem>
                <MenuItem value="dark">🏴 Dark</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Position</InputLabel>
              <Select
                value={positionFilter}
                label="Position"
                onChange={(e) => setPositionFilter(e.target.value)}
              >
                <MenuItem value="all">All Positions</MenuItem>
                <MenuItem value="goalkeeper">Goalkeeper</MenuItem>
                <MenuItem value="defender">Defender</MenuItem>
                <MenuItem value="midfielder">Midfielder</MenuItem>
                <MenuItem value="striker">Striker</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e) => setSortBy(e.target.value)}
              >
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="rating">Rating</MenuItem>
                <MenuItem value="position">Position</MenuItem>
                <MenuItem value="team">Team</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Order</InputLabel>
              <Select
                value={sortOrder}
                label="Order"
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <MenuItem value="asc">A-Z / Low-High</MenuItem>
                <MenuItem value="desc">Z-A / High-Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              Showing {displayedPlayers.length} of {players.length} players
              {displayedPlayers.filter(p => p.favorite).length > 0 && ` • ${displayedPlayers.filter(p => p.favorite).length} favorites`}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Players Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>⭐</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Rating</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>Preferred Team</TableCell>
              <TableCell>Venmo Handle</TableCell>
              <TableCell>Venmo Name</TableCell>
              <TableCell>WhatsApp Name</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedPlayers.map((player) => (
              <TableRow key={player.name} sx={{ bgcolor: player.favorite ? '#fff9c4' : 'inherit' }}>
                <TableCell 
                  onClick={() => {
                    const updatedPlayers = players.map(p => 
                      p.name === player.name ? {...p, favorite: !p.favorite} : p
                    );
                    setPlayers(updatedPlayers);
                    autoSavePlayersConfig(updatedPlayers);
                  }} 
                  sx={{ cursor: 'pointer', textAlign: 'center', '&:hover': { bgcolor: 'grey.50' } }}
                >
                  <span style={{ fontSize: '18px' }}>
                    {player.favorite ? '⭐' : '☆'}
                  </span>
                </TableCell>
                <TableCell onClick={() => handleEditField(player, 'name')} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}>
                  {editingField === `${player.name}-name` ? (
                    <TextField
                      value={editingPlayer.name}
                      onChange={(e) => setEditingPlayer({...editingPlayer, name: e.target.value})}
                      onBlur={handleFieldBlur}
                      onKeyDown={handleFieldKeyDown}
                      size="small"
                      autoFocus
                      fullWidth
                    />
                  ) : (
                    player.name
                  )}
                </TableCell>
                <TableCell onClick={() => handleEditField(player, 'rating')} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}>
                  {editingField === `${player.name}-rating` ? (
                    <TextField
                      type="number"
                      inputProps={{ min: 1, max: 10, step: 0.1 }}
                      value={editingPlayer.rating}
                      onChange={(e) => setEditingPlayer({...editingPlayer, rating: parseFloat(e.target.value) || 0})}
                      onBlur={handleFieldBlur}
                      onKeyDown={handleFieldKeyDown}
                      size="small"
                      autoFocus
                      fullWidth
                    />
                  ) : (
                    player.rating
                  )}
                </TableCell>
                <TableCell onClick={() => handleEditField(player, 'position')} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}>
                  {editingField === `${player.name}-position` ? (
                    <FormControl size="small" fullWidth>
                      <Select
                        value={editingPlayer.position}
                        onChange={(e) => {
                          const updatedPlayer = {...editingPlayer, position: e.target.value};
                          setEditingPlayer(updatedPlayer);
                          // Save immediately with the updated player
                          handleSaveEdit(updatedPlayer);
                        }}
                        autoFocus
                      >
                        <MenuItem value="goalkeeper">Goalkeeper</MenuItem>
                        <MenuItem value="defender">Defender</MenuItem>
                        <MenuItem value="midfielder">Midfielder</MenuItem>
                        <MenuItem value="striker">Striker</MenuItem>
                      </Select>
                    </FormControl>
                  ) : (
                    <Chip 
                      label={player.position} 
                      size="small"
                      color={player.position === 'goalkeeper' ? 'warning' : 'default'}
                    />
                  )}
                </TableCell>
                <TableCell onClick={() => handleEditField(player, 'team')} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}>
                  {editingField === `${player.name}-team` ? (
                    <FormControl size="small" fullWidth>
                      <Select
                        value={editingPlayer.team}
                        onChange={(e) => {
                          const updatedPlayer = {...editingPlayer, team: e.target.value};
                          setEditingPlayer(updatedPlayer);
                          // Save immediately with the updated player
                          handleSaveEdit(updatedPlayer);
                        }}
                        autoFocus
                      >
                        <MenuItem value="white">🏳️ White</MenuItem>
                        <MenuItem value="dark">🏴 Dark</MenuItem>
                      </Select>
                    </FormControl>
                  ) : (
                    player.team === 'white' ? '🏳️ White' : '🏴 Dark'
                  )}
                </TableCell>
                <TableCell onClick={() => handleEditField(player, 'venmoHandle')} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}>
                  {editingField === `${player.name}-venmoHandle` ? (
                    <TextField
                      value={editingPlayer.venmoHandle || ''}
                      onChange={(e) => setEditingPlayer({...editingPlayer, venmoHandle: e.target.value})}
                      onBlur={handleFieldBlur}
                      onKeyDown={handleFieldKeyDown}
                      size="small"
                      autoFocus
                      fullWidth
                      placeholder="@username"
                    />
                  ) : (
                    player.venmoHandle ? `@${player.venmoHandle.replace('@', '')}` : <em style={{color: '#999'}}>Click to edit</em>
                  )}
                </TableCell>
                <TableCell onClick={() => handleEditField(player, 'venmoFullName')} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}>
                  {editingField === `${player.name}-venmoFullName` ? (
                    <TextField
                      value={editingPlayer.venmoFullName}
                      onChange={(e) => setEditingPlayer({...editingPlayer, venmoFullName: e.target.value})}
                      onBlur={handleFieldBlur}
                      onKeyDown={handleFieldKeyDown}
                      size="small"
                      autoFocus
                      fullWidth
                    />
                  ) : (
                    player.venmoFullName || <em style={{color: '#999'}}>Click to edit</em>
                  )}
                </TableCell>
                <TableCell onClick={() => handleEditField(player, 'whatsAppName')} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}>
                  {editingField === `${player.name}-whatsAppName` ? (
                    <TextField
                      value={editingPlayer.whatsAppName}
                      onChange={(e) => setEditingPlayer({...editingPlayer, whatsAppName: e.target.value})}
                      onBlur={handleFieldBlur}
                      onKeyDown={handleFieldKeyDown}
                      size="small"
                      autoFocus
                      fullWidth
                    />
                  ) : (
                    player.whatsAppName || <em style={{color: '#999'}}>Click to edit</em>
                  )}
                </TableCell>
                <TableCell>
                  <Button size="small" color="error" onClick={() => handleDeletePlayer(player.name)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Player Modal */}
      <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Player</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            variant="outlined"
            value={newPlayer.name}
            onChange={(e) => setNewPlayer({...newPlayer, name: e.target.value})}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Venmo Handle (@username)"
            fullWidth
            variant="outlined"
            value={newPlayer.venmoHandle}
            onChange={(e) => setNewPlayer({...newPlayer, venmoHandle: e.target.value})}
            placeholder="@johndoe"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Venmo Full Name"
            fullWidth
            variant="outlined"
            value={newPlayer.venmoFullName}
            onChange={(e) => setNewPlayer({...newPlayer, venmoFullName: e.target.value})}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="WhatsApp Name"
            fullWidth
            variant="outlined"
            value={newPlayer.whatsAppName}
            onChange={(e) => setNewPlayer({...newPlayer, whatsAppName: e.target.value})}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Rating (1-10)"
            type="number"
            inputProps={{ min: 1, max: 10, step: 0.1 }}
            fullWidth
            variant="outlined"
            value={newPlayer.rating}
            onChange={(e) => setNewPlayer({...newPlayer, rating: parseFloat(e.target.value)})}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Position</InputLabel>
            <Select
              value={newPlayer.position}
              label="Position"
              onChange={(e) => setNewPlayer({...newPlayer, position: e.target.value})}
            >
              <MenuItem value="goalkeeper">Goalkeeper</MenuItem>
              <MenuItem value="defender">Defender</MenuItem>
              <MenuItem value="midfielder">Midfielder</MenuItem>
              <MenuItem value="striker">Striker</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Preferred Team</InputLabel>
            <Select
              value={newPlayer.team}
              label="Preferred Team"
              onChange={(e) => setNewPlayer({...newPlayer, team: e.target.value})}
            >
              <MenuItem value="white">🏳️ White</MenuItem>
              <MenuItem value="dark">🏴 Dark</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Favorite Player</InputLabel>
            <Select
              value={newPlayer.favorite ? 'true' : 'false'}
              label="Favorite Player"
              onChange={(e) => setNewPlayer({...newPlayer, favorite: e.target.value === 'true'})}
            >
              <MenuItem value="false">☆ Regular Player</MenuItem>
              <MenuItem value="true">⭐ Favorite Player</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddModal(false)}>Cancel</Button>
          <Button onClick={handleSaveNewPlayer} variant="contained">Add Player</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default PlayerConfig;