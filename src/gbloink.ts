
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
    currentScaleName: string
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

        this.currentScaleName = 'chromatic';
    }

    setCurrent(currentScaleName: string) {
        this.currentScaleName = currentScaleName;
    }

    adjustToCurrentScale(note: number): number {
        return this.scales[this.currentScaleName].findNextNoteInScale(note);
    }
}

const scaleKeeper = new ScaleKeeper();

declare const WebAudioTinySynth: any;

// Each ball has a synth associated with it. The synth is responsible for playing a sound
// when the ball hits something
class Synth {
    synth: any;
    lastNote: number;
    volume: number;
    delay: number;
    // width of the respective control elements
    volumeWidth: number;
    delayWidth: number;
    instrumentWidth: number;

    constructor(p1: number, p2: number, ballName: string) {
        this.synth = new WebAudioTinySynth();
        this.lastNote = null;
        this.synth.setProgram(p1, p2);
        this.volume = 50;
        this.delay = 0.5; // default delay

        let canvas: HTMLCanvasElement = document.getElementById(ballName + '_volume') as HTMLCanvasElement;
        canvas.addEventListener('mouseup', this.handleVolumeChangeEvent.bind(this));
        this.volumeWidth = canvas.width;

        canvas = document.getElementById(ballName + '_delay') as HTMLCanvasElement;
        canvas.addEventListener('mouseup', this.handleDelayChangeEvent.bind(this));
        this.delayWidth = canvas.width;

        canvas = document.getElementById(ballName + '_instrument') as HTMLCanvasElement;
        canvas.addEventListener('mouseup', this.handleInstrumentChangeEvent.bind(this));
        this.instrumentWidth = canvas.width;
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
        const program = Math.floor((x / this.instrumentWidth) * 127);
        this.synth.setProgram(0, program);
    };

    handleVolumeChangeEvent(event: MouseEvent) {
        const [x, y] = eventToXY(event);
        this.volume = Math.floor((x / this.volumeWidth) * 127);
    };

    handleDelayChangeEvent(event: MouseEvent) {
        const [x, y] = eventToXY(event);
        this.delay = 0.05 + (x / this.delayWidth) * 0.95;
    };
}

// Class to handle (x, y) coordinates
type Coords = {
    x: number;
    y: number;
}

// Class representing a ball on the canvas
class Ball {
    name: string;
    x: number;
    y: number;
    colour: string;
    synth: Synth;
    dx: number;
    dy: number;
    rad: number;
    speedWidth: number;

    constructor(c: Coords, colour: string, name: string, midi1: number, midi2: number) {
        this.name = name;
        this.x = c.x;
        this.y = c.y;
        this.colour = colour;
        this.synth = new Synth(midi1, midi2, name);
        this.dx = 2;
        this.dy = 2;
        this.rad = 5;

        let canvas: HTMLCanvasElement = document.getElementById(name + '_speed') as HTMLCanvasElement;
        canvas.addEventListener('mouseup', this.handleSpeedChangeEvent.bind(this));
        this.speedWidth = canvas.width;
    }

    move(otherBalls: Ball[], blocks: Block[]) : void {
        let tx = this.x + this.dx;
        let ty = this.y + this.dy;
        let flag = false;

        if (tx < 3 || tx > gbloink.canvas.width - 3) {
            this.dx = -this.dx;
            this.playNote(); 
            flag = true;
        }

        if (ty < 3 || ty > gbloink.canvas.height - 3) {
            this.dy = -this.dy;
            this.playNote();
            flag = true;
        }

        if (flag) {
            return;
        }

        // balls collide other balls
        for (const another of otherBalls) {
            if (another.name === this.name) {
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
            if (b.contains({x: tx + this.dx, y: ty})) {
                this.dx = -this.dx;
                this.playNote();
            }

            if (b.contains({x: tx, y: ty + this.dy})) {
                this.dy = -this.dy;
                this.playNote();
            }
        }

        this.x = tx;
        this.y = ty;
    }

    mapYtoNote(y: number): number {
        // transform y coordinate in [0, height] range to note in [96, 30] range. 
        // the bottom of the canvas has the highest y coordinate and maps to the lowest note
        return Math.floor(((gbloink.canvas.height - y) / 6) + 30);
    }

    playNote(): void {
        this.synth.play(scaleKeeper.adjustToCurrentScale(this.mapYtoNote(this.y)));
    }

    handleSpeedChangeEvent(event: MouseEvent): void {
        const [x, y] = eventToXY(event);
        const speed = 1 + Math.floor((x / this.speedWidth) * 5);
        this.dx = speed * (this.dx / Math.abs(this.dx));
        this.dy = speed * (this.dy / Math.abs(this.dy));
    };

    draw(): void {
        let ctx: CanvasRenderingContext2D = gbloink.canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.rad, 0, 2 * Math.PI);
        ctx.fillStyle = this.colour;
        ctx.fill();
        ctx.stroke();
    }

