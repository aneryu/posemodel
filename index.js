import * as posenet from '@tensorflow-models/posenet';
import dat from 'dat.gui';
import stats from './stats';
import loadVideo from './loadVideo';
import {drawKeypoints, drawSkeleton} from './utils';
import * as THREE from 'three';
import { layers } from '@tensorflow/tfjs';
window.THREE = THREE;
require('./GLTFLoader.js');
require('./OrbitControls.js');
const modalUrl = require('./RobotExpressive.glb');

function wait(t) {
    return new Promise(r => setTimeout(r, t));
}

let camera;
let scene;
let renderer;
let clock;
let mixer;
let model;
let controls;
let originPose;

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

const last =  window.last = {};

const locks = window.locks = {
    Head: true,
};

const object = window.object = {};
const origin = window.origin = {};
const origin2 = window.origin2 = {};
const length = window.length = {};
const readys = window.readys = {};
const angles = window.angles = {};

let minPartConfidence = 0.8;

async function updatePose(npose) {
    let [nose, leftEye, rightEye, leftEar, rightEar, leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle] = npose;
    let newPose = {nose, leftEye, rightEye, leftEar, rightEar, leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle};
    
    originPose = Object.values(newPose);
    
    Object.keys(pose).map(key => {
        let p = newPose[key];
        if (!p) {
            return;
        }
        if (p.score > minPartConfidence) {
            pose[key] = new THREE.Vector2(p.position.x, p.position.y);
        }
    });
    if (pose.leftHip && pose.rightHip) {
        pose.center = getCenter(pose.leftHip, pose.rightHip);
    }
}

window.unlockHead = function () {
    locks.Head = false;
    window.unlockHead = function() {};
};

