function SongChord(startTick, endTick, chordKindIndex, rootMidiPitch, embelishments)
{
	this.startTick      = startTick;
	this.endTick        = endTick;
	this.chordKindIndex = chordKindIndex;
	this.rootMidiPitch  = rootMidiPitch;
	this.embelishments  = embelishments;
}


SongChord.prototype.clone = function()
{
	return new SongChord(
		this.startTick.clone(),
		this.endTick.clone(),
		this.chordKindIndex,
		this.rootMidiPitch,
		this.embelishments);
}