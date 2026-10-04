const socket = io();

let roomCode = null;
let roomState = null;

let gameScene = null;

let localPlayerId = null;

let players = new Map();
let bullets = new Map();

let inputState = {
    left: false,
    right: false,
    jump: false,
    shoot: false,

    aimX: 1000,
    aimY: 400
};

let lastInputTime = 0;

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 900;

const config = {

    type: Phaser.AUTO,

    parent: "game",

    width: 1000,
    height: 600,

    backgroundColor: "#101010",

    physics: {
        default: "arcade"
    },

    scene: {
        create,
        update
    }
};

const game = new Phaser.Game(config);

const menu =
    document.getElementById("menu");

const createButton =
    document.getElementById("createButton");

const joinButton =
    document.getElementById("joinButton");

const startButton =
    document.getElementById("startButton");

const roomInput =
    document.getElementById("roomInput");

const roomCodeDisplay =
    document.getElementById("roomCode");

const lobbyPlayers =
    document.getElementById("lobbyPlayers");

const statusDisplay =
    document.getElementById("status");

createButton.addEventListener(
    "click",
    () => {

        statusDisplay.textContent =
            "Creating room...";

        socket.emit(
            "createRoom",
            (response) => {

                if (!response.success) {

                    statusDisplay.textContent =
                        response.message;

                    return;
                }

                roomCode =
                    response.code;

                roomCodeDisplay.textContent =
                    `ROOM: ${roomCode}`;

                statusDisplay.textContent =
                    "Share this code with your friends.";

                startButton.style.display =
                    "block";
            }
        );
    }
);

joinButton.addEventListener(
    "click",
    () => {

        const code =
            roomInput.value
                .trim()
                .toUpperCase();

        if (!code) {

            statusDisplay.textContent =
                "Enter a room code.";

            return;
        }

        socket.emit(
            "joinRoom",
            code,
            (response) => {

                if (!response.success) {

                    statusDisplay.textContent =
                        response.message;

                    return;
                }

                roomCode =
                    response.code;

                roomCodeDisplay.textContent =
                    `ROOM: ${roomCode}`;

                statusDisplay.textContent =
                    "Joined room.";
            }
        );
    }
);

startButton.addEventListener(
    "click",
    () => {

        socket.emit("startGame");
    }
);

socket.on(
    "connect",
    () => {

        localPlayerId =
            socket.id;
    }
);

socket.on(
    "roomState",
    (state) => {

        roomState = state;

        roomCodeDisplay.textContent =
            `ROOM: ${state.code}`;

        lobbyPlayers.innerHTML =
            state.players
                .map(
                    (player, index) =>
                        `Player ${index + 1}` +
                        (
                            player.id === state.host
                                ? " 👑"
                                : ""
                        )
                )
                .join("<br>");

        if (
            state.state === "lobby"
        ) {

            menu.style.display =
                "flex";

            startButton.style.display =
                state.host === socket.id
                    ? "block"
                    : "none";

            statusDisplay.textContent =
                state.players.length >= 2
                    ? "Ready to start."
                    : "Waiting for another player...";
        }

        if (
            state.state === "playing"
        ) {

            menu.style.display =
                "none";
        }
    }
);

socket.on(
    "gameState",
    (state) => {

        updatePlayers(state.players);

        updateBullets(state.bullets);
    }
);

function updatePlayers(serverPlayers) {

    const seen = new Set();

    for (
        const data of serverPlayers
    ) {

        seen.add(data.id);

        let object =
            players.get(data.id);

        if (!object) {

            object =
                createPlayerObject(data);

            players.set(
                data.id,
                object
            );
        }

        object.targetX =
            data.x / 2;

        object.targetY =
            data.y * (600 / 900);

        object.health =
            data.health;

        object.score =
            data.score;

        object.alive =
            data.alive;

        object.facing =
            data.facing;

        updateHealthBar(object);

        if (!data.alive) {

            object.body.setVisible(false);

            object.gun.setVisible(false);

            object.healthBar.setVisible(false);

        } else {

            object.body.setVisible(true);

            object.gun.setVisible(true);

            object.healthBar.setVisible(true);
        }
    }

    for (
        const [id, object] of players
    ) {

        if (!seen.has(id)) {

            destroyPlayerObject(object);

            players.delete(id);
        }
    }
}

function updateBullets(serverBullets) {

    const seen = new Set();

    for (
        const data of serverBullets
    ) {

        seen.add(data.id);

        let bullet =
            bullets.get(data.id);

        if (!bullet) {

            bullet =
                gameScene.add.circle(
                    data.x / 2,
                    data.y * (600 / 900),
                    5,
                    0xffff00
                );

            bullets.set(
                data.id,
                bullet
            );
        }

        bullet.targetX =
            data.x / 2;

        bullet.targetY =
            data.y * (600 / 900);
    }

    for (
        const [id, bullet] of bullets
    ) {

        if (!seen.has(id)) {

            bullet.destroy();

            bullets.delete(id);
        }
    }
}

function createPlayerObject(data) {

    const body =
        gameScene.add.rectangle(
            data.x / 2,
            data.y * (600 / 900),
            28,
            43,
            data.id === socket.id
                ? 0x00aaff
                : 0xff4444
        );

    const gun =
        gameScene.add.rectangle(
            body.x + 20,
            body.y,
            35,
            7,
            0xffffff
        );

    gun.setOrigin(0, 0.5);

    const healthBar =
        gameScene.add.rectangle(
            body.x,
            body.y - 30,
            40,
            5,
            0x22dd44
        );

    return {
        body,
        gun,
        healthBar,

        targetX: body.x,
        targetY: body.y,

        health: 100,

        score: 0,

        alive: true,

        facing: 1
    };
}

