function CompilerParser(src, msgReporter)
{
	this.song = new Song();
	this.reader = new CompilerReader(src);
	this.lineReader = null;
	this.msgReporter = msgReporter;
	
	this.trackNum = 1;
	
	this.MEASURE_TERMINATOR_REGULAR = 0;
	this.MEASURE_TERMINATOR_FORCED = 1;
	this.MEASURE_TERMINATOR_CONTINUABLE = 2;
}


CompilerParser.prototype.parse = function()
{
	this.lineReader = this.reader.makeLineReader();
	
	// Prepare data that persists
	// between tracks and segments.
	var segmentData =
	{
		segmentStartTick: new Rational(0),
		firstMeasureStartTick: new Rational(0),
		currentKey: new SongKey(new Rational(0), null, 0),
		currentMeter: new SongMeter(new Rational(0), 4, 4),
		noteTracks: [[]],
		chordTrack: null,
		measureTerminatorsToMatch: null,
		lastMeasureTerminatorWasContinuable: false,
		lastNoteByTrack: [[]],
		lastChord: null
	};
	
	// Add song defaults.
	this.song.keyAdd(segmentData.currentKey);
	this.song.meterAdd(segmentData.currentMeter);
	
	while (true)
	{
		this.lineReader.skipWhitespace();
		
		// Alternate between parsing directives and
		// segments of music.
		// Also, finish up a segment if it has ended.
		
		try
		{
			// Finish a segment if there is a blank line.
			if (this.lineReader.isOver())
			{
				this.finishSegment(segmentData);
			}
			
			// Read a directive.
			else if (this.lineReader.currentChar() == '@')
			{
				this.finishSegment(segmentData);
				this.parseDirective(segmentData);
			}
			
			// Or parse a track for the current segment.
			else
			{
				this.parseTrack(segmentData);
			}
		}
		catch (msg)
		{
			this.handleReport(msg);
		}
		
		if (!this.lineReader.isOver())
			this.msgReporter.report(this.lineReader.makeError("expected line end"));
		
		if (this.reader.isOver())
			break;
			
		this.lineReader = this.reader.makeLineReader();
	}
	
	this.finishSegment(segmentData);
	this.song.setLength(segmentData.segmentStartTick.clone());
	
	// Sort song elements by tick.
	this.song.notes.sort(function (a, b) { return a.startTick.compare(b.startTick); });
	this.song.chords.sort(function (a, b) { return a.startTick.compare(b.startTick); });
	this.song.keys.sort(function (a, b) { return a.tick.compare(b.tick); });
	this.song.meters.sort(function (a, b) { return a.tick.compare(b.tick); });
	this.song.measures.sort(function (a, b) { return a.compare(b); });
	
	return this.song;
}


CompilerParser.prototype.handleReport = function(msg)
{
	if (msg["description"] != undefined)
		this.msgReporter.report(msg);
	else
		throw msg;
}


CompilerParser.prototype.parseDirective = function(segmentData)
{
	this.lineReader.match('@', "unreachable: expected '@'");
	this.lineReader.skipWhitespace();
	
	var directive = this.lineReader.readString("expected directive");
	this.lineReader.skipWhitespace();
	
	switch (directive)
	{
		case "key":
			this.parseDirectiveKey(segmentData);
			break;
			
		case "meter":
			this.parseDirectiveMeter(segmentData);
			break;
			
		case "tempo":
			this.parseDirectiveTempo(segmentData);
			break;
			
		default:
			throw this.lineReader.makeError("unknown directive '" + directive + "'");
	}
}


CompilerParser.prototype.parseDirectiveKey = function(segmentData)
{
	var tonicString = this.lineReader.readNoteName("expected tonic pitch");
	this.lineReader.skipWhitespace();
	
	var tonic = Theory.absoluteNoteNameToRelativePitchValue(tonicString);
	if (tonic == null)
		throw this.lineReader.makeError("invalid tonic pitch '" + tonicString + "'");
	
	segmentData.currentKey = new SongKey(segmentData.segmentStartTick.clone(), null, tonic);
	this.song.keyAdd(segmentData.currentKey);
}


CompilerParser.prototype.parseDirectiveMeter = function(segmentData)
{
	var numeratorString = this.lineReader.readInteger("expected meter numerator");
	this.lineReader.skipWhitespace();
	
	var numerator = parseInt(numeratorString);
	if (isNaN(numerator) || !Theory.isValidMeterNumerator(numerator))
		throw this.lineReader.makeError("invalid meter numerator '" + numeratorString + "'");
	
	this.lineReader.match('/', "expected '/'");
	this.lineReader.skipWhitespace();
	
	var denominatorString = this.lineReader.readInteger("expected meter denominator");
	this.lineReader.skipWhitespace();
	
	var denominator = parseInt(denominatorString);
	if (isNaN(denominator) || !Theory.isValidMeterDenominator(denominator))
		throw this.lineReader.makeError("invalid meter denominator '" + denominatorString + "'");
		
	segmentData.currentMeter = new SongMeter(segmentData.segmentStartTick.clone(), numerator, denominator);
	this.song.meterAdd(segmentData.currentMeter);
}


