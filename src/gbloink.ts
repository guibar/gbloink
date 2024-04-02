// Generate a random colour
let ballSoundControlBarWidth = 170;

document.addEventListener("DOMContentLoaded", function() {
    const game = new Game("canvasId");

    // You can add any other initialization code here
    // For example, setting up the TinySynth library

    let intervalId = setInterval(() => game.next(), 50);

    document.getElementById('startButton').addEventListener('click', function () {
        // Implement your start game logic here
        clearInterval(intervalId);
        intervalId = setInterval(() => game.next(), 50);
    });

    document.getElementById('stopButton').addEventListener('click', function () {
        // Implement your stop game logic here
        clearInterval(intervalId);
    });
});

function randomColour(): string {
    const letters = '0123456789ABCDEF'.split('');
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Calculate the Euclidean distance between two points
function dist(x1: number, y1: number, x2: number, y2: number): number {
    const dx2 = (x1 - x2) ** 2;
    const dy2 = (y1 - y2) ** 2;
    return Math.sqrt(dx2 + dy2);
}

// Class representing a musical scale
class Scale {
    notes: boolean[];

    constructor(notes: number[]) {
        this.notes = notes.map((note) => Boolean(note));
    };

    // We might as well get a random note in the scale? Or have a probability distribution
    // that favors something close to the previous note.
    // In the MIDI system C3 = 48, C4 = 60, C5 = 72 with each increment adding a semitone
    findNextNoteInScale(note: number): number {
        const noteWithoutOctave = note % 12;
        // find the number of semitones to the next note in the scale
        let nbSemiTonesToAdd = 0;
        // find the first 
        while (!this.notes[noteWithoutOctave + nbSemiTonesToAdd]) {
            nbSemiTonesToAdd += 1;
        }
        return note + nbSemiTonesToAdd;
    }
}

// Class for transforming y-coordinates into MIDI notes
class ScaleKeeper {
    currentScalekey: string
    scales: { [key: string]: Scale };

    constructor() {
        this.scales = {
            chromatic: new Scale([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
            major: new Scale([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1]),
            minor: new Scale([1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1]),
            diminished: new Scale([1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1]),
            arab: new Scale([1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1]),
            debussy: new Scale([1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]),
            gypsy: new Scale([1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1]),
            pent1: new Scale([1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0]),
            pent2: new Scale([1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1])
        };

        this.currentScalekey = 'chromatic';
    }

    setCurrent(currentScalekey: string) {
        this.currentScalekey = currentScalekey;
    }

    mapYtoNote(y: number) {
        // transform y coordinate in [0, 400] range to note in [96, 30] range. 
        // 400 is at the bottom so it maps to 30.
        const note = Math.floor(((400 - y) / 6) + 30);
        return this.scales[this.currentScalekey].findNextNoteInScale(note);
    }
}

const scaleKeeper = new ScaleKeeper();


// Wrapper around the HTML5 canvas API
class Html5Canvas {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    canvasTag: string;
    width: number;
    height: number;

    constructor(canvasId: string, width: number, height: number) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvas) {
            throw new Error(`No canvas element found with id ${canvasId}`);
        }
        this.canvas = canvas;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Unable to get 2D context from canvas');
        }
        this.ctx = ctx;

        this.canvasTag = canvasId;
        this.width = width;
        this.height = height;
    }

    background(col: string) {
        this.ctx.fillStyle = col;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    fillStyle(col: string) {
        this.ctx.fillStyle = col;
    }

    line(x1: number, y1: number, x2: number, y2: number) {
        if (this.ctx) {
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
        }
    }

    circle(cx: number, cy: number, r: number) {
        this.ctx.beginPath();
        const x = this.ctx.lineWidth;
        this.ctx.lineWidth = 5;
        this.ctx.arc(cx, cy, r, 0, 2 * Math.PI, false);
        this.ctx.stroke();
        this.ctx.lineWidth = x;
    }

    rect(x: number, y: number, w: number, h: number) {
        this.ctx.beginPath();
        const tmp = this.ctx.lineWidth;
        this.ctx.lineWidth = 3;
        this.ctx.rect(x, y, w, h);
        this.ctx.stroke();
        this.ctx.lineWidth = tmp;
    }
}

declare const WebAudioTinySynth: any;

// Class representing a control bar
function addListenerToCanvas(id: string, mouseUpListener: (event: MouseEvent) => void) {
    const canvas = document.getElementById(id);
    if (!canvas) {
        throw new Error(`No canvas element found with id ${id}`);
    }
    canvas.addEventListener('mouseup', mouseUpListener);
}

class Synth {
    synth: any;
    lastNote: number;
    volume: number;
    delay: number;

    constructor(p1: number, p2: number, id: string) {
        this.synth = new WebAudioTinySynth();
        this.lastNote = null;
        this.synth.setProgram(p1, p2);
        this.volume = 50;
        this.delay = 0.5; // default delay
        addListenerToCanvas(id +'_volume', this.handleVolumeChangeEvent.bind(this));
        addListenerToCanvas(id + '_delay', this.handleDelayChangeEvent.bind(this));
        addListenerToCanvas(id + '_instrument', this.handleInstrumentChangeEvent.bind(this));
    }

    play(note: number) {
        if (this.lastNote !== null) {
            this.synth.noteOff(0, note, 0);
        }
        this.lastNote = note;
        this.synth.noteOn(0, note, this.volume, 0);        
        this.synth.noteOff(0, note, this.delay);
    }
    
    handleInstrumentChangeEvent(event: MouseEvent) {
        const [x, y] = eventToXY(event);
        const program = Math.floor((x / 170) * 127);
        this.synth.setProgram(0, program);
    };

    handleVolumeChangeEvent(event: MouseEvent) {
        const [x, y] = eventToXY(event);
        this.volume = Math.floor((x / 170) * 127);
    };

    handleDelayChangeEvent(event: MouseEvent) {
        const [x, y] = eventToXY(event);
        this.delay = 0.05 + (x / 170) * 0.95;
    };

}


let COUNTER = 0;

// Class representing a ball on the canvas
class Ball {
    id: number;
    name: string;
    x: number;
    y: number;
    colour: string;
    synth: Synth;
    dx: number;
    dy: number;
    rad: number;
    width: number;
    height: number;

    constructor(x: number, y: number, colour: string, name: string, width: number, height: number, midi1: number, midi2: number) {
        this.x = x;
        this.y = y;
        this.colour = colour;
        this.synth = new Synth(midi1, midi2, name);
        this.id = COUNTER;
        this.dx = 2;
        this.dy = 2;
        this.rad = 5;
        this.width = width;
        this.height = height;
        COUNTER += 1;
        addListenerToCanvas(name + '_speed', this.handleSpeedChangeEvent.bind(this));
    }

    move(otherBalls: Ball[], blocks: Block[]) {
        let tx = this.x + this.dx;
        let ty = this.y + this.dy;
        let flag = false;

        if (tx < 3 || tx > this.width - 3) {
            this.dx = -this.dx;
            this.playNote();
            flag = true;
        }

        if (ty < 3 || ty > this.height - 3) {
            this.dy = -this.dy;
            this.playNote();
            flag = true;
        }

        if (flag) {
            return;
        }

        // balls collide other balls
        for (const another of otherBalls) {
            if (another.id === this.id) {
                continue;
            }
            if (another.hit(tx, this.y, this.rad)) {
                if (another.x < this.x) {
                    this.dx = Math.abs(this.dx);
                } else {
                    this.dx = -Math.abs(this.dx);
                }
                this.playNote();
                flag = true;
                continue;
            }

            if (another.hit(this.x, ty, this.rad)) {
                if (another.y < this.y) {
                    this.dy = Math.abs(this.dy);
                } else {
                    this.dy = -Math.abs(this.dy);
                }
                this.playNote();
                flag = true;
            }
        }

        // balls collide with blocks
        for (const b of blocks) {
            if (b.contains(tx + this.dx, ty)) {
                this.dx = -this.dx;
                this.playNote();
            }

            if (b.contains(tx, ty + this.dy)) {
                this.dy = -this.dy;
                this.playNote();
            }
        }

        this.x = tx;
        this.y = ty;
    }

    playNote() {
        this.synth.play(scaleKeeper.mapYtoNote(this.y));
    }

    handleSpeedChangeEvent(event: MouseEvent) {
        const [x, y] = eventToXY(event);
        const speed = 1 + Math.floor((x / 170) * 5);
        this.dx = speed * (this.dx / Math.abs(this.dx));
        this.dy = speed * (this.dy / Math.abs(this.dy));
    };

    // const redSpeed = new ControlBar('redball_speed', this.balls[0].handleSpeedChangeEvent.bind(this.balls[0]));
    // const greenSpeed = new ControlBar('greenball_speed', this.balls[1].handleSpeedChangeEvent.bind(this.balls[1]));
    // const blueSpeed = new ControlBar('blueball_speed', this.balls[2].handleSpeedChangeEvent.bind(this.balls[2]));

    draw(canvas: Html5Canvas): void {
        canvas.ctx.beginPath();
        canvas.ctx.arc(this.x, this.y, this.rad, 0, 2 * Math.PI);
        canvas.ctx.fillStyle = this.colour;
        canvas.ctx.fill();
        canvas.ctx.stroke();
    }

    hit(x: number, y: number, rad: number): boolean {
        return dist(x, y, this.x, this.y) < this.rad + rad;
    }
}

// Class representing a block on the canvas
class Block {
    width: number;
    height: number;
    xLeft: number;
    xRight: number;
    yBottom: number;
    yTop: number;
    colour: string;

    constructor(xCentre: number, yCentre: number) {
        // width and height are random in range [5, 55]
        this.width = 5 + Math.random() * 50;
        this.height = 5 + Math.random() * 50;
        this.xLeft = xCentre - this.width / 2;
        this.yTop = yCentre - this.height / 2;
        this.xRight = xCentre + this.width / 2;
        this.yBottom = yCentre + this.height / 2;
        this.colour = randomColour();
    }

    contains(x: number, y: number) {
        if (x < this.xLeft || x > this.xRight || y < this.yTop || y > this.yBottom) {
            return false;
        }
        return true;
    }

    // do I need to pass the canvas everytime or should I keep it as a member variable even a static one?
    draw(canvas: Html5Canvas) { 
        canvas.ctx.beginPath();
        canvas.ctx.rect(this.xLeft, this.yTop, this.width, this.height);
        canvas.ctx.fillStyle = this.colour;
        canvas.ctx.fill();
        canvas.ctx.lineWidth = 1;
        canvas.ctx.strokeStyle = 'white';
        canvas.ctx.stroke();
    }
}

class BlockKeeper {
    static blocks: Block[] = [];

    static createBlock(x: number, y: number) {
        let b: Block = new Block(x, y);
        BlockKeeper.blocks.push(b);
        return b;
    }
    
    static removeOrCreateAt(x: number, y: number): void {
        for(let i=0;i<this.blocks.length;i++) {
            if (this.blocks[i].contains(x, y)) {
                this.blocks.splice(i, 1);
                return;
            }
        }
        this.blocks.push(new Block(x, y));
    }
    
    static drawBlocks(canvas: Html5Canvas): void {
        this.blocks.forEach(block => block.draw(canvas));
    }

    // why 30 bocks spaced every 30?
    static initialize(): void {           
        for (let i = 0; i <= 30; i++) {
            // create random blocks at the bottom every 30 pixels
            this.removeOrCreateAt(i * 30, Math.floor(50 + Math.random() * 50));
            // create random blocks at the top every 30 pixels
            this.removeOrCreateAt(i * 30, Math.floor(300 + Math.random() * 50));
        }
    }
}


function eventToXY(event: MouseEvent): [number, number] {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const root = document.documentElement;
    const x = event.pageX - rect.left - root.scrollLeft;
    const y = event.pageY - rect.top - root.scrollTop;
    return [x, y];
};

// Class representing the game
class Game {
    canvas: Html5Canvas;
    balls: Ball[];
    canvasId: any;
    constructor(canvasId: string) {
        this.canvas = new Html5Canvas(canvasId, 800, 400);
        this.balls = [
            new Ball(200, 200, '#ff0000', 'redball', 800, 400, 0, 0),
            new Ball(300, 200, '#00ff00', 'greenball', 800, 400, 0, 24),
            new Ball(400, 200, '#0000ff', 'blueball', 800, 400, 0, 44),
        ];
        this.canvasId = canvasId;
        scaleKeeper.setCurrent("major");

        BlockKeeper.initialize();        
        this.canvas.canvas.addEventListener('mouseup', (event: MouseEvent) => {
            const rect = this.canvas.canvas.getBoundingClientRect();
            const root = document.documentElement;
            const x = event.pageX - rect.left - root.scrollLeft;
            const y = event.pageY - rect.top - root.scrollTop;
            BlockKeeper.removeOrCreateAt(x, y);
        });
    }

    next() {
        this.canvas.background('black');
        this.balls.forEach(ball => ball.move(this.balls, BlockKeeper.blocks));
        BlockKeeper.drawBlocks(this.canvas);
        this.balls.forEach(ball => ball.draw(this.canvas));
    }
}


