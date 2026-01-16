const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('gameId') || '12345678';
const playerId = parseInt(urlParams.get('playerId')) || 1;

let db;
let currentState = Array(100).fill(0);
let previousState = Array(100).fill(0);
let playerOneColor;
let playerTwoColor;
let playerOneHand = [];
let playerTwoHand = [];
let discardPile = [];
let lastPlayedCard = 0;
let remainingDeck = [];
let currentPlayer = 1;
let selectedCard;
let playsRemaining = 0;
let pendingMoves = [];
let groundTruthFirstClick = null;
let hotspotFirstClick = null;
let hotspotPhase = "initial";

firebase.initializeApp(firebaseConfig);
db = firebase.database();

function addLog(message) {
    const logContainer = document.getElementById('activity-log');
    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry');
    logEntry.innerText = message;
    logContainer.prepend(logEntry);
    
    const allEntries = logContainer.querySelectorAll('.log-entry');
    if (allEntries.length > 50) {
        allEntries[allEntries.length - 1].remove();
    }
}

function displayCurrentCard(card) {
    const cardDisplay = document.getElementById('current-card-display');
    if (!card) {
        cardDisplay.className = 'empty';
        cardDisplay.innerHTML = 'No card selected';
        return;
    }
    
    cardDisplay.className = '';
    cardDisplay.innerHTML = `
        <h3>${card.name}</h3>
        <p>${card.description}</p>
    `;
}

async function selectCard(card) {
    selectedCard = card;
    displayCurrentCard(card);
    addLog(`Player ${currentPlayer} selected ${card.name}`);

    if (card.executionType === "immediate") {
        let result = card.execute(currentState, previousState, currentPlayer);
        if (result) {
            currentState = result;
            setBoardState(currentState, playerOneColor, playerTwoColor);
        }
        endTurn(card);
    } else if (card.executionType === "choice-direction") {
        const choice = await createChoiceModal("Direction");
        let result = card.execute(currentState, previousState, choice, currentPlayer);
        if (result) {
            currentState = result;
            setBoardState(currentState, playerOneColor, playerTwoColor);
        }
        endTurn(card);
    } else if (card.executionType === "choice-layer") {
        const choice = await createChoiceModal("Layer Type");
        let result = card.execute(currentState, previousState, choice, currentPlayer);
        if (result) {
            currentState = result;
            setBoardState(currentState, playerOneColor, playerTwoColor);
        }
        endTurn(card);
    } else if (card.executionType === "choice-discard") {
        await card.execute(currentState, null, currentPlayer, isValidMove);
    } else if (card.executionType === "choice-deck-5") {
        let result = await card.execute(currentState, null, currentPlayer, isValidMove);
        endTurn(card);
    } else if (card.executionType === "crunch") {
        let result = card.execute(currentState, null, currentPlayer, isValidMove);
        endTurn(card);
    } else if (card.executionType === "choice-opponent-card") {
        let result = await card.execute(currentState, null, currentPlayer, isValidMove);
        endTurn(card);
    } else if (card.executionType === "ground-truth") {
        playsRemaining = card.movesRemaining;
        groundTruthFirstClick = null;
    } else if (card.executionType === "spatial-join") {
        initializeSpatialJoin();
    } else if (card.executionType === "hotspot") {
        playsRemaining = card.movesRemaining;
        hotspotFirstClick = null;
        hotspotPhase = "initial";
    }
}

