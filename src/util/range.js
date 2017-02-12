function Range(start, end)
{
	this.start = start;
	this.end   = end;
}


Range.prototype.clone = function()
{
	return new Range(this.start, this.end);
}


Range.prototype.merge = function(other)
{
	this.start = Math.min(this.start, other.start)
	this.end   = Math.max(this.end,   other.end);
}


Range.prototype.stretch = function(pivot, origin, delta)
{
	var start = stretch(this.start, pivot, origin, delta);
	var end   = stretch(this.end,   pivot, origin, delta);
	
	this.start = Math.min(start, end);
	this.end   = Math.max(start, end);
}


Range.prototype.clip = function(min, max)
{
	this.start = Math.max(this.start, min)
	this.end   = Math.min(this.end,   max);
}


Range.prototype.getClippedParts = function(clipRange)
{
	var parts = [];
	
	if (!this.overlapsRange(clipRange))
		parts.push(this.clone());
	else
	{
		if (clipRange.start > this.start)
			parts.push(new Range(this.start, clipRange.start));
		
		if (clipRange.end < this.end)
			parts.push(new Range(clipRange.end, this.end));
	}
	
	return parts;
}


Range.prototype.size = function()
{
	return this.end - this.start;
}


Range.prototype.overlapsPoint = function(point)
{
	return point > this.start && point < this.end;
}


Range.prototype.includesPoint = function(point)
{
	return point >= this.start && point < this.end;
}


Range.prototype.overlapsRange = function(other)
{
	return this.start < other.end && this.end > other.start;
}


Range.prototype.includedInRange = function(other)
{
	return this.start < other.end && this.end >= other.start;
}