const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('gameId') || '12345678';
const playerId = parseInt(urlParams.get('playerId')) || 1;

let db;
let map;
let currentState = Array(100).fill(0);
let previousState = Array(100).fill(0);
let mapCoordinates = [0, 0];
let mapZoom = 1;
let mapBasemap = 'imagery';
let initialPieces = 10;
let playerOneColor;
let playerTwoColor;
let playerOneHand = [];
let playerTwoHand = [];
let playerOnePlayedFirstTurn = false;
let playerTwoPlayedFirstTurn = false;
let gameOver = false;
let cumulativeScore = {playerOne: 0, playerTwo: 0};
let discardPile = [];
let lastPlayedCard = 99;
let lastPlayedCardPlayer = 1;
let remainingDeck = [];
let currentPlayer = 1;
let selectedCard;
let playsRemaining = 0;
let pendingMoves = [];
let groundTruthFirstClick = null;
let hotspotFirstClick = null;
let hotspotPhase = "initial";
let gameLog = [];
let isListenerSetup = false;
let isMapInitialized = false;

document.getElementById('game-id-display').textContent = `Game: ${gameId}`;

firebase.initializeApp(firebaseConfig);
db = firebase.database();
const gameStatesRef = db.ref('game-states');

function addLog(message) {
    const now = new Date();
    const timeStamp = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });

    const logEntry = timeStamp + " " + message;
    gameLog.push(logEntry);
    
    updateLogDisplay();
}

function updateLogDisplay() {
    const logContainer = document.getElementById('activity-log');
    logContainer.innerHTML = '';
    
    gameLog.slice().reverse().forEach(logText => {
        const logElement = document.createElement('div');
        logElement.classList.add('log-entry');
        logElement.innerText = logText;
        logContainer.appendChild(logElement);
    });
    
    const allEntries = logContainer.querySelectorAll('.log-entry');
    if (allEntries.length > 50) {
        gameLog = gameLog.slice(-50);
    }
}

function updateDeckIndicators() {
    const discardIndicator = document.getElementById('discard-pile');
    const deckIndicator = document.getElementById('remaining-deck');
    
    if (discardIndicator) {
        discardIndicator.innerHTML = '';
        discardIndicator.classList.add('deck-container');
        
        const numCards = discardPile.length;
        const maxDisplay = 5;
        const cardsToShow = Math.min(numCards, maxDisplay);
        
        for (let i = 0; i < cardsToShow; i++) {
            const discardItem = discardPile[numCards - cardsToShow + i];
            const playerColor = discardItem.player === 1 ? playerOneColor : playerTwoColor;
            
            const cardEl = document.createElement('div');
            cardEl.classList.add('card-back', 'stacked-card');
            cardEl.style.backgroundColor = playerColor;
            cardEl.style.left = (i * 2) + 'px';
            cardEl.style.top = '0px';
            cardEl.style.zIndex = i;
            
            const img = document.createElement('img');
            img.src = '../styles/gis-battle.svg';
            img.alt = 'GIS Battle Logo';
            
            const label = document.createElement('h3');
            label.textContent = 'GIS Battle';
            
            cardEl.appendChild(img);
            cardEl.appendChild(label);
            discardIndicator.appendChild(cardEl);
        }
    }
    
    if (deckIndicator) {
        deckIndicator.innerHTML = '';
        deckIndicator.classList.add('deck-container');
        
        const numCards = remainingDeck.length;
        const maxDisplay = 5;
        const cardsToShow = Math.min(numCards, maxDisplay);
        
        for (let i = 0; i < cardsToShow; i++) {
            const cardEl = document.createElement('div');
            cardEl.classList.add('card-back', 'stacked-card');
            cardEl.style.backgroundColor = '#667eea';
            cardEl.style.left = (i * 2) + 'px';
            cardEl.style.top = '0px';
            cardEl.style.zIndex = i;
            
            const img = document.createElement('img');
            img.src = '../styles/gis-battle.svg';
            img.alt = 'GIS Battle Logo';
            
            const label = document.createElement('h3');
            label.textContent = 'GIS Battle';
            
            cardEl.appendChild(img);
            cardEl.appendChild(label);
            deckIndicator.appendChild(cardEl);
        }
    }
}

displayCurrentCard = function(card) {
    const cardDisplay = document.getElementById('current-card-mini');
    if (!cardDisplay) return;
    
    cardDisplay.innerHTML = '';
    
    if (card) {
        const cardBack = document.createElement('div');
        cardBack.classList.add('card-back');
        cardBack.style.backgroundColor = currentPlayer === 1 ? playerOneColor : playerTwoColor;
        
        const img = document.createElement('img');
        img.src = '../styles/gis-battle.svg';
        img.alt = 'GIS Battle Logo';
        
        const label = document.createElement('h3');
        label.textContent = card.name || 'GIS Battle';
        
        cardBack.appendChild(img);
        cardBack.appendChild(label);
        cardDisplay.appendChild(cardBack);
    } else {
        const lastCard = getCardById(lastPlayedCard);
        if (lastCard) {
            const cardContainer = document.createElement('div');
            cardContainer.className = 'last-card-container';
            
            const cardBack = document.createElement('div');
            cardBack.classList.add('card-back');
            cardBack.style.backgroundColor = lastPlayedCardPlayer === 1 ? playerOneColor : playerTwoColor;
            cardBack.style.cursor = 'pointer';
            
            const img = document.createElement('img');
            img.src = '../styles/gis-battle.svg';
            img.alt = 'GIS Battle Logo';
            
            const label = document.createElement('h3');
            label.textContent = lastCard.name || 'GIS Battle';
            
            cardBack.appendChild(img);
            cardBack.appendChild(label);
            
            cardBack.addEventListener('click', function() {
                showLastPlayedCardMagnified();
            });
            
            cardContainer.appendChild(cardBack);
            
            if (playsRemaining > 0) {
                const indicatorContainer = document.createElement('div');
                indicatorContainer.className = 'plays-remaining-indicator';
                
                for (let i = 0; i < (lastCard.numberOfPlays || 1); i++) {
                    const circle = document.createElement('div');
                    circle.className = 'play-circle';
                    if (i < playsRemaining) {
                        circle.classList.add('play-circle-active');
                    }
                    indicatorContainer.appendChild(circle);
                }
                
                cardContainer.appendChild(indicatorContainer);
            }
            
            cardDisplay.appendChild(cardContainer);
        }
    }
};

