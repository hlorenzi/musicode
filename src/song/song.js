function Song()
{
	this.ticksPerWholeNote = 960;
	this.lengthInTicks = 0;
	this.tracks = [];
	this.chords = [];
	this.keys   = [];
	this.meters = [];
}


Song.prototype.setLengthInTicks = function(ticks)
{
	this.lengthInTicks = ticks;
}


Song.prototype.noteAdd = function(track, note)
{
	if (this.tracks[track] == undefined)
		this.tracks[track] = [];
	
	this.tracks[track].push(note);
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