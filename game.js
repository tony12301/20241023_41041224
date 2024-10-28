// 等待DOM加載完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    initGame();
});

// 獲取DOM元素
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const difficultyElement = document.getElementById("difficulty");
const gameOverElement = document.getElementById("gameOver");
const finalScoreElement = document.getElementById("finalScore");
const restartButton = document.getElementById("restartButton");
const changeDifficultyButton = document.getElementById("changeDifficultyButton");
const difficultySelect = document.getElementById("difficultySelect");
const gameScreen = document.getElementById("gameScreen");

// 音訊元素
const backgroundMusic = document.getElementById("backgroundMusic");
const hitSound = document.getElementById("hitSound");
const loseLifeSound = document.getElementById("loseLifeSound");

// 主題配置
const themeSettings = {
    default: {
        background: '#f0f0f0',
        brickColors: {
            easy: "#0095DD",
            medium: "#00FF00",
            hard: "#FF0000"
        },
        ballColor: "#0095DD",
        paddleColor: "#0095DD"
    },
    night: {
        background: '#0f2027',
        brickColors: {
            easy: "#4a69bd",
            medium: "#6c5ce7",
            hard: "#a55eea"
        },
        ballColor: "#a55eea",
        paddleColor: "#4a69bd"
    },
    forest: {
        background: '#134e5e',
        brickColors: {
            easy: "#58B19F",
            medium: "#3B3B98",
            hard: "#182C61"
        },
        ballColor: "#58B19F",
        paddleColor: "#182C61"
    },
    ocean: {
        background: '#1cb5e0',
        brickColors: {
            easy: "#48dbfb",
            medium: "#0abde3",
            hard: "#54a0ff"
        },
        ballColor: "#48dbfb",
        paddleColor: "#54a0ff"
    }
};

// 難度配置
const difficultySettings = {
    easy: {
        ballSpeed: 2,
        paddleWidth: 85,
        brickRowCount: 3,
        brickColumnCount: 8,
        lives: 5,
        displayName: "簡單"
    },
    medium: {
        ballSpeed: 3,
        paddleWidth: 75,
        brickRowCount: 4,
        brickColumnCount: 10,
        lives: 3,
        displayName: "中等"
    },
    hard: {
        ballSpeed: 4,
        paddleWidth: 65,
        brickRowCount: 5,
        brickColumnCount: 12,
        lives: 2,
        displayName: "困難"
    }
};

// 遊戲配置
const config = {
    paddle: {
        height: 10,
        width: 75,
        speed: 7
    },
    brick: {
        height: 20,
        padding: 5,
        offsetTop: 30,
        offsetLeft: 30,
        colors: themeSettings.default.brickColors // 初始使用預設主題的顏色
    },
    ball: {
        radius: 10,
        speed: {
            x: 2,
            y: -2
        }
    }
};

// 遊戲狀態
let gameState = {
    score: 0,
    lives: 3,
    currentDifficulty: null,
    currentTheme: 'default',
    ball: {
        x: canvas.width / 2,
        y: canvas.height - 30,
        dx: 0,
        dy: 0
    },
    paddle: {
        x: (canvas.width - config.paddle.width) / 2
    },
    controls: {
        rightPressed: false,
        leftPressed: false
    },
    isGameOver: false,
    isPaused: true,
    ballTrail: [],
    trailLength: 5
};
let musicVolume = 0.3;
let soundVolume = 0.5;
const volumeControls = {
    music: document.querySelector('#musicVolume'),
    sound: document.querySelector('#soundVolume')
};
let bricks = [];

// 主題切換函數
function changeTheme(theme) {
    gameState.currentTheme = theme;
    const container = document.querySelector('.game-container');
    
    // 移除所有主題類
    container.classList.remove('theme-default', 'theme-night', 'theme-forest', 'theme-ocean');
    // 添加新主題類
    container.classList.add(`theme-${theme}`);
    
    // 更新遊戲顏色
    config.brick.colors = themeSettings[theme].brickColors;
    
    // 如果遊戲正在進行，重繪畫面
    if (!gameState.isPaused) {
        drawGame();
    }
}