function showLastPlayedCardMagnified() {
    const lastCard = getCardById(lastPlayedCard);
    if (!lastCard) return;
    
    const existingOverlay = document.getElementById('board-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'board-overlay';
    
    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-selector-container';
    
    const magnifiedCard = document.createElement('div');
    magnifiedCard.classList.add('magnified-card', 'magnified-card-display');
    magnifiedCard.style.border = `3px solid ${lastPlayedCardPlayer === 1 ? playerOneColor : playerTwoColor}`;
    
    const cardTitle = document.createElement('h3');
    cardTitle.classList.add('magnified-card-title');
    cardTitle.innerText = lastCard.name;
    
    const cardDescription = document.createElement('p');
    cardDescription.classList.add('magnified-card-description');
    cardDescription.innerText = lastCard.description;
    
    magnifiedCard.appendChild(cardTitle);
    magnifiedCard.appendChild(cardDescription);
    
    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'card-wrapper';
    cardWrapper.appendChild(magnifiedCard);
    
    cardContainer.appendChild(cardWrapper);
    overlay.appendChild(cardContainer);
    
    const closeButton = document.createElement('button');
    closeButton.className = 'cancel-button';
    closeButton.innerText = 'Close';
    closeButton.addEventListener('click', function() {
        overlay.remove();
    });
    
    overlay.appendChild(closeButton);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
    
    document.body.appendChild(overlay);
}

async function selectCard(card) {
    selectedCard = card;
    displayCurrentCard(card);
    addLog(`Player ${currentPlayer} selected ${card.name}`);
    const endTurnBtn = document.getElementById('end-turn-early-btn');
    if (endTurnBtn) {
        endTurnBtn.classList.add('visible');
    }

    if (card.cardId === 99) {
        playsRemaining = card.numberOfPlays || 1;
        groundTruthFirstClick = null;
    } else if (card.executionType === "immediate") {
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
    gameStatesRef.orderByChild('gameId').equalTo(gameId).once('value', (snapshot) => {
        const data = snapshot.val();

        if (data) {
            const gameStateKey = Object.keys(data)[0];
            const gameData = data[gameStateKey];

            // if (playerId === 1 && gameData.playerOneJoined) {
            //     alert('Player 1 slot is already taken!');
            //     window.location.href = '../index.html';
            //     return;
            // }
            // if (playerId === 2 && gameData.playerTwoJoined) {
            //     alert('Player 2 slot is already taken!');
            //     window.location.href = '../index.html';
            //     return;
            // }

            const updateData = {};
            if (playerId === 1) {
                updateData.playerOneJoined = true;
            } else if (playerId === 2) {
                updateData.playerTwoJoined = true;
            }
            
            gameStatesRef.child(gameStateKey).update(updateData);
            addLog(`Player ${playerId} joined the game`);
            
            setupGameStateListener();
        }
    });
}

function setupGameStateListener() {
    if (isListenerSetup) return;
    isListenerSetup = true;
    
    gameStatesRef.orderByChild('gameId').equalTo(gameId).on('value', (snapshot) => {
        const data = snapshot.val();

        if (data) {
            const gameStateKey = Object.keys(data)[0];
            const gameData = data[gameStateKey];

            if (gameData.gameState) {
                currentState = JSON.parse(gameData.gameState);
                currentPlayer = gameData.currentPlayer || 1;

                mapCoordinates = JSON.parse(gameData.coordinates);
                mapZoom = gameData.zoom;
                mapBasemap = gameData.basemap;

                if (!isMapInitialized && mapCoordinates && mapZoom && mapBasemap) {
                    console.log('Initializing map with Firebase data:', { mapCoordinates, mapZoom, mapBasemap });
                    buildBoard();
                    isMapInitialized = true;
                }

                playerOneColor = gameData.playerOneColor;
                playerTwoColor = gameData.playerTwoColor;

                initialPieces = gameData.initialPieces || 10;
                gameOver = gameData.gameOver || false;
                cumulativeScore = gameData.cumulativeScore ? JSON.parse(gameData.cumulativeScore) : {playerOne: 0, playerTwo: 0};

                playerOneHand = JSON.parse(gameData.playerOneHand);
                playerTwoHand = JSON.parse(gameData.playerTwoHand);

                playerOnePlayedFirstTurn = gameData.playerOnePlayedFirstTurn || false;
                playerTwoPlayedFirstTurn = gameData.playerTwoPlayedFirstTurn || false;

                discardPile = JSON.parse(gameData.discardPile);
                lastPlayedCard = gameData.lastPlayedCard || 99;
                lastPlayedCardPlayer = gameData.lastPlayedCardPlayer || 1;
                playsRemaining = gameData.playsRemaining || 0;
                remainingDeck = JSON.parse(gameData.remainingDeck);

                pendingMoves = JSON.parse(gameData.pendingMoves) || [];

                if (gameData.gameLog) {
                    gameLog = JSON.parse(gameData.gameLog);
                    updateLogDisplay();
                }

                setBoardState(currentState, playerOneColor, playerTwoColor);
                
                highlightChanges(currentState, previousState);

                if (gameOver) {
                    setTimeout(() => {
                        const scores = calculateGameScore(currentState);
                        const winner = scores.playerOne.finalScore > scores.playerTwo.finalScore ? 'Player One Wins!' :
                                    scores.playerTwo.finalScore > scores.playerOne.finalScore ? 'Player Two Wins!' :
                                    'It\'s a Tie!';
                        displayGameOverScreen(scores, winner);
                    }, 500);
                    return;
                }
                dealCards(playerId);
                updateTurnIndicator();
                displayCurrentCard(null);
            }
        }
    });
}

function buildBoard() {
    console.log('Building board with coordinates:', mapCoordinates, 'zoom:', mapZoom, 'basemap:', mapBasemap);

    if (map) {
        map.remove();
    }

    map = L.map('map', { 
        interactive: false, 
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        keyboard: false,
        boxZoom: false
    }).setView(mapCoordinates, mapZoom);

    const basemapLayer = getBasemapLayer(mapBasemap);
    basemapLayer.addTo(map);

    const boardArea = document.getElementById('game-board');
    boardArea.innerHTML = '';

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

updateTurnIndicator = function() {
    const turnIndicator = document.getElementById('turn-indicator');
    const playerHandContainer = document.getElementById('player-hand-container');
    const playerSection = document.getElementById('player-section');
    const opponentSection = document.getElementById('opponent-section');
    let playerTurnBlocker = document.getElementById('player-turn-blocker');
    let opponentTurnBlocker = document.getElementById('opponent-turn-blocker');
    
    if (turnIndicator) {
        turnIndicator.textContent = `Player ${currentPlayer}'s Turn`;
        turnIndicator.classList.remove('turn-indicator-active', 'turn-indicator-opponent');
        turnIndicator.classList.add(currentPlayer === playerId ? 'turn-indicator-active' : 'turn-indicator-opponent');
    }

    if (!playerTurnBlocker) {
        playerTurnBlocker = createBlocker('player');
        playerSection.appendChild(playerTurnBlocker);
    }

    if (!opponentTurnBlocker) {
        opponentTurnBlocker = createBlocker('opponent');
        opponentSection.appendChild(opponentTurnBlocker);
    }
    
    if (currentPlayer !== playerId) {
        playerTurnBlocker.style.display = 'flex';
        opponentTurnBlocker.style.display = 'none';
    } else {
        playerTurnBlocker.style.display = 'none';
        opponentTurnBlocker.style.display = 'flex';
    }
    
    updateDeckIndicators();
};

function createBlocker(targetHand) {
    const blocker = document.createElement('div');
    blocker.classList.add('turn-blocker');
    let blockerId;
    let blockerText;

    if (targetHand === 'player') {
        blocker.id = 'player-turn-blocker';
        blocker.innerText = 'Opponent\'s Turn';
    } else if (targetHand === 'opponent') {
        blocker.id = 'opponent-turn-blocker';
        blocker.innerText = 'Opponent\'s Hand';
    }

    return blocker;
}

function dealCards(playerId) {
    const playerHand = playerId === 1 ? playerOneHand : playerTwoHand;
    const handContainer = document.getElementById('player-hand-container');
    handContainer.innerHTML = '';

    const currentPlayerColor = playerId === 1 ? playerOneColor : playerTwoColor;
    
    playerHand.forEach(cardId => {
        const cardContainer = createCardElement(cardId, currentPlayerColor, true);
        cardContainer.addEventListener('click', function() {
            if (currentPlayer !== playerId) {
                alert('Please wait for your turn!');
                return;
            }
            const card = getCardById(cardId);
            showMagnifiedCard(card);
        });

        handContainer.appendChild(cardContainer);
    });

    const opponentHandContainer = document.getElementById('opponent-hand-container');
    opponentHandContainer.innerHTML = '';
    const opponentHand = playerId === 1 ? playerTwoHand : playerOneHand;
    const opponentColor = playerId === 1 ? playerTwoColor : playerOneColor;

    opponentHand.forEach((cardId) => {
        const cardContainer = createCardElement(cardId, opponentColor, false);
        opponentHandContainer.appendChild(cardContainer);
    });

    updateDeckIndicators();
}

function createCardElement(cardId, playerColor, isPlayerHand = false) {
    const card = getCardById(parseInt(cardId));
    if (!card) {
        addLog(`Card with ID ${cardId} not found`);
        return;
    }

    const cardContainer = document.createElement('div');
    cardContainer.classList.add('card-container');
    cardContainer.id = `card-${card.cardId}`;
    
    const cardBack = document.createElement('div');
    cardBack.classList.add('card-back');
    if (playerColor) {
        cardBack.style.backgroundColor = playerColor;
    }
    
    const cardBackImg = document.createElement('img');
    cardBackImg.src = '../styles/gis-battle.svg';
    cardBackImg.alt = 'GIS Battle Logo';
    cardBack.appendChild(cardBackImg);
    
    const cardBackTitle = document.createElement('h3');
    cardBackTitle.innerText = isPlayerHand ? (card.name || 'GIS Battle') : "GIS Battle";
    cardBack.appendChild(cardBackTitle);

    cardContainer.appendChild(cardBack);

    return cardContainer;
}

function getCardById(cardId) {
    const numericId = parseInt(cardId);
    return Object.values(cardTypes).find(card => card.cardId === numericId);
}

function showMagnifiedCard(card) {
    const playerHand = playerId === 1 ? playerOneHand : playerTwoHand;
    const currentIndex = playerHand.indexOf(card.cardId);
    
    showCardSelector(playerHand, currentIndex, 'hand');
}

function showCardSelector(cardArray, startIndex, context) {
    const existingOverlay = document.getElementById('board-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    let currentIndex = startIndex;

    const overlay = document.createElement('div');
    overlay.id = 'board-overlay';

    const cardContainer = document.createElement('div');
    cardContainer.className = 'card-selector-container';

    const prevButton = document.createElement('button');
    prevButton.className = 'nav-button prev-button';
    prevButton.innerHTML = '◀';
    prevButton.addEventListener('click', function() {
        currentIndex = (currentIndex - 1 + cardArray.length) % cardArray.length;
        updateDisplayedCard();
    });

    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'card-wrapper';

    const nextButton = document.createElement('button');
    nextButton.className = 'nav-button next-button';
    nextButton.innerHTML = '▶';
    nextButton.addEventListener('click', function() {
        currentIndex = (currentIndex + 1) % cardArray.length;
        updateDisplayedCard();
    });

    const actionButton = document.createElement('button');
    actionButton.className = 'action-button';

    if (context === 'hand') {
        actionButton.innerText = 'Use Card';
    } else if (context === 'opponent-use' || context === 'opponent-discard') {
        actionButton.innerText = context === 'opponent-use' ? 'Use This Card' : 'Discard This Card';
    } else if (context === 'discard' || context === 'deck') {
        actionButton.innerText = 'Select This Card';
    }

    actionButton.addEventListener('click', function() {
        const selectedCardId = cardArray[currentIndex];
        overlay.remove();
        
        if (context === 'hand') {
            const card = getCardById(selectedCardId);
            selectCard(card);
        } else if (context === 'opponent-use') {
            window.cardSelectorResolve({ cardId: selectedCardId, action: 'use' });
        } else if (context === 'opponent-discard') {
            window.cardSelectorResolve({ cardId: selectedCardId, action: 'discard' });
        } else if (context === 'discard' || context === 'deck') {
            window.cardSelectorResolve(selectedCardId);
        }
    });

    const cancelButton = document.createElement('button');
    cancelButton.className = 'cancel-button';
    cancelButton.innerText = 'Cancel';
    cancelButton.addEventListener('click', function() {
        overlay.remove();
        if (context !== 'hand' && window.cardSelectorResolve) {
            window.cardSelectorResolve(null);
        }
    });

    function updateDisplayedCard() {
        cardWrapper.innerHTML = '';
        const cardId = cardArray[currentIndex];
        const card = getCardById(cardId);
        
        const magnifiedCard = document.createElement('div');
        magnifiedCard.classList.add('magnified-card', 'magnified-card-display');
        magnifiedCard.style.border = `3px solid ${currentPlayer === 1 ? playerOneColor : playerTwoColor}`;
        
        const cardTitle = document.createElement('h3');
        cardTitle.classList.add('magnified-card-title');
        cardTitle.innerText = card.name;
        
        const cardDescription = document.createElement('p');
        cardDescription.classList.add('magnified-card-description');
        cardDescription.innerText = card.description;
        
        magnifiedCard.appendChild(cardTitle);
        magnifiedCard.appendChild(cardDescription);
        cardWrapper.appendChild(magnifiedCard);

        if (cardArray.length <= 1) {
            prevButton.classList.add('nav-button-hidden');
            nextButton.classList.add('nav-button-hidden');
            prevButton.classList.remove('nav-button-visible');
            nextButton.classList.remove('nav-button-visible');
        } else {
            prevButton.classList.add('nav-button-visible');
            nextButton.classList.add('nav-button-visible');
            prevButton.classList.remove('nav-button-hidden');
            nextButton.classList.remove('nav-button-hidden');
        }
    }

    updateDisplayedCard();

    cardContainer.appendChild(prevButton);
    cardContainer.appendChild(cardWrapper);
    cardContainer.appendChild(nextButton);

    overlay.appendChild(cardContainer);
    overlay.appendChild(actionButton);
    overlay.appendChild(cancelButton);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            overlay.remove();
            if (context !== 'hand' && window.cardSelectorResolve) {
                window.cardSelectorResolve(null);
            }
        }
    });

    let touchStartX = 0;
    let touchEndX = 0;

    cardWrapper.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    }, false);

    cardWrapper.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, false);

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                currentIndex = (currentIndex + 1) % cardArray.length;
            } else {
                currentIndex = (currentIndex - 1 + cardArray.length) % cardArray.length;
            }
            updateDisplayedCard();
        }
    }

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
    if (currentPlayer !== playerId) {
        alert('Please wait for your turn!');
        return;
    }

    if (!selectedCard) {
        const hasPlayedFirstTurn = currentPlayer === 1 ? playerOnePlayedFirstTurn : playerTwoPlayedFirstTurn;
        
        if (!hasPlayedFirstTurn) {
            const firstCard = getCardById(99);
            if (firstCard) {
                selectedCard = firstCard;
                displayCurrentCard(firstCard);
                playsRemaining = initialPieces || firstCard.numberOfPlays || 1;
                addLog(`Player ${currentPlayer} auto-selected ${firstCard.name}`);
            } else {
                alert('First turn card not found!');
                return;
            }
        } else {
            alert('Please select a card first!');
            return;
        }
    }
    
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

                updateFirebase();
                
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
            
            if (currentState.spatialJoinFeatures) {
                currentState.spatialJoinFeatures.forEach((feature, index) => {
                    if (!currentState.spatialJoinUsedFeatures.has(index)) {
                        feature.squares.forEach(square => {
                            document.getElementById(`board-space${square}`).classList.add('highlight-change');
                        });
                    }
                });
            }

            updateFirebase();
            
            if (playsRemaining === 0) {
                document.querySelectorAll('.board-space').forEach(space => {
                    space.classList.remove('highlight-change');
                });
                delete currentState.spatialJoinValidSquares;
                delete currentState.spatialJoinFeatures;
                delete currentState.spatialJoinUsedFeatures;
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
                updateFirebase();
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

                    updateFirebase();
                    
                    if (playsRemaining === 0) {
                        document.querySelectorAll('.board-space').forEach(space => {
                            space.classList.remove('highlight-change');
                        });
                        delete currentState.hotspotAnchor;
                        endTurn(card);
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

        updateFirebase();
        
        if (currentState && playsRemaining === 0) {
            endTurn(card);
        }
    } else {
        addLog("Move was invalid, try again");
    }
}

