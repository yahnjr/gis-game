const cardTypes = {
    createFeatures: {
        cardId: 1,
        name: "Create Features",
        description: "Create a new 2x2 feature on the board. You cannot convert your opponent's features.",
        pattern: [0, 1, 10, 11],
        numberOfPlays: 1,
        executionType: "placement",
        execute: function(board, startSquare, player, isValidMove) {
            let successfulTurns = 0;
            this.pattern.forEach(offset => {
                const target = startSquare + offset;
                if (isValidMove(startSquare, target) && board[target] === 0) {
                    board[target] = player;
                    successfulTurns++;
                }
            });

            if (successfulTurns > 0) {
                return board;
            } else {
                console.log("Invalid move, try again");
                return false;
            }
        }
    },

    eraseFeatures: {
        cardId: 2,
        name: "Erase Features",
        description: "Erase features in a 2x3 mask. This can remove both your and your opponent's features.",
        pattern: [0, 1, 10, 11, 20, 21],
        numberOfPlays: 1,
        executionType: "placement",
        execute: function(board, startSquare, player, isValidMove) {
            this.pattern.forEach(offset => {
                const target = startSquare + offset;
                if (isValidMove(startSquare, target, 2)) {
                    board[target] = 0;
                }
            });
            return board;
        },
    },

    clip: {
        cardId: 3,
        name: "Clip",
        description: "Convert an opponent's 2x2 feature to your own.",
        pattern: [0, 1, 10, 11],
        numberOfPlays: 1,
        executionType: "placement",
        execute: function(board, startSquare, player, isValidMove) {
            let successfulTurns = 0;
            this.pattern.forEach(offset => {
                const target = startSquare + offset;
                if (isValidMove(startSquare, target) && board[target] !== 0 && board[target] !== player) {
                    board[target] = player;
                    successfulTurns++;
                }
            });

            if (successfulTurns > 0) {
                return board;
            } else {
                console.log("Invalid move, try again");
                return false;
            }
        }
    },

    fieldCollection: {
        cardId: 4,
        name: "Field Collection",
        description: "Add four features anywhere on the board.",
        pattern: [0],
        numberOfPlays: 4,
        executionType: "placement",
        execute: function(board, startSquare, player, isValidMove) {
                const target = startSquare + this.pattern[0];
                if (isValidMove(startSquare, target) && board[target] == 0) {
                    board[target] = player;
                } else {
                    console.log("Invalid move, try again");
                    return false;
            };
            return board;
        }    
    },

    interpolate: {
        cardId: 5,
        name: "Interpolate",
        description: "Squares with at least three of your features neighboring are filled with your pieces. This can convert opponent's features.",
        executionType: "immediate",
        execute: function(board, previousState, player) {
            const newBoard= [...board];
            
            board.forEach((space, index) => {
                interpolateFill(newBoard, board, index, player);
            });
            return newBoard;
        }      
    },

    dissolve: {
        cardId: 6,
        name: "Dissolve",
        description: "Convert a polygon of your opponent's features touching a polygon feature of your own to your features.",
        executionType: "placement",
        numberOfPlays: 1,
        execute: function(board, startSquare, player, isValidMove) {
            const opponent = player === 1 ? 2 : 1;

            const opponentPolygon  = determinePolygon(board, startSquare, opponent);
            if (!opponentPolygon) {
                console.log("Must click on an opponent's polygon feature");
                return false;
            }

            let toughingPlayerFeature = false;

            for (const square of opponentPolygon) {
                const neighbors = [square - 1, square + 1, square - 10, square + 10];

                for (const neighbor of neighbors) {
                    if (isValidMove(square, neighbor) && board[neighbor] === player) {
                        const playerPolygon = determinePolygon(board, neighbor, player);
                        const playerLine = determineLine(board, neighbor, player);

                        if (playerPolygon || playerLine) {
                            touchingPlayerFeature = true;
                            break;
                        }
                    }
                }

                if (touchingPlayerFeature) break;
            }
            
            if (!touchingPlayerFeature) {
                console.log("Opponent's polygon must be touching one of your polygon or line features");
                return false;
            }
            
            opponentPolygon.forEach(square => {
                board[square] = player;
            });
            
            console.log(`Dissolved opponent polygon of ${opponentPolygon.length} squares`);
            return board;
        }    
    },

    groundTruth: {
        cardId: 7,
        name: "Ground Truth",
        description: "Make up to 6 one-space moves of any pieces. Pieces can be moved off the side of the map to be removed.",
        executionType: "ground-truth",
        movesRemaining: 6,
        execute: function(board, fromSquare, toSquare, player, isValidMove) {            
            if (board[fromSquare] === 0) {
                console.log("No piece at selected square");
                return false;
            }
            
            const fromRow = Math.floor(fromSquare / 10);
            const fromCol = fromSquare % 10;
            const toRow = Math.floor(toSquare / 10);
            const toCol = toSquare % 10;
            
            const rowDiff = Math.abs(fromRow - toRow);
            const colDiff = Math.abs(fromCol - toCol);
            
            if (rowDiff > 1 || colDiff > 1 || (rowDiff === 0 && colDiff === 0)) {
                console.log("Can only move one space at a time");
                return false;
            }
            
            if (toSquare < 0 || toSquare >= 100) {
                board[fromSquare] = 0;
                console.log("Piece moved off edge and removed");
                return board;
            }
            
            if (board[toSquare] !== 0) {
                console.log("Cannot move to occupied square");
                return false;
            }
            
            board[toSquare] = board[fromSquare];
            board[fromSquare] = 0;
            
            console.log(`Moved piece from ${fromSquare} to ${toSquare}`);
            return board;
        }    
    },

    buffer: {
        cardId: 8,
        name: "Buffer",
        description: "Choose one of your polygon features. All empty squarees orthogonally adjacent to that polygon are filled with your features.",
        executionType: "placement",
        execute: function(board, startSquare, player, isValidMove) {
            polygonMembers = determinePolygon(board, startSquare, player);
            console.log("Buffering polygon members:", polygonMembers);
            if (polygonMembers) {
                polygonMembers.forEach(square => {
                    const neighbors = [square - 1, square + 1, square - 10, square + 10];
                    neighbors.forEach(neighbor => {
                        if (isValidMove(square, neighbor) && board[neighbor] === 0) {
                            board[neighbor] = player;
                        }
                    });
                });
            } else {
                console.log("No valid polygon found for buffering.");
                return false;
            }
            return board;
        }    
    },

    discardEdits: {
        cardId: 9,
        name: "Discard Edits",
        description: "Return the board to its state previous to your opponent's last turn.",
        executionType: "immediate",
        execute: function(board, previousState, player) {
            return [...previousState];
        }    
    },

    fillSinks: {
        cardId: 10,
        name: "Fill Sinks",
        description: "Any square with four pieces around it is filled with your pieces. This cannot convert your opponent's features. The edge of the map counts as a surrounding piece.",
        executionType: "immediate",
        execute: function(board, previousState, player) {
            let newBoard = [...board];

            board.forEach((space, index) => {
                fillSinks(newBoard, index, player);
            });
            return newBoard;
        }    
    },

    project: {
        cardId: 11,
        name: "Project",
        description: "Choose a direction to reproject the map into. All pieces move one square in that direction. Pieces that move off the side of the map are removed.",
        executionType: "choice-direction",
        execute: function(board, previousState, chosenDirection, player) {
            let newBoard = [...board];

            board.forEach((space, index) => {
                projectPieces(newBoard, index, chosenDirection, player);
            });
            return newBoard;
        }    
    },
    
    spatialJoin: {
        cardId: 12,
        name: "Spatial Join",
        description: "Add a piece to all of your line and polygon features.",
        executionType: "placement",
        execute: function(board, startSquare, player, isValidMove) {
            if (!board.spatialJoinValidSquares || !board.spatialJoinValidSquares.has(startSquare)) {
                console.log("Must place piece adjacent to a highlighted feature");
                return false;
            }
            
            if (board[startSquare] !== 0) {
                console.log("Square already occupied");
                return false;
            } 

            board[startSquare] = player;

            board.spatialJoinValidSquares.delete(startSquare);

            console.log(`Spatial Join: Placed piece at ${startSquare}`);
            return board;
        }    
    },

    turnOffLayer: {
        cardId: 13,
        name: "Turn Off Layer",
        description: "Remove all features of a selected type: line, polygon, or point. This affects both your and your opponent's features.",
        executionType: "choice-layer",
        execute: function(board, previousState, chosenLayerType, player) {
            let newBoard = [...board];

            turnOffLayer(newBoard, chosenLayerType, player);

            return newBoard;
        }       
    },

    crunchTime: {
        cardId: 14,
        name: "Crunch Time",
        description: "Discard this card and skip a turn. At the end of the game, choose a tool from the top 3 of the remaining deck and play immediately.",
        executionType: "crunch",
        execute: function(board, startSquare, player, isValidMove) {
            pendingMoves.push(["crunch", player]);
            console.log(`Crunch Time: Player ${player} will choose a card at end of game`);
            return board;
        }    
    },

    hotspotAnalysis: {
        cardId: 15,
        name: "Hotspot Analysis",
        description: "Add one piece to the board. Move four of your pieces any number of squares to create a continuous polygon feature with this new piece.",
        executionType: "hotspot",
        movesRemaining: 4,
        execute: function(board, fromSquare, toSquare, player, isValidMove, initialPlacement) {
            if (initialPlacement) {
                if (board[fromSquare] !== 0) {
                    console.log("Must place on empty square");
                    return false;
                }
                board[fromSquare] = player;
                board.hotspotAnchor = fromSquare;
                console.log(`Hotspot: Placed anchor piece at ${fromSquare}`);
                return board;
            } else {
                if (board[fromSquare] !== player) {
                    console.log("Must select one of your pieces");
                    return false;
                }
                
                if (board[toSquare] !== 0) {
                    console.log("Destination must be empty");
                    return false;
                }
                
                board[toSquare] = board[fromSquare];
                board[fromSquare] = 0;
                
                console.log(`Hotspot: Moved piece from ${fromSquare} to ${toSquare}`);
                return board;
            }
        }    
    },

    nearestNeighbor: {
        cardId: 16,
        name: "Nearest Neighbor",
        description: "Choose an orthagonal direction. All empty spaces adjacent to one of your features in that direction are filled with your features.",
        executionType: "choice-direction",
        execute: function(board, previousState, chosenDirection, player) {
            let newBoard = [...board];
            const originalBoard = [...board];

            board.forEach((space, index) => {
                nearestNeighbor(newBoard, originalBoard, index, chosenDirection, player);
            });
            return newBoard;
        }       
    },

    tesselate: {
        cardId: 17,
        name: "Tesselate",
        description: "Create a 3x3 alternating grid of your features centered on the selected square. This cannot convert your opponent's features.",
        pattern: [0, 2, 11, 13, 20, 22, 31, 33],
        executionType: "placement",
        execute: function(board, startSquare, player, isValidMove) {
            this.pattern.forEach(offset => {
                const target = startSquare + offset;
                if (isValidMove(startSquare, target, 3) && board[target] == 0) {
                    board[target] = player;
                }
            });
            return board;
        } 
    },

    ctrlZ: {
        cardId: 18,
        name: "Ctrl+Z",
        description: "Choose a tool from the discard pile and play it immediately.",
        executionType: "choice-discard",
        execute: async function(board, startSquare, player, isValidMove) {
            if (discardPile.length === 0) {
                console.log("No cards in discard pile");
                return false;
            }

            const chosenCardId = await createDiscardChoiceModal();
            
            if (chosenCardId) {
                const chosenCard = getCardById(chosenCardId);
                selectCard(chosenCard);
            }

            return board;
        }
    },

    collaboration: {
        cardId: 19,
        name: "Collaboration",
        description: "Choose one of your opponent's cards to reveal. Choose whether to use it for yourself or force a discard.",
        executionType: "choice-opponent-card",
        execute: async function(board, startSquare, player, isValidMove) {
            const opponent = player === 1 ? 2 : 1;
            const opponentHand = opponent === 1 ? playerOneHand : playerTwoHand;
            
            if (opponentHand.length === 0) {
                console.log("Opponent has no cards");
                return board;
            }
            
            const result = await createCollaborationModal(opponentHand, opponent);
            
            if (result) {
                const { cardId, action } = result;
                
                if (action === 'use') {
                    const card = getCardById(cardId);
                    console.log(`Using opponent's card: ${card.name}`);
                    
                    const cardIndex = opponentHand.indexOf(cardId);
                    opponentHand.splice(cardIndex, 1);
                    
                    await selectCard(card);
                    
                } else if (action === 'discard') {
                    console.log(`Forcing opponent to discard card ${cardId}`);
                    
                    const cardIndex = opponentHand.indexOf(cardId);
                    opponentHand.splice(cardIndex, 1);
                    discardPile.push(cardId);
                    
                    updateFirebase();
                }
            }
            
            return board;
        }    
    },

    modelBuilder: {
        cardId: 20,
        name: "Model Builder",
        description: "Choose a tool from the top 5 cards in the remaining deck. This tool will be played at the end of the game.",
        executionType: "choice-deck-5",
        execute: async function(board, startSquare, player, isValidMove) {
            if (remainingDeck.length === 0) {
                console.log("No cards in remaining deck");
                return board;
            };

            const chosenCardId = await createDeckChoiceModal(5);

            if (chosenCardId) {
                pendingMoves.push(["modelBuilder", [player, chosenCardId]]);
                console.log(`Model Builder: Card ${chosenCardId} queued for player ${player} at end of game`);
            }

            return board;
        }
    },

     dataValidation: {
        cardId: 21,
        name: "Data Validation",
        description: "Choose three pieces from anywhere on the board to flip to your features. Chosen spaces can be blank or occupied by your opponent's features.",
        pattern: [0],
        numberOfPlays: 3,
        executionType: "placement",
        execute: function(board, startSquare, player, isValidMove) {
                    const target = startSquare + this.pattern[0];
                    if (isValidMove(startSquare, target) && board[target] != player) {
                        board[target] = player;
                    } else {
                        console.log("Invalid move, try again");
                        return false;
                };
                return board;
            }  
    },
};