    hit(x: number, y: number, rad: number): boolean {
        return dist(x, y, this.x, this.y) < this.rad + rad;
    }
}

// Class representing a block on the canvas
class Block {
    topLeftCornerCoords: Coords;
    bottomRightCornerCoords: Coords;
    width: number;
    height: number;
    colour: string;

    constructor(blockCentre: Coords) {
        // width and height are random in range [5, 55]
        this.width = 5 + Math.random() * 50;
        this.height = 5 + Math.random() * 50;
        this.topLeftCornerCoords = {
            x: blockCentre.x - this.width / 2, 
            y: blockCentre.y - this.height / 2
        };
        this.bottomRightCornerCoords = {
            x: blockCentre.x + this.width / 2, 
            y: blockCentre.y + this.height / 2
        };
        this.colour = randomColour();
    }

    contains(point: Coords) {
        if (point.x < this.topLeftCornerCoords.x || point.x > this.bottomRightCornerCoords.x || 
            point.y < this.topLeftCornerCoords.y || point.y > this.bottomRightCornerCoords.y) {
            return false;
        }
        return true;
    }

    draw() { 
        let ctx: CanvasRenderingContext2D = gbloink.canvas.getContext('2d');
        ctx.beginPath();
        ctx.rect(this.topLeftCornerCoords.x, this.topLeftCornerCoords.y, this.width, this.height);
        ctx.fillStyle = this.colour;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'white';
        ctx.stroke();
    }
}

class BlockKeeper {
    static blocks: Block[] = [];

    static createBlock(centreCoords: Coords) {
        let b: Block = new Block(centreCoords);
        BlockKeeper.blocks.push(b);
        return b;
    }
    
    static removeOrCreateAt(point: Coords): void {
        for(let i=0;i<this.blocks.length;i++) {
            if (this.blocks[i].contains(point)) {
                this.blocks.splice(i, 1);
                return;
            }
        }
        this.blocks.push(new Block(point));
    }
    
    static drawBlocks(): void {
        this.blocks.forEach(block => block.draw());
    }

    static initialize(): void {           
        for (let i = 0; i <= 30; i++) {
            // create random blocks at the bottom every 30 pixels
            this.removeOrCreateAt({
                x: i * 30, 
                y: Math.floor(50 + Math.random() * 50)
            });
            // create random blocks at the top every 30 pixels
            this.removeOrCreateAt({
                x: i * 30, 
                y: Math.floor(300 + Math.random() * 50)
            });
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

// Generate a random colour
let ballSoundControlBarWidth = 170;

let gbloink: {
    canvas: HTMLCanvasElement;
    minWidth: number;
    minHeight: number;
    balls: Ball[];
    init: () => void;
    next: () => void;
} = {
    canvas: document.getElementById("canvasId") as HTMLCanvasElement,
    balls: [],
    minHeight: 200,
    minWidth: 400,
    init: function () {
        if (!this.canvas) {
            throw new Error(`No canvas element found with id canvasId`);
        }
        if (this.canvas.width < this.minWidth || this.canvas.height < this.minHeight) {
            throw new Error(`Minimum width or height not respected in canvas`);
        }
        if (!this.canvas.getContext('2d')) {
            throw new Error('Unable to get 2D context from canvas');
        }

        this.balls = [
            new Ball({x: 200, y:200}, '#ff0000', 'redball', 0, 0),
            new Ball({x:300, y:200}, '#00ff00', 'greenball', 0, 24),
            new Ball({x: 360, y:200}, '#0000ff', 'blueball', 0, 44),
        ]
        scaleKeeper.setCurrent("major");

        BlockKeeper.initialize();        
        this.canvas.addEventListener('mouseup', (event: MouseEvent) => {
            const rect = this.canvas.getBoundingClientRect();
            const root = document.documentElement;
            BlockKeeper.removeOrCreateAt({
                x: event.pageX - rect.left - root.scrollLeft, 
                y: event.pageY - rect.top - root.scrollTop
            });
        });
    },
    
    next: function () {
        // restore the canvas to all black
        this.canvas.getContext('2d').fillStyle = 'black';
        this.canvas.getContext('2d').fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.balls.forEach(ball => ball.move(this.balls, BlockKeeper.blocks));
        BlockKeeper.drawBlocks();
        this.balls.forEach(ball => ball.draw());
    }
};


document.addEventListener("DOMContentLoaded", function() {
    gbloink.init();

    let intervalId = setInterval(() => gbloink.next(), 50);

    document.getElementById('startButton').addEventListener('click', function () {
        // Implement your start game logic here
        clearInterval(intervalId);
        intervalId = setInterval(() => gbloink.next(), 50);
    });

    document.getElementById('stopButton').addEventListener('click', function () {
        // Implement your stop game logic here
        clearInterval(intervalId);
    });
});


