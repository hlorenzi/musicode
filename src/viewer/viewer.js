function Viewer(svg)
{
	var that = this;
	
	this.svg = svg;
	this.svg.onmousemove = function(ev) { that.eventMouseMove(ev); };
	this.svg.onmouseup = function(ev) { that.eventMouseUp(ev); };
	this.svg.onmouseout = function(ev) { that.eventMouseOut(ev); };
	
	this.svgCursor = null;
	this.svgCursorGhost = null;
	this.svgCursorPlayback = null;
	
	this.song = null;
	this.blocks = [];
	this.cursorTick = new Rational(0);
	this.cursorGhostTick = new Rational(0);
	this.cursorPlaybackTick = new Rational(0);
	
	this.width = 0;
	this.height = 0;
	
	this.defaultNoteMidiPitchMin = 60;
	this.defaultNoteMidiPitchMax = 71;
	
	this.margin = 10;
	this.marginBetweenRows = 10;
	this.wholeTickWidth = 100;
	this.noteHeight = 5;
	this.noteSideMargin = 0.5;
	this.chordHeight = 50;
	this.chordSideMargin = 0.5;
	this.chordOrnamentHeight = 5;
}


Viewer.prototype.eventMouseMove = function(ev)
{
	var elemRect = this.svg.getBoundingClientRect();
	var mouseX = ev.clientX - elemRect.left;
	var mouseY = ev.clientY - elemRect.top;
	
	// Update cursor ghost.
	if (this.svgCursorGhost == null)
		return;
	
	var blockAtMouse = this.getBlockAt(mouseX, mouseY);
	
	var offset = blockAtMouse == null ? new Rational(0) :
		this.getTickOffset(mouseX - blockAtMouse.x, new Rational(0, 1, 8));
	
	this.cursorGhostTick = this.updateSvgCursor(this.svgCursorGhost, blockAtMouse, offset);
}


Viewer.prototype.eventMouseUp = function(ev)
{
	var elemRect = this.svg.getBoundingClientRect();
	var mouseX = ev.clientX - elemRect.left;
	var mouseY = ev.clientY - elemRect.top;
	
	// Update cursor.
	if (this.svgCursor == null)
		return;
	
	var blockAtMouse = this.getBlockAt(mouseX, mouseY);
	
	var offset = blockAtMouse == null ? new Rational(0) :
		this.getTickOffset(mouseX - blockAtMouse.x, new Rational(0, 1, 8));
	
	this.cursorTick = this.updateSvgCursor(this.svgCursor, blockAtMouse, offset);
}


Viewer.prototype.eventMouseOut = function(ev)
{
	// Remove cursor ghost.
	if (this.svgCursorGhost == null)
		return;
	
	this.cursorGhostTick = this.updateSvgCursor(this.svgCursorGhost, null, 0);
}


Viewer.prototype.hideCursorPlayback = function(tick)
{
	this.cursorPlaybackTick = this.updateSvgCursor(this.svgCursorPlayback, null, new Rational(0));
}


Viewer.prototype.setCursorPlayback = function(tick)
{
	// TODO: Optimize.
	var blockAtTick = this.getBlockAtTick(tick);
	
	var offset = blockAtTick == null ? new Rational(0) :
		tick.clone().subtract(blockAtTick.start);
	
	this.cursorPlaybackTick = this.updateSvgCursor(this.svgCursorPlayback, blockAtTick, offset);
}


Viewer.prototype.updateSvgCursor = function(node, block, tickOffset)
{
	if (block == null)
	{
		editSvgNode(node, { x1: 0, y1: 0, x2: 0, y2: 0 });
		return new Rational(0);
	}
	else
	{
		var cursorX = tickOffset.asFloat() * this.wholeTickWidth;
		
		editSvgNode(node,
		{
			x1: block.x + cursorX,
			y1: block.y - 5,
			x2: block.x + cursorX,
			y2: block.y + block.height + 5
		});
		
		return block.start.clone().add(tickOffset);
	}
}


Viewer.prototype.setSong = function(song)
{
	this.song = song;
	this.refresh();
}


Viewer.prototype.getBlockAt = function(x, y)
{
	for (var i = 0; i < this.blocks.length; i++)
	{
		var block = this.blocks[i];
		
		// Only check the right and bottom boundaries,
		// as to recognize the left and top margin space
		// as part of the block.
		// It works because this is a linear search loop.
		if (x < block.x + block.width &&
			y < block.rowY + block.rowHeight)
		{
			return block;
		}
	}
	
	return null;
}


