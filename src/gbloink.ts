/**
 * Encapsulate a pair of coordinates (x, y) 
 * 
 */
type Coords = {
    x: number;
    y: number;
}

function addCoords(c1: Coords, c2: Coords): Coords {
    return {
        x: c1.x + c2.x,
        y: c1.y + c2.y
    };
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

    constructor(bottomLeft: Coords, topRight: Coords, colour: string) {
        this.bottomLeft = bottomLeft;
        this.topRightCoords = topRight;
        this.width = topRight.x - bottomLeft.x;
        this.height = topRight.y - bottomLeft.y;
        this.colour = colour;
    }
    
    contains(point: Coords): boolean {
        if (point.x < this.bottomLeft.x || point.x > this.topRightCoords.x ||
            point.y < this.bottomLeft.y || point.y > this.topRightCoords.y) {
            return false;
        }
        return true;
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

declare const RBush: any;

/**
 * By extending RBush this way, I can directly add and remove blocks from the index.
 */
class BlockIndex extends RBush {
    toBBox(block: Block) { 
        return {
            minX: block.bottomLeft.x, 
            minY: block.bottomLeft.y, 
            maxX: block.topRightCoords.x, 
            maxY: block.topRightCoords.y
        }; 
    }
    compareMinX(block1: Block, block2: Block) { return block1.bottomLeft.x - block2.bottomLeft.x; }
    compareMinY(block1: Block, block2: Block) { return block1.bottomLeft.y - block2.bottomLeft.y; }
}

class BlockKeeper {
    static blocks: Block[] = [];
    static index = new BlockIndex();

    static addSomeRandomBlocks(nbOfBlocksPerRow: number): void {
        let xStep = gbloink.width / nbOfBlocksPerRow * 2;
        for (let i = 0; i <= nbOfBlocksPerRow; i++) {
            // create random blocks at the bottom every 30 pixels
            BlockKeeper.addRandomSizeBlock({
                x: i * xStep,
                y: 50 + Math.floor(Math.random() * 50)
                
            });
            // create random blocks at the top every 30 pixels
            BlockKeeper.addRandomSizeBlock({
                x: i * xStep,
                y: (gbloink.height - 50) - Math.floor(Math.random() * 50)
            });
        }
    }

    static addRandomSizeBlock(centreCoords: Coords): void {
        // width and height are random in range [5, 55]
        let width = 5  + Math.random() * 50;
        let height = 5 + Math.random() * 50;
        let bottomLeftCoords = {
            x: centreCoords.x - width / 2,
            y: centreCoords.y - height / 2
        };
        let topRightCoords = {
            x: centreCoords.x + width / 2,
            y: centreCoords.y + height / 2
        };
        let b: Block = new Block(bottomLeftCoords, topRightCoords, BlockKeeper.randomColour());
        BlockKeeper.blocks.push(b);
        this.index.insert(b);
    }

    static randomColour(): string {
        const letters = '0123456789ABCDEF'.split('');
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }
    /**
     * Function called on clicks. If a block is clicked, it is removed, otherwise we had a random block
     * @param point of the click
     * @returns 
     */
    static removeOrCreateAt(point: Coords): void {
        for (let i = 0; i < this.blocks.length; i++) {
            if (this.blocks[i].contains(point)) {
                // remove the block from the index and the array (in that order!)
                this.index.remove(this.blocks[i]);
                this.blocks.splice(i, 1);
                return;
            }
        }
        BlockKeeper.addRandomSizeBlock(point);
    }

    static drawAllBlocks(): void {
        // erase the block canvas
        gbloink.getBlockDrawingContext(true);
        this.blocks.forEach(block => block.draw());
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
    colour: string;
    synth: Synth;
    speed: Coords;

    constructor(c: Coords, colour: string, name: string, timbre: number) {
        this.name = name;
        this.position = c;
        this.colour = colour;
        this.synth = new Synth(name, timbre);
        this.speed = { x: 2, y: 2 };

        let speedSlider = document.getElementById(name + '_speed') as HTMLInputElement;
        speedSlider.value = this.speed.x.toString();
        speedSlider.addEventListener('input', this.handleSpeedChangeEvent.bind(this));
    }

    hereToNextTrajectoryBbox() {
        return {
            minX: Math.min(this.position.x,this.position.x + this.speed.x), 
            minY: Math.min(this.position.y,this.position.y + this.speed.y),
            maxX: Math.max(this.position.x,this.position.x + this.speed.x),
            maxY: Math.max(this.position.y,this.position.y + this.speed.y)
        }
    };

    /**
     * Handle the collision between this ball and another ball, changing their speed
     * and playing a note
     * @param otherBall the second ball
     */
    handleCollisionWithBall(otherBall: Ball): void {
        let dx = Math.abs(this.position.x - otherBall.position.x);
        let dy = Math.abs(this.position.y - otherBall.position.y);

        // if the balls are too far away on both dimensions,
        if (dx > Ball.hitDistance || dy > Ball.hitDistance) {
            return;
        } // else, balls will collide
        // if they are moving on opposite directions in both x and y, 
        // reverse the y speed if they are more aligned on the x axis and vice-versa
        // If they are equally aligned on x and y, reverse both speeds (both if clauses apply )
        if (this.speed.x * otherBall.speed.x < 0 && this.speed.y * otherBall.speed.y < 0) {
            if (dx >= dy) {
                this.speed.x *= -1;
                otherBall.speed.x *= -1;
            } 
            if (dx <= dy) {
                this.speed.y *= -1;
                otherBall.speed.y *= -1;
            }
        } else {  // if they are only opposed in speed in one dimension, reverse the speed of both balls in that dimension
            if (this.speed.y * otherBall.speed.y < 0) {
                this.speed.y *= -1;
                otherBall.speed.y *= -1;
            } else if (this.speed.x * otherBall.speed.x < 0) {
                this.speed.x *= -1;
                otherBall.speed.x *= -1;
            }
        }
        // the case where they are moving in the same direction but one is faster is not handled
        this.playNote();
        otherBall.playNote();
    }

    /**
     * Handle the collisions between this ball and the ones after it in the array
     */
    handleCollisions(): void {
        let i = gbloink.balls.indexOf(this);
        for (let j = i + 1; j < gbloink.balls.length; j++) {
            this.handleCollisionWithBall(gbloink.balls[j]);
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
    handleBorderCollision(): void {
        let bounceOnBorder: boolean = false;
        let nextX = this.position.x + this.speed.x;
        let nextY = this.position.y + this.speed.y;
        if (nextX < 0 || nextX > gbloink.ballCanvas.width) {
            this.speed.x *= -1;
            bounceOnBorder = true;
        }
        if (nextY < 0 || nextY > gbloink.ballCanvas.height) {
            this.speed.y *= -1;
            bounceOnBorder = true;
        }
        if (bounceOnBorder) {
            this.playNote();
        }
    }
    
    /**
     * Given a ball, handle any possible block collision
     * @param one of the 3 balls
     * @returns true if the ball bounces on the block, false otherwise
     */
    bounceOnBlocks(): void {
        let nearBlocks = BlockKeeper.index.search(this.hereToNextTrajectoryBbox());
        // if some block(s) is(are) close enough, bounce on the first one
        if (nearBlocks.length > 0) {
            let bounceLeftOrRight:boolean = false;
            let bounceUpOrDown:boolean = false;
            if (nearBlocks[0].contains(addCoords(this.position,{x: this.speed.x, y: 0}))) {
                this.speed.x = -this.speed.x;
                bounceLeftOrRight = true;
            }
            if (nearBlocks[0].contains(addCoords(this.position,{x: 0, y: this.speed.y}))) {
                this.speed.y = -this.speed.y;
                bounceUpOrDown = true;
            }
            if (bounceLeftOrRight || bounceUpOrDown) {
                this.playNote();
            }
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
    delay: number = 1;
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

        let delaySlider = document.getElementById(ballName + '_delay') as HTMLInputElement;
        delaySlider.value = this.delay.toString();
        delaySlider.addEventListener('input', (event: InputEvent) => {
            this.delay = parseInt((event.target as HTMLInputElement).value);
        });

        let instrumentSlider = document.getElementById(ballName + '_instrument') as HTMLInputElement;
        instrumentSlider.value = this.timbre.toString();
        instrumentSlider.addEventListener('input', (event: InputEvent) => {
            this.timbre = parseInt((event.target as HTMLInputElement).value);
            this.synth.setProgram(this.midiChannel, this.timbre);
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
        console.log('delay on ball is' + this.delay);
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
            BlockKeeper.drawAllBlocks();
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
        BlockKeeper.addSomeRandomBlocks(30);
        BlockKeeper.drawAllBlocks();
        this.balls.forEach((ball: Ball) => {
            ball.draw();
        });
    }

    updateBalls(): void {
        // erase ball canvas
        this.getBallDrawingContext(true);
        this.balls.forEach((ball: Ball) => {
            ball.move(); 
            ball.handleBorderCollision();
            ball.handleCollisions();
            ball.bounceOnBlocks();
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
