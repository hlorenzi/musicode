function Song()
{
	this.length = new Rational(0);
	this.notes  = [];
	this.chords = [];
	this.keys   = [];
	this.meters = [];
	this.measures = [];
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