function switchPlayer() {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    previousState = [...currentState]
    addLog(`Switched to Player ${currentPlayer}'s turn`);
    dealCards(playerId);
    updateTurnIndicator();
    displayCurrentCard(null);
}

function endTurn(card) {
    let currentHand = currentPlayer === 1 ? playerOneHand : playerTwoHand;
    const cardIndex = currentHand.indexOf(card.cardId);
    const endTurnBtn = document.getElementById('end-turn-early-button');
    currentHand.splice(cardIndex, 1);
    lastPlayedCard = card.cardId;
    lastPlayedCardPlayer = currentPlayer;
    if (card.cardId !== 99) {
        discardPile.push({ cardId: card.cardId, player: currentPlayer });
    }
    addLog(`Player ${currentPlayer} played ${card.name}`);

    if (card.cardId === 99) {
        if (currentPlayer === 1) {
            playerOnePlayedFirstTurn = true;
        } else {
            playerTwoPlayedFirstTurn = true;
        }
        addLog(`Player ${currentPlayer} has completed their first turn!`);
    }

    switchPlayer();
    updateFirebase();

    currentHand = currentPlayer === 1 ? playerOneHand : playerTwoHand;

    if (endTurnBtn) {
        endTurnBtn.classList.remove('visible');
    }
    
    if (playerOneHand.length === 0 && playerTwoHand.length === 0) {
        beginEndGame();
    } else if (currentHand.length === 0) {
        addLog(`Player ${currentPlayer} has no cards left, skipping turn`);
        endTurn({ cardId: -1, name: 'No Card' });
    }
}

