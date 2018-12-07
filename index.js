import * as posenet from '@tensorflow-models/posenet';
import dat from 'dat.gui';
import stats from './stats';
import loadVideo from './loadVideo';
import {drawKeypoints, drawSkeleton} from './utils';
require('./GLTFLoader.js');
require('./OrbitControls.js');
const modalUrl = require('./RobotExpressive.glb');

let camera;
let scene;
let renderer;
let clock;
let mixer;
let gltf;
let model;
let controls;
let Head;
let ShoulderL;
let ShoulderR;
let UpperArmL;
let UpperArmR;
let LowerArmL;
let LowerArmR;
let originPose;

let originUpperArmLQ;
let originLowerArmLQ;
let originUpperArmRQ;
let originLowerArmRQ;

let upperArmLeftLength = 0;
let upperArmRightLength = 0;
let lowerArmLeftLength = 0;
let lowerArmRightLength = 0;

const pose = {
    nose: undefined,
    leftEye: undefined,
    rightEye: undefined,
    leftEar: undefined,
    rightEar: undefined,
    leftShoulder: undefined,
    rightShoulder: undefined,
    leftElbow: undefined,
    rightElbow: undefined,
    leftWrist: undefined,
    rightWrist: undefined,
    leftHip: undefined,
    rightHip: undefined,
    leftKnee: undefined,
    rightKnee: undefined,
    leftAnkle: undefined,
    rightAnkle: undefined,
};

const radius = {
    UpperArmLeft: 0,
    LowerArmLeft: 0,
    UpperArmRight: 0,
    LowerArmRight: 0,
};

const last =  window.last = {};

const locks = window.locks = {
    Head: true,
};

const object = window.object = {};

const origin = window.origin = {};

let minPartConfidence = 0.5;

function distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

async function updatePose(npose) {
    let [nose, leftEye, rightEye, leftEar, rightEar, leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle] = npose;
    let newPose = {nose, leftEye, rightEye, leftEar, rightEar, leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle};
    
    originPose = Object.values(newPose);
    
    Object.keys(pose).map(key => {
        let p = newPose[key];
        if (p.score > minPartConfidence) {
            pose[key] = p.position;
        }
    });
}

window.unlockHead = function () {
    locks.Head = false;
    window.unlockHead = function() {};
};

window.checkReady = function () {
    if ([
        'nose',
        'leftEye',
        'rightEye',
        'leftEar',
        'rightEar'
    ].every(e => pose[e])) {
        window.unlockHead();
    }

    if (window.ready) {
        last.nose = pose.nose;
        last.leftEye = pose.leftEye;
        last.rightEye = pose.rightEye;
        return;
    }
    if ([
        'nose',
        'leftEye',
        'rightEye',
        'leftEar',
        'rightEar',
        'leftShoulder',
        'rightShoulder',
        'leftElbow',
        'rightElbow',
        'leftWrist',
        'rightWrist',
        // 'leftKnee', 
        // 'rightKnee', 
        // 'leftAnkle', 
        // 'rightAnkle'
    ].every(e => pose[e])) {
        console.log('ready');
        window.ready = true;
    }
}

window.stop = function () {
    window.ready = false;
    window.checkReady = () => {};
}

function updateRadius() {
    let newUpperArmLeft = distance(pose.leftShoulder, pose.leftElbow);
    if (radius.UpperArmLeft < newUpperArmLeft) {
        radius.UpperArmLeft = newUpperArmLeft;
    }
    let newLowerArmLeft = distance(pose.leftElbow, pose.leftWrist);
    if (radius.LowerArmLeft < newLowerArmLeft) {
        radius.LowerArmLeft = newLowerArmLeft;
    }
}

