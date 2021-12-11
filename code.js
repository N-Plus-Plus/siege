document.addEventListener(`DOMContentLoaded`, function () { onLoad(); } );
document.addEventListener(`visibilitychange`, visibility, false );
window.addEventListener("mousedown", function (e) { clicked(e.target,e.button) });


const canvas = document.querySelector(`#canvas`);
const ctx = canvas.getContext(`2d`);
var canvasDiameter = Math.min( document.body.clientHeight, document.body.clientWidth ) * 0.9; // Canvas width and height
var canvasRadius = canvasDiameter / 2;
const frameRate = 10; // Frame Rate
const adjFrames = 100; // Mass change frames
const ups = 30; // UI updates per second
const massFloor = 100;
const delayFrames = 25; // frames between each jerk appearing
const maxJerks = 100;

var me = {
    mass: 1000
    , toMass: 1000
    , damage: 5
    , mobility: 150
    , scale: 1
    , toScale: 1
}
var shooter = {
    rad: 0
    , len: 10
    , firing: false
    , target: { x: 0, y: 0 }
}
var run = {
    wave: 0
    , jerks: 1
    , spawnrate: 1
    , velocity: 1
    , density: 1
    , enemymass: 250
    , ticks: 0
    , massConsumed: 0
}
var upg = {
    mobility: { ranks: 0, cost: 2000, benefit: 1.1, scale: 1.125 }
    , damage: { ranks: 0, cost: 4000, benefit: 1.1, scale: 1.125 }
    , scale: { ranks: 0, cost: 8000, benefit: 1.1, scale: 1.125 }
    , spawnrate: { ranks: 0, cost: 2500, benefit: 1.1, scale: 1.125 }
    , velocity: { ranks: 0, cost: 5000, benefit: 1.1, scale: 1.125 }
    , density: { ranks: 0, cost: 7500, benefit: 1.1, scale: 1.125 }
    , enemymass: { ranks: 0, cost: 10000, benefit: 1.25, scale: 1.25 * 10 / 9 }

}
var unit = canvasDiameter * 0.001;

var jerks = [];

const waveTimer = 4500;
var liveness = true;


function onLoad(){
    canvasDiameter = Math.min( document.body.clientHeight, document.body.clientWidth ) * 0.9; // Canvas width and height
    canvasRadius = canvasDiameter / 2;
    canvas.height = canvasDiameter;
    canvas.width = canvasDiameter;
    updateMass();
    doWaves();
}

var loop = setInterval(() => { if( liveness ){ doLoop(); } }, frameRate );

function clicked( target, button ){
    if( button == 0 ){
        if( target.classList.contains(`button`) ){
            buyUpg( target.getAttribute(`id`) );
        }
    }
}

function doWaves(){
    setTimeout(() => {
        if( liveness ){ 
            if( jerks.length < maxJerks ){
                spawnJerk();
            }
        }
        doWaves();
    }, 500 + waveTimer / getStat( `spawnrate` ) );
}

function doLoop(){
    cleanup();
    moveJerks();
    moveShooter();
    drawMe();
    drawJerks();
    run.ticks++;
    if( run.ticks % ( ups / frameRate ) == 0 ){
        updateMass();
        updateClock();
        updateAfford();
    }
    if( me.mass !== me.toMass ){ adjMass(); }
}

function updateMass(){
    document.querySelector(`#myMass`).innerHTML = `Mass: ${niceNumber( me.mass )}`;
}

function updateClock(){
    document.querySelector(`#runTime`).innerHTML = timeFromTicks( run.ticks );
}

function updateAfford(){
    let n = document.querySelectorAll(`.button`);
    for( let i = 0; i < n.length; i++ ){
        a = n[i].getAttribute(`id`);
        if( checkAfford( a ) ){ 
            n[i].classList.add( `afford`);
            n[i].children[0].innerHTML = `${romanize( upg[a].ranks + 1)}`;
            n[i].children[1].style = `;`;
        }
        else{
            n[i].classList.remove( `afford`);
            n[i].children[0].innerHTML = `${romanize( upg[a].ranks + 1)}`;
            n[i].children[1].style = `width: ${( me.toMass - massFloor ) / getCost( a ) * 100}%`;
        }
    }
}