function isValidMove(fromIndex, toIndex, maxDistance = 1) {
    if (toIndex < 0 || toIndex >= 100) return false;

    const fromRow = Math.floor(fromIndex / 10);
    const toRow = Math.floor(toIndex / 10);
    const fromCol = fromIndex % 10;
    const toCol = toIndex % 10;

    if (Math.abs(fromRow - toRow) > maxDistance || Math.abs(fromCol - toCol) > maxDistance) {
        return false;
    }

    return true;
}

function determinePolygon(board, startSquare, player) {
    if (board[startSquare] !== player) {
        return false;
    }

    const visited = new Set();
    const polygonMembers = [];

    console.log("Polygon members:", polygonMembers);

    function floodFill(square) {
        if (visited.has(square) || square < 0 || square >= 100) {
            return;
        }

        if (board[square] !== player) {
            return;
        }

        visited.add(square);
        polygonMembers.push(square);

        const neighbors = [square - 1, square + 1, square - 10, square + 10];

        neighbors.forEach(neighbor => {
            if (isValidMove(square, neighbor)) {
                floodFill(neighbor);
            }
        });
    }

    floodFill(startSquare);

    if (polygonMembers.length >= 4) {
        return polygonMembers;
    } else {
        return false;
    }
}

function determineLine(board, startSquare, player) {
    if (determinePolygon(board, startSquare, player)) {
        return false;
    }

    if (board[startSquare] !== player) {
        return false;
    }

    const visited = new Set();
    const lineMembers = [];

    function floodFill(square) {
        if (visited.has(square) || square < 0 || square >= 100) {
            return;
        }

        if (board[square] !== player) {
            return;
        }

        visited.add(square);
        lineMembers.push(square);

        const neighbors = [square - 1, square + 1, square - 9, square + 9, square - 10, square -11, square + 10, square + 11];

        neighbors.forEach(neighbor => {
            if (isValidMove(square, neighbor)) {
                floodFill(neighbor);
            }
        });
    }

    floodFill(startSquare);

    if (lineMembers.length >= 3) {
        return lineMembers;
    } else {
        return false;
    }
}

