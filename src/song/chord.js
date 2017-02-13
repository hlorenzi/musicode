function SongChord(startTick, endTick, chordIndex, rootMidiPitch)
{
	this.startTick     = startTick;
	this.endTick       = endTick;
	this.chordIndex    = chordIndex;
	this.rootMidiPitch = rootMidiPitch;
}


SongChord.prototype.clone = function()
{
	return new SongChord(this.startTick.clone(), this.endTick.clone(), this.chordIndex, this.rootMidiPitch);
}