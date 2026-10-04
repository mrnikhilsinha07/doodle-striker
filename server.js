const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

const rooms = new Map();

const WORLD = {
    width: 2000,
    height: 900,
    groundY: 820
};

const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;

const PLAYER = {
    width: 42,
    height: 64,
    speed: 320,
    jump: 650,
    gravity: 1500,
    maxHealth: 100,
    respawnTime: 2000
};

const BULLET = {
    speed: 950,
    damage: 25,
    lifetime: 1200
};

function randomRoomCode() {
    let code;

    do {
        code = Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();
    } while (rooms.has(code));

    return code;
}

function spawnPosition(index) {
    const positions = [
        { x: 250, y: 600 },
        { x: 550, y: 600 },
        { x: 850, y: 600 },
        { x: 1150, y: 600 },
        { x: 1450, y: 600 },
        { x: 1750, y: 600 }
    ];

    return positions[index % positions.length];
}

function createPlayer(socketId, index) {
    const spawn = spawnPosition(index);

    return {
        id: socketId,

        x: spawn.x,
        y: spawn.y,

        vx: 0,
        vy: 0,

        width: PLAYER.width,
        height: PLAYER.height,

        health: PLAYER.maxHealth,

        score: 0,

        alive: true,

        respawnAt: 0,

        facing: 1,

        input: {
            left: false,
            right: false,
            jump: false,
            shoot: false
        },

        aimX: spawn.x + 100,
        aimY: spawn.y
    };
}

function publicPlayer(player) {
    return {
        id: player.id,
        x: player.x,
        y: player.y,
        health: player.health,
        score: player.score,
        alive: player.alive,
        facing: player.facing
    };
}

function publicRoom(room) {
    return {
        code: room.code,
        host: room.host,
        state: room.state,
        players: Array.from(room.players.values()).map(publicPlayer)
    };
}

function broadcastRoom(room) {
    io.to(room.code).emit("roomState", publicRoom(room));
}

function resetPlayer(player, index) {
    const spawn = spawnPosition(index);

    player.x = spawn.x;
    player.y = spawn.y;

    player.vx = 0;
    player.vy = 0;

    player.health = PLAYER.maxHealth;

    player.alive = true;
    player.respawnAt = 0;
}

function startMatch(room) {

    if (room.players.size < MIN_PLAYERS) {
        return false;
    }

    room.state = "playing";

    let index = 0;

    for (const player of room.players.values()) {
        resetPlayer(player, index);
        player.score = 0;
        index++;
    }

    room.bullets = [];

    broadcastRoom(room);

    return true;
}

function createBullet(player) {

    const dx = player.aimX - player.x;
    const dy = player.aimY - player.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
        return;
    }

    const vx = dx / distance;
    const vy = dy / distance;

   const roomBullet = {
        id: Math.random().toString(36).substring(2),
        owner: player.id,
        x: player.x,
        y: player.y,
        vx: vx * BULLET.speed,
        vy: vy * BULLET.speed,
        created: Date.now()
    };

    return roomBullet;
}

function bulletHitsPlayer(bullet, player) {

    if (!player.alive) {
        return false;
    }

    if (bullet.owner === player.id) {
        return false;
    }

    const halfW = player.width / 2;
    const halfH = player.height / 2;

    return (
        bullet.x >= player.x - halfW &&
        bullet.x <= player.x + halfW &&
        bullet.y >= player.y - halfH &&
        bullet.y <= player.y + halfH
    );
}