function setupFirebaseListeners() {
    const gameStatesRef = db.ref('game-states');

    gameStatesRef.orderByChild('gameId').equalTo(gameId).once('value', (snapshot) => {
        const data = snapshot.val();

        if (data) {
            const gameStateKey = Object.keys(data)[0];
            const gameData = data[gameStateKey];

            if (playerId === 1 && gameData.playerOneJoined) {
                alert('Player 1 slot is already taken!');
                addLog('Attempted to join as Player 1 but slot was taken');
                return;
            }
            if (playerId === 2 && gameData.playerTwoJoined) {
                alert('Player 2 slot is already taken!');
                addLog('Attempted to join as Player 2 but slot was taken');
                return;
            }

            const updateData = {};
            if (playerId === 1) {
                updateData.playerOneJoined = true;
            } else if (playerId === 2) {
                updateData.playerTwoJoined = true;
            }
            
            gameStatesRef.child(gameStateKey).update(updateData);
            addLog(`Player ${playerId} joined the game`);
        }
    });

    gameStatesRef.orderByChild('gameId').equalTo(gameId).on('value', (snapshot) => {
        const data = snapshot.val();

        if (data) {
            const gameStateKey = Object.keys(data)[0];
            const gameData = data[gameStateKey];

            if (gameData.gameState) {
                if (currentState && currentState.length > 0) {
                    previousState = [...currentState];
                }

                currentState = JSON.parse(gameData.gameState);
                currentPlayer = gameData.currentPlayer || 1;

                playerOneColor = gameData.playerOneColor;
                playerTwoColor = gameData.playerTwoColor;

                playerOneHand = JSON.parse(gameData.playerOneHand);
                playerTwoHand = JSON.parse(gameData.playerTwoHand);

                discardPile = JSON.parse(gameData.discardPile);
                lastPlayedCard = gameData.lastPlayedCard;
                remainingDeck = JSON.parse(gameData.remainingDeck);

                pendingMoves = JSON.parse(gameData.pendingMoves) || [];

                setBoardState(currentState, playerOneColor, playerTwoColor);
                
                highlightChanges(currentState, previousState);

                dealCards(playerId);
            }
        }
    })
}

function buildBoard() {
    boardArea = document.getElementById('game-board');

    for (let i = 0; i < 100; i++) {
        const boardSpace = document.createElement('div');
        boardSpace.classList.add('board-space');
        boardSpace.id = `board-space${i}`;

        boardArea.appendChild(boardSpace);

        const gamePiece = document.createElement('div');
        gamePiece.classList.add('gamePiece');
        gamePiece.id = `game-piece${i}`;
        gamePiece.addEventListener('click', function() {
            executeCard(i);
        });

        boardSpace.appendChild(gamePiece);
    }
}

function setBoardState(currentState, playerOneColor, playerTwoColor){
    for (let i = 0; i < 100; i++ ) {
        const currentSpace = currentState[i];
        const gamePiece = document.getElementById(`game-piece${i}`);

        if (currentSpace == 1) {
            gamePiece.style.backgroundColor = playerOneColor;
        } else if (currentSpace == 2)
        {
            gamePiece.style.backgroundColor = playerTwoColor;
        } else {
            gamePiece.style.backgroundColor = 'rgba(0,0,0,0)';
        }
    };
}

function dealCards(playerId) {
    const playerHand = playerId === 1 ? playerOneHand : playerTwoHand;
    const handContainer = document.getElementById('player-hand-container');
    handContainer.innerHTML = '';

    playerHand.forEach(cardId => {
        const cardContainer = createCardElement(cardId);
        cardContainer.addEventListener('click', function() {
            const card = getCardById(cardId);
            showMagnifiedCard(card);
        });

        handContainer.appendChild(cardContainer);
    });

    const opponentHandContainer = document.getElementById('opponent-hand-container');
    opponentHandContainer.innerHTML = '';
    const opponentHand = playerId === 1 ? playerTwoHand : playerOneHand;

    opponentHand.forEach((cardId) => {
        const cardContainer = createCardElement(cardId);
        cardContainer.querySelector('.card-container-inner').classList.add('flip');
        
        opponentHandContainer.appendChild(cardContainer);
    });
}

