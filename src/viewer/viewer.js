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
	this.song.measures.sort(function (a, b) { return a.compare(b); });
	
	// Prepare work data structure.
	var data =
	{
		// Updated by refreshRow, stores state
		// between calls to it.
		currentTick: new Rational(0),
		nextKey: 1,
		nextMeter: 1,
		nextMeasure: 0,
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
	// a measure end or a key/meter change.
	var blocks = [];
	{
		// Tick of where the next block starts.
		var tick = data.currentTick.clone();
		
		// X position of where the next block starts,
		// to check for where to break the row.
		var x = this.margin;
		
		while (true)
		{
			var currentKey = this.song.keys[data.nextKey - 1];
			var currentMeter = this.song.meters[data.nextMeter - 1];
			
			// Find where is the nearest block break that follows the
			// current tick, which could be due to one of many factors.
			var REASON_SONG_END = 0;
			var REASON_KEY_CHANGE = 1;
			var REASON_METER_CHANGE = 2;
			var REASON_MEASURE = 3;
			
			// Start by using the song endpoint, then
			// progressively search for breaks that happen before.
			var nextBlockBreak = this.song.length.clone();
			var nextBlockBreakReason = REASON_SONG_END;
			
			// Check next key change, if there is one, against the
			// current nearest block break.
			if (data.nextKey < this.song.keys.length &&
				this.song.keys[data.nextKey].tick.compare(nextBlockBreak) < 0)
			{
				nextBlockBreak = this.song.keys[data.nextKey].tick.clone();
				nextBlockBreakReason = REASON_KEY_CHANGE;
			}
			
			// Check next meter change, if there is one, against the
			// current nearest block break.
			if (data.nextMeter < this.song.meters.length &&
				this.song.meters[data.nextMeter].tick.compare(nextBlockBreak) < 0)
			{
				nextBlockBreak = this.song.meters[data.nextMeter].tick.clone();
				nextBlockBreakReason = REASON_METER_CHANGE;
			}
			
			// Check next measure terminator, if there is one, against the
			// current nearest block break.
			if (data.nextMeasure < this.song.measures.length &&
				this.song.measures[data.nextMeasure].compare(nextBlockBreak) < 0)
			{
				nextBlockBreak = this.song.measures[data.nextMeasure].clone();
				nextBlockBreakReason = REASON_MEASURE;
			}
			
			// Check if this block overflows the canvas's width.
			var blockXEnd = (nextBlockBreak.asFloat() - data.currentTick.asFloat()) * this.wholeTickWidth;
			if (blockXEnd > this.width - this.margin)
			{
				// If there is already a block in this row,
				// we can end the row now.
				if (blocks.length > 0)
					break;
				
				// TODO: Else, try breaking the block in
				// smaller pieces.
				// Currently this just lets the block overflow the canvas.
			}
			
			// Add the block to the list, if it is not degenerate.
			if (tick.compare(nextBlockBreak) != 0)
			{
				// Find the current measure's start tick.
				var measureStart = new Rational(0);
				if (data.nextMeasure - 1 >= 0)
					measureStart = this.song.measures[data.nextMeasure - 1].clone();
				
				var block =
				{
					start: tick.clone(),
					end: nextBlockBreak.clone(),
					key: currentKey,
					meter: currentMeter,
					measureStart: measureStart
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
			
			else if (nextBlockBreakReason == REASON_KEY_CHANGE)
				data.nextKey += 1;
			
			else if (nextBlockBreakReason == REASON_METER_CHANGE)
				data.nextMeter += 1;
			
			else if (nextBlockBreakReason == REASON_MEASURE)
				data.nextMeasure += 1;
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
		if (notes[i].midiPitch == null)
			continue;
		
		midiPitchMin = Math.min(notes[i].midiPitch, midiPitchMin);
		midiPitchMax = Math.max(notes[i].midiPitch, midiPitchMax);
	}
	
	// Check if there's any key/meter changes in this row.
	var rowHasKeyChange = false;
	var rowHasMeterChange = false;
	for (var i = 0; i < blocks.length; i++)
	{
		rowHasKeyChange   = rowHasKeyChange   || (blocks[i].key  .tick.compare(blocks[i].start) == 0);
		rowHasMeterChange = rowHasMeterChange || (blocks[i].meter.tick.compare(blocks[i].start) == 0);
	}
	
	// Calculate row and block height.
	var keyChangeStaffYOffset = 0;
	var keyChangeStaffHeight = (rowHasKeyChange ? 20 : 0);
	var meterChangeStaffYOffset = keyChangeStaffHeight;
	var meterChangeStaffHeight = (rowHasMeterChange ? 20 : 0);
	var noteStaffYOffset = keyChangeStaffHeight + meterChangeStaffHeight;
	var noteStaffHeight = (midiPitchMax + 1 - midiPitchMin) * this.noteHeight;
	var blockYOffset = keyChangeStaffHeight + meterChangeStaffHeight;
	var blockHeight = noteStaffHeight;
	var rowHeight = blockYOffset + blockHeight;
	
	// Render blocks.
	for (var i = 0; i < blocks.length; i++)
	{
		var tickOffsetStart = blocks[i].start.clone().subtract(rowStartTick);
		var tickOffsetEnd = blocks[i].end.clone().subtract(rowStartTick);
		
		var xStart = tickOffsetStart.asFloat() * this.wholeTickWidth;
		var xEnd = tickOffsetEnd.asFloat() * this.wholeTickWidth;
		
		// Add the block's background.
		this.addSvgNode("viewerBlockBackground", "rect",
		{
			x: this.margin + xStart,
			y: data.y + blockYOffset,
			width: xEnd - xStart,
			height: blockHeight
		});
		
		// Add the meter's beat lines.
		var beatTickOffset = blocks[i].measureStart.clone().subtract(rowStartTick);
		while (true)
		{
			beatTickOffset.add(blocks[i].meter.getBeatLength());
			
			if (beatTickOffset.compare(tickOffsetStart) <= 0)
				continue;
			
			if (beatTickOffset.compare(tickOffsetEnd) >= 0)
				break;
			
			var xBeat = beatTickOffset.asFloat() * this.wholeTickWidth;
			
			var svgBeat = this.addSvgNode("viewerBeat", "line",
			{
				x1: this.margin + xBeat,
				y1: data.y + blockYOffset,
				x2: this.margin + xBeat,
				y2: data.y + blockYOffset + blockHeight
			});
		}
		
		// Add the block's frame.
		this.addSvgNode("viewerBlockFrame", "rect",
		{
			x: this.margin + xStart,
			y: data.y + blockYOffset,
			width: xEnd - xStart,
			height: blockHeight
		});
		
		// Add a key change indicator, if there is one.
		if (blocks[i].key.tick.compare(blocks[i].start) == 0)
		{
			var svgBeat = this.addSvgNode("viewerKeyLine", "line",
			{
				x1: this.margin + xStart,
				y1: data.y + keyChangeStaffYOffset,
				x2: this.margin + xStart,
				y2: data.y + blockYOffset + blockHeight
			});
			
			var svgBeat = this.addSvgText("viewerKeyLabel",
				blocks[i].key.getLabel(),
				{
					x: this.margin + xStart + 5,
					y: data.y + keyChangeStaffYOffset + keyChangeStaffHeight / 2
				});
		}
		
		// Add a meter change indicator, if there is one.
		if (blocks[i].meter.tick.compare(blocks[i].start) == 0)
		{
			var svgBeat = this.addSvgNode("viewerMeterLine", "line",
			{
				x1: this.margin + xStart,
				y1: data.y + meterChangeStaffYOffset,
				x2: this.margin + xStart,
				y2: data.y + blockYOffset + blockHeight
			});
			
			var svgBeat = this.addSvgText("viewerMeterLabel",
				blocks[i].meter.getLabel(),
				{
					x: this.margin + xStart + 5,
					y: data.y + meterChangeStaffYOffset + meterChangeStaffHeight / 2
				});
		}
	}
	
	// Render notes.
	for (var i = 0; i < notes.length; i++)
	{
		if (notes[i].midiPitch == null)
			continue;
		
		var tickOffsetStart = notes[i].startTick.clone().subtract(rowStartTick);
		var tickOffsetEnd = notes[i].endTick.clone().subtract(rowStartTick);
		
		if (tickOffsetStart.compare(new Rational(0)) < 0)
			tickOffsetStart = new Rational(0);
		
		if (notes[i].endTick.compare(rowEndTick) > 0)
			tickOffsetEnd = rowLengthInTicks.clone();
		
		var xStart = tickOffsetStart.asFloat() * this.wholeTickWidth;
		var xEnd = tickOffsetEnd.asFloat() * this.wholeTickWidth;
		
		var midiPitchOffset = notes[i].midiPitch - midiPitchMin;
		var yTop = noteStaffYOffset + noteStaffHeight - (midiPitchOffset + 1) * this.noteHeight;
		
		this.addSvgNode("viewerNote", "rect",
		{
			x: this.margin + xStart + this.noteSideMargin,
			y: data.y + yTop,
			width: xEnd - xStart - this.noteSideMargin * 2,
			height: this.noteHeight
		});
	}
	
	// Update row-persistent variables.
	data.y += rowHeight + this.marginBetweenRows;
	data.currentTick = rowEndTick;
}


Viewer.prototype.addSvgNode = function(cl, kind, attributes)
{
	var node = makeSvgNode(kind, attributes);
	node.setAttribute("class", cl);
	this.svg.appendChild(node);
}


Viewer.prototype.addSvgText = function(cl, text, attributes)
{
	var node = makeSvgNode("text", attributes);
	node.setAttribute("class", cl);
	node.innerHTML = text;
	this.svg.appendChild(node);
}


function makeSvgNode(kind, attributes)
{
	var node = document.createElementNS("http://www.w3.org/2000/svg", kind);
	for (var attr in attributes)
		node.setAttributeNS(null, attr, attributes[attr]);
	return node;
}