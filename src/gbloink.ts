/**
 * Encapsulate a pair of coordinates (x, y) 
 * 
 */
type Coords = {
    x: number;
    y: number;
}

/** 
 * Class representing a rectangle shaped obstacle to the balls on the canvas
*/
class Block {
    bottomLeft: Coords;
    topRightCoords: Coords;
    width: number;
    height: number;
    colour: string;

    constructor(blockCentre: Coords) {
        // width and height are random in range [5, 55]
        this.width = 5 + Math.random() * 50;
        this.height = 5 + Math.random() * 50;
        this.bottomLeft = {
            x: blockCentre.x - this.width / 2,
            y: blockCentre.y - this.height / 2
        };
        this.topRightCoords = {
            x: blockCentre.x + this.width / 2,
            y: blockCentre.y + this.height / 2
        };
        this.colour = Block.randomColour();
    }

    static randomColour(): string {
        const letters = '0123456789ABCDEF'.split('');
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    contains(point: Coords): boolean {
        if (point.x < this.bottomLeft.x || point.x > this.topRightCoords.x ||
            point.y < this.bottomLeft.y || point.y > this.topRightCoords.y) {
            return false;
        }
        return true;
    }
    /**
     * Given a ball, detect if the ball will cross one of the vertical edges of this block
     * If it does, invert the vertical speed of the ball and return true
     * @param one of the 3 balls
     * @returns true if one of the edges of this block would be crossed by the ball 
     * in the next move if it keeps the same moving direction.
     */
    adjustVspeed(ball: Ball): boolean {
        // y coord of ball would change side of the bottom edge y coord 
        // and x coord is within the x range of the edge +/- the speed increment
        if (((ball.y - this.bottomLeft.y) * (ball.y + ball.dx - this.bottomLeft.y)) <= 0 &&
            this.bottomLeft.x - ball.dx <= ball.x && ball.x <= this.topRightCoords.x + ball.dx) {
            ball.dy = -ball.dy;
            return true;
        }
        // y coord of ball would change side of the top edge y coord 
        // and x coord is within the x range of the edge +/- the speed increment
        else if (((ball.y - this.topRightCoords.y) * (ball.y + ball.dy - this.topRightCoords.y)) <= 0 &&
            this.bottomLeft.x - ball.dx <= ball.x && ball.x <= this.topRightCoords.x + ball.dx) {
            ball.dy = -ball.dy;
            return true;
        }
    }

    adjustHspeed(ball: Ball): boolean {
        // ball will cross the left edge
        if (((ball.x - this.bottomLeft.x) * (ball.x + ball.dx - this.bottomLeft.x)) <= 0 &&
            this.bottomLeft.y - ball.dy <= ball.y && ball.y <= this.topRightCoords.y + ball.dy) {
            ball.dx = -ball.dx;
            return true;
        }
        // ball will cross the right edge
        if (((ball.x - this.topRightCoords.x) * (ball.x + ball.dx - this.topRightCoords.x)) <= 0 &&
            this.bottomLeft.y - ball.dy <= ball.y && ball.y <= this.topRightCoords.y + ball.dy) {
            ball.dx = -ball.dx;
            return true;
        }
    }

    draw(): void {
        let ctx: CanvasRenderingContext2D = gbloink.canvas.getContext('2d');
        ctx.beginPath();
        ctx.rect(this.bottomLeft.x, this.bottomLeft.y, this.width, this.height);
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

    static initialize(): void {
        for (let i = 0; i <= 30; i++) {
            // create random blocks at the bottom every 30 pixels
            BlockKeeper.createBlock({
                x: i * 30,
                y: Math.floor(50 + Math.random() * 50)
            });
            // create random blocks at the top every 30 pixels
            BlockKeeper.createBlock({
                x: i * 30,
                y: Math.floor(300 + Math.random() * 50)
            });
        }
    }

    static removeOrCreateAt(point: Coords): void {
        for (let i = 0; i < this.blocks.length; i++) {
            if (this.blocks[i].contains(point)) {
                this.blocks.splice(i, 1);
                return;
            }
        }
        BlockKeeper.createBlock(point);
    }

    static drawBlocks(): void {
        this.blocks.forEach(block => block.draw());
    }

    static handleCollisions(ball: Ball): void {
        let willBounce: boolean = false;
        for (let i = 0; i < this.blocks.length; i++) {
            if (this.blocks[i].adjustVspeed(ball)) {
                willBounce = true;
                break;
            }
        }
        for (let i = 0; i < this.blocks.length; i++) {
            if (this.blocks[i].adjustHspeed(ball)) {
                willBounce = true;
                break
            }
        }
        if (willBounce) {
            ball.playNote();
        }
    }
}

/**
 * Class representing a ball bouncing around on the canvas
 * and playing a sound when it hits the border, a block or another ball
 */
class Ball {
    static hitDistance: number = 8;
    static radius: number = 5;
    name: string;
    x: number;
    y: number;
    colour: string;
    synth: Synth;
    dx: number;
    dy: number;

    constructor(c: Coords, colour: string, name: string, timbre: number) {
        this.name = name;
        this.x = c.x;
        this.y = c.y;
        this.colour = colour;
        this.synth = new Synth(name, timbre);
        this.dx = 2;
        this.dy = 2;

        let speedSlider = document.getElementById(name + '_speed') as HTMLInputElement;
        speedSlider.value = this.dx.toString();
        speedSlider.addEventListener('input', this.handleSpeedChangeEvent.bind(this));
    }

    static pairBallCollide(b1: Ball, b2: Ball): boolean {
        // if the balls are too far away on either dimension,
        if (Math.abs(b1.x - b2.x) > Ball.hitDistance || Math.abs(b1.y - b2.y) > Ball.hitDistance) {
            return false;
        } // else the balls are colliding
        // if they are moving on opposite directions in x, reverse the x speed of both
        if (b1.dx * b2.dx < 0) {
            b1.dx = -b1.dx;
            b2.dx = -b2.dx;
        } // if they are moving on opposite directions in y, reverse the y speed of both
        if (b1.dy * b2.dy < 0) {
            b1.dy = -b1.dy;
            b2.dy = -b2.dy;
        }
        // the case where they are moving in the same direction but one is faster is not handled
        b1.playNote();
        b2.playNote();
        return true;
    }

    // consider all pairwise interactions between balls
    static allBallsCollide(balls: Ball[]): void {
        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                this.pairBallCollide(balls[i], balls[j]);
            }
        }
    }
    /**
     * Move the ball by dx and dy corresponding to one unit of time. 
     * |dx| = |dy| so All balls move at the same speed
     * along the x and y axes i.e. on a line of + or - 45 degrees.
     */
    move(): void {
        this.x += this.dx;
        this.y += this.dy;
    }
    /**
     * Adjust speed and make sound if ball is heading towards a border
     */
    detectBorderCollision(): void {
        let flag: boolean = false;
        if (this.x < 3 || this.x > gbloink.canvas.width - 3) {
            this.dx = -this.dx;
            flag = true;
        }

        if (this.y < 3 || this.y > gbloink.canvas.height - 3) {
            this.dy = -this.dy;
            flag = true;
        }

        if (flag) {
            this.playNote();
        }
    }
    /**
     * Map linearly the y coordinate in [0, height] range to note in [96, 30] range = [C7, B2]
     * The bottom of the canvas has the highest y coordinate and maps to the lowest note 
     * @param a y coordinate on the canvas
     * @returns a note in the MIDI format 
     */
    mapYtoNote(y: number): number {
        return Math.floor(((gbloink.canvas.height - y) / 6) + 30);
    }
    /**
     * Play a note corresponding to the y coordinate of the ball adjusted
     * to belong to the current scale
     */
    playNote(): void {
        this.synth.play(scaleKeeper.adjustToCurrentScale(this.mapYtoNote(this.y)));
    }

