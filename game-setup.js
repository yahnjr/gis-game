function createGame(playerOneColor, numberOfCards) {
            console.log("Starting game with color:", playerOneColor, "and number of cards:", numberOfCards);

            const gameId = Math.random().toString(36).substring(2, 10);
            console.log("Game ID:", gameId);

            let remainingDeck = Array.from({ length: 20 }, (_, i) => i + 1);
            remainingDeck = shuffleArray(remainingDeck);

            let playerOneHand = [];
            let playerTwoHand = [];
            
            for (let i = 0; i < numberOfCards; i++) {
                playerOneHand.push(remainingDeck.pop());
                playerTwoHand.push(remainingDeck.pop());
            }

            gameStatesRef.child(`game-${gameId}`).set({
                gameId: gameId,
                currentPlayer: 1,
                discardPile: JSON.stringify([]),
                gameState: JSON.stringify(Array(100).fill(0)),
                previousState: JSON.stringify(Array(100).fill(0)),
                lastPlayedCard: null,
                playerOneColor: playerOneColor,
                playerTwoColor: "rgba(0, 0, 255, 1)",
                playerOneJoined: false,
                playerTwoJoined: false,
                playerOneHand: JSON.stringify(playerOneHand),
                playerTwoHand: JSON.stringify(playerTwoHand),
                remainingDeck: JSON.stringify(remainingDeck),
                pendingMoves: JSON.stringify([])
            }).then(() => {
                console.log("Game created successfully!");
                alert(`Game created! Game ID: ${gameId}\nShare this ID with Player 2`);
                window.location.href = `play/index.html?gameId=${gameId}&playerId=1`;
            }).catch((error) => {
                console.error('Error creating game:', error);
                alert('Failed to create game. Please try again.');
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