CompilerParser.prototype.parseDirectiveTempo = function(segmentData)
{
	var bpmString = this.lineReader.readInteger("expected beats per minute");
	this.lineReader.skipWhitespace();
	
	var bpm = parseInt(bpmString);
	if (isNaN(bpm) || !Theory.isValidBpm(bpm))
		throw this.lineReader.makeError("invalid beats per minute '" + bpmString + "'");
	
	// TODO: Song tempo should be changeable
	// throughout the music.
	this.song.bpm = bpm;
}


CompilerParser.prototype.parseTrack = function(segmentData)
{
	// Read track index.
	var trackIndexString = this.lineReader.readInteger("expected track index");
	this.lineReader.skipWhitespace();
	
	var trackIndex = parseInt(trackIndexString);
	if (isNaN(trackIndex) || trackIndex < 0 || trackIndex >= this.trackNum)
		throw this.lineReader.makeError("invalid track '" + trackIndexString + "'");
	
	// Read index separator according to whether
	// the previous measure terminator was continuable.
	if (segmentData.lastMeasureTerminatorWasContinuable)
	{
		this.lineReader.match('~', "expected '~'");
	}
	else
		this.lineReader.match('|', "expected '|'");
	
	this.lineReader.skipWhitespace();
	
	// Find out what subtrack index this is.
	// This is the number of times this track has
	// appeared within the current segment
	// (i.e. simultaneous notes).
	var subTrackIndex = 0;
	var subTracks = segmentData.noteTracks[trackIndex];
	if (subTracks != undefined)
		subTrackIndex = subTracks.length;
	
	if (segmentData.lastNoteByTrack[trackIndex] == undefined)
		segmentData.lastNoteByTrack[trackIndex] = [];
	
	// Parse track data.
	// TODO: Parse other types of tracks.
	var trackData = this.parseNoteTrack(segmentData, trackIndex, subTrackIndex);
	
	// Add track to segment.
	if (segmentData.noteTracks[trackIndex] == undefined)
		segmentData.noteTracks[trackIndex] = [];
	
	segmentData.noteTracks[trackIndex].push(trackData);
	
	// Verify measure terminator alignment within this segment,
	// or, if this is the first track in the segment,
	// set its measure terminators as the ones to be matched.
	// TODO: Verify measure terminator alignment.
	if (segmentData.measureTerminatorsToMatch == null)
		segmentData.measureTerminatorsToMatch = trackData.measureTerminators;
}


CompilerParser.prototype.parseNoteTrack = function(segmentData, trackIndex, subTrackIndex)
{
	var trackData =
	{
		measureTerminators: [],
		notes: [],
		currentMeasureStartTick: segmentData.firstMeasureStartTick.clone(),
		currentTick: segmentData.segmentStartTick.clone(),
		baseDuration: segmentData.currentMeter.getBeatLength()
	};
	
	while (!this.lineReader.isOver())
	{
		// Parse as many notes as there are.
		while (true)
		{
			// Check if there is a duration specifier.
			if (this.lineReader.currentChar() == ':')
				this.parseDurationSpecifier(trackData);
			
			// Check if there is a duration marker,
			// which will extend the previous note.
			if (this.lineReader.currentChar() == '-' ||
			    this.lineReader.currentChar() == '.' ||
			    this.lineReader.currentChar() == ',' ||
			    this.lineReader.currentChar() == ';')
			{
				if (segmentData.lastNoteByTrack[trackIndex][subTrackIndex] == null)
					throw this.lineReader.makeError("invalid note extension");
				
				var extension = this.parseNoteExtension(segmentData, trackData, trackIndex, subTrackIndex);
				
				// Update tick for the next note.
				trackData.currentTick.add(extension.duration);
			}
			
			// Or else, parse a note start.
			else
			{
				var note = this.parseNote(trackData.baseDuration);
				if (note == null)
					break;
				
				// Update tick for the next note.
				var startTick = trackData.currentTick.clone();
				trackData.currentTick.add(note.duration);
				
				// Register note.
				var songNote = new SongNote(startTick, trackData.currentTick.clone(), trackIndex, note.pitch);
				trackData.notes.push(songNote);
				segmentData.lastNoteByTrack[trackIndex][subTrackIndex] = songNote;
			}
		}
		
		// Parse a measure terminator.
		this.parseTrackMeasureTerminator(segmentData, trackData);
	}
	
	return trackData;
}