function getCenter(p1, p2) {
    return new THREE.Vector2((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
}

let count = 0;
window.checkReady = function () {
    if (!pose.leftHip || !pose.rightHip) {
        return;
    }
    // let angle = new THREE.Vector2().subVectors(pose.leftHip, pose.rightHip).angle();
    let center = defibrillate('center');
    if (center === last.center) {
        count++;
    } else {
        count = 0;
    }
    if (count > 5) {
        showReady();
        count = 0;
    }
    
    // console.log(angle);
    // if (!locks.Head) {
    //     return;
    // }
    // if ([
    //     'nose',
    //     'leftEye',
    //     'rightEye',
    //     'leftEar',
    //     'rightEar'
    // ].every(e => pose[e])) {
    //     window.unlockHead();
    // }

    // if (window.ready) {
    //     last.nose = pose.nose;
    //     last.leftEye = pose.leftEye;
    //     last.rightEye = pose.rightEye;
    //     return;
    // }
    // if ([
    //     'nose',
    //     'leftEye',
    //     'rightEye',
    //     'leftEar',
    //     'rightEar',
    //     'leftShoulder',
    //     'rightShoulder',
    //     'leftElbow',
    //     'rightElbow',
    //     'leftWrist',
    //     'rightWrist',
    //     // 'leftKnee', 
    //     // 'rightKnee', 
    //     // 'leftAnkle', 
    //     // 'rightAnkle'
    // ].every(e => pose[e])) {
    //     console.log('ready');
    //     window.ready = true;
    // }
}

window.stop = function () {
    window.ready = false;
    window.checkReady = () => {};
}

window.showReady = function () {
    window.readyEl.classList.add('active');
    window.showReady = () => {};
};

async function init() {
    // await wait(10000);
    window.readyEl.addEventListener('transitionend', () => console.log(1) || readyEl.classList.remove('active'))

    const video = await loadVideo();
    const net = await posenet.load();
    const canvas = document.getElementById('output');
    canvas.width = 300;
    canvas.height = 250;
    const ctx = canvas.getContext('2d');
    let minPartConfidence = 0.5;

    async function refreshPose(time) {
        stats.begin();
        TWEEN.update(time);
        await updatePose((await net.estimateSinglePose(video, 1, true, 8)).keypoints);
        
        let dt = clock.getDelta();
        if ( mixer ) mixer.update( dt );
        
        updateHead(time);
        updateBody();
        updateArmL();
        updateArmR();

        if (originPose) {
            ctx.clearRect(0, 0, 600, 500);
            drawKeypoints(originPose, minPartConfidence, ctx);
            drawSkeleton(originPose, minPartConfidence, ctx);
        }
        renderer.render(scene, camera);
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

    
    let names = getBone(scene, []);
    for (let name of names) {
        object[name] = scene.getObjectByName(name);
        origin[name] = object[name].quaternion.clone();
    }

    let legHeight = object.Body.position.y;
    length.hip = object.UpperLegL.position.x * 2;
    // object.Body.position.set(0, 0, 0);
    origin2.Body = origin.Body;

    object.Head.quaternion.set(-0.0004230051726248802, 0.014537744856876672, -0.029081642508459328, 0.9994712267544827);
    object.UpperArmL.position.y = 0;
    object.UpperArmL.quaternion.set(0.5730939069771501, -0.8191740774928641, 0.020943043597471827, 0.00886714114718003);
    object.LowerArmL.quaternion.set(-0.0159900732374463, 0.6905463197368158, -0.033120564876520715, 0.7223525169657905);
    object.UpperArmR.position.y = 0;
    object.UpperArmR.quaternion.set(-0.5730939069771501, -0.8191740774928641, 0.020943043597471827, 0.00886714114718003);
    object.LowerArmR.position.x = 0.0002;
    object.LowerArmR.quaternion.set(-0.08876987551035145, -0.6406316196435936, 0.0847015956183325, 0.7579819463133176);

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

window.setObject = function setObject(objectName, x, y, z, a) {
    let _q1 = origin2[objectName].clone();
    let _q2 = new THREE.Quaternion();
    _q2.setFromAxisAngle(new THREE.Vector3(x, y, z), a);
    
    object[objectName].quaternion.copy(_q1);
    object[objectName].applyQuaternion(_q2);
}

function defibrillate(name, minDistance = 0.5) {
    let prev = last[name];
    let current = pose[name];
    if (prev && current.distanceTo(prev) < minDistance) {
        current = prev;
    } else {
        last[name] = current;
    }
    return current;
}

function setBodyBase() {
    console.log('setBodyBase');
    if (!readys.body) {
        window.showReady();
        readys.body = true;
    }
    length.poseHip = pose.leftHip.x - pose.rightHip.x;
    length.poseShoulder = pose.leftShoulder.x - pose.rightShoulder.x;
    length.poseLeg = ((pose.leftKnee.y - pose.leftHip.y) + (pose.rightKnee.y - pose.rightHip.y)) / 2;
    origin.center = pose.center.clone();
}
function updateBody(t) {
    if (!pose.leftHip || !pose.rightHip || !pose.leftShoulder || !pose.rightShoulder) {
        return;
    }
    // let angle = new THREE.Vector2().subVectors(pose.leftHip, pose.rightHip).angle();
    let center = defibrillate('center');
    if (center === last.center) {
        count++;
    } else {
        count = 0;
    }
    if (count > (readys.body ? 50 : 5)) {
        setBodyBase();
        count = 0;
    }

    if (!readys.body) {
        return;
    }

    let axisAngle = new THREE.Vector2().subVectors(getCenter(pose.leftHip, pose.rightHip), getCenter(pose.leftShoulder, pose.rightShoulder)).angle();
    angles.axis = axisAngle - (Math.PI / 2);

    let jumpHeight = pose.center.y - origin.center.y;
    // console.log(jumpHeight);
    let diffy = Math.tan(angles.axis) * length.hip * Math.sign(angles.axis);
    object.Body.position.y = length.hip * jumpHeight / length.poseHip + diffy;

    

    setObject('Body', 0, 0, 1, -angles.axis);
    let q = new THREE.Quaternion();
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angles.axis);

    origin2.UpperArmL = origin.UpperArmL.clone().multiply(q);
    origin2.LowerArmL = origin.LowerArmL.clone().multiply(q);
    origin2.UpperArmR = origin.UpperArmR.clone().multiply(q);
    origin2.LowerArmR = origin.LowerArmR.clone().multiply(q);

    

    origin2.UpperLegL = origin.UpperLegL.clone();
    setObject('UpperLegL', 0, 0, 1, angles.axis);
    origin2.UpperLegL = object.UpperLegL.quaternion.clone();

    origin2.UpperLegR = origin.UpperLegR.clone();
    setObject('UpperLegR', 0, 0, 1, angles.axis);
    origin2.UpperLegR = object.UpperLegR.quaternion.clone();

    // setObject('updateLegL', 0, 0, 1, -angles.axis);
    // setObject('updateLegL', 0, 0, 1, -angles.axis);

    // console.log(angles.axis / Math.PI * 180);
    let poseLeftLeg = pose.leftKnee.y - pose.leftHip.y;
    angles.leftLeg = Math.acos(poseLeftLeg / length.poseLeg);
    if (isNaN(angles.leftLeg)) {
        angles.leftLeg = 0;
    }
    let poseRightLeg = pose.rightKnee.y - pose.rightHip.y;
    angles.rightLeg = Math.acos(poseRightLeg / length.poseLeg);
    if (isNaN(angles.rightLeg)) {
        angles.rightLeg = 0;
    }
    setObject('UpperLegR', 1, 0, 0, -angles.rightLeg);
    // origin2.LowerLegL = object.LowerLegL.quaternion.clone();
    // setObject('LowerLegL', 1, 0, 0, angles.leftLeg);

    // console.log(angles.leftLeg / Math.PI * 180);
}

function updateHead(t) {
    // console.log(t);
    let nose = defibrillate('nose');
    let leftEar = defibrillate('leftEar');
    let rightEar = defibrillate('rightEar');
    let leftShoulder = defibrillate('leftShoulder');
    let rightShoulder = defibrillate('rightShoulder');

    if (!nose || !leftEar || !rightEar || locks.Head) {
        // console.log('no ready');
        return;
    }

    if (last.nose === nose && last.leftEar === leftEar && last.rightEar === rightEar) {
        console.log('no change');
        return;
    }

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
    if (!readys.body) {
        return;
    }
    let {leftShoulder, leftElbow, leftWrist} = pose;
    if (!leftShoulder || !leftElbow || !leftWrist) {
        return;
    }
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
    if (!readys.body) {
        return;
    }
    let {rightShoulder, rightElbow, rightWrist} = pose;
    if (!rightShoulder || !rightElbow || !rightWrist) {
        return;
    }
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
