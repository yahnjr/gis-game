const cardTypes = {
    firstTurn: {
        cardId: 99,
        name: "Player's First Turn",
        description: "Add ten features anywhere on the board.",
        pattern: [0],
        numberOfPlays: 10,
        executionType: "placement",
        execute: function(board, startSquare, player, isValidMove) {
                const target = startSquare + this.pattern[0];
                if (isValidMove(startSquare, target) && board[target] == 0) {
                    board[target] = player;
                    addLog(`Opening Moves: Placed feature at square ${startSquare}`);
                } else {
                    addLog("Invalid move, try again");
                    return false;
            };
            return board;
        }    
    },
    
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
                addLog(`Created ${successfulTurns} features at square ${startSquare}`);
                return board;
            } else {
                addLog("Invalid move, try again");
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
            let erasedCount = 0;
            this.pattern.forEach(offset => {
                const target = startSquare + offset;
                if (isValidMove(startSquare, target, 2) && board[target] !== 0) {
                    board[target] = 0;
                    erasedCount++;
                }
            });
            addLog(`Erased ${erasedCount} features`);
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
                addLog(`Clipped ${successfulTurns} opponent features`);
                return board;
            } else {
                addLog("Invalid move, try again");
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
                    addLog(`Field Collection: Placed feature at square ${startSquare}`);
                } else {
                    addLog("Invalid move, try again");
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
            let filledCount = 0;
            
            board.forEach((space, index) => {
                if (interpolateFill(newBoard, board, index, player)) {
                    filledCount++;
                }
            });
            addLog(`Interpolate: Filled ${filledCount} squares`);
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
                addLog("Must click on an opponent's polygon feature");
                return false;
            }

            let touchingPlayerFeature = false;

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
                addLog("Opponent's polygon must be touching one of your polygon or line features");
                return false;
            }
            
            opponentPolygon.forEach(square => {
                board[square] = player;
            });
            
            addLog(`Dissolved opponent polygon of ${opponentPolygon.length} squares`);
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
                addLog("No piece at selected square");
                return false;
            }
            
            const fromRow = Math.floor(fromSquare / 10);
            const fromCol = fromSquare % 10;
            const toRow = Math.floor(toSquare / 10);
            const toCol = toSquare % 10;
            
            const rowDiff = Math.abs(fromRow - toRow);
            const colDiff = Math.abs(fromCol - toCol);
            
            if (rowDiff > 1 || colDiff > 1 || (rowDiff === 0 && colDiff === 0)) {
                addLog("Can only move one space at a time");
                return false;
            }
            
            if (toSquare < 0 || toSquare >= 100) {
                board[fromSquare] = 0;
                addLog("Piece moved off edge and removed");
                return board;
            }
            
            if (board[toSquare] !== 0) {
                addLog("Cannot move to occupied square");
                return false;
            }
            
            board[toSquare] = board[fromSquare];
            board[fromSquare] = 0;
            
            addLog(`Moved piece from square ${fromSquare} to ${toSquare}`);
            return board;
        }    
    },

    buffer: {
        cardId: 8,
        name: "Buffer",
        description: "Choose one of your polygon features. All empty squares orthogonally adjacent to that polygon are filled with your features.",
        executionType: "placement",
        execute: function(board, startSquare, player, isValidMove) {
            polygonMembers = determinePolygon(board, startSquare, player);
            if (polygonMembers) {
                let bufferedCount = 0;
                polygonMembers.forEach(square => {
                    const neighbors = [square - 1, square + 1, square - 10, square + 10];
                    neighbors.forEach(neighbor => {
                        if (isValidMove(square, neighbor) && board[neighbor] === 0) {
                            board[neighbor] = player;
                            bufferedCount++;
                        }
                    });
                });
                addLog(`Buffer: Added ${bufferedCount} features around polygon`);
            } else {
                addLog("No valid polygon found for buffering");
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
            addLog("Board reverted to previous state");
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
            let filledCount = 0;

            board.forEach((space, index) => {
                if (fillSinks(newBoard, index, player)) {
                    filledCount++;
                }
            });
            addLog(`Fill Sinks: Filled ${filledCount} squares`);
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
            projectPieces(newBoard, chosenDirection);
            addLog(`Project: Moved all pieces ${chosenDirection}`);
            return newBoard;
        }    
    },
    
    spatialJoin: {
        cardId: 12,
        name: "Spatial Join",
        description: "Add a piece to all of your line and polygon features.",
        executionType: "spatial-join",
        execute: function(board, startSquare, player, isValidMove) {
            if (!board.spatialJoinValidSquares || !board.spatialJoinValidSquares.has(startSquare)) {
                addLog("Must place piece adjacent to a highlighted feature");
                return false;
            }
            
            if (board[startSquare] !== 0) {
                addLog("Square already occupied");
                return false;
            } 

            board[startSquare] = player;

            board.spatialJoinValidSquares.delete(startSquare);

            addLog(`Spatial Join: Placed piece at square ${startSquare}`);
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

            const removedCount = turnOffLayer(newBoard, chosenLayerType, player);
            addLog(`Turn Off Layer: Removed ${removedCount} ${chosenLayerType}`);

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
            addLog(`Crunch Time: Player ${player} will choose a card at end of game`);
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
                    addLog("Must place on empty square");
                    return false;
                }
                board[fromSquare] = player;
                board.hotspotAnchor = fromSquare;
                addLog(`Hotspot: Placed anchor piece at square ${fromSquare}`);
                return board;
            } else {
                if (board[fromSquare] !== player) {
                    addLog("Must select one of your pieces");
                    return false;
                }
                
                if (board[toSquare] !== 0) {
                    addLog("Destination must be empty");
                    return false;
                }
                
                board[toSquare] = board[fromSquare];
                board[fromSquare] = 0;
                
                addLog(`Hotspot: Moved piece from square ${fromSquare} to ${toSquare}`);
                return board;
            }
        }    
    },

    nearestNeighbor: {
        cardId: 16,
        name: "Nearest Neighbor",
        description: "Choose an orthogonal direction. All empty spaces adjacent to one of your features in that direction are filled with your features.",
        executionType: "choice-direction",
        execute: function(board, previousState, chosenDirection, player) {
            let newBoard = [...board];
            const originalBoard = [...board];
            let filledCount = 0;

            board.forEach((space, index) => {
                if (nearestNeighbor(newBoard, originalBoard, index, chosenDirection, player)) {
                    filledCount++;
                }
            });
            addLog(`Nearest Neighbor: Filled ${filledCount} squares to the ${chosenDirection}`);
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
            let placedCount = 0;
            this.pattern.forEach(offset => {
                const target = startSquare + offset;
                if (isValidMove(startSquare, target, 3) && board[target] == 0) {
                    board[target] = player;
                    placedCount++;
                }
            });
            addLog(`Tesselate: Placed ${placedCount} features`);
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
                addLog("No cards in discard pile");
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
        description: "Choose one of your opponent's cards to reveal. Choose whether to use it for yourself or force a discard. If the opposing player is out of cards, use the top card from the remaining deck.",
        executionType: "choice-opponent-card",
        execute: async function(board, startSquare, player, isValidMove) {
            const opponent = player === 1 ? 2 : 1;
            const opponentHand = opponent === 1 ? playerOneHand : playerTwoHand;
            
            if (opponentHand.length === 0) {
                addLog("Opponent has no cards, using top card from remaining deck");
                if (remainingDeck.length != 0) {
                    const topCard = remainingDeck.pop();
                    opponentHand.push(topCard);
                }

                return board;
            }
            
            const result = await createCollaborationModal(opponentHand, opponent);
            
            if (result) {
                const { cardId, action } = result;
                
                if (action === 'use') {
                    const card = getCardById(cardId);
                    addLog(`Using opponent's card: ${card.name}`);
                    
                    const cardIndex = opponentHand.indexOf(cardId);
                    opponentHand.splice(cardIndex, 1);
                    
                    await selectCard(card);
                    
                } else if (action === 'discard') {
                    addLog(`Forcing opponent to discard card ${cardId}`);
                    
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
                addLog("No cards in remaining deck");
                return board;
            };

            const chosenCardId = await createDeckChoiceModal(5);

            if (chosenCardId) {
                pendingMoves.push(["modelBuilder", [player, chosenCardId]]);
                addLog(`Model Builder: Card ${chosenCardId} queued for player ${player} at end of game`);
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
                        addLog(`Data Validation: Flipped square ${startSquare} to Player ${player}`);
                    } else {
                        addLog("Invalid move, try again");
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
        return false;
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
        return true;
    }
    return false;
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
        return true;
    }
    return false;
}

function projectPieces(newBoard, direction) {
    const boardSize = 100;
    let indices = [];
    
    for (let i = 0; i < boardSize; i++) {
        indices.push(i);
    }
    
    if (direction === "South" || direction === "East") {
        indices.reverse();
    }
    
    indices.forEach(square => {
        let piece = newBoard[square];
        
        if (piece === 0) return;
        
        let targetSquare;
        switch(direction) {
            case "North": targetSquare = square - 10; break;
            case "South": targetSquare = square + 10; break;
            case "East": targetSquare = square + 1; break;
            case "West": targetSquare = square - 1; break;
        }
        
        if (isValidMove(square, targetSquare) && newBoard[targetSquare] === 0) {
            newBoard[targetSquare] = piece;
            newBoard[square] = 0;
        } else if (!isValidMove(square, targetSquare)) {
            newBoard[square] = 0;
        }
    });
}

function nearestNeighbor(newBoard, originalBoard, square, direction, player) {
    let piece = originalBoard[square];

    if (piece != player) {
        return false;
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
        return true;
    }
    return false;
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

    let removedCount = 0;
    switch(layerType) {
        case "Polygons":
            allPolygons.forEach(square => {
                newBoard[square] = 0;
                removedCount++;
            });
            break;
        case "Lines":
            allLines.forEach(square => {
                newBoard[square] = 0;
                removedCount++;
            });
            break;
        case "Points":
            remainingPoints.forEach(square => {
                newBoard[square] = 0;
                removedCount++;
            });
            break;
        default:
            addLog("Invalid layer type selected");
    }
    
    return removedCount;
}