function destroyPlayerObject(object) {

    object.body.destroy();

    object.gun.destroy();

    object.healthBar.destroy();
}

function updateHealthBar(object) {

    const width =
        Math.max(
            0,
            40 * (object.health / 100)
        );

    object.healthBar.width =
        width;
}

function create() {

    gameScene = this;

    this.cameras.main.setBackgroundColor(
        "#101010"
    );

    // Ground

    this.add.rectangle(
        500,
        570,
        1000,
        60,
        0x333333
    );

    // Platforms

    this.add.rectangle(
        300,
        430,
        300,
        20,
        0x444444
    );

    this.add.rectangle(
        700,
        330,
        280,
        20,
        0x444444
    );

    this.add.rectangle(
        900,
        470,
        220,
        20,
        0x444444
    );

    this.add.text(
        20,
        20,
        "DOODLE STRIKER",
        {
            fontSize: "26px",
            color: "#ffffff",
            fontStyle: "bold"
        }
    );

    this.add.text(
        20,
        52,
        "← → Move    A / SPACE Jump    Mouse Aim    Click Shoot",
        {
            fontSize: "14px",
            color: "#cccccc"
        }
    );

    setupKeyboard(this);

    setupMouse(this);

    setupMobileControls();
}

function setupKeyboard(scene) {

    scene.input.keyboard.on(
        "keydown-LEFT",
        () => {
            inputState.left = true;
        }
    );

    scene.input.keyboard.on(
        "keyup-LEFT",
        () => {
            inputState.left = false;
        }
    );

    scene.input.keyboard.on(
        "keydown-RIGHT",
        () => {
            inputState.right = true;
        }
    );

    scene.input.keyboard.on(
        "keyup-RIGHT",
        () => {
            inputState.right = false;
        }
    );

    scene.input.keyboard.on(
        "keydown-A",
        () => {
            inputState.jump = true;
        }
    );

    scene.input.keyboard.on(
        "keyup-A",
        () => {
            inputState.jump = false;
        }
    );

    scene.input.keyboard.on(
        "keydown-SPACE",
        () => {
            inputState.jump = true;
        }
    );

    scene.input.keyboard.on(
        "keyup-SPACE",
        () => {
            inputState.jump = false;
        }
    );
}

function setupMouse(scene) {

    scene.input.on(
        "pointermove",
        (pointer) => {

            inputState.aimX =
                pointer.worldX * 2;

            inputState.aimY =
                pointer.worldY * 1.5;
        }
    );

    scene.input.on(
        "pointerdown",
        () => {

            inputState.shoot = true;
        }
    );

    scene.input.on(
        "pointerup",
        () => {

            inputState.shoot = false;
        }
    );
}

function setupMobileControls() {

    const left =
        document.getElementById(
            "leftButton"
        );

    const right =
        document.getElementById(
            "rightButton"
        );

    const jump =
        document.getElementById(
            "jumpButton"
        );

    const fire =
        document.getElementById(
            "fireButton"
        );

    bindHold(
        left,
        () => inputState.left = true,
        () => inputState.left = false
    );

    bindHold(
        right,
        () => inputState.right = true,
        () => inputState.right = false
    );

    bindHold(
        jump,
        () => inputState.jump = true,
        () => inputState.jump = false
    );

    bindHold(
        fire,
        () => inputState.shoot = true,
        () => inputState.shoot = false
    );
}

function bindHold(
    element,
    start,
    end
) {

    element.addEventListener(
        "pointerdown",
        (event) => {

            event.preventDefault();

            start();
        }
    );

    element.addEventListener(
        "pointerup",
        (event) => {

            event.preventDefault();

            end();
        }
    );

    element.addEventListener(
        "pointercancel",
        end
    );

    element.addEventListener(
        "pointerleave",
        end
    );
}

function update(time) {

    // Smooth players

    for (
        const object of players.values()
    ) {

        object.body.x =
            Phaser.Math.Linear(
                object.body.x,
                object.targetX,
                0.35
            );

        object.body.y =
            Phaser.Math.Linear(
                object.body.y,
                object.targetY,
                0.35
            );

        object.gun.x =
            object.body.x;

        object.gun.y =
            object.body.y;

        object.healthBar.x =
            object.body.x;

        object.healthBar.y =
            object.body.y - 30;

        if (
            object.facing < 0
        ) {
            object.gun.rotation =
                Math.PI;
        }
    }

    // Smooth bullets

    for (
        const bullet of bullets.values()
    ) {

        if (
            bullet.targetX !== undefined
        ) {

            bullet.x =
                Phaser.Math.Linear(
                    bullet.x,
                    bullet.targetX,
                    0.6
                );

            bullet.y =
                Phaser.Math.Linear(
                    bullet.y,
                    bullet.targetY,
                    0.6
                );
        }
    }

    // Send input

    if (
        socket.connected &&
        time - lastInputTime > 30
    ) {

        socket.emit(
            "input",
            inputState
        );

        lastInputTime =
            time;
    }

    // Aim local gun

    const local =
        players.get(socket.id);

    if (local) {

        const pointer =
            this.input.activePointer;

        const angle =
            Phaser.Math.Angle.Between(
                local.body.x,
                local.body.y,
                pointer.worldX,
                pointer.worldY
            );

        local.gun.rotation =
            angle;
    }
}