function cleanup(){
    ctx.clearRect(0, 0, canvasDiameter, canvasDiameter);
}

function drawMe(){
    ctx.setLineDash([]);
    // laser
    if( shooter.firing ){
        ctx.beginPath();
        ctx.moveTo( canvasRadius, canvasRadius );
        ctx.lineTo( shooter.target.x, shooter.target.y );
        ctx.strokeStyle = "#f00"
        ctx.lineWidth = Math.max( 2 / getStat( `scale` ), 0.5 );
        ctx.stroke();
        ctx.closePath();
    }

    if( getStat(`scale`) < 8 ){
        // shooter
        let c = ( aToR( me.mass ) + shooter.len ) / getStat( `scale` ) * unit;
        let a = Math.sin( shooter.rad ) * c;
        let b = Math.cos( shooter.rad ) * c;
        ctx.beginPath();
        ctx.moveTo( canvasRadius, canvasRadius );
        ctx.lineTo( canvasRadius + b, canvasRadius + a );
        ctx.strokeStyle = "#fff"
        ctx.lineWidth = 5 / getStat( `scale` ) * unit;
        ctx.stroke();
        ctx.closePath();
    }

    // me
    ctx.beginPath();
    ctx.arc( canvasRadius, canvasRadius, aToR( me.mass ) / getStat( `scale` ) * unit, 0, Math.PI * 2 );
    ctx.fillStyle = `#fff`;
    ctx.fill();
    ctx.closePath();

    // range
    let k = 11;
    ctx.beginPath();
    ctx.setLineDash([k, k]);
    ctx.arc( canvasRadius, canvasRadius, canvasRadius / 2, 0, Math.PI * 2 );
    ctx.lineWidth = 1;
    ctx.strokeStyle = `#fff3`;
    ctx.stroke();
    ctx.closePath();

}

function moveJerks(){
    for( let i = 0; i < jerks.length; i++ ){
        let j = jerks[i];
        if( j.delay > 0 ){ j.delay--; }
        else if( intersect( j.x, j.y, 0, canvasRadius, canvasRadius, aToR( me.mass ) / getStat(`scale`) * unit ) ){
            addMass( Math.pow( j.mass, j.density ), i );
        }
        else{
            j.x += j.xDir;
            j.y += j.yDir;
        }
    }
}

function moveShooter(){
    // TODO aim out of range but don't fire until in range
    let vis = [];
    for( let i = 0; i < jerks.length; i++ ){
        if( !jerks[i].visible ){
            if( intersect( jerks[i].x, jerks[i].y, aToR( jerks[i].mass ) / getStat(`scale`) * unit, canvasRadius, canvasRadius, canvasRadius / 2 ) ){
                jerks[i].visible = true;
            }
        }
        if( jerks[i].visible ){
            vis.push(
                { 
                    index: i, 
                    dist: Math.sqrt( Math.pow( canvasRadius - jerks[i].x, 2 ) + Math.pow( canvasRadius - jerks[i].y, 2 ) ) - aToR( me.mass )
                }
            )
        }
        vis.sort( ( a, b ) => a.dist > b.dist && 1 || -1 );
    }
    shooter.firing = false;
    if( vis.length > 0 ){
        let t = jerks[vis[0].index];
        let deg = Math.atan2( -t.yDir, -t.xDir );
        if( deg < 0 ){ deg += Math.PI * 2; }
        if( deg > Math.PI * 2 ){ deg -= Math.PI * 2; }
        if( shooter.rad < 0 ){ shooter.rad += Math.PI * 2; }
        if( shooter.rad > Math.PI * 2 ){ shooter.rad -= Math.PI * 2; }
        if( deg !== shooter.rad ){
            let amt = makeRadian( getStat( `mobility` ) ) / aToC( me.mass );
            if( shooter.rad < deg && shooter.rad + amt > deg ){
                shooter.rad = deg;
            }
            else if( shooter.rad > deg && shooter.rad - amt < deg ){
                shooter.rad = deg;
            }
            else{
                if( ( shooter.rad - deg > 0 && shooter.rad - deg < Math.PI ) || shooter.rad - deg < -Math.PI ){ amt *= -1 }
                shooter.rad += amt;                
            } 
        }
        else{ fireLaser( vis[0].index ); }
    }
}