// 輔助函數：將十六進制顏色轉換為 RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
        `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
        : '0, 0, 0';
}// 初始化磚塊
function initializeBricks(settings) {
    const bricks = [];
    const totalWidth = canvas.width - 2 * config.brick.offsetLeft;
    const brickWidth = Math.floor((totalWidth - (settings.brickColumnCount - 1) * config.brick.padding) / settings.brickColumnCount);
    
    config.brick.width = brickWidth;
    
    for(let c = 0; c < settings.brickColumnCount; c++) {
        bricks[c] = [];
        for(let r = 0; r < settings.brickRowCount; r++) {
            const brickX = c * (brickWidth + config.brick.padding) + config.brick.offsetLeft;
            const brickY = r * (config.brick.height + config.brick.padding) + config.brick.offsetTop;
            
            // 根據難度和行數決定磚塊的耐久度
            let hitPoints = 1;
            if (settings.difficulty === 'medium' && r < 2) {
                hitPoints = 2;
            } else if (settings.difficulty === 'hard') {
                if (r < 2) hitPoints = 3;
                else if (r < 4) hitPoints = 2;
            }
            
            bricks[c][r] = {
                x: brickX,
                y: brickY,
                status: hitPoints, // 使用 status 來記錄剩餘的耐久度
                width: brickWidth,
                maxHitPoints: hitPoints // 記錄初始耐久度用於顏色計算
            };
        }
    }
    return bricks;
}


// 繪製球和尾跡
function drawBall() {
    // 繪製尾跡
    for(let i = 0; i < gameState.ballTrail.length; i++) {
        const trail = gameState.ballTrail[i];
        const alpha = (i + 1) / gameState.ballTrail.length;
        
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, config.ball.radius * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${hexToRgb(themeSettings[gameState.currentTheme].ballColor)}, ${alpha * 0.3})`;
        ctx.fill();
        ctx.closePath();
    }
    
    // 繪製主球
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, config.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = themeSettings[gameState.currentTheme].ballColor;
    ctx.fill();
    ctx.closePath();
    
    // 更新尾跡位置
    gameState.ballTrail.push({
        x: gameState.ball.x,
        y: gameState.ball.y
    });
    
    if(gameState.ballTrail.length > gameState.trailLength) {
        gameState.ballTrail.shift();
    }
}

// 繪製擋板
function drawPaddle() {
    ctx.beginPath();
    ctx.rect(gameState.paddle.x, 
             canvas.height - config.paddle.height,
             config.paddle.width, 
             config.paddle.height);
    ctx.fillStyle = themeSettings[gameState.currentTheme].paddleColor;
    ctx.fill();
    ctx.closePath();
}

// 繪製磚塊
function drawBricks() {
    for(let c = 0; c < bricks.length; c++) {
        for(let r = 0; r < bricks[c].length; r++) {
            const brick = bricks[c][r];
            if(brick.status > 0) {
                ctx.beginPath();
                ctx.rect(
                    brick.x,
                    brick.y,
                    brick.width,
                    config.brick.height
                );
                
                // 根據剩餘耐久度計算顏色
                let baseColor;
                const theme = themeSettings[gameState.currentTheme];
                if (brick.maxHitPoints === 1) {
                    baseColor = theme.brickColors[gameState.currentDifficulty];
                } else {
                    // 計算顏色漸變
                    const progress = brick.status / brick.maxHitPoints;
                    if (brick.maxHitPoints === 2) {
                        // 雙重磚塊使用不同的顏色
                        baseColor = progress === 1 ? '#FF6B6B' : '#FFA07A';
                    } else {
                        // 三重磚塊使用另一組顏色
                        if (progress > 0.66) baseColor = '#FF4757';
                        else if (progress > 0.33) baseColor = '#FF6B6B';
                        else baseColor = '#FF7F50';
                    }
                }
                
                ctx.fillStyle = baseColor;
                ctx.fill();
                
                // 為多重磚塊添加耐久度指示
                if (brick.maxHitPoints > 1) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(
                        brick.status,
                        brick.x + brick.width/2,
                        brick.y + config.brick.height/2 + 4
                    );
                }
                
                ctx.closePath();
            }
        }
    }
}