function updateFirebase() {  
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
                lastPlayedCardPlayer: lastPlayedCardPlayer,
                playsRemaining: playsRemaining,
                remainingDeck: JSON.stringify(remainingDeck),
                pendingMoves: JSON.stringify(pendingMoves),
                playerOnePlayedFirstTurn: playerOnePlayedFirstTurn,
                playerTwoPlayedFirstTurn: playerTwoPlayedFirstTurn,
                gameLog: JSON.stringify(gameLog)
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
    if (choiceType === "Direction") {
        return createDirectionChoiceModal();
    } else if (choiceType === "Layer Type") {
        return createLayerChoiceModal();
    }
}

function createDirectionChoiceModal() {
    return new Promise((resolve) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'board-overlay';

        const choiceContent = document.createElement('div');
        choiceContent.id = 'choice-content';
        choiceContent.classList.add('magnified-card-display');
        choiceContent.classList.add('magnified-card');
        choiceContent.style.border = `3px solid ${currentPlayer === 1 ? playerOneColor : playerTwoColor}`;

        const choiceTitle = document.createElement('h3');
        choiceTitle.innerText = 'Choose Direction';
        choiceContent.appendChild(choiceTitle);

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'direction-buttons-container';

        const directions = [
            { name: 'North', key: 'north', label: 'N' },
            { name: 'South', key: 'south', label: 'S' },
            { name: 'East', key: 'east', label: 'E' },
            { name: 'West', key: 'west', label: 'W' }
        ];

        directions.forEach(dir => {
            const button = document.createElement('button');
            button.className = `direction-btn direction-btn-${dir.key}`;
            button.innerText = dir.label;
            button.addEventListener('click', function() {
                addLog(`Chosen Direction: ${dir.name}`);
                modalOverlay.remove();
                resolve(dir.name); 
            });
            buttonsContainer.appendChild(button);
        });

        const compassIcon = document.createElement('img');
        compassIcon.src = '../styles/compass.svg';
        compassIcon.alt = 'Compass Icon';
        compassIcon.classList.add('compass-icon');
        buttonsContainer.appendChild(compassIcon);

        choiceContent.appendChild(buttonsContainer);
        modalOverlay.appendChild(choiceContent);
        document.body.appendChild(modalOverlay);
    });
}

