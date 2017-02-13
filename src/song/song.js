function Song()
{
	this.length = new Rational(0);
	this.tracks = [];
	this.chords = [];
	this.keys   = [];
	this.meters = [];
	this.forcedMeasures = [];
}


Song.prototype.setLength = function(ticks)
{
	this.length = ticks;
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


Song.prototype.forcedMeasureAdd = function(tick)
{
	this.forcedMeasures.push(tick);
}