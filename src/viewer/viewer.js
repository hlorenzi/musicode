function Viewer(svg)
{
	this.svg = svg;
	this.song = null;
	
	this.width = 0;
	this.height = 0;
	
	this.margin = 10;
	this.wholeTickWidth = 100;
}


Viewer.prototype.setSong = function(song)
{
	this.song = song;
	this.refresh();
}


Viewer.prototype.refresh = function()
{
	// Update dimensions.
	this.width = this.svg.clientWidth;
	this.height = this.svg.clientHeight;
	
	// Clear SVG elements.
	while (this.svg.lastChild)
		this.svg.removeChild(this.svg.lastChild);
	
	// Early return if no song.
	if (this.song == null)
		return;
	
	// Sort song elements by tick.
	this.song.keys.sort(function (a, b) { return a.tick.compare(b.tick); });
	this.song.meters.sort(function (a, b) { return a.tick.compare(b.tick); });
	this.song.forcedMeasures.sort(function (a, b) { return a.compare(b); });
	
	// Prepare work data structure.
	var data =
	{
		// Updated by refreshRow, stores state
		// between calls to it.
		currentTick: new Rational(0),
		nextMeter: 1,
		nextForcedMeasure: 0,
		
		unterminatedNotes: [],
		y: this.margin
	};
	
	// Keep creating rows while song is not over.
	while (data.currentTick.compare(this.song.length) < 0)
	{
		this.refreshRow(data);
	}
	
	// Resize SVG element for vertical scrolling to work.
	this.svg.style.height = data.y + this.margin;
}


Viewer.prototype.refreshRow = function(data)
{
	var tick = data.currentTick.clone();
	var x = this.margin;
	
	var blocks = [];
	
	var REASON_LENGTH = 0;
	var REASON_METER_CHANGE = 1;
	var REASON_MEASURE = 2;
	var REASON_FORCED_MEASURE = 3;
	
	while (true)
	{
		// Find where is the nearest block break that follows the
		// current tick.
		// This could be the song's end, a meter change,
		// a regular measure's end, or a forced measure terminator.
		var nextBlockBreak = this.song.length.clone();
		var nextBlockBreakReason = REASON_LENGTH;
		
		// Check next meter change, if there is one, against the
		// current nearest block break.
		if (data.nextMeter < this.song.meters.length &&
			this.song.meters[data.nextMeter].tick.compare(nextBlockBreak) < 0)
		{
			nextBlockBreak = this.song.meters[data.nextMeter].tick.clone();
			nextBlockBreakReason = REASON_METER_CHANGE;
		}
		
		// Calculate next measure separator, and
		// check it against current nearest block break.
		{
			// Calculate from what tick we should start
			// counting measures.
			// Start by using the current meter's tick.
			var currentMeter = this.song.meters[data.nextMeter - 1];
			var currentMeterStartTick = currentMeter.tick.clone();
			
			// Check if there was a forced measure terminator after
			// the current meter's tick, which would displace the
			// starting point to count measures.
			if (data.nextForcedMeasure - 1 >= 0 &&
				data.nextForcedMeasure - 1 < this.song.forcedMeasures.length &&
				this.song.forcedMeasures[data.nextForcedMeasure - 1].compare(currentMeterStartTick) > 0)
			{
				currentMeterStartTick = this.song.forcedMeasures[data.nextForcedMeasure - 1].clone();
			}
			
			// Count measures until the one following the current tick.
			// Perhaps could be calculated more efficiently.
			var nextMeasureBreak = currentMeterStartTick;
			while (nextMeasureBreak.compare(tick) <= 0)
				nextMeasureBreak.add(currentMeter.getMeasureLength());
			
			// Check it against the current nearest block break.
			if (nextMeasureBreak.compare(nextBlockBreak) < 0)
			{
				nextBlockBreak = nextMeasureBreak;
				nextBlockBreakReason = REASON_MEASURE;
			}
		}
		
		// Check next forced measure terminator, if there is one, against the
		// current nearest block break.
		if (data.nextForcedMeasure < this.song.forcedMeasures.length &&
			this.song.forcedMeasures[data.nextForcedMeasure].compare(nextBlockBreak) < 0)
		{
			nextBlockBreak = this.song.forcedMeasures[data.nextForcedMeasure].clone();
			nextBlockBreakReason = REASON_FORCED_MEASURE;
		}
		
		// Check if this block overflows the canvas's width.
		var blockXEnd = (nextBlockBreak.asFloat() - data.currentTick.asFloat()) * this.wholeTickWidth;
		if (blockXEnd > this.width - this.margin)
		{
			// If there is already a block in this row,
			// we can end it now.
			if (blocks.length > 0)
				break;
			
			// TODO: Else, try breaking the block in
			// smaller pieces.
			// Currently just lets the block overflow the canvas.
		}
		
		// Add the block to the list.
		blocks.push({ start: tick.clone(), end: nextBlockBreak.clone() });
		
		// Update variables for next iteration.
		x = blockXEnd;
		tick = nextBlockBreak;
		
		if (nextBlockBreakReason == REASON_LENGTH)
			break;
		
		else if (nextBlockBreakReason == REASON_METER_CHANGE)
			data.nextMeter += 1;
		
		else if (nextBlockBreakReason == REASON_FORCED_MEASURE)
			data.nextForcedMeasure += 1;
	}
	
	// Print blocks.
	for (var i = 0; i < blocks.length; i++)
	{
		var blockTickOffsetStart = blocks[i].start.clone();
		blockTickOffsetStart.subtract(data.currentTick);
		
		var blockTickOffsetEnd = blocks[i].end.clone();
		blockTickOffsetEnd.subtract(data.currentTick);
		
		var blockXStart = blockTickOffsetStart.asFloat() * this.wholeTickWidth;
		var blockXEnd = blockTickOffsetEnd.asFloat() * this.wholeTickWidth;
		
		var svgBlock = makeSvgNode("rect",
		{
			x: this.margin + blockXStart,
			y: data.y,
			width: blockXEnd - blockXStart,
			height: 50
		});
		
		svgBlock.setAttribute("class", "viewerBlock");
		this.svg.appendChild(svgBlock);
	}
	
	// Update row-persistent variables.
	data.y += 55;
	data.currentTick = tick;
}


function makeSvgNode(kind, attributes)
{
	var node = document.createElementNS("http://www.w3.org/2000/svg", kind);
	for (var attr in attributes)
		node.setAttributeNS(null, attr, attributes[attr]);
	return node;
}