    handleSpeedChangeEvent(event: InputEvent): void {
        const speed = parseInt((event.target as HTMLInputElement).value);
        this.dx = speed * Math.sign(this.dx);
        this.dy = speed * Math.sign(this.dy);
    }

    /**
     * Draw the ball on the canvas as a full circle of the correct color
     */
    draw(): void {
        let ctx: CanvasRenderingContext2D = gbloink.canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(this.x, this.y, Ball.radius, 0, 2 * Math.PI);
        ctx.fillStyle = this.colour;
        ctx.fill();
        ctx.stroke();
    }
}

/**
* Class representing musical scales, with an array of 12 booleans indicating which
* notes are part of the scale.
*/
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
/**
* Each ball has one instance of this class responsible for managing the sound
* which is played when the ball bounces
*/
class Synth {
    synth: any;
    volume: number = 50;
    delay: number = 50;
    timbre: number;
    previousNote: number = 0;
    midiChannel: number = 0;

    static channelMap: { [key: string]: number } = {
        'redball': 0,
        'greenball': 1,
        'blueball': 2,
    };

    constructor(ballName: string, timbre: number) {
        this.midiChannel = Synth.channelMap[ballName];
        this.synth = new WebAudioTinySynth();
        this.timbre = timbre;
        this.synth.setProgram(0, this.timbre);

        let volumeSlider = document.getElementById(ballName + '_volume') as HTMLInputElement;
        volumeSlider.value = this.volume.toString();
        volumeSlider.addEventListener('input', (event: InputEvent) => {
            this.volume = parseInt((event.target as HTMLInputElement).value);
        });

        // remove this code for now, until I find a satisfactory way to handle note duration
        // let delaySlider = document.getElementById(ballName + '_delay') as HTMLInputElement;
        // delaySlider.value = this.delay.toString();
        // delaySlider.addEventListener('input', (event: InputEvent) => {
        //     this.delay = parseInt((event.target as HTMLInputElement).value);
        // });

        let instrumentSlider = document.getElementById(ballName + '_instrument') as HTMLInputElement;
        instrumentSlider.value = timbre.toString();
        instrumentSlider.addEventListener('input', (event: InputEvent) => {
            console.log('about to set the ball to value', this.midiChannel, parseInt((event.target as HTMLInputElement).value));
            this.synth.setProgram(this.midiChannel, parseInt((event.target as HTMLInputElement).value));
        });
    }