function updateRoom(room, dt) {

    if (room.state !== "playing") {
        return;
    }

    const delta = dt / 1000;
    const now = Date.now();

    const players = Array.from(room.players.values());

    players.forEach((player, index) => {

        if (!player.alive) {

            if (now >= player.respawnAt) {
                resetPlayer(player, index);
            }

            return;
        }

        let direction = 0;

        if (player.input.left) {
            direction -= 1;
        }

        if (player.input.right) {
            direction += 1;
        }

        player.vx = direction * PLAYER.speed;

        player.x += player.vx * delta;

        if (player.x < 30) {
            player.x = 30;
        }

        if (player.x > WORLD.width - 30) {
            player.x = WORLD.width - 30;
        }

        if (direction !== 0) {
            player.facing = direction;
        }

        player.vy += PLAYER.gravity * delta;

        player.y += player.vy * delta;

        const floorY =
            WORLD.groundY - PLAYER.height / 2;

        if (player.y >= floorY) {

            player.y = floorY;

            player.vy = 0;
        }

        if (
            player.input.jump &&
            player.y >= floorY - 2
        ) {
            player.vy = -PLAYER.jump;
        }

        if (player.input.shoot) {

            const lastShot =
                room.lastShot[player.id] || 0;

            if (now - lastShot >= 180) {

                const bullet = createBullet(player);

                if (bullet) {
                    room.bullets.push(bullet);
                    room.lastShot[player.id] = now;
                }
            }
        }
    });

    room.bullets = room.bullets.filter((bullet) => {

        bullet.x += bullet.vx * delta;
        bullet.y += bullet.vy * delta;

        const age = now - bullet.created;

        if (age > BULLET.lifetime) {
            return false;
        }

        if (
            bullet.x < 0 ||
            bullet.x > WORLD.width ||
            bullet.y < 0 ||
            bullet.y > WORLD.height
        ) {
            return false;
        }

        if (bullet.y >= WORLD.groundY) {
            return false;
        }

        for (const player of players) {

            if (bulletHitsPlayer(bullet, player)) {

                player.health -= BULLET.damage;

                if (player.health <= 0) {

                    player.health = 0;
                    player.alive = false;
                    player.respawnAt =
                        now + PLAYER.respawnTime;

                    const attacker =
                        room.players.get(bullet.owner);

                    if (attacker) {
                        attacker.score += 1;
                    }
                }

                return false;
            }
        }

        return true;
    });

    io.to(room.code).emit("gameState", {
        players: players.map(publicPlayer),
        bullets: room.bullets.map((bullet) => ({
            id: bullet.id,
            x: bullet.x,
            y: bullet.y
        }))
    });
}

io.on("connection", (socket) => {

    console.log("Player connected:", socket.id);

    socket.on("createRoom", (callback) => {

        const code = randomRoomCode();

        const room = {
            code,
            host: socket.id,
            state: "lobby",
            players: new Map(),
            bullets: [],
            lastShot: {}
        };

        const player =
            createPlayer(socket.id, 0);

        room.players.set(socket.id, player);

        rooms.set(code, room);

        socket.join(code);

        socket.data.roomCode = code;

        callback({
            success: true,
            code
        });

        broadcastRoom(room);
    });

    socket.on("joinRoom", (rawCode, callback) => {

        const code =
            String(rawCode || "")
                .trim()
                .toUpperCase();

        const room = rooms.get(code);

        if (!room) {

            callback({
                success: false,
                message: "Room not found."
            });

            return;
        }

        if (room.state !== "lobby") {

            callback({
                success: false,
                message: "Game already started."
            });

            return;
        }

        if (room.players.size >= MAX_PLAYERS) {

            callback({
                success: false,
                message: "Room is full."
            });

            return;
        }

        const player =
            createPlayer(
                socket.id,
                room.players.size
            );

        room.players.set(
            socket.id,
            player
        );

        socket.join(code);

        socket.data.roomCode = code;

        callback({
            success: true,
            code
        });

        broadcastRoom(room);
    });

    socket.on("startGame", () => {

        const code = socket.data.roomCode;

        const room = rooms.get(code);

        if (!room) {
            return;
        }

        if (room.host !== socket.id) {
            return;
        }

        startMatch(room);
    });

    socket.on("input", (data) => {

        const code = socket.data.roomCode;

        const room = rooms.get(code);

        if (!room) {
            return;
        }

        const player =
            room.players.get(socket.id);

        if (!player) {
            return;
        }

        player.input.left =
            Boolean(data.left);

        player.input.right =
            Boolean(data.right);

        player.input.jump =
            Boolean(data.jump);

        player.input.shoot =
            Boolean(data.shoot);

        if (
            typeof data.aimX === "number" &&
            typeof data.aimY === "number"
        ) {
            player.aimX = data.aimX;
            player.aimY = data.aimY;
        }
    });

    socket.on("disconnect", () => {

        console.log(
            "Player disconnected:",
            socket.id
        );

        const code = socket.data.roomCode;

        if (!code) {
            return;
        }

        const room = rooms.get(code);

        if (!room) {
            return;
        }

        room.players.delete(socket.id);

        delete room.lastShot[socket.id];

        if (room.players.size === 0) {

            rooms.delete(code);

            return;
        }

        if (room.host === socket.id) {

            const nextHost =
                room.players.keys().next().value;

            room.host = nextHost;
        }

        broadcastRoom(room);
    });
});

setInterval(() => {

    const dt = 1000 / 30;

    for (const room of rooms.values()) {
        updateRoom(room, dt);
    }

}, 1000 / 30);

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        game: "DOODLE STRIKER"
    });
});

server.listen(PORT, "0.0.0.0", () => {

    console.log(
        `DOODLE STRIKER server running on port ${PORT}`
    );

});