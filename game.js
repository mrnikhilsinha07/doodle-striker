const config = {
    type: Phaser.AUTO,

    width: 1000,
    height: 600,

    backgroundColor: "#1b1b1b",

    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 800 },
            debug: false
        }
    },

    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let player;
let cursors;

function preload() {
}

function create() {

    // Ground
    const ground = this.add.rectangle(
        500,
        570,
        1000,
        60,
        0x333333
    );

    this.physics.add.existing(ground, true);

    // Player
    player = this.add.rectangle(
        300,
        450,
        40,
        60,
        0x00aaff
    );

    this.physics.add.existing(player);

    player.body.setCollideWorldBounds(true);

    // Collision with ground
    this.physics.add.collider(player, ground);

    // Keyboard
    cursors = this.input.keyboard.createCursorKeys();

    // Instructions
    this.add.text(
        20,
        20,
        "MINI MILITIA WEB  |  Arrow Keys = Move / Jump",
        {
            fontSize: "20px",
            color: "#ffffff"
        }
    );
}

function update() {

    if (!player || !player.body) {
        return;
    }

    // Left
    if (cursors.left.isDown) {
        player.body.setVelocityX(-250);
    }

    // Right
    else if (cursors.right.isDown) {
        player.body.setVelocityX(250);
    }

    // Stop
    else {
        player.body.setVelocityX(0);
    }

    // Jump
    if (
        cursors.up.isDown &&
        player.body.blocked.down
    ) {
        player.body.setVelocityY(-500);
    }
}