async function init() {
    const video = await loadVideo();
    const net = await posenet.load();
    const canvas = document.getElementById('output');
    canvas.width = 300;
    canvas.height = 250;

    const ctx = canvas.getContext('2d');
    let minPartConfidence = 0.5;
    let i = 0;

    async function refreshPose(time) {
        stats.begin();
        TWEEN.update(time);
        await updatePose((await net.estimateSinglePose(video, 0.5, true, 16)).keypoints);
        window.checkReady();
        let dt = clock.getDelta();
        if ( mixer ) mixer.update( dt );
        if (!locks.Head) {
            updateHead();

            let leftFaceLength = distance(pose.nose, pose.leftEar);
            let rightFaceLength = distance(pose.nose, pose.rightEar);

            let ratio = leftFaceLength / rightFaceLength;
            // console.log(ratio);
            if (ratio > 5) {
                console.log('left');
                anmiationTurnHead(-1);
            } else if (ratio < 0.1) {
                anmiationTurnHead(1);
                console.log('right');
            }
            last.leftFaceLength = leftFaceLength;
            last.rightFaceLength = rightFaceLength;

            // console.log(pose.leftEar, pose.rightEar);
        }

        if (window.ready) {
            updateRadius();

            
            updateArmL();
            updateArmR();
            // updateLegL();
            // updateLegR();
        }
    
        if (originPose) {
            ctx.clearRect(0, 0, 600, 500);
            drawKeypoints(originPose, minPartConfidence, ctx);
            drawSkeleton(originPose, minPartConfidence, ctx);
        }
        
        renderer.render( scene, camera );
    
        stats.end();
        requestAnimationFrame(refreshPose);
    }

    requestAnimationFrame(refreshPose);
}

function initModal() {
    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.25, 100 );
    camera.position.set(0, 3, 10 );
    camera.lookAt( new THREE.Vector3( 0, 1, 0 ) );

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xe0e0e0 );
    scene.fog = new THREE.Fog( 0xe0e0e0, 20, 100 );

    clock = new THREE.Clock();

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.gammaOutput = true;
    renderer.gammaFactor = 2.2;
    document.body.appendChild( renderer.domElement );

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    // lights

    var light = new THREE.HemisphereLight( 0xffffff, 0x444444 );
    light.position.set( 0, 20, 0 );
    scene.add( light );

    light = new THREE.DirectionalLight( 0xffffff );
    light.position.set( 0, 20, 10 );
    scene.add( light );

    // ground

    var mesh = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2000, 2000 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
    mesh.rotation.x = - Math.PI / 2;
    scene.add( mesh );

    var grid = new THREE.GridHelper( 200, 40, 0x000000, 0x000000 );
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add( grid );
}

init();
initModal();

var loader = new THREE.GLTFLoader();

function getBone(obj, result = []) {
    if (obj.type === 'Bone') {
        result.push(obj.name);
    }
    obj.children && obj.children.map(e => {
        getBone(e, result);
    });
    return result;
}