function createCardElement(cardId) {
    const card = getCardById(parseInt(cardId));
    if (!card) {
        addLog(`Card with ID ${cardId} not found`);
        return;
    }

    const cardContainer = document.createElement('div');
    cardContainer.classList.add('card-container');
    cardContainer.id = `card-${card.cardId}`;

    const cardContainerInner = document.createElement('div');
    cardContainerInner.classList.add('card-container-inner');
    
    const cardBack = document.createElement('div');
    cardBack.classList.add('card-back');
    const cardBackTitle = document.createElement('h3');
    cardBackTitle.innerText = "GIS Battle";
    cardBack.appendChild(cardBackTitle);
    
    const cardFront = document.createElement('div');
    cardFront.classList.add('card-front');
    const cardTitle = document.createElement('h3');
    cardTitle.innerText = card.name;
    const cardDescription = document.createElement('p');
    cardDescription.innerText = card.description;

    cardFront.appendChild(cardTitle);
    cardFront.appendChild(cardDescription);

    cardContainerInner.appendChild(cardBack);
    cardContainerInner.appendChild(cardFront);
    cardContainer.appendChild(cardContainerInner);

    return cardContainer;
}

function getCardById(cardId) {
    return Object.values(cardTypes).find(card => card.cardId === cardId);
}