function fireLaser( index ){
    let tar = jerks[index];
    let a = Math.min( getStat( `damage` ), tar.mass * tar.density );
    tar.mass -= a;
    me.toMass += a;
    run.massConsumed += a;
    shooter.firing = true;
    shooter.target.x = tar.x;
    shooter.target.y = tar.y;
    if( jerks[index].mass <= 0 ){ jerks.splice( index, 1 ); }
    updateMass();
}

function drawJerks(){
    for( let i = 0; i < jerks.length; i++ ){
        let j = jerks[i];
        ctx.beginPath();
        ctx.arc( j.x, j.y, aToR( j.mass ) / getStat( `scale` ) * unit, 0, Math.PI * 2 );
        ctx.fillStyle = `#fff6`;
        ctx.fill();
        ctx.closePath();
    }
}

function spawnJerk(){
    let m = getStat( `enemymass` );
    let alpha = Math.random() * 90;
    let c = canvasRadius + aToR( m );
    let a = Math.sin( makeRadian( alpha ) ) * c * ( Math.random() > 0.5 ? 1 : -1 );
    let b = Math.cos( makeRadian( alpha ) ) * c * ( Math.random() > 0.5 ? 1 : -1 );
    jerks.push(
        {
            mass: m
            , density: 1 * getStat( `density` )
            , x: canvasRadius + a
            , y: canvasRadius + b
            , xDir: -a * 0.002 * unit / getStat( `scale` )
            , yDir: -b * 0.002 * unit / getStat( `scale` )
            , delay: 0
            , visible: false
        }
    )
}

function addMass( n, j ){
    me.toMass -= n;
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

function visibility() {
    if( document.visibilityState === "hidden" ){ liveness = false; } else{ liveness = true; }
}

var si = ["","k","M","B","T","q","Q","s","S","O","D"];

function niceNumber( x ){
    let o = ``;
    if( x < 1000 && x > -1000 ){ o = round(x,2)}
    else if( x < 1000000 && x > -1000000 ){ o = round(x,0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") }
    else{ o = abbrevNum( x ) };
    return o;
}

function abbrevNum(number){
    let neg = false;
    if( number < 0 ){
        neg = true;
        number = Math.abs( number );
    }
    var tier = Math.log10(number) / 3 | 0;
    if(tier == 0) return number;
    var suffix = si[tier];
    var scale = Math.pow(10, tier * 3);
    var scaled = number / scale;
    return ( neg ? `-` : `` ) + scaled.toPrecision(4) + suffix;
}

function round(value, exp) {
    if (typeof exp === 'undefined' || +exp === 0)
    return Math.round(value);  
    value = +value;
    exp = +exp;  
    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0))
    return NaN;
    value = value.toString().split('e');
    value = Math.round(+(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp)));
    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp));
}

function timeFromTicks( ticks ){
    let ms = ticks * frameRate;
    let days = 0, hours = 0, minutes = 0, seconds = 0;
    if( ms > 86400000 ){
        days += Math.floor( ms / 86400000 );
        ms -= days * 86400000;
    }
    if( ms > 3600000 ){
        hours += Math.floor( ms / 3600000 );
        ms -= hours * 3600000;
    }
    if( ms > 60000 ){
        minutes += Math.floor( ms / 60000 );
        ms -= minutes * 60000;
    }
    if( ms > 1000 ){
        seconds += Math.floor( ms / 1000 );
    }
    let o = ``;
    if( days == 0 ){ o = `${twoDig( hours )}:${twoDig( minutes )}:${twoDig( seconds )}`; }
    else{ o = `${twoDig( days )}:${twoDig( hours )}:${twoDig( minutes )}:${twoDig( seconds )}`; }
    return o;
}

