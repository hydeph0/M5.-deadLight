/** --- Configuration --- **/
const SCREEN_WIDTH = 800;  // Standard visible size
const SCREEN_HEIGHT = 600; // Standard visible size
const TILE_SIZE = 30;
const POWER_TIME = 6 * 60; 
const GHOST_RESPAWN_TIME = 7 * 60; 

const GHOST_INFO = {
    "Blinky": { color: "rgb(255, 0, 0)", speed: 2.4, offset: [0, 0] },
    "Pinky": { color: "rgb(255, 182, 193)", speed: 2.2, offset: [120, 0] },
    "Inky": { color: "rgb(0, 255, 255)", speed: 2.0, offset: [-120, 0] },
    "Clyde": { color: "rgb(255, 165, 0)", speed: 1.8, offset: [0, 120] }
};

const LEVELS = [
    [
        "1111111111111111111", 
        "1B000000010000000B1", 
        "1011011101011101101",
        "1000000000000000001", 
        "1011010111110101101", 
        "00000101   X   1010000", 
        "11110101 1 1 10101111", 
        "11110101 1G1 10101111", 
        "100000000P000000001", 
        "1111111111111111111"
    ],
    [
        "1111111111111111111", 
        "1B010000010000010B1", 
        "1011101111111011101",
        "1000000011000000001", 
        "1110111101101111011", 
        " 0000000   X   000000 ",
        "11101111 1 1 1111011", 
        "10000111 1G1 1100001", 
        "1B1100000P0000011B1", 
        "1111111111111111111"
    ],
    [
        "1111111111111111111", 
        "100010001B100010001", 
        "1010101010101010101",
        "1010001000001000101", 
        "1011100000000011101", 
        " 000B000   X   000B000 ",
        "1101101111111011011", 
        "10000011 1G1 1100001", 
        "101110000P0000011101", 
        "1111111111111111111"
    ]
];

class Rect {
    constructor(x, y, w, h) { this.x = x; this.y = y; this.w = w; this.h = h; }
    get center() { return [this.x + this.w / 2, this.y + this.h / 2]; }
    colliderect(other) {
        return this.x < other.x + other.w && this.x + this.w > other.x &&
               this.y < other.y + other.h && this.y + this.h > other.y;
    }
    move(dx, dy) { return new Rect(this.x + dx, this.y + dy, this.w, this.h); }
}

class Ghost {
    constructor(name, x, y, image, blue_image, speed, offset) {
        this.name = name; this.start_pos = [x + 2, y + 2];
        this.rect = new Rect(this.start_pos[0], this.start_pos[1], 26, 26);
        this.image = image; this.blue_image = blue_image;
        this.speed = speed; this.offset = offset;
        this.direction = [1, 0]; this.alive = true; this.in_house = true;
        this.respawn_timer = 0; this.pos_x = x + 2; this.pos_y = y + 2;
    }
    can_move(direction, walls) {
        let test_rect = new Rect(this.pos_x + direction[0] * this.speed, this.pos_y + direction[1] * this.speed, 26, 26);
        return !walls.some(w => test_rect.colliderect(w));
    }
    move(walls, player_rect, is_power_mode, exit_pos) {
        if (!this.alive) {
            if (++this.respawn_timer >= GHOST_RESPAWN_TIME) {
                this.alive = true; this.in_house = true; [this.pos_x, this.pos_y] = this.start_pos;
                this.respawn_timer = 0;
            } return;
        }
        if (this.in_house) {
            if (this.pos_y > exit_pos[1]) this.pos_y -= this.speed;
            else if (Math.abs(this.pos_x - exit_pos[0]) > 2) this.pos_x += (this.pos_x < exit_pos[0]) ? this.speed : -this.speed;
            else this.in_house = false;
            this.rect.x = this.pos_x; this.rect.y = this.pos_y; return;
        }
        if (Math.floor(this.pos_x - 2) % TILE_SIZE === 0 && Math.floor(this.pos_y - 102) % TILE_SIZE === 0) {
            let [tx, ty] = player_rect.center;
            let target = is_power_mode ? [0, 0] : [tx + this.offset[0], ty + this.offset[1]];
            let valid_dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => (d[0] !== -this.direction[0] || d[1] !== -this.direction[1]) && this.can_move(d, walls));
            if (valid_dirs.length) this.direction = valid_dirs.reduce((p, c) => Math.hypot((this.pos_x + p[0]) - target[0], (this.pos_y + p[1]) - target[1]) < Math.hypot((this.pos_x + c[0]) - target[0], (this.pos_y + c[1]) - target[1]) ? p : c);
        }
        if (!this.can_move(this.direction, walls)) {
            for (let d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.can_move(d, walls)) { this.direction = d; break; }
        }
        this.pos_x += this.direction[0] * this.speed; this.pos_y += this.direction[1] * this.speed;
        