function createLayerChoiceModal() {
    return new Promise((resolve) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'board-overlay';

        const choiceContent = document.createElement('div');
        choiceContent.id = 'choice-content';
        choiceContent.classList.add('magnified-card-display');
        choiceContent.classList.add('magnified-card');
        choiceContent.style.border = `3px solid ${currentPlayer === 1 ? playerOneColor : playerTwoColor}`;

        const choiceTitle = document.createElement('h3');
        choiceTitle.innerText = 'Choose Layer Type';
        choiceContent.appendChild(choiceTitle);

        const layers = [
            { name: 'Points', type: 'point' },
            { name: 'Lines', type: 'line' },
            { name: 'Polygons', type: 'polygon' }
        ];

        layers.forEach(layer => {
            const button = document.createElement('button');
            button.classList.add('layer-btn');
            
            const content = document.createElement('div');
            content.className = 'layer-btn-content';
            
            const graphic = document.createElement('div');
            graphic.className = 'layer-graphic';

            if (layer.type === 'point') {
                graphic.innerHTML = '<div class="layer-graphic-point" style="width: 8px; height: 8px; background: #333; border-radius: 50%; margin: 0 auto;"></div>';
            } else if (layer.type === 'line') {
                graphic.innerHTML = `<svg viewBox="0 0 20 12" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="2" cy="6" r="2" fill="#333"/>
                    <line x1="4" y1="6" x2="16" y2="6" stroke="#333" stroke-width="1"/>
                    <circle cx="18" cy="6" r="2" fill="#333"/>
                </svg>`;
            } else if (layer.type === 'polygon') {
                graphic.innerHTML = `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="2" cy="4" r="1.5" fill="#333"/>
                    <circle cx="18" cy="6" r="1.5" fill="#333"/>
                    <circle cx="16" cy="18" r="1.5" fill="#333"/>
                    <circle cx="4" cy="16" r="1.5" fill="#333"/>
                    <circle cx="10" cy="10" r="1.5" fill="#333"/>
                    <polyline points="2,4 18,6 16,18 4,16 2,4" stroke="#333" stroke-width="0.8" fill="none"/>
                </svg>`;
            }

            content.appendChild(graphic);
            const label = document.createElement('span');
            label.innerText = layer.name;
            content.appendChild(label);
            button.appendChild(content);

            button.addEventListener('click', function() {
                addLog(`Chosen Layer Type: ${layer.name}`);
                modalOverlay.remove();
                resolve(layer.name); 
            });

            choiceContent.appendChild(button);
        });

        modalOverlay.appendChild(choiceContent);
        document.body.appendChild(modalOverlay);
    });
}

