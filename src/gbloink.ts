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
    
    static strokeStyle: string = 'white';

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
        if (((ball.position.y - this.bottomLeft.y) * (ball.position.y + ball.speed.x - this.bottomLeft.y)) <= 0 &&
            this.bottomLeft.x - ball.speed.x <= ball.position.x && ball.position.x <= this.topRightCoords.x + ball.speed.x) {
            ball.speed.y = -ball.speed.y;
            return true;
        }
        // y coord of ball would change side of the top edge y coord 
        // and x coord is within the x range of the edge +/- the speed increment
        else if (((ball.position.y - this.topRightCoords.y) * (ball.position.y + ball.speed.y - this.topRightCoords.y)) <= 0 &&
            this.bottomLeft.x - ball.speed.x <= ball.position.x && ball.position.x <= this.topRightCoords.x + ball.speed.x) {
            ball.speed.y = -ball.speed.y;
            return true;
        }
    }

    adjustHspeed(ball: Ball): boolean {
        // ball will cross the left edge
        if (((ball.position.x - this.bottomLeft.x) * (ball.position.x + ball.speed.x - this.bottomLeft.x)) <= 0 &&
            this.bottomLeft.y - ball.speed.y <= ball.position.y && ball.position.y <= this.topRightCoords.y + ball.speed.y) {
            ball.speed.x = -ball.speed.x;
            return true;
        }
        // ball will cross the right edge
        if (((ball.position.x - this.topRightCoords.x) * (ball.position.x + ball.speed.x - this.topRightCoords.x)) <= 0 &&
            this.bottomLeft.y - ball.speed.y <= ball.position.y && ball.position.y <= this.topRightCoords.y + ball.speed.y) {
            ball.speed.x = -ball.speed.x;
            return true;
        }
    }

    draw(): void {
        let ctx: CanvasRenderingContext2D = gbloink.getBlockDrawingContext();
        ctx.beginPath();
        ctx.rect(this.bottomLeft.x, this.bottomLeft.y, this.width, this.height);
        ctx.fillStyle = this.colour;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = Block.strokeStyle;
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
        // erase the block canvas
        gbloink.getBlockDrawingContext(true);
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
    position: Coords;
    // x: number;
    // y: number;
    colour: string;
    synth: Synth;
    speed: Coords;
    // dx: number;
    // dy: number;

    constructor(c: Coords, colour: string, name: string, timbre: number) {
        this.name = name;
        this.position = c;
        // this.x = c.x;
        // this.y = c.y;
        this.colour = colour;
        this.synth = new Synth(name, timbre);
        this.speed = { x: 2, y: 2 };
        // this.dx = 2;
        // this.dy = 2;

        let speedSlider = document.getElementById(name + '_speed') as HTMLInputElement;
        speedSlider.value = this.speed.x.toString();
        speedSlider.addEventListener('input', this.handleSpeedChangeEvent.bind(this));
    }

    static pairBallCollide(b1: Ball, b2: Ball): boolean {
        // if the balls are too far away on either dimension,
        if (Math.abs(b1.position.x - b2.position.x) > Ball.hitDistance || Math.abs(b1.position.y - b2.position.y) > Ball.hitDistance) {
            return false;
        } // else the balls are colliding
        // if they are moving on opposite directions in x, reverse the x speed of both
        if (b1.speed.x * b2.speed.x < 0) {
            b1.speed.x *= -1;
            b2.speed.x *= -1;
        } // if they are moving on opposite directions in y, reverse the y speed of both
        if (b1.speed.y * b2.speed.y < 0) {
            b1.speed.y *= -1;
            b2.speed.y *= -1;
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
        this.position.x += this.speed.x;
        this.position.y += this.speed.y;
    }
    /**
     * Adjust speed and make sound if ball is heading towards a border
     */
    detectBorderCollision(): void {
        let flag: boolean = false;
        if (this.position.x < 3 || this.position.x > gbloink.ballCanvas.width - 3) {
            this.speed.x *= -1;
            flag = true;
        }

        if (this.position.y < 3 || this.position.y > gbloink.ballCanvas.height - 3) {
            this.speed.y *= -1;
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
    getRawNote(): number {
        return Math.floor(((gbloink.ballCanvas.height - this.position.y) / 6) + 30);
    }
    /**
     * Play a note corresponding to the y coordinate of the ball adjusted
     * to belong to the current scale
     */
    playNote(): void {
        this.synth.play(gbloink.scaleKeeper.adjustToCurrentScale(this.getRawNote()));
    }
    /**
     * Adjust the magnitude of the speed of the ball, keeping the same direction. 
     * @param event the input event that triggered the change
     */
    handleSpeedChangeEvent(event: InputEvent): void {
        const speed = parseInt((event.target as HTMLInputElement).value);
        this.speed.x = speed * Math.sign(this.speed.x);
        this.speed.y = speed * Math.sign(this.speed.y);
    }

    /**
     * Draw the ball on the canvas as a full circle of the correct color
     */
    draw(): void {
        let ctx: CanvasRenderingContext2D = gbloink.getBallDrawingContext();
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, Ball.radius, 0, 2 * Math.PI);
        ctx.fillStyle = this.colour;
        ctx.fill();
        ctx.strokeStyle = 'white';
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
    currentScale: string
    scales: { [key: string]: Scale };

    constructor(scale: string) {
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
        this.currentScale = 'chromatic';
        if (scale in this.scales) {
            this.currentScale = scale;
        }
    }

    setCurrent(newScale: string) {
        if (newScale in this.scales) {
            this.currentScale = newScale;
        }
    }

    adjustToCurrentScale(note: number): number {
        return this.scales[this.currentScale].findNextNoteInScale(note);
    }
}

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
    blockCanvas: HTMLCanvasElement;
    ballCanvas: HTMLCanvasElement
    width: number = 400;
    height: number = 200;
    balls: Ball[];
    scaleKeeper: ScaleKeeper;

    constructor() {
        this.blockCanvas = document.getElementById("block-canvas") as HTMLCanvasElement;
        this.ballCanvas = document.getElementById("ball-canvas") as HTMLCanvasElement;
        
        // set the width and height of both canvas to be the same and defined by the div element containing the canvas
        this.width = document.getElementById("play-area").clientWidth;
        this.blockCanvas.width = this.width;
        this.ballCanvas.width = this.width;

        this.height = document.getElementById("play-area").clientHeight;
        this.blockCanvas.height = this.height;
        this.ballCanvas.height = this.height;

        BlockKeeper.initialize();

        this.scaleKeeper = new ScaleKeeper('major');

        this.balls = [
            new Ball({ x: this.blockCanvas.width/8*2, y: this.blockCanvas.height/2 }, '#ff0000', 'redball', 0),
            new Ball({ x: this.blockCanvas.width/8*3, y: this.blockCanvas.height/2 }, '#00ff00', 'greenball', 24),
            new Ball({ x: this.blockCanvas.width/8*4, y: this.blockCanvas.height/2 }, '#0000ff', 'blueball', 44),
        ]

        // Put the event listener on the ball canvas as it is on top of the block canvas but pass
        // events to the BlockKeeper to handle the block creation/deletion
        this.ballCanvas.addEventListener('mouseup', (event: MouseEvent) => {
            const rect = this.ballCanvas.getBoundingClientRect();
            const root = document.documentElement;
            BlockKeeper.removeOrCreateAt({
                x: event.pageX - rect.left - root.scrollLeft,
                y: event.pageY - rect.top - root.scrollTop
            });
            BlockKeeper.drawBlocks();
        });
    }

    getBlockDrawingContext(refresh: boolean = false): CanvasRenderingContext2D {
        let ctx: CanvasRenderingContext2D = this.blockCanvas.getContext('2d');
        if (refresh) {
            ctx.clearRect(0, 0, this.width, this.height);
        }
        return ctx;
    }
    getBallDrawingContext(refresh:boolean = false): CanvasRenderingContext2D {
        let ctx: CanvasRenderingContext2D = this.ballCanvas.getContext('2d');
        if (refresh) {
            ctx.clearRect(0, 0, this.width, this.height);
        }
        return ctx;
    }

    init(): void {
        BlockKeeper.drawBlocks();
        this.balls.forEach((ball: Ball) => {
            ball.draw();
        });
    }

    updateBalls(): void {
        // erase ball canvas
        this.getBallDrawingContext(true);
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
    gbloink.init();

    let intervalId: number;

    document.getElementById('startButton').addEventListener('click', function () {
        // Implement your start game logic here
        clearInterval(intervalId);
        intervalId = setInterval(() => gbloink.updateBalls(), 50);
    });

    document.getElementById('stopButton').addEventListener('click', function () {
        // Implement your stop game logic here
        clearInterval(intervalId);
    });
});