// 碰撞檢測
function collisionDetection() {
    for(let c = 0; c < bricks.length; c++) {
        for(let r = 0; r < bricks[c].length; r++) {
            const b = bricks[c][r];
            if(b.status > 0) {
                if(gameState.ball.x > b.x && 
                   gameState.ball.x < b.x + b.width && 
                   gameState.ball.y > b.y && 
                   gameState.ball.y < b.y + config.brick.height) {
                    gameState.ball.dy = -gameState.ball.dy;
                    b.status--; // 減少磚塊耐久度
                    
                    // 只有在完全破壞磚塊時才加分
                    if (b.status === 0) {
                        gameState.score += b.maxHitPoints; // 根據磚塊初始耐久度給分
                        scoreElement.textContent = gameState.score;
                    }
                    
                    // 播放碰撞音效
                    hitSound.currentTime = 0;
                    hitSound.play().catch(err => console.log('音效播放失敗:', err));
                    
                    // 檢查是否所有磚塊都被破壞
                    let remainingBricks = 0;
                    for(let i = 0; i < bricks.length; i++) {
                        for(let j = 0; j < bricks[i].length; j++) {
                            if(bricks[i][j].status > 0) remainingBricks++;
                        }
                    }
                    if(remainingBricks === 0) {
                        showGameOver(true);
                    }
                }
            }
        }
    }
}

// 遊戲結束處理
function showGameOver(isWin) {
    gameState.isGameOver = true;
    gameState.isPaused = true;
    finalScoreElement.textContent = gameState.score;
    gameOverElement.classList.remove('hidden');
    gameOverElement.querySelector("h2").textContent = 
        isWin ? "恭喜過關！" : "遊戲結束";
    
    // 停止背景音樂
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
}

// 更新遊戲狀態
function updateGameState() {
    if(gameState.ball.x + gameState.ball.dx > canvas.width - config.ball.radius || 
       gameState.ball.x + gameState.ball.dx < config.ball.radius) {
        gameState.ball.dx = -gameState.ball.dx;
    }
    
    if(gameState.ball.y + gameState.ball.dy < config.ball.radius) {
        gameState.ball.dy = -gameState.ball.dy;
    }
    else if(gameState.ball.y + gameState.ball.dy > canvas.height - config.ball.radius) {
        if(gameState.ball.x > gameState.paddle.x && 
           gameState.ball.x < gameState.paddle.x + config.paddle.width) {
            gameState.ball.dy = -gameState.ball.dy;
        }
        else {
            gameState.lives--;
            livesElement.textContent = gameState.lives;
            
            // 播放失去生命音效
            loseLifeSound.currentTime = 0;
            loseLifeSound.play().catch(err => console.log('音效播放失敗:', err));
            
            if(gameState.lives === 0) {
                showGameOver(false);
                return;
            }
            else {
                resetBallAndPaddle();
            }
        }
    }
    
    gameState.ball.x += gameState.ball.dx;
    gameState.ball.y += gameState.ball.dy;
    
    if(gameState.controls.rightPressed && 
       gameState.paddle.x < canvas.width - config.paddle.width) {
        gameState.paddle.x += config.paddle.speed;
    }
    else if(gameState.controls.leftPressed && gameState.paddle.x > 0) {
        gameState.paddle.x -= config.paddle.speed;
    }
}

// 重置球和擋板位置
function resetBallAndPaddle() {
    gameState.ball.x = canvas.width / 2;
    gameState.ball.y = canvas.height - 30;
    gameState.ball.dx = config.ball.speed.x;
    gameState.ball.dy = config.ball.speed.y;
    gameState.paddle.x = (canvas.width - config.paddle.width) / 2;
    gameState.ballTrail = [];
}

// 更新顯示
function updateDisplay() {
    scoreElement.textContent = gameState.score;
    livesElement.textContent = gameState.lives;
    difficultyElement.textContent = difficultySettings[gameState.currentDifficulty].displayName;
}