function createDiscardChoiceModal() {
    return new Promise((resolve) => {
        window.cardSelectorResolve = resolve;

        if (discardPile.length === 0) {
            alert('No cards in discard pile');
            resolve(null);
            return;
        }

        const cardIds = discardPile.map(item => item.cardId);
        showCardSelector(cardIds, 0, 'discard');
    });
}

function createDeckChoiceModal(numberOfCards) {
    return new Promise((resolve) => {
        window.cardSelectorResolve = resolve;

        const topCards = remainingDeck.slice(0, numberOfCards);
        
        if (topCards.length === 0) {
            alert('No cards in deck');
            resolve(null);
            return;
        }

        showCardSelector(topCards, 0, 'deck');
    });
}

async function createCollaborationModal(opponentHand, opponentPlayer) {
    return new Promise((resolve) => {
        if (opponentHand.length === 0) {
            alert('Opponent has no cards');
            resolve(null);
            return;
        }

        const existingOverlay = document.getElementById('board-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'board-overlay';

        const selectionContainer = document.createElement('div');
        selectionContainer.className = 'collaboration-selection-container';

        const selectionTitle = document.createElement('h2');
        selectionTitle.className = 'collaboration-selection-title';
        selectionTitle.innerText = 'Choose one card to reveal:';

        const cardGrid = document.createElement('div');
        cardGrid.className = 'card-selection-grid';

        const opponentColor = currentPlayer === 1 ? playerTwoColor : playerOneColor;

        opponentHand.forEach((cardId) => {
            const cardElement = createCardElement(cardId, opponentColor, false);
            cardElement.classList.add('collaboration-card-clickable');
            cardElement.addEventListener('click', function() {
                showRevealedCard(cardId);
            });

            cardGrid.appendChild(cardElement);
        });

        selectionContainer.appendChild(selectionTitle);
        selectionContainer.appendChild(cardGrid);
        overlay.appendChild(selectionContainer);

        function showRevealedCard(selectedCardId) {
            selectionContainer.classList.add('collaboration-selection-hidden');

            const revealContainer = document.createElement('div');
            revealContainer.className = 'collaboration-reveal-container';

            const card = getCardById(selectedCardId);

            const magnifiedCard = document.createElement('div');
            magnifiedCard.classList.add('magnified-card', 'collaboration-reveal-card');
            magnifiedCard.style.border = `3px solid ${currentPlayer === 1 ? playerOneColor : playerTwoColor}`;

            const cardTitle = document.createElement('h3');
            cardTitle.className = 'collaboration-card-title';
            cardTitle.innerText = card.name;

            const cardDescription = document.createElement('p');
            cardDescription.className = 'collaboration-card-description';
            cardDescription.innerText = card.description;

            magnifiedCard.appendChild(cardTitle);
            magnifiedCard.appendChild(cardDescription);

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'collaboration-buttons collaboration-reveal-buttons';

            const useButton = document.createElement('button');
            useButton.className = 'action-button';
            useButton.innerText = 'Use This Card';
            useButton.addEventListener('click', function() {
                addLog(`Using opponent's card`);
                overlay.remove();
                resolve({ cardId: selectedCardId, action: 'use' });
            });

            const discardButton = document.createElement('button');
            discardButton.className = 'action-button discard-action';
            discardButton.innerText = 'Discard This Card';
            discardButton.addEventListener('click', function() {
                addLog(`Forcing opponent to discard card`);
                overlay.remove();
                resolve({ cardId: selectedCardId, action: 'discard' });
            });

            buttonContainer.appendChild(useButton);
            buttonContainer.appendChild(discardButton);

            revealContainer.appendChild(magnifiedCard);
            revealContainer.appendChild(buttonContainer);
            overlay.appendChild(revealContainer);
        }

        document.body.appendChild(overlay);
    });
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
                features.push({ type: 'polygon', squares: polygon, id: `feature-${features.length}` });
            } else if (line) {
                line.forEach(sq => visited.add(sq));
                features.push({ type: 'line', squares: line, id: `feature-${features.length}` });
            }
        }
    });
    
    if (features.length === 0) {
        addLog("No line or polygon features found");
        endTurn(selectedCard);
        return;
    }
    
    currentState.spatialJoinFeatures = features;
    currentState.spatialJoinUsedFeatures = new Set();
    
    const validSquares = new Map();
    
    features.forEach((feature, featureIndex) => {
        feature.squares.forEach(square => {
            const neighbors = feature.type === 'polygon' 
                ? [square - 1, square + 1, square - 10, square + 10]
                : [square - 1, square + 1, square - 9, square + 9, square - 10, square - 11, square + 10, square + 11];
            
            neighbors.forEach(neighbor => {
                if (isValidMove(square, neighbor) && currentState[neighbor] === 0) {
                    validSquares.set(neighbor, featureIndex);
                }
            });
        });
        
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

function calculateGameScore(gameState) {
    const scores = {
        playerOne: { basePoints: 0, lineBonus: 0, polygonBonus: 0, largestBonus: 0 },
        playerTwo: { basePoints: 0, lineBonus: 0, polygonBonus: 0, largestBonus: 0 },
        totalFeatures: 0,
        totalLines: 0,
        totalPolygons: 0,
        largestPolygonSize: 0,
        largestPolygonPlayer: null
    };

    const visited = new Set();
    const features = {
        1: { lines: [], polygons: [] },
        2: { lines: [], polygons: [] }
    };

    [1, 2].forEach(player => {
        gameState.forEach((space, index) => {
            if (space === player && !visited.has(index)) {
                const polygon = determinePolygon(gameState, index, player);
                const line = determineLine(gameState, index, player);
                
                if (polygon && polygon.length > 0) {
                    polygon.forEach(sq => visited.add(sq));
                    features[player].polygons.push(polygon);
                } else if (line && line.length > 0) {
                    line.forEach(sq => visited.add(sq));
                    features[player].lines.push(line);
                }
            }
        });
    });

    [1, 2].forEach(player => {
        const key = player === 1 ? 'playerOne' : 'playerTwo';
        
        scores[key].basePoints = gameState.filter(space => space === player).length;
        
        scores[key].lineBonus = features[player].lines.length * 2;
        
        features[player].polygons.forEach(polygon => {
            scores[key].polygonBonus += polygon.length * 2;
        });
        
        features[player].polygons.forEach(polygon => {
            if (polygon.length > scores.largestPolygonSize) {
                scores.largestPolygonSize = polygon.length;
                scores.largestPolygonPlayer = player;
            }
        });
    });

    if (scores.largestPolygonPlayer) {
        const key = scores.largestPolygonPlayer === 1 ? 'playerOne' : 'playerTwo';
        scores[key].largestBonus = 3;
    }

    scores.totalFeatures = features[1].lines.length + features[1].polygons.length + 
                           features[2].lines.length + features[2].polygons.length;
    scores.totalLines = features[1].lines.length + features[2].lines.length;
    scores.totalPolygons = features[1].polygons.length + features[2].polygons.length;

    scores.playerOne.finalScore = scores.playerOne.basePoints + scores.playerOne.lineBonus + 
                                  scores.playerOne.polygonBonus + scores.playerOne.largestBonus;
    scores.playerTwo.finalScore = scores.playerTwo.basePoints + scores.playerTwo.lineBonus + 
                                  scores.playerTwo.polygonBonus + scores.playerTwo.largestBonus;

    return scores;
}

async function beginEndGame() {
    addLog("Beginning end game sequence...");
    
    if (pendingMoves.length > 0) {
        addLog(`Processing ${pendingMoves.length} pending moves`);
        await processPendingMoves();
    }

    const scores = calculateGameScore(currentState);

    addLog(`Final Score - Player One: ${scores.playerOne.finalScore}, Player Two: ${scores.playerTwo.finalScore}`);

    const winner = scores.playerOne.finalScore > scores.playerTwo.finalScore ? 'Player One Wins!' :
                   scores.playerTwo.finalScore > scores.playerOne.finalScore ? 'Player Two Wins!' :
                   'It\'s a Tie!';
    
    addLog(winner);

    if (winner === 'Player One Wins!') {
        cumulativeScore.playerOne++;
    } else if (winner === 'Player Two Wins!') {
        cumulativeScore.playerTwo++;
    }

    displayGameOverScreen(scores, winner);

    gameStatesRef.orderByChild('gameId').equalTo(gameId).once('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const gameStateKey = Object.keys(data)[0];
            gameStatesRef.child(gameStateKey).update({
                gameOver: true,
                cumulativeScore: JSON.stringify(cumulativeScore)
            });
        }
    });
}

