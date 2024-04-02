
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

    adjustToCurrentScale(note: number): number {
        return this.scales[this.currentScalekey].findNextNoteInScale(note);
    }
}

const scaleKeeper = new ScaleKeeper();

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
    canvas: Html5Canvas;

    constructor(c: Coords, colour: string, name: string, canvas: Html5Canvas, midi1: number, midi2: number) {
        this.name = name;
        this.x = c.x;
        this.y = c.y;
        this.colour = colour;
        this.synth = new Synth(midi1, midi2, name);
        this.dx = 2;
        this.dy = 2;
        this.rad = 5;
        this.canvas = canvas;
        addListenerToCanvas(name + '_speed', this.handleSpeedChangeEvent.bind(this));
    }

    move(otherBalls: Ball[], blocks: Block[]) {
        let tx = this.x + this.dx;
        let ty = this.y + this.dy;
        let flag = false;

        if (tx < 3 || tx > this.canvas.canvas.width - 3) {
            this.dx = -this.dx;
            this.playNote(); 
            flag = true;
        }

        if (ty < 3 || ty > this.canvas.canvas.height - 3) {
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

    mapYtoNote(y: number) {
        // transform y coordinate in [0, 400] range to note in [96, 30] range. 
        // 400 is at the bottom so it maps to 30.
        return Math.floor(((this.canvas.canvas.height - y) / 6) + 30);
    }

    playNote() {
        this.synth.play(scaleKeeper.adjustToCurrentScale(this.mapYtoNote(this.y)));
    }

    handleSpeedChangeEvent(event: MouseEvent) {
        const [x, y] = eventToXY(event);
        const speed = 1 + Math.floor((x / 170) * 5);
        this.dx = speed * (this.dx / Math.abs(this.dx));
        this.dy = speed * (this.dy / Math.abs(this.dy));
    };

    draw(): void {
        this.canvas.ctx.beginPath();
        this.canvas.ctx.arc(this.x, this.y, this.rad, 0, 2 * Math.PI);
        this.canvas.ctx.fillStyle = this.colour;
        this.canvas.ctx.fill();
        this.canvas.ctx.stroke();
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

// Wrapper around the HTML5 canvas API
class Html5Canvas {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    minWidth: number = 400;
    minHeight: number = 200;

    constructor(canvasId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvas) {
            throw new Error(`No canvas element found with id ${canvasId}`);
        }
        this.canvas = canvas;
        if (this.canvas.width < this.minWidth || this.canvas.height < this.minHeight) {
            throw new Error(`Minimum width or height not respected in ${canvasId}`);
        }

        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Unable to get 2D context from canvas');
        }
        this.ctx = ctx;
    }

    background(col: string) {
        this.ctx.fillStyle = col;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
}


// Generate a random colour
let ballSoundControlBarWidth = 170;

let gbloink: {
    canvas: Html5Canvas;
    balls: Ball[];
    init: () => void;
    next: () => void;
} = {
    canvas: new Html5Canvas("canvasId"),
    balls: [],
    
    init: function () {
        this.balls = [
            new Ball({x: 200, y:200}, '#ff0000', 'redball', this.canvas, 0, 0),
            new Ball({x:300, y:200}, '#00ff00', 'greenball', this.canvas, 0, 24),
            new Ball({x:400, y:200}, '#0000ff', 'blueball', this.canvas, 0, 44),
        ]
        scaleKeeper.setCurrent("major");

        BlockKeeper.initialize();        
        this.canvas.canvas.addEventListener('mouseup', (event: MouseEvent) => {
            const rect = this.canvas.canvas.getBoundingClientRect();
            const root = document.documentElement;
            const x = event.pageX - rect.left - root.scrollLeft;
            const y = event.pageY - rect.top - root.scrollTop;
            BlockKeeper.removeOrCreateAt(x, y);
        });
    },
    
    next: function () {
        this.canvas.background('black');
        this.balls.forEach(ball => ball.move(this.balls, BlockKeeper.blocks));
        BlockKeeper.drawBlocks(this.canvas);
        this.balls.forEach(ball => ball.draw(this.canvas));
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