CompilerParser.prototype.parseTrackMeasureTerminator = function(segmentData, trackData)
{
	// Is this a continuable measure terminator (tilde)?
	if (this.lineReader.nextCharBy(0) == '~')
	{
		this.lineReader.advance();
		this.lineReader.skipWhitespace();
		
		// Register this terminator position.
		trackData.measureTerminators.push({ kind: this.MEASURE_TERMINATOR_CONTINUABLE, tick: trackData.currentTick.clone() });
		
		// DON'T update measure start tick for next measure,
		// because it's meant to be the same measure.
	}
	
	// Is this a forced measure terminator (double bar)?
	else if (this.lineReader.nextCharBy(0) == '|' && this.lineReader.nextCharBy(1) == '|')
	{
		this.lineReader.advance();
		this.lineReader.advance();
		this.lineReader.skipWhitespace();
		
		// Check that this measure is not exactly the right duration.
		var measureDurationTest = this.testMeasureDuration(segmentData, trackData);
		if (measureDurationTest.comparison == 0)
			this.msgReporter.report(this.lineReader.makeError("redundant forced measure terminator"));
		
		// Register this terminator position.
		trackData.measureTerminators.push({ kind: this.MEASURE_TERMINATOR_FORCED, tick: trackData.currentTick.clone() });
		
		// Update measure start tick for next measure.
		trackData.currentMeasureStartTick = trackData.currentTick.clone();
	}
	
	// Is this is a regular measure terminator (single bar)?
	else if (this.lineReader.nextCharBy(0) == '|')
	{
		this.lineReader.advance();
		this.lineReader.skipWhitespace();
		
		// Check that this measure is exactly the right duration.
		var measureDurationTest = this.testMeasureDuration(segmentData, trackData);
		if (measureDurationTest.comparison != 0)
			this.msgReporter.report(measureDurationTest.err);
		
		// Register this terminator position.
		trackData.measureTerminators.push({ kind: this.MEASURE_TERMINATOR_REGULAR, tick: trackData.currentTick.clone() });
		
		// Update measure start tick for next measure.
		trackData.currentMeasureStartTick = trackData.currentTick.clone();
	}
	
	// Else, this is an error.
	else
		throw this.lineReader.makeError("expected measure terminator");
}


CompilerParser.prototype.parseDurationSpecifier = function(trackData)
{
	this.lineReader.advance();
	this.lineReader.skipWhitespace();

	var denominatorString = this.lineReader.readInteger("expected duration specifier");
	this.lineReader.skipWhitespace();
	
	var denominator = parseInt(denominatorString);
	if (isNaN(denominator) || !Theory.isValidMeterDenominator(denominator))
		throw this.lineReader.makeError("invalid length '" + denominatorString + "'");

	trackData.baseDuration = new Rational(0, 1, denominator);
	
	if (this.lineReader.match(':'))
	{
		this.lineReader.skipWhitespace();
		
		var tupleString = this.lineReader.readInteger("expected tuple size");
		this.lineReader.skipWhitespace();
		
		var tuple = parseInt(tupleString);
		if (isNaN(tuple) || !Theory.isValidMeterNumerator(tuple))
			throw this.lineReader.makeError("invalid tuple size '" + tupleString + "'");
		
		trackData.baseDuration.multiply(new Rational(0, 1, tuple));
	}
}


CompilerParser.prototype.parseNote = function(baseDuration)
{
	var pitch = null;
	
	if (this.lineReader.currentChar() == '_')
	{
		this.lineReader.advance();
	}
	else
	{
		var pitchString = this.lineReader.readNoteName();
		if (pitchString == null)
			return null;
		
		pitch = Theory.absoluteNoteNameToPitchValue(pitchString);
		if (pitch == null)
			throw this.lineReader.makeError("invalid note pitch '" + pitchString + "'");
		
		this.lineReader.skipWhitespace();
		
		var octaveString = this.lineReader.readInteger("expected note octave");
		
		var octave = parseInt(octaveString);
		if (isNaN(octave) || !Theory.isValidOctave(octave))
			throw this.lineReader.makeError("invalid note octave '" + octaveString + "'");
		
		pitch += 12 * octave;
		if (!Theory.isValidMidiPitch(pitch))
			throw this.lineReader.makeError("invalid note '" + pitchString + octaveString + "'");
	}
	
	this.lineReader.skipWhitespace();
	
	// Check if there is a duration multiplier to parse,
	// or else use the base duration.
	var durationMultiplier = new Rational(1);
	
	if (this.lineReader.currentChar() == '-' ||
		this.lineReader.currentChar() == '.' ||
		this.lineReader.currentChar() == ',' ||
		this.lineReader.currentChar() == ';')
	{
		durationMultiplier = this.parseDurationMultiplier();
		if (durationMultiplier == null)
			throw this.lineReader.makeError("expected note duration");
	}
	
	return {
		pitch: pitch,
		duration: baseDuration.clone().multiply(durationMultiplier)
	};
}


