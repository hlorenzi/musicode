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


SongMeter.prototype.getMeasureLength = function()
{
	return new Rational(
		0,
		this.numerator,
		this.denominator);
}


SongMeter.prototype.getBeatLength = function()
{
	return new Rational(
		0,
		1,
		this.denominator);
}


SongMeter.prototype.getLabel = function()
{
	return Theory.getMeterLabel(this.numerator, this.denominator);
}