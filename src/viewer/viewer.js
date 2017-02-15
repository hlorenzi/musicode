function Viewer(svg)
{
	this.svg = svg;
	this.song = null;
	
	this.width = 0;
	this.height = 0;
	
	this.defaultNoteMidiPitchMin = 60;
	this.defaultNoteMidiPitchMax = 71;
	
	this.margin = 10;
	this.marginBetweenRows = 5;
	this.wholeTickWidth = 100;
	this.noteHeight = 5;
	this.noteSideMargin = 0.5;
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
	this.song.notes.sort(function (a, b) { return a.startTick.compare(b.startTick); });
	this.song.chords.sort(function (a, b) { return a.startTick.compare(b.startTick); });
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
		nextNote: 0,
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
	// Calculate blocks which fit in this row.
	// A block is any segment of music interrupted by
	// a measure end or a meter change.
	var blocks = [];
	{
		// Tick of where the next block starts.
		var tick = data.currentTick.clone();
		
		// X position of where the next block starts,
		// to check for where to break the row.
		var x = this.margin;
		
		while (true)
		{
			// Find where is the nearest block break that follows the
			// current tick, which could be due to one of many factors.
			var REASON_SONG_END = 0;
			var REASON_METER_CHANGE = 1;
			var REASON_MEASURE = 2;
			var REASON_FORCED_MEASURE = 3;
			
			// Start by using the song endpoint, then
			// progressively search for breaks that happen before.
			var nextBlockBreak = this.song.length.clone();
			var nextBlockBreakReason = REASON_SONG_END;
			
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
			var currentMeter = this.song.meters[data.nextMeter - 1];
			{
				// Calculate from what tick we should start
				// counting measures.
				// Start by using the current meter's tick.
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
			
			// Add the block to the list, if it is not degenerate.
			if (tick.compare(nextBlockBreak) != 0)
			{
				var block =
				{
					start: tick.clone(),
					end: nextBlockBreak.clone(),
					meter: currentMeter
				};
				
				blocks.push(block);
			}
			
			// Update variables for next iteration.
			// They need to be updated here at the end of the loop,
			// because the block might have overflowed the canvas's width,
			// and it could have been disregarded.
			x = blockXEnd;
			tick = nextBlockBreak;
			
			if (nextBlockBreakReason == REASON_SONG_END)
				break;
			
			else if (nextBlockBreakReason == REASON_METER_CHANGE)
				data.nextMeter += 1;
			
			else if (nextBlockBreakReason == REASON_FORCED_MEASURE)
				data.nextForcedMeasure += 1;
		}
	}
	
	var rowStartTick = data.currentTick;
	var rowEndTick = tick;
	var rowLengthInTicks = rowEndTick.clone().subtract(rowStartTick);
	
	// Early return if there are no blocks to print.
	if (blocks.length == 0)
		return;
	
	// Find out the notes contained in this row.
	var notes = [];
	{
		// Check for notes that lingered from before this row.
		for (var i = data.unterminatedNotes.length - 1; i >= 0; i--)
		{
			var note = data.unterminatedNotes[i];
			notes.push(note);
			
			// Remove from the list the notes that end in this row.
			if (note.endTick.compare(rowEndTick) <= 0)
				data.unterminatedNotes.splice(i, 1);
		}
		
		// Check for new notes.
		while (data.nextNote < this.song.notes.length &&
			this.song.notes[data.nextNote].startTick.compare(rowEndTick) < 0)
		{
			var note = this.song.notes[data.nextNote];
			notes.push(note);
			
			// Add it to the unterminated list if its end point
			// is beyond the current row.
			if (note.endTick.compare(rowEndTick) > 0)
				data.unterminatedNotes.push(note);
						
			data.nextNote += 1;
		}
	}
	
	// Find the lowest and highest pitches for notes in this row.
	var midiPitchMin = this.defaultNoteMidiPitchMin;
	var midiPitchMax = this.defaultNoteMidiPitchMax;
	for (var i = 0; i < notes.length; i++)
	{
		midiPitchMin = Math.min(notes[i].midiPitch, midiPitchMin);
		midiPitchMax = Math.max(notes[i].midiPitch, midiPitchMax);
	}
	
	// Calculate block height.
	var noteStaffHeight = (midiPitchMax + 1 - midiPitchMin) * this.noteHeight;
	var blockHeight = noteStaffHeight;
	
	// Render blocks.
	for (var i = 0; i < blocks.length; i++)
	{
		var tickOffsetStart = blocks[i].start.clone().subtract(rowStartTick);
		var tickOffsetEnd = blocks[i].end.clone().subtract(rowStartTick);
		
		var xStart = tickOffsetStart.asFloat() * this.wholeTickWidth;
		var xEnd = tickOffsetEnd.asFloat() * this.wholeTickWidth;
		
		// Add the block's background.
		var svgBlock = makeSvgNode("rect",
		{
			x: this.margin + xStart,
			y: data.y,
			width: xEnd - xStart,
			height: blockHeight
		});
		
		svgBlock.setAttribute("class", "viewerBlockBackground");
		this.svg.appendChild(svgBlock);
		
		// Add the meter's beat lines.
		var beatTickOffset = tickOffsetStart.clone();
		while (true)
		{
			beatTickOffset.add(blocks[i].meter.getBeatLength());
			if (beatTickOffset.compare(tickOffsetEnd) >= 0)
				break;
			
			var xBeat = beatTickOffset.asFloat() * this.wholeTickWidth;
			
			var svgBeat = makeSvgNode("line",
			{
				x1: this.margin + xBeat,
				y1: data.y,
				x2: this.margin + xBeat,
				y2: data.y + blockHeight
			});
			
			svgBeat.setAttribute("class", "viewerBeat");
			this.svg.appendChild(svgBeat);
		}
		
		// Add the block's frame.
		var svgBlock = makeSvgNode("rect",
		{
			x: this.margin + xStart,
			y: data.y,
			width: xEnd - xStart,
			height: blockHeight
		});
		
		svgBlock.setAttribute("class", "viewerBlockFrame");
		this.svg.appendChild(svgBlock);
	}
	
	// Render notes.
	for (var i = 0; i < notes.length; i++)
	{
		var tickOffsetStart = notes[i].startTick.clone().subtract(rowStartTick);
		var tickOffsetEnd = notes[i].endTick.clone().subtract(rowStartTick);
		
		if (tickOffsetStart.compare(new Rational(0)) < 0)
			tickOffsetStart = new Rational(0);
		
		if (notes[i].endTick.compare(rowEndTick) > 0)
			tickOffsetEnd = rowLengthInTicks.clone();
		
		var xStart = tickOffsetStart.asFloat() * this.wholeTickWidth;
		var xEnd = tickOffsetEnd.asFloat() * this.wholeTickWidth;
		
		var midiPitchOffset = notes[i].midiPitch - midiPitchMin;
		var yTop = noteStaffHeight - (midiPitchOffset + 1) * this.noteHeight;
		
		var svgBlock = makeSvgNode("rect",
		{
			x: this.margin + xStart + this.noteSideMargin,
			y: data.y + yTop,
			width: xEnd - xStart - this.noteSideMargin * 2,
			height: this.noteHeight
		});
		
		svgBlock.setAttribute("class", "viewerNote");
		this.svg.appendChild(svgBlock);
	}
	
	// Update row-persistent variables.
	data.y += blockHeight + this.marginBetweenRows;
	data.currentTick = rowEndTick;
}


function makeSvgNode(kind, attributes)
{
	var node = document.createElementNS("http://www.w3.org/2000/svg", kind);
	for (var attr in attributes)
		node.setAttributeNS(null, attr, attributes[attr]);
	return node;
}