Viewer.prototype.getBlockAtTick = function(tick)
{
	for (var i = 0; i < this.blocks.length; i++)
	{
		var block = this.blocks[i];
		
		if (tick.compare(block.end) < 0)
			return block;
	}
	
	return null;
}


Viewer.prototype.getTickOffset = function(x, snap)
{
	var offset = new Rational(0);
	
	while (offset.asFloat() * this.wholeTickWidth < x)
		offset.add(snap);
	
	if (offset.compare(snap) >= 0)
		offset.subtract(snap);
	
	return offset;
}


Viewer.prototype.refresh = function()
{
	// Update dimensions.
	this.width = this.svg.clientWidth;
	this.height = this.svg.clientHeight;
	
	// Clear SVG elements.
	while (this.svg.lastChild)
		this.svg.removeChild(this.svg.lastChild);
	
	// Clear layout blocks.
	this.blocks = [];
	
	// Early return if no song.
	if (this.song == null)
		return;
	
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
		nextChord: 0,
		
		y: this.margin
	};
	
	// Keep creating rows while song is not over.
	while (data.currentTick.compare(this.song.length) < 0)
	{
		this.refreshRow(data);
	}
	
	// Resize SVG element for vertical scrolling to work.
	this.svg.style.height = data.y + this.margin;
	
	// Add cursor elements with dummy parameters.
	// Some of them will be updated in the event handlers for
	// mouse interaction/playback.
	this.svgCursor = this.addSvgNode("viewerCursor", "line", { x1: 0, y1: 0, x2: 0, y2: 0 });
	this.svgCursorGhost = this.addSvgNode("viewerCursorGhost", "line", { x1: 0, y1: 0, x2: 0, y2: 0 });
	this.svgCursorPlayback = this.addSvgNode("viewerCursorPlayback", "line", { x1: 0, y1: 0, x2: 0, y2: 0 });
	
	// Update cursor element.
	var blockAtCursor = this.getBlockAtTick(this.cursorTick);
	var cursorOffset = blockAtCursor == null ? new Rational(0) :
		this.cursorTick.clone().subtract(blockAtCursor.start);
		
	this.updateSvgCursor(this.svgCursor, blockAtCursor, cursorOffset);
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
	
	// Find out the chords contained in this row.
	var chords = [];
	{
		// Check for new chords.
		while (data.nextChord < this.song.chords.length &&
			this.song.chords[data.nextChord].startTick.compare(rowEndTick) < 0)
		{
			var chord = this.song.chords[data.nextChord];
			chords.push(chord);
			
			if (this.song.chords[data.nextChord].endTick.compare(rowEndTick) > 0)
				break;
			
			data.nextChord += 1;
		}
	}
	
	// Find the lowest and highest pitches for notes in this row.
	var rowHasNotes = false;
	var midiPitchMin = this.defaultNoteMidiPitchMin;
	var midiPitchMax = this.defaultNoteMidiPitchMax;
	for (var i = 0; i < notes.length; i++)
	{
		if (notes[i].midiPitch == null)
			continue;
		
		rowHasNotes = true;
		midiPitchMin = Math.min(notes[i].midiPitch, midiPitchMin);
		midiPitchMax = Math.max(notes[i].midiPitch, midiPitchMax);
	}
	
	// Check if there are any chords in this row.
	var rowHasChords = false;
	for (var i = 0; i < chords.length; i++)
	{
		if (chords[i].rootMidiPitch != null)
		{
			rowHasChords = true;
			break;
		}
	}
	
	// Check if there are any key/meter changes in this row.
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
	var blockYOffset = keyChangeStaffHeight + meterChangeStaffHeight;
	var noteStaffYOffset = blockYOffset;
	var noteStaffHeight = (rowHasNotes ? (midiPitchMax + 1 - midiPitchMin) * this.noteHeight : 0);
	var chordStaffYOffset = blockYOffset + noteStaffHeight;
	var chordStaffHeight = (rowHasChords ? this.chordHeight : 0);
	var blockHeight = noteStaffHeight + chordStaffHeight;
	var rowHeight = blockYOffset + blockHeight;
	
	// Render blocks.
	for (var i = 0; i < blocks.length; i++)
	{
		var tickOffsetStart = blocks[i].start.clone().subtract(rowStartTick);
		var tickOffsetEnd = blocks[i].end.clone().subtract(rowStartTick);
		
		var xStart = tickOffsetStart.asFloat() * this.wholeTickWidth;
		var xEnd = tickOffsetEnd.asFloat() * this.wholeTickWidth;
		
		// Add block layout to master list.
		// This is used for mouse interaction.
		this.blocks.push(
		{
			start: blocks[i].start.clone(),
			end: blocks[i].end.clone(),
			key: blocks[i].key,
			meter: blocks[i].meter,
			rowY: data.y,
			rowHeight: rowHeight,
			x: this.margin + xStart,
			y: data.y + blockYOffset,
			width: xEnd - xStart,
			height: blockHeight
		});
		
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
		
		// Render notes.
		// TODO: Optimize linear search away.
		for (var j = 0; j < notes.length; j++)
		{
			if (notes[j].midiPitch == null)
				continue;
			
			if (notes[j].startTick.compare(blocks[i].end) >= 0)
				continue;
			
			if (notes[j].endTick.compare(blocks[i].start) <= 0)
				continue;
			
			var noteTickOffsetStart = notes[j].startTick.clone().subtract(blocks[i].start);
			var noteTickOffsetEnd = notes[j].endTick.clone().subtract(blocks[i].start);
			
			if (noteTickOffsetStart.compare(new Rational(0)) < 0)
				noteTickOffsetStart = new Rational(0);
			
			if (notes[j].endTick.compare(blocks[i].end) > 0)
				noteTickOffsetEnd = blocks[i].end.clone().subtract(blocks[i].start);
			
			var noteXStart = noteTickOffsetStart.asFloat() * this.wholeTickWidth;
			var noteXEnd = noteTickOffsetEnd.asFloat() * this.wholeTickWidth;
			
			var midiPitchOffset = notes[j].midiPitch - midiPitchMin;
			var noteYTop = noteStaffYOffset + noteStaffHeight - (midiPitchOffset + 1) * this.noteHeight;
			
			var noteDegree = Theory.getTruncatedPitchFromPitch(
				notes[j].midiPitch - blocks[i].key.tonicMidiPitch);
			
			this.addSvgNode("viewerDegree" + noteDegree, "rect",
			{
				x: this.margin + xStart + noteXStart + this.noteSideMargin,
				y: data.y + noteYTop,
				width: noteXEnd - noteXStart - this.noteSideMargin * 2,
				height: this.noteHeight
			});
		}
		
		// Render chords.
		// TODO: Optimize linear search away.
		for (var j = 0; j < chords.length; j++)
		{
			if (chords[j].rootMidiPitch == null)
				continue;
			
			if (chords[j].startTick.compare(blocks[i].end) >= 0)
				continue;
			
			if (chords[j].endTick.compare(blocks[i].start) <= 0)
				continue;
			
			var chordTickOffsetStart = chords[j].startTick.clone().subtract(blocks[i].start);
			var chordTickOffsetEnd = chords[j].endTick.clone().subtract(blocks[i].start);
			
			if (chordTickOffsetStart.compare(new Rational(0)) < 0)
				chordTickOffsetStart = new Rational(0);
			
			if (chords[j].endTick.compare(blocks[i].end) > 0)
				chordTickOffsetEnd = blocks[i].end.clone().subtract(blocks[i].start);
			
			var chordXStart = chordTickOffsetStart.asFloat() * this.wholeTickWidth;
			var chordXEnd = chordTickOffsetEnd.asFloat() * this.wholeTickWidth;
			
			var chordDegree = Theory.getTruncatedPitchFromPitch(
				chords[j].rootMidiPitch - blocks[i].key.tonicMidiPitch);
			
			this.addSvgNode("viewerChordBackground", "rect",
			{
				x: this.margin + xStart + chordXStart + this.chordSideMargin,
				y: data.y + chordStaffYOffset,
				width: chordXEnd - chordXStart - this.chordSideMargin * 2,
				height: chordStaffHeight
			});
			
			this.addSvgNode("viewerDegree" + chordDegree, "rect",
			{
				x: this.margin + xStart + chordXStart + this.chordSideMargin,
				y: data.y + chordStaffYOffset,
				width: chordXEnd - chordXStart - this.chordSideMargin * 2,
				height: this.chordOrnamentHeight
			});
			
			this.addSvgNode("viewerDegree" + chordDegree, "rect",
			{
				x: this.margin + xStart + chordXStart + this.chordSideMargin,
				y: data.y + chordStaffYOffset + chordStaffHeight - this.chordOrnamentHeight,
				width: chordXEnd - chordXStart - this.chordSideMargin * 2,
				height: this.chordOrnamentHeight
			});
			
			// Build and add the chord label.
			var chordLabel = Theory.getChordRootLabel(blocks[i].key.scale, chordDegree);
			if (Theory.chordKinds[chords[j].chordKindIndex].symbol[0])
				chordLabel = chordLabel.toLowerCase();
			
			chordLabel += Theory.chordKinds[chords[j].chordKindIndex].symbol[1];
			
			var chordLabelSuperscript = Theory.chordKinds[chords[j].chordKindIndex].symbol[2]; 
			
			var svgChordLabel = this.addSvgTextComplemented(
				"viewerChordLabel",
				"viewerChordLabelSuperscript",
				chordLabel,
				chordLabelSuperscript,
				{
					x: this.margin + xStart + chordXStart + (chordXEnd - chordXStart) / 2,
					y: data.y + chordStaffYOffset + chordStaffHeight / 2
				});
			
			// Narrow text if it overflows the space.
			if (svgChordLabel.getComputedTextLength() > chordXEnd - chordXStart)
			{
				editSvgNode(svgChordLabel,
				{
					textLength: chordXEnd - chordXStart,
					lengthAdjust: "spacingAndGlyphs"
				});
			}
		}
		
		// Add the block's melody frame.
		this.addSvgNode("viewerBlockFrame", "rect",
		{
			x: this.margin + xStart,
			y: data.y + noteStaffYOffset,
			width: xEnd - xStart,
			height: noteStaffHeight
		});
		
		// Add the block's chord frame.
		this.addSvgNode("viewerBlockFrame", "rect",
		{
			x: this.margin + xStart,
			y: data.y + chordStaffYOffset,
			width: xEnd - xStart,
			height: chordStaffHeight
		});
		
		// Add a key change indicator, if there is one.
		if (blocks[i].key.tick.compare(blocks[i].start) == 0)
		{
			this.addSvgNode("viewerKeyLine", "line",
			{
				x1: this.margin + xStart,
				y1: data.y + keyChangeStaffYOffset,
				x2: this.margin + xStart,
				y2: data.y + blockYOffset + blockHeight
			});
			
			this.addSvgText("viewerKeyLabel", blocks[i].key.getLabel(),
			{
				x: this.margin + xStart + 5,
				y: data.y + keyChangeStaffYOffset + keyChangeStaffHeight / 2
			});
		}
		
		// Add a meter change indicator, if there is one.
		if (blocks[i].meter.tick.compare(blocks[i].start) == 0)
		{
			this.addSvgNode("viewerMeterLine", "line",
			{
				x1: this.margin + xStart,
				y1: data.y + meterChangeStaffYOffset,
				x2: this.margin + xStart,
				y2: data.y + blockYOffset + blockHeight
			});
			
			this.addSvgText("viewerMeterLabel", blocks[i].meter.getLabel(),
			{
				x: this.margin + xStart + 5,
				y: data.y + meterChangeStaffYOffset + meterChangeStaffHeight / 2
			});
		}
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
	return node;
}


Viewer.prototype.addSvgText = function(cl, text, attributes)
{
	var node = makeSvgNode("text", attributes);
	node.setAttribute("class", cl);
	node.innerHTML = text;
	this.svg.appendChild(node);
	return node;
}


Viewer.prototype.addSvgTextComplemented = function(cl, clSuperscript, text, textSuperscript, attributes)
{
	var nodeSuperscript = makeSvgNode("tspan", { "baseline-shift": "super" });
	nodeSuperscript.setAttribute("class", clSuperscript);
	nodeSuperscript.innerHTML = textSuperscript;
	
	var node = makeSvgNode("text", attributes);
	node.setAttribute("class", cl);
	node.innerHTML = text;
	
	node.appendChild(nodeSuperscript);
	this.svg.appendChild(node);
	return node;
}


function makeSvgNode(kind, attributes)
{
	var node = document.createElementNS("http://www.w3.org/2000/svg", kind);
	for (var attr in attributes)
		node.setAttributeNS(null, attr, attributes[attr]);
	return node;
}


function editSvgNode(node, attributes)
{
	for (var attr in attributes)
		node.setAttributeNS(null, attr, attributes[attr]);
}