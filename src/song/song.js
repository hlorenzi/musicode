function Song()
{
	this.length = new Rational(0);
	this.notes  = [];
	this.chords = [];
	this.keys   = [];
	this.meters = [];
	this.measures = [];
	
	// TODO: Should be changeable
	// throughout the music.
	this.bpm = 120;
}


Song.prototype.setLength = function(ticks)
{
	this.length = ticks;
}


Song.prototype.noteAdd = function(note)
{
	this.notes.push(note);
}


Song.prototype.chordAdd = function(chord)
{
	this.chords.push(chord);
}


Song.prototype.keyAdd = function(key)
{
	this.keys.push(key);
}


Song.prototype.meterAdd = function(meter)
{
	this.meters.push(meter);
}


Song.prototype.measureAdd = function(tick)
{
	this.measures.push(tick);
}


Song.prototype.feedSynth = function(synth, startTick)
{
	// Add notes.
	for (var i = 0; i < this.notes.length; i++)
	{
		var note = this.notes[i];
		
		if (note.midiPitch == null)
			continue;
		
		if (note.endTick.compare(startTick) <= 0)
			continue;
		
		var offsetStart = note.startTick.clone().subtract(startTick);
		var offsetEnd = note.endTick.clone().subtract(startTick);
		
		var timeStart = offsetStart.asFloat() * (1000 / this.bpm / 4);
		var timeEnd = offsetEnd.asFloat() * (1000 / this.bpm / 4);
		
		synth.addNoteOn(timeStart, 0, note.midiPitch, 1);
		synth.addNoteOff(timeEnd - 0.01, 0, note.midiPitch);
	}
	
	// Add chords.
	for (var i = 0; i < this.chords.length; i++)
	{
		var chord = this.chords[i];
		
		if (chord.endTick.compare(startTick) <= 0)
			continue;
		
		var pitches = Theory.calculateChordPitches(chord);
		
		for (var j = 0; j < pitches.length; j++)
		{
			var offsetStart = chord.startTick.clone().subtract(startTick);
			var offsetEnd = chord.endTick.clone().subtract(startTick);
			
			var timeStart = offsetStart.asFloat() * (1000 / this.bpm / 4);
			var timeEnd = offsetEnd.asFloat() * (1000 / this.bpm / 4);
			
			synth.addNoteOn(timeStart, 1, pitches[j], 1);
			synth.addNoteOff(timeEnd - 0.01, 1, pitches[j], 1);
		}
	}
}