function showMagnifiedCard(card) {
    const existingOverlay = document.getElementById('board-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'board-overlay';

    const magnifiedCard = createCardElement(card.cardId);

    const useButton = document.createElement('button');
    useButton.innerText = 'Use Card';
    useButton.addEventListener('click', function() {
        overlay.remove();
        selectCard(card);
    });

    overlay.appendChild(magnifiedCard);
    overlay.appendChild(useButton);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
}

function highlightCard(cardId) {
    const highlightedCard = document.getElementById(`card-${cardId}`);
    const otherCards = document.querySelectorAll('.card-container');

    otherCards.forEach(card => {
        card.classList.remove('highlighted-card');
    });

    highlightedCard.classList.add('highlighted-card');   
}

function executeCard(clickedSquare) {
    const card = selectedCard;

    if (card.executionType === "ground-truth") {
        if (groundTruthFirstClick === null) {
            if (currentState[clickedSquare] !== 0) {
                groundTruthFirstClick = clickedSquare;
                document.getElementById(`board-space${clickedSquare}`).classList.add('highlight-change');
                addLog(`Selected piece at square ${clickedSquare} to move`);
            } else {
                addLog("No piece at that location");
            }
        } else {
            const fromSquare = groundTruthFirstClick;
            const toSquare = clickedSquare;
            
            document.getElementById(`board-space${fromSquare}`).classList.remove('highlight-change');
            
            let result = card.execute(currentState, fromSquare, toSquare, currentPlayer, isValidMove);
            
            if (result !== false) {
                currentState = result;
                setBoardState(currentState, playerOneColor, playerTwoColor);
                playsRemaining--;
                
                groundTruthFirstClick = null;
                
                if (playsRemaining === 0) {
                    endTurn(card);
                }
            } else {
                addLog("Invalid move, try again");
                groundTruthFirstClick = null;
            }
        }
        return;
    }

    if (card.executionType === "spatial-join") {
        let result = card.execute(currentState, clickedSquare, currentPlayer, isValidMove);
        
        if (result !== false) {
            currentState = result;
            setBoardState(currentState, playerOneColor, playerTwoColor);
            playsRemaining--;
            
            if (playsRemaining === 0) {
                document.querySelectorAll('.board-space').forEach(space => {
                    space.classList.remove('highlight-change');
                });
                delete currentState.spatialJoinValidSquares;
                endTurn(card);
            }
        } else {
            addLog("Invalid placement");
        }
        return;
    }

    if (card.executionType === "hotspot") {
        if (hotspotPhase === "initial") {
            let result = card.execute(currentState, clickedSquare, null, currentPlayer, isValidMove, true);
            
            if (result !== false) {
                currentState = result;
                setBoardState(currentState, playerOneColor, playerTwoColor);
                hotspotPhase = "moving";
            }
        } else if (hotspotPhase === "moving") {
            if (hotspotFirstClick === null) {
                if (currentState[clickedSquare] === currentPlayer) {
                    hotspotFirstClick = clickedSquare;
                    document.getElementById(`board-space${clickedSquare}`).classList.add('highlight-change');
                    addLog(`Selected piece at square ${clickedSquare} to move`);
                } else {
                    addLog("Must select one of your pieces");
                }
            } else {
                const fromSquare = hotspotFirstClick;
                const toSquare = clickedSquare;
                
                document.getElementById(`board-space${fromSquare}`).classList.remove('highlight-change');
                
                let result = card.execute(currentState, fromSquare, toSquare, currentPlayer, isValidMove, false);
                
                if (result !== false) {
                    currentState = result;
                    setBoardState(currentState, playerOneColor, playerTwoColor);
                    playsRemaining--;
                    
                    hotspotFirstClick = null;
                    
                    if (playsRemaining === 0) {
                        if (validateHotspotPolygon()) {
                            document.querySelectorAll('.board-space').forEach(space => {
                                space.classList.remove('highlight-change');
                            });
                            delete currentState.hotspotAnchor;
                            endTurn(card);
                        } else {
                            alert('Pieces must form a polygon with the anchor piece. Turn cancelled.');
                            addLog('Hotspot validation failed - turn cancelled');
                            document.querySelectorAll('.board-space').forEach(space => {
                                space.classList.remove('highlight-change');
                            });
                            delete currentState.hotspotAnchor;
                        }
                    }
                } else {
                    addLog("Invalid move, try again");
                    hotspotFirstClick = null;
                }
            }
        }
        return;
    }

    if (playsRemaining === 0) {
        playsRemaining = card.numberOfPlays || 1;
    }

    let result = card.execute(currentState, clickedSquare, currentPlayer, isValidMove);

    if (result != false) {
        currentState = result;
        setBoardState(currentState, playerOneColor, playerTwoColor);
        playsRemaining--;
        
        if (currentState && playsRemaining === 0) {
            endTurn(card);
        }
    } else {
        addLog("Move was invalid, try again");
    }
}

function switchPlayer() {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    addLog(`Switched to Player ${currentPlayer}'s turn`);
    dealCards(playerId);
}

function endTurn(card) {
    const currentHand = currentPlayer === 1 ? playerOneHand : playerTwoHand;
    const cardIndex = currentHand.indexOf(card.cardId);
    currentHand.splice(cardIndex, 1);
    lastPlayedCard = card.cardId;
    discardPile.push(card.cardId);
    addLog(`Player ${currentPlayer} played ${card.name}`);
    displayCurrentCard(null);
    switchPlayer();
    updateFirebase();

    if (playerOneHand.length === 0 && playerTwoHand.length === 0) {
        beginEndGame();
    }
}

function updateFirebase() {
    const gameStatesRef = db.ref('game-states');
    
    gameStatesRef.orderByChild('gameId').equalTo(gameId).once('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            const gameStateKey = Object.keys(data)[0];
            
            gameStatesRef.child(gameStateKey).update({
                gameState: JSON.stringify(currentState),
                currentPlayer: currentPlayer,
                playerOneHand: JSON.stringify(playerOneHand),
                playerTwoHand: JSON.stringify(playerTwoHand),
                discardPile: JSON.stringify(discardPile),
                lastPlayedCard: lastPlayedCard,
                remainingDeck: JSON.stringify(remainingDeck),
                pendingMoves: JSON.stringify(pendingMoves)
            }).then(() => {
                addLog('Game state updated');
            }).catch((error) => {
                addLog('Error updating game state: ' + error);
            });
        }
    });
}

function highlightChanges(newState, oldState) {
    document.querySelectorAll('.board-space').forEach(space => {
        space.classList.remove('highlight-change');
    });

    for (let i = 0; i < 100; i++) {
        if (newState[i] !== oldState[i]) {
            const gameSpace = document.getElementById(`board-space${i}`);
            gameSpace.classList.add('highlight-change');
        }
    }
}