loader.load(modalUrl, function( _gltf ) {
    console.log(_gltf);
    model = _gltf.scene;
    scene.add( model );
    gltf = _gltf;

    
    let names = getBone(scene, []);
    for (let name of names) {
        object[name] = scene.getObjectByName(name);
        origin[name] = object[name].quaternion.clone();
    }

    object.Head.quaternion.set(-0.0004230051726248802, 0.014537744856876672, -0.029081642508459328, 0.9994712267544827);
    object.UpperArmL.position.y = 0;
    object.UpperArmL.quaternion.set(0.5730939069771501, -0.8191740774928641, 0.020943043597471827, 0.00886714114718003);
    object.LowerArmL.quaternion.set(-0.0159900732374463, 0.6905463197368158, -0.033120564876520715, 0.7223525169657905);
    object.UpperArmR.position.y = 0;
    object.UpperArmR.quaternion.set(-0.5730939069771501, -0.8191740774928641, 0.020943043597471827, 0.00886714114718003);
    object.LowerArmR.position.x = 0.0002;
    object.LowerArmR.quaternion.set(-0.08876987551035145, -0.6406316196435936, 0.0847015956183325, 0.7579819463133176);

    // origin.UpperArmL = object.UpperArmL.quaternion.clone();
    // origin.LowerArmL = object.LowerArmL.quaternion.clone();
    // origin.UpperArmR = object.UpperArmR.quaternion.clone();
    // origin.LowerArmR = object.LowerArmR.quaternion.clone();

    object.LowerLegL.add(object.FootL);
    object.LowerLegR.add(object.FootR);

    object.FootL.position.x = 0;
    object.FootL.position.y = 0.009;
    object.FootL.position.z = 0.001;
    object.FootR.position.x = 0;
    object.FootR.position.y = 0.009;
    object.FootR.position.z = 0.001;
    let q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 36 * 32);
    object.FootL.applyQuaternion(q);
    object.FootR.applyQuaternion(q);

    // setObject('ShoulderL', 0, -1, 0, Math.PI / 4);
    // setObject('ShoulderR', 0, 1, 0, Math.PI / 4);

    for (let name of ['Head', 'UpperArmL', 'LowerArmL', 'UpperArmR', 'LowerArmR', 'ShoulderL', 'ShoulderR', 'FootL', 'FootR']) {
        origin[name] = object[name].quaternion.clone();
    }

    mixer = new THREE.AnimationMixer( model );

    var material = new THREE.LineBasicMaterial( { color: 0x0000ff } );
    var geometry = new THREE.Geometry();
    geometry.vertices.push(new THREE.Vector3( -10, 0, 0) );
    geometry.vertices.push(new THREE.Vector3( 0, 10, 0) );
    geometry.vertices.push(new THREE.Vector3( 10, 0, 0) );
    var line = new THREE.Line( geometry, material );
    scene.add( line );
});

function setObject(objectName, x, y, z, a) {
    let _q1 = origin[objectName].clone();
    let _q2 = new THREE.Quaternion();
    _q2.setFromAxisAngle(new THREE.Vector3(x, y, z), a);
    
    object[objectName].quaternion.copy(_q1);
    object[objectName].applyQuaternion(_q2);
}

function updateHead() {
    let {nose, leftEar, rightEar} = pose;
    let a = rightEar.y - leftEar.y;
    let b = leftEar.x - rightEar.x;
    let c = rightEar.x * leftEar.y - leftEar.x * rightEar.y;
    let d = (a * nose.x + b * nose.y + c ) / Math.sqrt(a * a + b * b);
    let x = (b * b * nose.x - a * b * nose.y - a * c) / (a * a + b * b);
    let y = (-a * b * nose.x + a * a * nose.y - b * c) / (a * a + b * b);
    let r2 = Math.sqrt(Math.pow(leftEar.x - rightEar.x, 2) + Math.pow(leftEar.y - rightEar.y, 2)) / 2;
    let m = {
        x: (leftEar.x + rightEar.x) / 2,
        y: (leftEar.y + rightEar.y) / 2
    };
    let dd = Math.sign(nose.x - m.x) * Math.sqrt(Math.pow(m.x - nose.x, 2) + Math.pow(m.y - nose.y, 2)) / 2;
    let r = Math.sqrt(Math.pow(dd, 2) + Math.pow(r2, 2));
    let xarc = Math.asin(d / r);
    let yarc = Math.atan(dd / r2);
    let xq = new THREE.Quaternion();
    xq.setFromAxisAngle(new THREE.Vector3(1, 0, 0), xarc);
    let yq = new THREE.Quaternion();
    yq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yarc);
    let outq = xq.multiply(yq);
    object.Head.quaternion.set(outq.x, outq.y, outq.z, outq.w);
}