        if (this.pos_x < -20) this.pos_x = SCREEN_WIDTH + 20;
        if (this.pos_x > SCREEN_WIDTH + 20) this.pos_x = -20;

        this.rect.x = Math.floor(this.pos_x); this.rect.y = Math.floor(this.pos_y);
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.canvas.width = SCREEN_WIDTH;
        this.canvas.height = SCREEN_HEIGHT;
        this.ctx = this.canvas.getContext('2d');
        this.current_level = 1; this.score = 0; this.lives = 4;
        this.state = "INIT"; this.muted = false; this.paused = false;
        this.keys = {};
        this.frame_count = 0;
        
        this.titleVideo = document.getElementById('titleVideo');
        this.winVideo = document.getElementById('winVideo');

        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);
        this.canvas.addEventListener('mousedown', e => this.handle_mouse(e));

        document.getElementById('overlay').addEventListener('click', () => {
            document.getElementById('overlay').style.display = 'none';
            this.state = "TITLE";
            this.toggle_audio_state(); 
            this.titleVideo.play().catch(e => console.log("Play blocked", e));
        });

        this.load_assets();
    }

    load_assets() {
        const assets = { player: 'deadmau5.png', pellet: 'lights.png', blue_ghost: 'blue ghost.png', game_over: 'pac_game_over.png', blinky: 'blinky.png', pinky: 'pinky.png', inky: 'inky.png', clyde: 'clyde.png' };
        this.images = {}; let loaded = 0;
        for (let k in assets) {
            this.images[k] = new Image(); this.images[k].src = assets[k];
            this.images[k].onload = () => { if (++loaded === Object.keys(assets).length) this.main_loop(); };
        }
        this.bg_music = new Audio();
        this.warning_sound = new Audio('dinowarning.wav');
        this.game_over_sound = new Audio('sonic game over theme.wav');
        this.clear_sound = new Audio('pac-man-theme-song.mp3'); 
        this.warning_played = false;

        this.warning_sound.onended = () => {
            if (!this.muted && this.state === "PLAYING" && !this.paused) this.bg_music.play();
        };

        this.clear_sound.onended = () => {
            this.trigger_next_level();
        };
    }

    trigger_next_level() {
        if (this.current_level >= 3) { 
            this.state = "WIN_VIDEO"; 
            if (!this.muted) this.winVideo.play(); 
        } else {
            this.current_level++;
            this.score = 0; 
            this.init_level();
            this.state = "PLAYING";
        }
    }

    toggle_audio_state() {
        this.titleVideo.muted = this.muted;
        this.winVideo.muted = this.muted;
        this.warning_sound.muted = this.muted;
        this.game_over_sound.muted = this.muted;
        this.clear_sound.muted = this.muted;
        if (this.muted) {
            this.bg_music.pause();
            this.warning_sound.pause();
            this.game_over_sound.pause();
            this.clear_sound.pause();
        } else {
            if (this.state === "PLAYING" && !this.paused) {
                if (this.warning_sound.paused || this.warning_sound.ended) this.bg_music.play();
            } else if (this.state === "GAME_OVER") {
                this.game_over_sound.play();
            } else if (this.state === "TITLE") {
                this.titleVideo.play();
            } else if (this.state === "LEVEL_CLEAR") {
                this.clear_sound.play();
            } else if (this.state === "WIN_VIDEO") {
                this.winVideo.play();
            }
        }
    }

    handle_mouse(e) {
        let r = this.canvas.getBoundingClientRect();
        let mx = (e.clientX - r.left) * (SCREEN_WIDTH / r.width); 
        let my = (e.clientY - r.top) * (SCREEN_HEIGHT / r.height);

        // Mute button logic - Updated to BOTTOM LEFT
        if (mx > 10 && mx < 110 && my > (SCREEN_HEIGHT - 50) && my < (SCREEN_HEIGHT - 10)) {
            this.muted = !this.muted;
            this.toggle_audio_state();
            return;
        }

        if (this.state === "TITLE") {
            if (mx > (SCREEN_WIDTH/2 - 100) && mx < (SCREEN_WIDTH/2 + 100) && my > 450 && my < 510) {
                this.score = 0; this.lives = 4; this.current_level = 1;
                this.titleVideo.pause(); this.init_level(); this.state = "PLAYING";
            }
        } else if (this.state === "PLAYING") {
            if (mx > (SCREEN_WIDTH - 120) && mx < (SCREEN_WIDTH - 10) && my > 10 && my < 40) {
                this.paused = !this.paused;
                if (this.paused) { 
                    this.pause_surface = this.apply_grayscale(this.canvas); 
                    this.bg_music.pause(); 
                    this.warning_sound.pause(); 
                }
                else this.toggle_audio_state();
            }
            if (this.paused && mx > (SCREEN_WIDTH/2 - 100) && mx < (SCREEN_WIDTH/2 + 100) && my > 350 && my < 410) {
                this.return_to_title();
            }
        } else if (this.state === "GAME_OVER") {
            if (mx > (SCREEN_WIDTH/2 - 100) && mx < (SCREEN_WIDTH/2 + 100) && my > 550 && my < 610) {
                this.game_over_sound.pause();
                this.game_over_sound.currentTime = 0;
                this.return_to_title();
            }
        } else if (this.state === "WIN_VIDEO") {
            if (mx > (SCREEN_WIDTH/2 - 100) && mx < (SCREEN_WIDTH/2 + 100) && my > 500 && my < 560) {
                this.winVideo.pause();
                this.return_to_title();
            }
        }
    }

    return_to_title() {
        this.paused = false;
        this.state = "TITLE";
        this.bg_music.pause();
        this.clear_sound.pause();
        this.titleVideo.currentTime = 0;
        this.titleVideo.play();
    }

    apply_grayscale(snapshot) {
        const temp = document.createElement('canvas');
        temp.width = SCREEN_WIDTH; temp.height = SCREEN_HEIGHT;
        const tCtx = temp.getContext('2d');
        tCtx.drawImage(snapshot, 0, 0);
        const imgData = tCtx.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            const avg = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) * 0.5;
            d[i] = d[i+1] = d[i+2] = avg;
        }
        tCtx.putImageData(imgData, 0, 0);
        return temp;
    }

    init_level() {
        const idx = this.current_level - 1;
        this.walls = [];
        this.layout = LEVELS[Math.min(idx, LEVELS.length - 1)];
        this.pellets = [];
        this.big_pellets = [];

        this.layout.forEach((row, r) => {
            row.split('').forEach((char, c) => {
                let rect = new Rect(c * TILE_SIZE, r * TILE_SIZE + 100, TILE_SIZE, TILE_SIZE);
                if (char === "1") this.walls.push(rect);
                else if (char === "0") this.pellets.push(new Rect(rect.center[0] - 7, rect.center[1] - 7, 15, 15));
                else if (char === "B") this.big_pellets.push(new Rect(rect.center[0] - 10, rect.center[1] - 10, 20, 20));
                else if (char === "X") this.exit_pos = [rect.x, rect.y];
            });
        });
        
        this.reset_positions();
        const tracks = {1: "tt32.lh - tac O.wav", 2: "jj11.i - LEVELING.wav", 3: "deadmau5 & Lights - When The Summer Dies (meowingtons remix).mp3"};
        this.bg_music.src = tracks[this.current_level] || tracks[3];
        this.bg_music.loop = true;
        this.warning_played = false;
        if (!this.muted) this.bg_music.play();
    }

    reset_positions() {
        this.ghosts = []; this.power_mode = false; this.power_timer = 0;
        this.layout.forEach((row, r) => {
            row.split('').forEach((char, c) => {
                let rect = new Rect(c * TILE_SIZE, r * TILE_SIZE + 100, TILE_SIZE, TILE_SIZE);
                if (char === "P") {
                    this.p_rect = new Rect(rect.x + 9, rect.y + 9, 12, 12);
                    this.pos_x = this.p_rect.x; this.pos_y = this.p_rect.y;
                } else if (char === "G") {
                    Object.keys(GHOST_INFO).forEach(n => this.ghosts.push(new Ghost(n, rect.x, rect.y, this.images[n.toLowerCase()], this.images.blue_ghost, GHOST_INFO[n].speed, GHOST_INFO[n].offset)));
                }
            });
        });
    }

    update() {
        if (this.state !== "PLAYING" || this.paused) return;
        this.frame_count++;

        if (this.lives === 1 && !this.warning_played) {
            this.warning_played = true;
            this.bg_music.pause();
            if (!this.muted) this.warning_sound.play(); 
        }

        if (this.power_mode) {
            if (--this.power_timer <= 0) this.power_mode = false;
        }

        let dx = 0, dy = 0;
        if (this.keys["ArrowLeft"]) dx = -3.3;
        if (this.keys["ArrowRight"]) dx = 3.3;
        if (this.keys["ArrowUp"]) dy = -3.3;
        if (this.keys["ArrowDown"]) dy = 3.3;

        if (dx !== 0 || dy !== 0) {
            let next_rect = this.p_rect.move(dx, dy);
            if (!this.walls.some(w => next_rect.colliderect(w))) {
                this.pos_x += dx; this.pos_y += dy;
                if (this.pos_x < -15) this.pos_x = SCREEN_WIDTH + 15;
                if (this.pos_x > SCREEN_WIDTH + 15) this.pos_x = -15;
                this.p_rect.x = this.pos_x; this.p_rect.y = this.pos_y;
            }
        }

        for (let i = this.pellets.length - 1; i >= 0; i--) {
            if (this.p_rect.colliderect(this.pellets[i])) { 
                this.pellets.splice(i, 1); 
                this.score += 10; 
            }
        }
        for (let i = this.big_pellets.length - 1; i >= 0; i--) {
            if (this.p_rect.colliderect(this.big_pellets[i])) {
                this.big_pellets.splice(i, 1); this.score += 50;
                this.power_mode = true; this.power_timer = POWER_TIME;
            }
        }

        if (this.score >= 909) {
            this.state = "LEVEL_CLEAR";
            this.bg_music.pause();
            this.clear_sound.currentTime = 0;
            if (!this.muted) this.clear_sound.play();
            return; 
        }

        this.ghosts.forEach(g => {
            if (g.alive && this.p_rect.colliderect(g.rect)) {
                if (this.power_mode) { 
                    g.alive = false; 
                    g.respawn_timer = 0; 
                    this.score += 69; 
                }
                else { 
                    this.lives--; 
                    if (this.lives <= 0) { 
                        this.state = "GAME_OVER"; 
                        this.bg_music.pause();
                        if(!this.muted) this.game_over_sound.play(); 
                    } else {
                        this.reset_positions(); 
                    }
                }
            }
            g.move(this.walls, this.p_rect, this.power_mode, this.exit_pos);
        });
    }

    main_loop() {
        this.update();
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        if (this.state === "TITLE") {
            this.ctx.drawImage(this.titleVideo, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
            this.ctx.fillStyle = "white"; this.ctx.font = "50px Arial Black"; this.ctx.textAlign = "center";
            this.ctx.fillText("M5. deadLight", SCREEN_WIDTH/2, 200);
            this.ctx.fillStyle = "#222"; this.ctx.fillRect(SCREEN_WIDTH/2 - 100, 450, 200, 60);
            this.ctx.fillStyle = "white"; this.ctx.font = "24px Arial"; this.ctx.fillText("START GAME", SCREEN_WIDTH/2, 488);
        } else if (this.state === "PLAYING" || this.state === "LEVEL_CLEAR") {
            this.ctx.fillStyle = "#111"; this.ctx.fillRect(0, 0, SCREEN_WIDTH, 100);
            this.ctx.textAlign = "left"; this.ctx.fillStyle = "white"; this.ctx.font = "24px 'Courier New'";
            this.ctx.fillText(`SCORE: ${this.score}`, 20, 40);
            this.ctx.fillText("LIVES: ", 20, 75);
            this.ctx.fillStyle = (this.lives === 1) ? "red" : "white";
            this.ctx.fillText(`${this.lives}`, 110, 75);

            if (this.paused) {
                this.ctx.drawImage(this.pause_surface, 0, 0);
                this.ctx.fillStyle = "rgba(0,0,0,0.5)";
                this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
                this.ctx.fillStyle = "#8b0000";
                this.ctx.fillRect(SCREEN_WIDTH/2 - 100, 350, 200, 60);
                this.ctx.fillStyle = "white";
                this.ctx.textAlign = "center";
                this.ctx.font = "24px Arial";
                this.ctx.fillText("QUIT TO TITLE", SCREEN_WIDTH/2, 388);
            }
            
            let wall_color = this.current_level === 2 ? "#20afbc" : (this.current_level === 3 ? "#e62daf" : "blue");
            this.ctx.strokeStyle = wall_color;
            this.walls.forEach(w => this.ctx.strokeRect(w.x, w.y, w.w, w.h));
            this.pellets.forEach(p => this.ctx.drawImage(this.images.pellet, p.x, p.y, 15, 15));
            
            if (Math.floor(this.frame_count / 15) % 2 === 0) {
                this.ctx.fillStyle = "#ff701a";
                this.big_pellets.forEach(p => {
                    this.ctx.beginPath(); this.ctx.arc(p.center[0], p.center[1], 10, 0, Math.PI * 2); this.ctx.fill();
                });
            }

            this.ctx.drawImage(this.images.player, this.p_rect.x - 7, this.p_rect.y - 7, 26, 26);
            this.ghosts.forEach(g => g.alive && this.ctx.drawImage(this.power_mode ? this.images.blue_ghost : g.image, g.rect.x, g.rect.y, 26, 26));

            if (this.state === "LEVEL_CLEAR") {
                this.ctx.fillStyle = "rgba(0,0,0,0.6)";
                this.ctx.fillRect(0, 300, SCREEN_WIDTH, 100);
                this.ctx.fillStyle = "yellow";
                this.ctx.textAlign = "center";
                this.ctx.font = "bold 40px 'Courier New'";
                this.ctx.fillText("LEVEL CLEARED.. sorta!", SCREEN_WIDTH/2, 360);
            }

            this.ctx.fillStyle = "darkred"; this.ctx.fillRect(SCREEN_WIDTH - 120, 10, 110, 30);
            this.ctx.fillStyle = "white"; this.ctx.textAlign = "center"; this.ctx.font = "20px Arial";
            this.ctx.fillText(this.paused ? "RESUME" : "PAUSE", SCREEN_WIDTH - 65, 32);

        } else if (this.state === "GAME_OVER") {
            this.ctx.drawImage(this.images.game_over, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
            this.ctx.fillStyle = "#222";
            this.ctx.fillRect(SCREEN_WIDTH/2 - 100, 550, 200, 60);
            this.ctx.fillStyle = "white";
            this.ctx.textAlign = "center";
            this.ctx.font = "20px Arial";
            this.ctx.fillText("Don't rage quit", SCREEN_WIDTH/2, 588);
        } else if (this.state === "WIN_VIDEO") {
            this.ctx.drawImage(this.winVideo, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
            this.ctx.fillStyle = "rgba(0, 150, 0, 0.8)";
            this.ctx.fillRect(SCREEN_WIDTH/2 - 100, 500, 200, 60);
            this.ctx.fillStyle = "white";
            this.ctx.textAlign = "center";
            this.ctx.font = "24px Arial";
            this.ctx.fillText("PLAY AGAIN?", SCREEN_WIDTH/2, 538);
        }

        // Global Mute Button - DRAWN AT BOTTOM LEFT
        this.ctx.fillStyle = "#444"; this.ctx.fillRect(10, SCREEN_HEIGHT - 50, 100, 40);
        this.ctx.fillStyle = "white"; this.ctx.font = "18px Arial"; this.ctx.textAlign = "center";
        this.ctx.fillText(this.muted ? "UNMUTE" : "MUTE", 60, SCREEN_HEIGHT - 25);

        requestAnimationFrame(() => this.main_loop());
    }
}

window.onload = () => new Game();