    play(note: number): void {
        // send a noteOff message for the old note, this shouldn't be needed
        if (this.previousNote !== null) {
            this.synth.noteOff(this.midiChannel, this.previousNote);
        }
        this.previousNote = note;

        this.synth.noteOn(this.midiChannel, note, this.volume);
        this.synth.noteOff(this.midiChannel, note, this.delay);
    }
}


class Gbloink {
    canvas: HTMLCanvasElement;
    minWidth: number = 400;
    minHeight: number = 200;
    balls: Ball[];

    constructor() {
        this.canvas = document.getElementById("canvasId") as HTMLCanvasElement;
        if (!this.canvas) {
            throw new Error(`No canvas element found with id canvasId`);
        }
        if (this.canvas.width < this.minWidth || this.canvas.height < this.minHeight) {
            throw new Error(`Minimum width or height not respected in canvas`);
        }
        if (!this.canvas.getContext('2d')) {
            throw new Error('Unable to get 2D context from canvas');
        }
        // need to make the start coordinates relative to width and height
        this.balls = [
            new Ball({ x: this.canvas.width/8*2, y: this.canvas.height/2 }, '#ff0000', 'redball', 0),
            new Ball({ x: this.canvas.width/8*3, y: this.canvas.height/2 }, '#00ff00', 'greenball', 24),
            new Ball({ x: this.canvas.width/8*4, y: this.canvas.height/2 }, '#0000ff', 'blueball', 44),
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
    }

    next(): void {
        // restore the canvas to all black
        this.canvas.getContext('2d').fillStyle = 'black';
        this.canvas.getContext('2d').fillRect(0, 0, this.canvas.width, this.canvas.height);
        BlockKeeper.drawBlocks();

        this.balls.forEach((ball: Ball) => {
            ball.move(); 
            ball.detectBorderCollision();
        });

        Ball.allBallsCollide(this.balls);

        this.balls.forEach((ball: Ball) => {
            BlockKeeper.handleCollisions(ball);
            ball.draw();
        });

     }
}

//  global scope for gbloink
let gbloink: Gbloink;

document.addEventListener("DOMContentLoaded", function () {
    gbloink = new Gbloink();
    gbloink.next();

    let intervalId: number;

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