function updateArmL() {
    let {leftShoulder, leftElbow, leftWrist} = pose;
    let ux = (leftElbow.x - leftShoulder.x);
    let uy = (leftElbow.y - leftShoulder.y);
    let r = Math.sqrt(Math.pow(ux, 2) + Math.pow(uy, 2));
    let uangle = new THREE.Vector2(ux, uy).angle();

    let lx = leftWrist.x - leftElbow.x;
    let ly = leftWrist.y - leftElbow.y;
    let r2 = Math.sqrt(Math.pow(lx, 2) + Math.pow(ly, 2));
    let langle = new THREE.Vector2(lx, ly).angle();

    setObject('UpperArmL', -uy / r, ux / r, 1, -uangle);
    // let q = new THREE.Quaternion();
    // q.setFromAxisAngle(new THREE.Vector3(-uy / Math.abs(uy), ux / Math.abs(uy), 0), Math.PI / 4);
    // object.UpperArmL.applyQuaternion(q);

    setObject('LowerArmL', 0, 0, 1, -uangle + langle);
    // let r2 = Math.pow(lx, 2) + Math.pow(ly, 2);
    // let q2 = new THREE.Quaternion();
    // q2.setFromAxisAngle(new THREE.Vector3(-ly / Math.abs(ly), lx / Math.abs(ly), 0), Math.PI / 4);
    // object.UpperArmL.applyQuaternion(q2);
}

function updateArmR() {
    let {rightShoulder, rightElbow, rightWrist} = pose;
    let ux = -(rightElbow.x - rightShoulder.x);
    let uy = -(rightElbow.y - rightShoulder.y);
    let r = Math.sqrt(Math.pow(ux, 2) + Math.pow(uy, 2));
    let uangle = new THREE.Vector2(ux, uy).angle();

    let lx = rightWrist.x - rightElbow.x;
    let ly = rightWrist.y - rightElbow.y;
    let langle = new THREE.Vector2(-lx, -ly).angle();

    setObject('UpperArmR', -uy / r, ux / r, 1, -uangle);
    setObject('LowerArmR', 0, 0, 1, -uangle + langle);
}

function updateLegL() {
    let {leftHip, leftKnee, leftAnkle} = pose;
    let ux = (leftKnee.x - leftHip.x);
    let uy = (leftKnee.y - leftHip.y);
    let uangle = ux === 0 ? 0 : Math.atan(ux / uy);
    
    let lx = leftAnkle.x - leftKnee.x;
    let ly = leftKnee.y - leftAnkle.y;
    let langle = lx === 0 ? 0 : Math.atan(lx / ly);
    
    setObject('UpperLegL', 0, 0, 1, uangle);
    setObject('LowerLegL', 0, 0, 1, uangle - langle);
}

function updateLegR() {
    let {rightHip, rightKnee, rightAnkle} = pose;
    let ux = (rightKnee.x - rightHip.x);
    let uy = (rightKnee.y - rightHip.y);
    let uangle = ux === 0 ? 0 : Math.atan(ux / uy);
    
    let lx = rightAnkle.x - rightKnee.x;
    let ly = rightAnkle.y - rightKnee.y;
    let langle = lx === 0 ? 0 : Math.atan(lx / ly);
    
    setObject('UpperLegR', 0, 0, 1, -uangle);
    setObject('LowerLegR', 0, 0, 1, -uangle + langle);
}

function anmiationTurnHead(sign) {
    let t = {a: 0};
    locks.Head = true;
    new TWEEN.Tween(t).to({a: sign * Math.PI * 2}, 1000)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(function () {
            // console.log(1);
            setObject('Head', 0, 1, 0, t.a);
        })
        .onComplete(function () {
            // console.log('onComplete');
            locks.Head = false;
        })
        .start();
}

window.anmiationTurnHead = anmiationTurnHead;

if (module.hot) {
    module.hot.dispose(function() {
        // 模块即将被替换时
        console.log('dispose');
    });
  
    module.hot.accept(function() {
        // 模块或其依赖项之一刚刚更新时
        console.log('dispose');
    });
}
