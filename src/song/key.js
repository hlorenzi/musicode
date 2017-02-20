function SongKey(tick, scaleIndex, tonicMidiPitch)
{
	this.tick           = tick;
	this.scaleIndex     = scaleIndex;
	this.tonicMidiPitch = tonicMidiPitch;
}


SongKey.prototype.clone = function()
{
	return new SongKey(
		this.tick.clone(),
		this.scaleIndex,
		this.tonicMidiPitch);
}


SongKey.prototype.getLabel = function()
{
	return Theory.getKeyLabel(this.scaleIndex, this.tonicMidiPitch);
}