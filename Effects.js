
String.prototype.contains = function(str) { return this.indexOf(str) != -1; };
Array.prototype.contains = function(str) { return this.indexOf (str) != -1;};

var octave = 0;
var echo = 0;
var echomulti = 0.65;
var echochange = false;
var fill = false;
var delay = 50;

function sendChat(msg){
	MPP.chat.send(msg);
}

var enabled = true;

// keyboard detection stuff
// this part is nabbed from script.js

$(document).on("keydown", handleKeyDown );
$(document).on("keyup", handleKeyUp);
var Note = function(note, octave) {
	this.note = note;
	this.octave = octave || 0;
};
	var mx = 0, last_mx = -10, my = 0, last_my = -10;

$(document).mousemove(function(event) {
	mx = ((event.pageX / $(window).width()) * 100).toFixed(2);
	my = ((event.pageY / $(window).height()) * 100).toFixed(2);
});
var n = function(a, b) { return {note: new Note(a, b), held: false}; };
var key_binding = {
	65: n("gs"),
	90: n("a"),
	83: n("as"),
	88: n("b"),
	67: n("c", 1),
	70: n("cs", 1),
	86: n("d", 1),
	71: n("ds", 1),
	66: n("e", 1),
	78: n("f", 1),
	74: n("fs", 1),
	77: n("g", 1),
	75: n("gs", 1),
	188: n("a", 1),
	76: n("as", 1),
	190: n("b", 1),
	191: n("c", 2),
	222: n("cs", 2),
	
	49: n("gs", 1),
	81: n("a", 1),
	50: n("as", 1),
	87: n("b", 1),
	69: n("c", 2),
	52: n("cs", 2),
	82: n("d", 2),
	53: n("ds", 2),
	84: n("e", 2),
	89: n("f", 2),
	55: n("fs", 2),
	85: n("g", 2),
	56: n("gs", 2),
	73: n("a", 2),
	57: n("as", 2),
	79: n("b", 2),
	80: n("c", 3),
	189: n("cs", 3),
	173: n("cs", 3), // firefox why
	219: n("d", 3),
	187: n("ds", 3),
	61: n("ds", 3), // firefox why
	221: n("e", 3)
};
var velocityFromMouseY = function() {
	return 0.1 + (my / 100) * 0.6;
};
var transpose_octave = 0;
var sustain = false;

// notes in recorded/temprecorded arrays are stored by this format per element: [note-type, note-name, note-volume, note-offset-from-timer]
// note-type: on,off
// note-name: the name of the note, already handled by the key_binding object, if you have another layout you might want to change this as well
// note-volume: 0 to 1
// note-offset-from-timer: time in millisecond from start of recording till note press/release

function handleKeyDown(evt){
	if ($("#chat").hasClass("chatting"))
		return;
	var code = parseInt(evt.keyCode);
	if(key_binding[code] !== undefined) {
		var binding = key_binding[code];
		if (binding.held)
			return;
		binding.held = true;
		var note = binding.note;
		var vol = velocityFromMouseY();
		var octaveadded = 0;
		if(evt.shiftKey) ++octaveadded;
		else if(evt.ctrlKey) --octaveadded;
		var nt = note.note + (1 + note.octave +transpose_octave+octaveadded);
		// record note press
		if (enabled){
			var type = "on";
			triggernote(type,nt,vol);
		}
		
	} else if((code === 38 || code === 39) && transpose_octave < 3) {
		++transpose_octave;
	} else if((code === 40 || code === 37) && transpose_octave > -2) {
		--transpose_octave;
	}
	else if(code == 9) { // Tab (don't tab away from the piano)
		evt.preventDefault();
	}
	else if(code == 8) { // Backspace (don't navigate Back)
		sustain = !sustain;
		evt.preventDefault();
	}
}
function handleKeyUp(evt){
	if ($("#chat").hasClass("chatting"))
		return;
	var code = parseInt(evt.keyCode);
	if(key_binding[code] !== undefined) {
		var binding = key_binding[code];
		if(!binding.held)
			return;
		binding.held = false;
		var note = binding.note;
		var vol = velocityFromMouseY();
		var octaveadded = 0;
		if(evt.shiftKey) ++octaveadded;
		else if(evt.ctrlKey) --octaveadded;
		var nt = note.note + (1 + note.octave +transpose_octave+octaveadded);
		// record note releases and ignore if sustain is enabled
		if (enabled){
			if (sustain)
				return;
			var type = "off";
			triggernote(type,nt,vol);
		}
		
	}
	else if(code == 9) { // Tab (don't tab away from the piano)
		evt.preventDefault();
	}
}

// attempting midi stuff


// Check if browser can request midi access
if (navigator.requestMIDIAccess) {
    console.log('MIDI is supported on this browser!');
	
	navigator.requestMIDIAccess().then(
	function(midiAccess){
		// loop through all midi inputs and register a midi message handler for each
		for (var input of midiAccess.inputs.values()){
			input.onmidimessage = midiMessageReceived;
		};
	},function(){console.log("Failed to access midi devices!");});
	
} else {
    console.log('MIDI is not supported on this browser');
}

function midiMessageReceived(msg) {
    //console.log(msg);
	var data = msg.data;
	// type of data received, 144 = note on, 128 = note off
	var type = data[0];
	// midi key id 0 - 127, 21 is the lowest A note
	var id = data[1];
	// midi velocity ranges from 0 to 127
	var vel = data[2]/127;
	
	var noteon = type == 144;
	// as I read sometimes vel 0 can mean note-off msg
	var noteoff = (type == 128) || (vel == 0);
	
	var note = Object.keys(MPP.piano.keys)[id-21];
	
	if (note === undefined)
		return;
	
	if (noteon){
		// record note press
		if (enabled){
			triggernote("on",note,vel);
		}
	}
	else if (noteoff){
		// record note releases and ignore if sustain is enabled
		if (enabled){
			if (sustain)
				return;
			triggernote("off",note,vel);
		}
	}
	
}
function playNote(id,vel){
	if (Object.keys(MPP.piano.keys)[id] === undefined) return;
	MPP.press(Object.keys(MPP.piano.keys)[id],vel);
}
function stopNote(id){
	if (Object.keys(MPP.piano.keys)[id] === undefined) return;
	MPP.release(Object.keys(MPP.piano.keys)[id]);
}
function triggernote(type,note,vel){
	var noteid = Object.keys(MPP.piano.keys).indexOf(note);
	if (type == "on"){
		
		for (var i = 0; i <= octave; i++){
			if (!fill && i != octave && i != 0) continue;
			for (var j = 1; j <= echo; j++){
				setTimeout(playNote, j*delay, noteid - 12*i, echochange ? (vel*(Math.pow(echomulti,j))):vel);
			}
			if (i == 0) continue;
			playNote(noteid - 12*i,vel);
		}
	}
	else if (type == "off"){
		for (var i = 1; i <= octave; i++){
			if (!fill && i != octave){
				continue;
			}
			stopNote(noteid - 12*i);
		}
	}
}

MPP.client.on("a", function (msg) {
	var args = msg.a.split(' ');
	var cmd = args[0];
	var input = msg.a.substring(cmd.length).trim();
	var isAdmin = (msg.p._id == MPP.client.user._id);
	if (!isAdmin){
		return;
	}
	if (cmd == "/js"){
		try {
			sendChat("Output: " + eval(input));
		} catch (err) {
			if (err != "Output: undefined"){
				sendChat(''+err);
			}
		}	
	}
});