function twoDig( n ){
    return n.toLocaleString('en-US', {
        minimumIntegerDigits: 2,
        useGrouping: false
    })
}

function calcMPS(){
    let s = run.ticks / ( 1000 / frameRate );
    let m = run.massConsumed;
    return `MPS: ${niceNumber( m/s )}`
}

function adjMass(){
    let amt = Math.max( 5, Math.abs( me.mass - me.toMass ) / adjFrames );
    if( Math.abs( me.mass - me.toMass ) < amt ){ amt = me.mass - me.toMass; }
    if( me.toMass < me.mass ){ amt *= -1; }
    if( Math.abs( me.toMass - me.mass ) / me.toMass < 0.02 ){ me.mass = me.toMass; }    
    else{ me.mass += amt; }
}

function checkAfford( subj ){
    let u = upg[subj];
    let spend = me.toMass - massFloor;
    let cost = u.cost * Math.pow( u.scale, u.ranks );
    return cost <= spend;
}

function buyUpg( subj ){
    if( checkAfford( subj ) ){
        let u = upg[subj];
        me.toMass -= u.cost * Math.pow( u.scale, u.ranks );
        u.ranks++;
    }
    if( subj == `scale` ){
        doScaleThings();
    }    
}

function doScaleThings(){
    document.querySelector(`#myScale`).innerHTML = `Scale ${niceNumber(getStat(`scale`))}:1`;
    // TODO move jerks back when increasing scale
    for( let i = 0; i < jerks.length; i++ ){
        let j = jerks[i];
        j.x += j.xDir * 100;
        j.y += j.yDir * 100;
    }
}

function getCost( subj ){
    return upg[subj].cost * Math.pow( upg[subj].scale, upg[subj].ranks );
}

function getStat( stat ){
    let o = 0;
    if( me[stat] !== undefined ){
        o = me[stat] * Math.pow( upg[stat].benefit, upg[stat].ranks );
    }
    else{
        o = run[stat] * Math.pow( upg[stat].benefit, upg[stat].ranks );
    }
    return o;
}

function romanize (num) {
    if( isNaN(num) )
        return ``;
    var digits = String(+num).split(""),
        key = ["","C","CC","CCC","CD","D","DC","DCC","DCCC","CM",
               "","X","XX","XXX","XL","L","LX","LXX","LXXX","XC",
               "","I","II","III","IV","V","VI","VII","VIII","IX"],
        roman = "",
        i = 3;
    while (i--)
        roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("M") + roman;
}


/*

IDEAS
All vanilla features are monochrome
All upgrades add colour to the interface and canvas

General
Scale change using a "toScale" like "toMass"
Add gravity so your mass increases the speed of jerks towards you per second per second
Another laser (potentially multiple) that never target the same jerk except bosses
Upgrade jerks with body count instead of mass ?
Prestige mechanic, currency and upgrades
Handle game loss (and hung state ?)
Autobuyers which run every n seconds but blindly buy everything
- secondary upgrade to deselect autobuy per upgrade

Laser
COLD: Beam slows enemy while being fired at
LIGHTNING: Beam ricochets to nearby jerks
ENERGY: Cause an AOE explosion on jerk death
HEAT: Laser does more damage the closer the jerk gets


Me
Pulse damage when within certain range
Satelites
Moon/s ?
Shields which absorb damage before it harms you

Jerks
Bosses
- That shoot at you
Tough grunts
Antimatter jerks ?
Suns ??
Mass determined as a range rather than flat




*/