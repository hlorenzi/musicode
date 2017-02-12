function SongMeter(tick, numerator, denominator)
{
	this.tick        = tick;
	this.numerator   = numerator;
	this.denominator = denominator;
}


SongMeter.prototype.clone = function()
{
	return new SongMeter(
		this.tick.clone(),
		this.numerator,
		this.denominator);
}