function createChoiceModal(choiceType) {
    return new Promise((resolve) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'board-overlay';

        const choiceContent = document.createElement('div');
        choiceContent.id = 'choice-content';
        choiceContent.classList.add('card-container');

        const choiceTitle = document.createElement('h3');
        choiceTitle.innerText = `Choose ${choiceType}`;
        choiceContent.appendChild(choiceTitle);

        const options = choiceType === "Direction" 
            ? ['North', 'East', 'South', 'West']
            : ['Points', 'Lines', 'Polygons'];

        options.forEach(option => {
            const button = document.createElement('button');
            button.innerText = option;
            button.addEventListener('click', function() {
                addLog(`Chosen ${choiceType}: ${option}`);
                modalOverlay.remove();
                resolve(option); 
            });
            choiceContent.appendChild(button);
        });

        modalOverlay.appendChild(choiceContent);
        document.body.appendChild(modalOverlay);
    });
}

function createDiscardChoiceModal() {
    return new Promise((resolve) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'board-overlay';

        const choiceContent = document.createElement('div');
        choiceContent.id = 'choice-content';

        const choiceTitle = document.createElement('h3');
        choiceTitle.innerText = 'Choose a Card from Discard Pile';
        choiceContent.appendChild(choiceTitle);

        if (discardPile.length > 0) {
            const firstCardId = discardPile[0];
            const cardElement = createCardElement(firstCardId);
            
            const selectButton = document.createElement('button');
            selectButton.innerText = 'Select This Card';
            selectButton.addEventListener('click', function() {
                addLog(`Selected card from discard pile`);
                modalOverlay.remove();
                resolve(firstCardId);
            });

            choiceContent.appendChild(cardElement);
            choiceContent.appendChild(selectButton);
        }

        const cancelButton = document.createElement('button');
        cancelButton.innerText = 'Cancel';
        cancelButton.addEventListener('click', function() {
            modalOverlay.remove();
            resolve(null);
        });

        choiceContent.appendChild(cancelButton);
        modalOverlay.appendChild(choiceContent);
        document.body.appendChild(modalOverlay);
    });
}

function createDeckChoiceModal(numberOfCards) {
    return new Promise((resolve) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'board-overlay';

        const choiceContent = document.createElement('div');
        choiceContent.id = 'choice-content';

        const choiceTitle = document.createElement('h3');
        choiceTitle.innerText = `Choose a Card from Top ${numberOfCards} of Deck`;
        choiceContent.appendChild(choiceTitle);

        const topCards = remainingDeck.slice(0, numberOfCards);
        
        if (topCards.length > 0) {
            const firstCardId = topCards[0];
            const cardElement = createCardElement(firstCardId);
            
            const selectButton = document.createElement('button');
            selectButton.innerText = 'Select This Card';
            selectButton.addEventListener('click', function() {
                addLog(`Selected card from deck`);
                modalOverlay.remove();
                resolve(firstCardId);
            });

            choiceContent.appendChild(cardElement);
            choiceContent.appendChild(selectButton);
        }

        const cancelButton = document.createElement('button');
        cancelButton.innerText = 'Cancel';
        cancelButton.addEventListener('click', function() {
            modalOverlay.remove();
            resolve(null);
        });

        choiceContent.appendChild(cancelButton);
        modalOverlay.appendChild(choiceContent);
        document.body.appendChild(modalOverlay);
    });
}

