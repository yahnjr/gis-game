function createGame(playerOneColor, numberOfCards, coordinates, zoom, basemap) {
    console.log("Starting game with color:", playerOneColor, "and number of cards:", numberOfCards);
    console.log("Map settings - coordinates:", coordinates, "zoom:", zoom, "basemap:", basemap);

    const gameId = Math.random().toString(36).substring(2, 7);
    console.log("Game ID:", gameId);

    let remainingDeck = Array.from({ length: 21 }, (_, i) => i + 1);
    remainingDeck = shuffleArray(remainingDeck);

    let playerOneHand = [];
    let playerTwoHand = [];
    
    for (let i = 0; i < numberOfCards; i++) {
        playerOneHand.push(remainingDeck.pop());
        playerTwoHand.push(remainingDeck.pop());
    }

    playerOneHand.push(99);
    playerTwoHand.push(99);

    gameStatesRef.child(`game-${gameId}`).set({
        gameId: gameId,
        currentPlayer: 1,
        discardPile: JSON.stringify([]),
        gameState: JSON.stringify(Array(100).fill(0)),
        previousState: JSON.stringify(Array(100).fill(0)),
        lastPlayedCard: 99,
        lastPlayedCardPlayer: 1,
        playerOneColor: playerOneColor,
        playerTwoColor: "rgba(0, 0, 255, 1)",
        playerOneJoined: false,
        playerTwoJoined: false,
        playerOneHand: JSON.stringify(playerOneHand),
        playerTwoHand: JSON.stringify(playerTwoHand),
        playerOnePlayedFirstTurn: false,
        playerTwoPlayedFirstTurn: false,
        playsRemaining: 0,
        remainingDeck: JSON.stringify(remainingDeck),
        pendingMoves: JSON.stringify([]),
        gameLog: JSON.stringify([]),
        coordinates: JSON.stringify(coordinates),
        zoom: zoom,
        basemap: basemap
    }).then(() => {
        console.log("Game created successfully!");
        alert(`Game created! Game ID: ${gameId}\nShare this ID with Player 2`);
        window.location.href = `play/index.html?gameId=${gameId}&playerId=1`;
    }).catch((error) => {
        console.error('Error creating game:', error);
        alert('Failed to create game. Please try again.');
    });
}

function playAgain(gameId, numberOfCards) {
    let remainingDeck = Array.from({ length: 20 }, (_, i) => i + 1);
    remainingDeck = shuffleArray(remainingDeck);

    let playerOneHand = [];
    let playerTwoHand = [];

    for (let i = 0; i < numberOfCards; i++) {
        playerOneHand.push(remainingDeck.pop());
        playerTwoHand.push(remainingDeck.pop());
    }
    
    playerOneHand.push(99);
    playerTwoHand.push(99);
    
    gameStatesRef.orderByChild('gameId').equalTo(gameId).once('value', (snapshot) => {
        const data = snapshot.val();
        
        if (data) {
            const gameStateKey = Object.keys(data)[0];
            const existingGameData = data[gameStateKey];
            
            gameStatesRef.child(gameStateKey).update({
                currentPlayer: 1,
                discardPile: JSON.stringify([]),
                gameState: JSON.stringify(Array(100).fill(0)),
                previousState: JSON.stringify(Array(100).fill(0)),
                lastPlayedCard: 99,
                lastPlayedCardPlayer: 1,
                playerOneJoined: existingGameData.playerOneJoined || false,
                playerTwoJoined: existingGameData.playerTwoJoined || false,
                playerOneHand: JSON.stringify(playerOneHand),
                playerTwoHand: JSON.stringify(playerTwoHand),
                playerOnePlayedFirstTurn: false,
                playerTwoPlayedFirstTurn: false,
                remainingDeck: JSON.stringify(remainingDeck),
                pendingMoves: JSON.stringify([]),
                gameLog: JSON.stringify([])
            }).then(() => {
                console.log("Restarting game successfully!");
                window.location.reload();
            }).catch((error) => {
                console.error('Error restarting game:', error);
                alert('Failed to restart game. Please try again.');
            });
        }
    });
}

function joinGame(gameId, playerTwoColor) {
    console.log("Joining game:", gameId, "with color:", playerTwoColor);

    gameStatesRef.child(`game-${gameId}`).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const gameData = snapshot.val();
            
            gameStatesRef.child(`game-${gameId}`).update({
                playerTwoColor: playerTwoColor
            }).then(() => {
                console.log("Joined game successfully!");
                window.location.href = `play/index.html?gameId=${gameId}&playerId=2`;
            }).catch((error) => {
                console.error('Error joining game:', error);
                alert('Failed to join game. Please try again.');
            });
        } else {
            console.log("Game not found");
            document.getElementById('join-error').style.display = 'block';
        }
    }).catch((error) => {
        console.error('Error checking game:', error);
        alert('Error checking game. Please try again.');
    });
}

function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;

    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]
        ];
    }

    return array;
}

function getRandomBrightColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 70 + Math.floor(Math.random() * 30);
    const lightness = 45 + Math.floor(Math.random() * 15);
    
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;
    
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgba(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const rgbaColor = `rgba(${r}, ${g}, ${b}, 1)`;
    
    return rgbaColor;
}