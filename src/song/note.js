function SongNote(startTick, endTick, midiPitch)
{
	this.startTick = startTick;
	this.endTick   = endTick;
	this.midiPitch = midiPitch;
}


SongNote.prototype.clone = function()
{
	return new SongNote(this.startTick.clone(), this.endTick.clone(), this.midiPitch);
}