function displayGameOverScreen(scores, winner) {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'board-overlay';

    const resultContent = document.createElement('div');
    resultContent.id = 'choice-content';
    resultContent.classList.add('game-over-container');
    
    const resultTitle = document.createElement('h2');
    resultTitle.innerText = 'Game Over!';
    resultContent.appendChild(resultTitle);

    const gameOverContent = document.createElement('div');
    gameOverContent.className = 'game-over-content';

    const playerOneColumn = document.createElement('div');
    playerOneColumn.className = 'player-score-column';
    playerOneColumn.style.borderLeftColor = playerOneColor;
    
    const playerOneTitle = document.createElement('h3');
    playerOneTitle.innerText = `Player One`;
    playerOneTitle.style.color = playerOneColor;
    playerOneColumn.appendChild(playerOneTitle);

    const p1Items = [
        { label: 'Base Points', value: scores.playerOne.basePoints },
        { label: 'Line Bonus', value: scores.playerOne.lineBonus },
        { label: 'Polygon Bonus', value: scores.playerOne.polygonBonus },
        { label: 'Largest Polygon', value: scores.playerOne.largestBonus }
    ];

    p1Items.forEach(item => {
        const scoreItem = document.createElement('div');
        scoreItem.className = 'score-item';
        scoreItem.innerHTML = `<span class="score-label">${item.label}:</span><span class="score-value">${item.value}</span>`;
        playerOneColumn.appendChild(scoreItem);
    });

    const p1Final = document.createElement('div');
    p1Final.className = 'final-score';
    p1Final.innerHTML = `<span>Total:</span><span>${scores.playerOne.finalScore}</span>`;
    playerOneColumn.appendChild(p1Final);

    const playerTwoColumn = document.createElement('div');
    playerTwoColumn.className = 'player-score-column';
    playerTwoColumn.style.borderLeftColor = playerTwoColor;
    
    const playerTwoTitle = document.createElement('h3');
    playerTwoTitle.innerText = `Player Two`;
    playerTwoTitle.style.color = playerTwoColor;
    playerTwoColumn.appendChild(playerTwoTitle);

    const p2Items = [
        { label: 'Base Points', value: scores.playerTwo.basePoints },
        { label: 'Line Bonus', value: scores.playerTwo.lineBonus },
        { label: 'Polygon Bonus', value: scores.playerTwo.polygonBonus },
        { label: 'Largest Polygon', value: scores.playerTwo.largestBonus }
    ];

    p2Items.forEach(item => {
        const scoreItem = document.createElement('div');
        scoreItem.className = 'score-item';
        scoreItem.innerHTML = `<span class="score-label">${item.label}:</span><span class="score-value">${item.value}</span>`;
        playerTwoColumn.appendChild(scoreItem);
    });

    const p2Final = document.createElement('div');
    p2Final.className = 'final-score';
    p2Final.innerHTML = `<span>Total:</span><span>${scores.playerTwo.finalScore}</span>`;
    playerTwoColumn.appendChild(p2Final);

    gameOverContent.appendChild(playerOneColumn);
    gameOverContent.appendChild(playerTwoColumn);
    resultContent.appendChild(gameOverContent);

    const winnerBox = document.createElement('div');
    winnerBox.className = 'game-over-winner';
    winnerBox.innerText = winner;
    resultContent.appendChild(winnerBox);

    const cumulativeScoreDiv = document.createElement('div');
    cumulativeScoreDiv.className = 'cumulative-score-div';
    cumulativeScoreDiv.innerHTML = `<strong>Series Score:</strong> Player One: ${cumulativeScore.playerOne} | Player Two: ${cumulativeScore.playerTwo}`;
    resultContent.appendChild(cumulativeScoreDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'game-over-actions';

    if (playerId === 1) {
        const replayButton = document.createElement('button');
        replayButton.className = 'action-button';
        replayButton.innerText = 'Play Again';
        replayButton.addEventListener('click', function() {
            modalOverlay.remove();
            playAgain(gameId, 5);
        });

        actionsDiv.appendChild(replayButton);
    }
    
    resultContent.appendChild(actionsDiv);
    
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
            if (card && playerId === player) {
                await executeEndGameCard(card, player);
            } else if (card) {
                addLog(`Waiting for Player ${player} to execute their Model Builder card...`);
            }
            
        } else if (moveType === 'crunch') {
            const player = move[1];
            
            addLog(`Processing Crunch Time for Player ${player}`);

            if (playerId === player) {
                const chosenCardId = await createDeckChoiceModal(3);
                if (chosenCardId) {
                    const card = getCardById(chosenCardId);
                    if (card) {
                        await executeEndGameCard(card, player);
                    }
                }
            } else {
                addLog(`Waiting for Player ${player} to choose their Crunch Time card...`);
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
        messageContent.classList.add('magnified-card-display');
        messageContent.classList.add('magnified-card');
        messageContent.style.border = `3px solid ${player === 1 ? playerOneColor : playerTwoColor}`;
        
        const messageTitle = document.createElement('h3');
        messageTitle.className = 'magnified-card-title';
        messageTitle.innerText = `Player ${player}: Use ${card.name}`;
        
        const cardDescription = document.createElement('p');
        cardDescription.className = 'magnified-card-description';
        cardDescription.innerText = card.description;
        
        const continueButton = document.createElement('button');
        continueButton.className = 'action-button';
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
            } else if (card.executionType === "ground-truth") {
                selectedCard = card;
                playsRemaining = card.movesRemaining;
                groundTruthFirstClick = null;
                await waitForCardCompletion();
            } else if (card.executionType === "spatial-join") {
                initializeSpatialJoin();
                await waitForCardCompletion();
            } else if (card.executionType === "hotspot") {
                selectedCard = card;
                playsRemaining = card.movesRemaining;
                hotspotFirstClick = null;
                hotspotPhase = "initial";
                await waitForCardCompletion();
            }
            
            currentPlayer = originalPlayer;
            updateFirebase();
            
            await new Promise(r => setTimeout(r, 1000));
            
            resolve();
        });

        messageContent.appendChild(messageTitle);
        messageContent.appendChild(cardDescription);
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

const endTurnBtn = document.getElementById('end-turn-early-btn');
if (endTurnBtn) {
    endTurnBtn.addEventListener('click', function() {
        if (selectedCard && currentPlayer === playerId) {
            endTurn(selectedCard);
            selectedCard = null;
            playsRemaining = 0;
            displayCurrentCard(null);
            groundTruthFirstClick = null;
            hotspotFirstClick = null;
            hotspotPhase = "initial";
            document.querySelectorAll('.board-space').forEach(space => {
                space.classList.remove('highlight-change');
            });
            updateTurnIndicator();
        }
    });
}

window.onload = function() {
    buildBoard();
    setBoardState(currentState, playerOneColor, playerTwoColor);
    setupFirebaseListeners();
    updateTurnIndicator();
    updateDeckIndicators();
}