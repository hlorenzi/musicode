function SongNote(startTick, endTick, trackIndex, midiPitch)
{
	this.startTick  = startTick;
	this.endTick    = endTick;
	this.trackIndex = trackIndex;
	this.midiPitch  = midiPitch;
}


SongNote.prototype.clone = function()
{
	return new SongNote(this.startTick.clone(), this.endTick.clone(), this.trackIndex, this.midiPitch);
}