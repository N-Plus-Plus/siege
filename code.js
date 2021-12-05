document.addEventListener(`DOMContentLoaded`, function () { onLoad(); } );

const canvas = document.querySelector(`#canvas`);
const ctx = canvas.getContext(`2d`);
const canvasDiameter = Math.min( document.body.clientHeight, document.body.clientWidth ) * 0.9; // Canvas width and height
const canvasRadius = canvasDiameter / 2;
const frameRate = 10; // Frame Rate

var mass = 1000;
var range = canvasRadius / 2;
var mobility = 150;
var shooter = {
    angle: 0
    , rad: 0
    , len: 10
    , dmg: 12.5
    , firing: false
    , target: { x: 0, y: 0 }
}

var run = {
    wave: 0
    , jerks: 3
    , mass: 250
    , delayFrames: 50
}

var jerks = [];
var bullets = [];

var waveTimer = 5000;

function onLoad(){
    canvas.height = canvasDiameter;
    canvas.width = canvasDiameter;    
}

var loop = setInterval(() => { doLoop(); }, frameRate );
var waves = setInterval(() => { startWave(); }, waveTimer );

function doLoop(){
    cleanup();
    moveJerks();
    moveShooter();
    drawMe();    
    drawJerks();
}

function cleanup(){
    ctx.clearRect(0, 0, canvasDiameter, canvasDiameter);
}

function drawMe(){
    // laser
    if( shooter.firing ){
        ctx.beginPath();
        ctx.moveTo( canvasRadius, canvasRadius );
        ctx.lineTo( shooter.target.x, shooter.target.y );
        ctx.strokeStyle = "#f00"
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();        
    }

    // shooter
    let c = aToR( mass ) + shooter.len;
    let a = Math.sin( shooter.rad ) * c;
    let b = Math.cos( shooter.rad ) * c;
    ctx.beginPath();
    ctx.moveTo( canvasRadius, canvasRadius );
    ctx.lineTo( canvasRadius + b, canvasRadius + a );
    ctx.strokeStyle = "#fff"
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.closePath();

    // me
    ctx.beginPath();
    ctx.arc( canvasRadius, canvasRadius, aToR( mass ), 0, Math.PI * 2 );
    ctx.fillStyle = `#fff`;
    ctx.fill();
    ctx.closePath();

    // range
    ctx.beginPath();
    ctx.arc( canvasRadius, canvasRadius, range, 0, Math.PI * 2 );
    ctx.lineWidth = 1;
    ctx.strokeStyle = `#fff3`;
    ctx.stroke();
    ctx.closePath();

    // mass
    // ctx.font = "15px Lexend Deca";
    // ctx.fillText( `Mass: ${ mass }`, 25, 35);
}

function moveJerks(){
    for( let i = 0; i < jerks.length; i++ ){
        let j = jerks[i];
        if( j.delay > 0 ){ j.delay--; }
        else if( intersect( j.x, j.y, 0, canvasRadius, canvasRadius, aToR( mass ) ) ){
            addMass( j.mass, i );
        }
        else{
            j.x += j.xDir;
            j.y += j.yDir;
        }
    }
}

function moveShooter(){
    if( shooter.rad < 0 ){ shooter.rad += makeRadian(360); }
    if( shooter.rad > makeRadian( 360 ) ){ shooter.rad -= makeRadian(360); }
    //if( shooter.rad > makeRadian(360) ){ shooter.rad -= makeRadian(360); }
    //if( shooter.rad > 1 ){ shooter.rad -= 1; }
    let vis = [];
    for( let i = 0; i < jerks.length; i++ ){
        if( !jerks[i].visible ){
            if( intersect( jerks[i].x, jerks[i].y, aToR( jerks[i].mass ), canvasRadius, canvasRadius, canvasRadius / 2 ) ){
                jerks[i].visible = true;
            }
        }
        if( jerks[i].visible ){
            vis.push(
                { 
                    index: i, 
                    dist: Math.sqrt( Math.pow( canvasRadius - jerks[i].x, 2 ) + Math.pow( canvasRadius - jerks[i].y, 2 ) ) - aToR( mass )
                }
            )
        }
        vis.sort( ( a, b ) => a.dist > b.dist && 1 || -1 );
    }
    shooter.firing = false;
    if( vis.length > 0 ){
        let t = jerks[vis[0].index];
        let deg = Math.atan2( -t.yDir, -t.xDir );
        if( deg < 0 ){ deg += makeRadian(360); }
        if( deg !== shooter.rad ){
            let amt = makeRadian( mobility ) / aToC( mass );
            if( shooter.rad < deg && shooter.rad + amt > deg ){
                shooter.rad = deg;
            }
            else if( shooter.rad > deg && shooter.rad + amt < deg ){
                shooter.rad = deg;
                //console.log( 2 )
            }
            else{
                // pick left or right
                // if( deg - shooter.rad > makeRadian( 360 ) / 2 ){ amt *= -1; }
                shooter.rad += amt;                
            } 
        }
        else{ fireLaser( vis[0].index ); }        
    }
}

function fireLaser( index ){
    let tar = jerks[index];
    // console.log(index)
    let a = Math.min( shooter.dmg, tar.mass );
    tar.mass -= a;
    mass += a;
    shooter.firing = true;
    shooter.target.x = tar.x;
    shooter.target.y = tar.y;
    if( jerks[index].mass == 0 ){ jerks.splice( index, 1 ); }
}

function drawJerks(){
    for( let i = 0; i < jerks.length; i++ ){
        let j = jerks[i];
        ctx.beginPath();
        ctx.arc( j.x, j.y, aToR( j.mass ), 0, Math.PI * 2 );
        ctx.fillStyle = `#fff6`;
        ctx.fill();
        ctx.closePath();
    }    
}

function startWave(){
    let j = run.jerks + run.wave;
    for( let i = 0; i < j; i++ ){
        let alpha = Math.random() * 90;
        let m = run.mass * ( 1 + run.wave * 0.5 );
        let c = canvasRadius + aToR( m );
        let a = Math.sin( makeRadian( alpha ) ) * c * ( Math.random() > 0.5 ? 1 : -1 );
        let b = Math.cos( makeRadian( alpha ) ) * c * ( Math.random() > 0.5 ? 1 : -1 );
        // console.log( a, b, c, alpha );
        jerks.push(
            {
                mass: m
                , x: canvasRadius + a
                , y: canvasRadius + b
                , xDir: -a * 0.002
                , yDir: -b * 0.002
                , delay: i * run.delayFrames
                , visible: false
            }
        )
    }
}

function addMass( n, j ){
    mass -= n;
    jerks[j].mass = 0;
    for( let i = jerks.length - 1; i >= 0; i-- ){
        if( jerks[i].mass == 0 ){ jerks.splice( i, 1 ); }
    }
}


function aToR( a ){
    return Math.sqrt( a / Math.PI );
}
function rToC( r ){
    return Math.PI * r;
}
function aToC( a ){
    return 2 * Math.PI * aToR( a );
}

function intersect( x1, y1, r1, x2, y2, r2 ){
    let squareDistance = ( x1 - x2 ) * ( x1 - x2 ) + ( y1 - y2 ) * ( y1 - y2 );
    return squareDistance <= ( ( r1 + r2 ) * ( r1 + r2 ) );
}

function randBetween( x, y ){
    var delta = y - x + 1;
    var output = Math.floor( Math.random() * delta ) + x;
    return output;
}

function makeRadian( n ){
    return n * ( Math.PI/180 );
}

function makeDegrees( n ){
    return n / ( Math.PI/180 );
}