function fillSinks(newBoard, square, player) {
    if (newBoard[square] != 0) {
        return;
    }

    const neighbors = [square - 1, square + 1, square - 10, square + 10];
    let surroundingCount = 0;


    neighbors.forEach(neighbor => {
        if (!isValidMove(square, neighbor)) {
            surroundingCount++;
        } else if (newBoard[neighbor] != 0) {
            surroundingCount++;
        }
    });

    if (surroundingCount === 4) {
        newBoard[square] = player;
    }
}

function interpolateFill(newBoard, originalBoard, square, player) {
    const neighbors = [square - 1, square + 1, square - 9, square + 9, square - 10, square + 10, square + 11, square - 11];
    let surroundingCount = 0;

    neighbors.forEach(neighbor => {
        if (isValidMove(square, neighbor) && originalBoard[neighbor] == player) {
            surroundingCount++;
        }
    });

    if (surroundingCount >= 3) {
        newBoard[square] = player;
    }
}

function projectPieces(newBoard, square, direction) {
    let piece = newBoard[square];

    switch(direction) {
        case "North":
            if (isValidMove(square, square - 10)) {
                newBoard[square - 10] = piece;
            }
            break;
        case "South":
            if (isValidMove(square, square + 10)) {
                newBoard[square + 10] = piece;
            }
            break;
        case "East":
            if (isValidMove(square, square + 1)) {
                newBoard[square + 1] = piece;
            }
            break;
        case "West":
            if (isValidMove(square, square - 1)) {
                newBoard[square - 1] = piece;
            }
            break;
        
    }
    
    newBoard[piece] = 0;
}

