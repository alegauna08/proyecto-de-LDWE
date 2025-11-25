document.addEventListener('DOMContentLoaded', () => {
    const API_KEY = '9d30130013a73f395300a5f143559bca'; 
    const API_URL = 'https://v3.football.api-sports.io';
    const HEADERS = { 'x-apisports-key': API_KEY };

    const cells = document.querySelectorAll('.cell');
    const rowCriteriaElements = document.querySelectorAll('.row-criteria'); 
    const colCriteriaElements = document.querySelectorAll('.col-criteria');
    const turnoIndicador = document.getElementById('turno-indicador');
    const jugadorInput = document.getElementById('jugador-input');
    const verificarBtn = document.getElementById('verificar-btn');
    const reiniciarBtn = document.getElementById('reiniciar-btn');
    const mensajeDiv = document.getElementById('mensaje');

    let board = [['', '', ''], ['', '', ''], ['', '', '']];
    let currentPlayer = 'player1';
    let currentPlayerSymbol = 'X';
    let gameActive = true;
    let selectedCell = null;
    let criteriosActuales = {};
    const cacheJugadores = {};

    const SEASON = '2023'; 
    const ligasDisponibles = [39, 140, 78, 61, 135, 45, 107, 34]; 
    
    async function fetchApiData(url) {
        const response = await fetch(url, { headers: HEADERS });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error HTTP: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        if (data.errors && Object.keys(data.errors).length > 0) {
            throw new Error(`Error API: ${JSON.stringify(data.errors)}`);
        }
        return data;
    }

    async function getSixClubsFromDifferentLeagues() {
        const clubesObtenidos = [];
        const ligasUsadas = new Set();
        const ligasMezcladas = [...ligasDisponibles].sort(() => 0.5 - Math.random());

        for (const ligaId of ligasMezcladas) {
            if (clubesObtenidos.length >= 6) break;

            try {
                const data = await fetchApiData(`${API_URL}/teams?league=${ligaId}&season=${SEASON}`);
                const equiposEnLiga = data.response;
                
                if (equiposEnLiga.length > 0) {
                    const shuffled = equiposEnLiga.sort(() => 0.5 - Math.random());
                    // Tomar 2 equipos por liga máximo
                    const equiposDeEstaLiga = shuffled.slice(0, 2);
                    clubesObtenidos.push(...equiposDeEstaLiga);
                    ligasUsadas.add(ligaId);
                    
                    console.log(`Añadidos ${equiposDeEstaLiga.length} equipos de la liga ${ligaId}`);
                }
            } catch (error) {
                console.warn(`No se pudieron obtener equipos de la liga ${ligaId}.`);
            }
        }

        console.log(`Total de equipos: ${clubesObtenidos.length}, de ${ligasUsadas.size} ligas diferentes`);

        if (clubesObtenidos.length < 6) {
            throw new Error(`Solo se pudieron obtener ${clubesObtenidos.length} clubes en total.`);
        }

        // Retornar solo los primeros 6, pero garantizando que vienen de diferentes ligas
        return clubesObtenidos.slice(0, 6);
    }

    async function iniciarJuego() {
        gameActive = false;
        mensajeDiv.textContent = 'Cargando clubes de diferentes ligas...';
        console.log('Iniciando juego...');
        
        try {
            const todosLosClubes = await getSixClubsFromDifferentLeagues();
            console.log('Clubes obtenidos:', todosLosClubes);
            
            const equiposFilas = todosLosClubes.slice(0, 3);
            const equiposColumnas = todosLosClubes.slice(3, 6);

            criteriosActuales = {
                filas: equiposFilas.map(e => ({ name: e.team.name, id: e.team.id })),
                columnas: equiposColumnas.map(e => ({ name: e.team.name, id: e.team.id }))
            };

            console.log('Criterios actuales:', criteriosActuales);

            rowCriteriaElements.forEach((el, index) => {
                el.textContent = criteriosActuales.filas[index].name;
                el.dataset.id = criteriosActuales.filas[index].id;
                console.log(`Fila ${index}:`, criteriosActuales.filas[index].name);
            });

            colCriteriaElements.forEach((el, index) => {
                el.textContent = criteriosActuales.columnas[index].name;
                el.dataset.id = criteriosActuales.columnas[index].id;
                console.log(`Columna ${index}:`, criteriosActuales.columnas[index].name);
            });
            
            resetGame();
            gameActive = true;
            mensajeDiv.textContent = '¡Empieza el juego 3x3!';
        } catch (error) {
            console.error("Error:", error);
            mensajeDiv.textContent = `Error: ${error.message}`;
            gameActive = false;
        }
    }

    const handleCellClick = (e) => {
        if (!gameActive) return;
        const cell = e.target;
        if (!cell.classList.contains('taken')) {
            if (selectedCell) {
                selectedCell.classList.remove('selected');
            }
            cell.classList.add('selected');
            selectedCell = cell;
            verificarBtn.disabled = false;
        }
    };

    const handleVerification = async () => {
        if (!selectedCell || !gameActive) return;

        const row = parseInt(selectedCell.dataset.row, 10);
        const col = parseInt(selectedCell.dataset.col, 10);
        const jugadorNombre = jugadorInput.value.trim();
        
        if (!jugadorNombre) {
            mensajeDiv.textContent = 'Introduce un nombre de jugador.';
            return;
        }

        const team1Id = criteriosActuales.filas[row].id;
        const team2Id = criteriosActuales.columnas[col].id;

        verificarBtn.disabled = true;
        mensajeDiv.textContent = 'Verificando...';

        try {
            const playerFound = await checkPlayerInTeams(jugadorNombre, team1Id, team2Id);

            if (playerFound) {
                selectedCell.textContent = jugadorNombre.toUpperCase();
                selectedCell.classList.remove('selected');
                selectedCell.classList.add('taken', currentPlayer);
                board[row][col] = currentPlayerSymbol;
                
                mensajeDiv.textContent = '✓ ¡Correcto!';

                if (checkWin(currentPlayerSymbol)) {
                    mensajeDiv.textContent = `🎉 ¡Ganó ${currentPlayer === 'player1' ? 'Jugador 1 (X)' : 'Jugador 2 (O)'}!`;
                    gameActive = false;
                    reiniciarBtn.classList.remove('hidden');
                } else if (checkDraw()) {
                    mensajeDiv.textContent = '🤝 ¡Empate!';
                    gameActive = false;
                    reiniciarBtn.classList.remove('hidden');
                } else {
                    switchPlayer();
                }
            } else {
                mensajeDiv.textContent = '✗ Jugador incorrecto. Turno saltado.';
                selectedCell.classList.remove('selected');
                switchPlayer();
            }
        } catch (error) {
            console.error('Error:', error);
            mensajeDiv.textContent = 'Error al verificar.';
            selectedCell.classList.remove('selected');
        }

        jugadorInput.value = '';
        verificarBtn.disabled = true;
        selectedCell = null;
    };

    const checkPlayerInTeams = async (playerName, team1Id, team2Id) => {
        const cacheKey = `${playerName}-${team1Id}-${team2Id}`;
        if (cacheJugadores[cacheKey] !== undefined) {
            return cacheJugadores[cacheKey];
        }

        try {
            const data1 = await fetchApiData(`${API_URL}/players?team=${team1Id}&search=${playerName}&season=${SEASON}`); 
            
            if (data1.results > 0) {
                const playerInTeam1 = data1.response.some(p => p.player.name.toLowerCase().includes(playerName.toLowerCase()));
                if (playerInTeam1) {
                    const data2 = await fetchApiData(`${API_URL}/players?team=${team2Id}&search=${playerName}&season=${SEASON}`);
                    const playerInTeam2 = data2.response.some(p => p.player.name.toLowerCase().includes(playerName.toLowerCase()));
                    cacheJugadores[cacheKey] = playerInTeam2;
                    return playerInTeam2;
                }
            }
            
            cacheJugadores[cacheKey] = false;
            return false;
        } catch (error) {
            console.error('Error API:', error);
            throw error;
        }
    };

    const switchPlayer = () => {
        currentPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';
        currentPlayerSymbol = currentPlayerSymbol === 'X' ? 'O' : 'X';
        turnoIndicador.textContent = `Turno: ${currentPlayer === 'player1' ? 'Jugador 1 (X)' : 'Jugador 2 (O)'}`;
        jugadorInput.focus();
    };

    const checkWin = (symbol) => {
        for (let r = 0; r < 3; r++) {
            if (board[r][0] === symbol && board[r][1] === symbol && board[r][2] === symbol) return true;
        }
        for (let c = 0; c < 3; c++) {
            if (board[0][c] === symbol && board[1][c] === symbol && board[2][c] === symbol) return true;
        }
        if (board[0][0] === symbol && board[1][1] === symbol && board[2][2] === symbol) return true;
        if (board[0][2] === symbol && board[1][1] === symbol && board[2][0] === symbol) return true;

        return false;
    };

    const checkDraw = () => {
        return board.every(row => row.every(cell => cell !== ''));
    };

    const resetGame = () => {
        board = [['', '', ''], ['', '', ''], ['', '', '']];
        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('taken', 'player1', 'player2', 'selected');
        });
        currentPlayer = 'player1';
        currentPlayerSymbol = 'X';
        gameActive = true;
        selectedCell = null;
        turnoIndicador.textContent = `Turno: Jugador 1 (X)`;
        mensajeDiv.textContent = '';
        reiniciarBtn.classList.add('hidden');
        verificarBtn.disabled = true;
        jugadorInput.value = '';
        jugadorInput.focus();
    };

    cells.forEach(cell => cell.addEventListener('click', handleCellClick));
    verificarBtn.addEventListener('click', handleVerification);
    reiniciarBtn.addEventListener('click', iniciarJuego);

    iniciarJuego();
});