async function createCollaborationModal(opponentHand, opponentPlayer) {
    return new Promise((resolve) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'board-overlay';

        const choiceContent = document.createElement('div');
        choiceContent.id = 'choice-content';

        const choiceTitle = document.createElement('h3');
        choiceTitle.innerText = `Reveal Player ${opponentPlayer}'s Card`;
        choiceContent.appendChild(choiceTitle);

        if (opponentHand.length > 0) {
            const firstCardId = opponentHand[0];
            const cardElement = createCardElement(firstCardId);

            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '10px';
            buttonContainer.style.marginTop = '10px';

            const useButton = document.createElement('button');
            useButton.innerText = 'Use This Card';
            useButton.addEventListener('click', function() {
                addLog(`Using opponent's card`);
                modalOverlay.remove();
                resolve({ cardId: firstCardId, action: 'use'});
            });

            const discardButton = document.createElement('button');
            discardButton.innerText = 'Discard This Card';
            discardButton.addEventListener('click', function() {
                addLog(`Forcing opponent to discard card`);
                modalOverlay.remove();
                resolve({ cardId: firstCardId, action: 'discard'});
            });

            buttonContainer.appendChild(useButton);
            buttonContainer.appendChild(discardButton);

            choiceContent.appendChild(cardElement);
            choiceContent.appendChild(buttonContainer);
        }

        const cancelButton = document.createElement('button');
        cancelButton.innerText = 'Cancel';
        cancelButton.addEventListener('click', function() {
            modalOverlay.remove();
            resolve(null);
        });

        choiceContent.appendChild(cancelButton);
        modalOverlay.appendChild(choiceContent);
        document.body.appendChild(modalOverlay);
    })
}

function initializeSpatialJoin() {
    const visited = new Set();
    const features = [];
    
    currentState.forEach((space, index) => {
        if (space === currentPlayer && !visited.has(index)) {
            const polygon = determinePolygon(currentState, index, currentPlayer);
            const line = determineLine(currentState, index, currentPlayer);
            
            if (polygon) {
                polygon.forEach(sq => visited.add(sq));
                features.push({ type: 'polygon', squares: polygon });
            } else if (line) {
                line.forEach(sq => visited.add(sq));
                features.push({ type: 'line', squares: line });
            }
        }
    });
    
    if (features.length === 0) {
        addLog("No line or polygon features found");
        endTurn(selectedCard);
        return;
    }
    
    const validSquares = new Set();
    
    features.forEach(feature => {
        feature.squares.forEach(square => {
            const neighbors = feature.type === 'polygon' 
                ? [square - 1, square + 1, square - 10, square + 10]
                : [square - 1, square + 1, square - 9, square + 9, square - 10, square - 11, square + 10, square + 11];
            
            neighbors.forEach(neighbor => {
                if (isValidMove(square, neighbor) && currentState[neighbor] === 0) {
                    validSquares.add(neighbor);
                }
            });
        });
    });
    
    features.forEach(feature => {
        feature.squares.forEach(square => {
            document.getElementById(`board-space${square}`).classList.add('highlight-change');
        });
    });
    
    currentState.spatialJoinValidSquares = validSquares;
    playsRemaining = features.length;
    
    addLog(`Spatial Join: ${features.length} feature(s) found`);
}

function validateHotspotPolygon() {
    if (!currentState.hotspotAnchor) return false;
    
    const polygon = determinePolygon(currentState, currentState.hotspotAnchor, currentPlayer);
    
    if (polygon && polygon.length >= 4) {
        addLog("Valid polygon formed!");
        return true;
    }
    
    addLog("Does not form a valid polygon");
    return false;
}

async function beginEndGame() {
    addLog("Beginning end game sequence...");
    
    if (pendingMoves.length > 0) {
        addLog(`Processing ${pendingMoves.length} pending moves`);
        await processPendingMoves();
    }

    const playerOneCount = currentState.filter(space => space === 1).length;
    const playerTwoCount = currentState.filter(space => space === 2).length;

    addLog(`Final Score - Player One: ${playerOneCount}, Player Two: ${playerTwoCount}`);

    const winner = playerOneCount > playerTwoCount ? 'Player One Wins!' :
                   playerTwoCount > playerOneCount ? 'Player Two Wins!' :
                   'It\'s a Tie!';
    
    addLog(winner);

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'board-overlay';

    const resultContent = document.createElement('div');
    resultContent.id = 'choice-content';
    resultContent.classList.add('card-container');
    
    const resultTitle = document.createElement('h2');
    resultTitle.innerText = 'Game Over!';
    
    const winnerText = document.createElement('h3');
    winnerText.innerText = winner;
    
    const scoreText = document.createElement('p');
    scoreText.innerText = `Player One: ${playerOneCount} pieces\nPlayer Two: ${playerTwoCount} pieces`;

    resultContent.appendChild(resultTitle);
    resultContent.appendChild(winnerText);
    resultContent.appendChild(scoreText);
    
    modalOverlay.appendChild(resultContent);
    document.body.appendChild(modalOverlay);
}