CompilerParser.prototype.parseNoteExtension = function(segmentData, trackData, trackIndex, subTrackIndex)
{
	var durationMultiplier = this.parseDurationMultiplier();
	if (durationMultiplier == null)
		throw this.lineReader.makeError("expected note duration");
	
	var duration = trackData.baseDuration.clone().multiply(durationMultiplier);
	segmentData.lastNoteByTrack[trackIndex][subTrackIndex].endTick.add(duration);
	
	return { duration: duration };
}



CompilerParser.prototype.parseDurationMultiplier = function()
{
	var multiplier = new Rational(0);
	
	while (true)
	{
		if (this.lineReader.match('-'))
			multiplier.add(new Rational(1));
		
		else if (this.lineReader.match('.'))
			multiplier.add(new Rational(0, 1, 2));
		
		else if (this.lineReader.match(','))
			multiplier.add(new Rational(0, 1, 4));
		
		else if (this.lineReader.match(';'))
			multiplier.add(new Rational(0, 1, 8));
		
		else
			break;
		
		this.lineReader.skipWhitespace();
	}
	
	if (multiplier.compare(new Rational(0)) == 0)
		return null;
	
	return multiplier;
}


CompilerParser.prototype.testMeasureDuration = function(segmentData, trackData)
{
	// Get the expected correct measure length for the current meter.
	var expectedMeasureLength = segmentData.currentMeter.getMeasureLength();
	
	// Get the duration of the actual measure that was just parsed.
	var actualMeasureLength = trackData.currentTick.clone().subtract(trackData.currentMeasureStartTick);
	
	// Calculate the difference between the actual and expected durations.
	var difference = expectedMeasureLength.clone().subtractFrom(actualMeasureLength);
	
	var comparison = difference.compare(new Rational(0));
	
	if (comparison < 0)
		return { comparison: -1, err: this.lineReader.makeError("measure short by " + difference.negate().toString()) };
	
	else if (comparison > 0)
	{
		var overflow = actualMeasureLength.subtract(expectedMeasureLength);
		
		return { comparison: 1, err: this.lineReader.makeError("measure overflowed by " + overflow.toString()) };
	}
	
	return { comparison: 0 };
}


CompilerParser.prototype.finishSegment = function(segmentData)
{
	// If there are no measure terminators to match,
	// it means we haven't started parsing a segment,
	// so there's nothing to do.
	if (segmentData.measureTerminatorsToMatch == null)
		return;
	
	// Add track elements to song.
	for (var i = 0; i < segmentData.noteTracks.length; i++)
	{
		var subTracks = segmentData.noteTracks[i];
		if (subTracks == undefined)
			continue;
		
		for (var j = 0; j < subTracks.length; j++)
		{
			var track = segmentData.noteTracks[i][j];
			for (var k = 0; k < track.notes.length; k++)
				this.song.noteAdd(track.notes[k]);
		}
	}
	
	// TODO: Clear lastNoteByTrack list for any subtrack
	// that was skipped during this segment.
	
	// Add measure terminators to song.
	for (var i = 0; i < segmentData.measureTerminatorsToMatch.length; i++)
	{
		if (segmentData.measureTerminatorsToMatch[i].kind != this.MEASURE_TERMINATOR_CONTINUABLE)
			this.song.measureAdd(segmentData.measureTerminatorsToMatch[i].tick);
	}
	
	// Grab next segment/measure start tick from any of
	// the tracks, since they all should have the same record.
	var anyTrackData = null;
	if (segmentData.chordTrack != null)
		anyTrackData = segmentData.chordTrack;
	else
	{
		for (var i = 0; i < segmentData.noteTracks.length; i++)
		{
			var subTracks = segmentData.noteTracks[i];
			if (subTracks == undefined)
				continue;
			
			for (var j = 0; j < subTracks.length; j++)
			{
				anyTrackData = segmentData.noteTracks[i][j];
			}
		}
	}
	
	// Update variables for next segment.
	segmentData.segmentStartTick = anyTrackData.currentTick.clone();
	segmentData.firstMeasureStartTick = anyTrackData.currentMeasureStartTick.clone();
	
	segmentData.noteTracks = [[]];
	segmentData.chordTrack = null;
	
	segmentData.lastMeasureTerminatorWasContinuable = false;
	if (segmentData.measureTerminatorsToMatch.length > 0)
	{
		var lastMeasureTerminator =
			segmentData.measureTerminatorsToMatch[segmentData.measureTerminatorsToMatch.length - 1];
		segmentData.lastMeasureTerminatorWasContinuable =
			(lastMeasureTerminator.kind == this.MEASURE_TERMINATOR_CONTINUABLE);
	}
	
	segmentData.measureTerminatorsToMatch = null;
}