var aStream, mediaRecorder, recordedBlobs, sourceBuffer, mediaSource;
var format = 'video/webm';

window.setupRecording = function setupRecording() {
    mediaSource = new MediaSource();
    mediaSource.addEventListener('sourceopen', handleSourceOpen, false);
}

function handleSourceOpen(event) {
    console.log('MediaSource opened');
    sourceBuffer = mediaSource.addSourceBuffer(format + 'codecs="vp8"');
    console.log('Source buffer: ', sourceBuffer);
}

function handleDataAvailable(event) {
    if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
    }
}

function handleStop(event) {
    console.log('Recorder stopped: ', event);
}

window.startRecording = function startRecording() {
    recordedBlobs = [];
    var options = {mimeType: format + ';codecs=vp9'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log(options.mimeType + ' is not Supported');
        options = {mimeType:  format+ ';codecs=vp8'};
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.log(options.mimeType + ' is not Supported');
            options = {mimeType: format};
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
               console.log(options.mimeType + ' is not Supported');
                options = {mimeType: ''};
            }
        }
    }
    try {
        var s = window.result.captureStream(); // frames per second
        s.addTrack(stream.getAudioTracks()[0]);
        s.addTrack(video2.captureStream().getAudioTracks()[0]);
        console.log('Started stream capture from canvas element: ', s);
        mediaRecorder = new MediaRecorder(s, options);
    } catch (e) {
        console.error('Exception while creating MediaRecorder: ' + e);
        alert('Exception while creating MediaRecorder: '
            + e + '. mimeType: ' + options.mimeType);
        return;
    }
    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    mediaRecorder.onstop = handleStop;
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.start(10); // collect 10ms of data
    console.log('MediaRecorder started', mediaRecorder);
}

window.stopRecording = function stopRecording() {
    mediaRecorder.stop();
    if (format !== 'image/gif') {
        console.log('Recorded Blobs: ', recordedBlobs);
    }
}

window.download = function download() {
    var blob = new Blob(recordedBlobs, {type: format});
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    var name = 'test' + format.substr(format.indexOf('/'), format.length);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
}