function nearestNeighbor(newBoard, square, direction, player) {
    let piece = originalBoard[square];

    if (piece != player) {
        return;
    }
    let targetSquare;
        switch(direction) {
            case "North": targetSquare = square - 10; break;
            case "South": targetSquare = square + 10; break;
            case "East": targetSquare = square + 1; break;
            case "West": targetSquare = square - 1; break;
        }

    if (isValidMove(square, targetSquare) && originalBoard[targetSquare] == 0) {
        newBoard[targetSquare] = player;
    }
}

function turnOffLayer(newBoard, layerType, player) {
    let allPolygons = new Set();
    let allLines = new Set();
    let remainingPoints = new Set();
    const opponent = player === 1 ? 2 : 1;

    newBoard.forEach((space, index) => {
        polygonPlayerMembers = determinePolygon(newBoard, index, player);
        polygonOpponentMembers = determinePolygon(newBoard, index, opponent);

        if (polygonPlayerMembers) {
            polygonPlayerMembers.forEach(member => allPolygons.add(member));
        } else if (polygonOpponentMembers) {
            polygonOpponentMembers.forEach(member => allPolygons.add(member));
        }

        linePlayerMembers = determineLine(newBoard, index, player);
        lineOpponentMembers = determineLine(newBoard, index, opponent);
        if (linePlayerMembers) {
            linePlayerMembers.forEach(member => allLines.add(member));
        }   else if (lineOpponentMembers) {
            lineOpponentMembers.forEach(member => allLines.add(member));
        } else if (space != 0) {
            remainingPoints.add(index);
        }
    });

    switch(layerType) {
        case "Polygons":
            allPolygons.forEach(square => {
                newBoard[square] = 0;
            });
            break;
        case "Lines":
            allLines.forEach(square => {
                newBoard[square] = 0;
            });
            break;
        case "Points":
            remainingPoints.forEach(square => {
                newBoard[square] = 0;
            });
            break;
        default:
            console.log("Invalid layer type selected.");
    }

}