// 遊戲主循環
function gameLoop() {
    if (!gameState.isPaused) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        drawBricks();
        drawBall();
        drawPaddle();
        collisionDetection();
        updateGameState();
        
        requestAnimationFrame(gameLoop);
    }
}

// 鍵盤控制
function keyDownHandler(e) {
    if(e.key === "Right" || e.key === "ArrowRight") {
        gameState.controls.rightPressed = true;
    }
    else if(e.key === "Left" || e.key === "ArrowLeft") {
        gameState.controls.leftPressed = true;
    }
}

function keyUpHandler(e) {
    if(e.key === "Right" || e.key === "ArrowRight") {
        gameState.controls.rightPressed = false;
    }
    else if(e.key === "Left" || e.key === "ArrowLeft") {
        gameState.controls.leftPressed = false;
    }
}

// 滑鼠控制
function mouseMoveHandler(e) {
    const relativeX = e.clientX - canvas.offsetLeft;
    if(relativeX > 0 && relativeX < canvas.width) {
        gameState.paddle.x = relativeX - config.paddle.width / 2;
    }
}

// 開始遊戲
function startGame(difficulty) {
    // 設置難度
    gameState.currentDifficulty = difficulty;
    const settings = {
        ...difficultySettings[difficulty],
        difficulty: difficulty
    };
    
    // 更新配置
    config.paddle.width = settings.paddleWidth;
    config.ball.speed.x = settings.ballSpeed;
    config.ball.speed.y = -settings.ballSpeed;
    
    // 更新遊戲狀態
    gameState.lives = settings.lives;
    gameState.score = 0;
    gameState.isPaused = false;
    gameState.isGameOver = false;
    gameState.ballTrail = [];
    
    // 重置球和擋板位置
    resetBallAndPaddle();
    
    // 初始化磚塊
    bricks = initializeBricks(settings);
    
    // 更新顯示
    updateDisplay();
    difficultySelect.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    gameOverElement.classList.add('hidden');
    
    // 播放背景音樂
    backgroundMusic.play().catch(err => console.log('音樂播放失敗:', err));
    
    // 開始遊戲循環
    gameLoop();
}

function showDifficultySelect() {
    difficultySelect.classList.remove('hidden');
    gameScreen.classList.add('hidden');
    gameOverElement.classList.add('hidden');
}

// 設置事件監聽器
function setupEventListeners() {
    document.addEventListener("keydown", keyDownHandler);
    document.addEventListener("keyup", keyUpHandler);
    document.addEventListener("mousemove", mouseMoveHandler);
    restartButton.addEventListener("click", () => startGame(gameState.currentDifficulty));
    changeDifficultyButton.addEventListener("click", showDifficultySelect);
    
    // 添加主題切換按鈕事件監聽
    const themeButtons = document.querySelectorAll('.theme-btn');
    themeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const theme = button.getAttribute('data-theme');
            changeTheme(theme);
        });
    });
     // 音量控制事件監聽
     volumeControls.music.addEventListener('input', (e) => {
        musicVolume = parseFloat(e.target.value);
        backgroundMusic.volume = musicVolume;
    });
    
    volumeControls.sound.addEventListener('input', (e) => {
        soundVolume = parseFloat(e.target.value);
        hitSound.volume = soundVolume;
        loseLifeSound.volume = soundVolume;
    });
}

// 初始化遊戲
function initGame() {
    setupEventListeners();
    
    // 設置音訊音量
    backgroundMusic.volume = 0.3;
    hitSound.volume = 0.5;
    loseLifeSound.volume = 0.5;
    
    // 設置難度選擇按鈕
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const difficulty = button.getAttribute('data-difficulty');
            startGame(difficulty);
        });
    });
     // 設置初始音量值
     volumeControls.music.value = musicVolume;
     volumeControls.sound.value = soundVolume;
     backgroundMusic.volume = musicVolume;
     hitSound.volume = soundVolume;
     loseLifeSound.volume = soundVolume;
    showDifficultySelect();
}