async function processPendingMoves() {
    addLog("Processing all pending moves...");
    
    for (const move of pendingMoves) {
        const moveType = move[0];
        
        if (moveType === 'modelBuilder') {
            const player = move[1][0];
            const cardId = move[1][1];
            
            addLog(`Processing Model Builder for Player ${player} with card ${cardId}`);
            
            const card = getCardById(cardId);
            if (card) {
                await executeEndGameCard(card, player);
            }
            
        } else if (moveType === 'crunch') {
            const player = move[1];
            
            addLog(`Processing Crunch Time for Player ${player}`);
            
            const chosenCardId = await createDeckChoiceModal(3);
            if (chosenCardId) {
                const card = getCardById(chosenCardId);
                if (card) {
                    await executeEndGameCard(card, player);
                }
            }
        }
    }
    
    pendingMoves = [];
    updateFirebase();
}

async function executeEndGameCard(card, player) {
    return new Promise((resolve) => {
        addLog(`Player ${player} executing card: ${card.name}`);
        
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'board-overlay';

        const messageContent = document.createElement('div');
        messageContent.id = 'choice-content';
        messageContent.classList.add('card-container');
        
        const messageTitle = document.createElement('h3');
        messageTitle.innerText = `Player ${player}: Use ${card.name}`;
        
        const cardElement = createCardElement(card.cardId);
        
        const continueButton = document.createElement('button');
        continueButton.innerText = 'Execute Card';
        continueButton.addEventListener('click', async function() {
            modalOverlay.remove();
            
            const originalPlayer = currentPlayer;
            currentPlayer = player;
            
            if (card.executionType === "placement") {
                selectedCard = card;
                playsRemaining = card.numberOfPlays || 1;
                await waitForCardCompletion();
            } else if (card.executionType === "immediate") {
                let result = card.execute(currentState, previousState, player);
                if (result) {
                    currentState = result;
                    setBoardState(currentState, playerOneColor, playerTwoColor);
                }
            } else if (card.executionType === "choice-direction") {
                const choice = await createChoiceModal("Direction");
                let result = card.execute(currentState, previousState, choice, player);
                if (result) {
                    currentState = result;
                    setBoardState(currentState, playerOneColor, playerTwoColor);
                }
            } else if (card.executionType === "choice-layer") {
                const choice = await createChoiceModal("Layer Type");
                let result = card.execute(currentState, previousState, choice, player);
                if (result) {
                    currentState = result;
                    setBoardState(currentState, playerOneColor, playerTwoColor);
                }
            }
            
            currentPlayer = originalPlayer;
            
            await new Promise(r => setTimeout(r, 1000));
            
            resolve();
        });

        messageContent.appendChild(messageTitle);
        messageContent.appendChild(cardElement);
        messageContent.appendChild(continueButton);
        modalOverlay.appendChild(messageContent);
        document.body.appendChild(modalOverlay);
    });
}

function waitForCardCompletion() {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (playsRemaining === 0) {
                clearInterval(checkInterval);
                selectedCard = null;
                resolve();
            }
        }, 100);
    });
}

window.onload = function() {
    buildBoard();
    setBoardState(currentState, playerOneColor, playerTwoColor);
    setupFirebaseListeners();
}