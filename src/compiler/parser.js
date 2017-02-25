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
		noteTracks: [],
		chordTrack: null,
		measureTerminatorsToMatch: null,
		lastMeasureTerminatorWasContinuable: false
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
			if (this.lineReader.isOver())
			{
				this.finishSegment(segmentData);
			}
			
			else if (this.lineReader.currentChar() == '@')
			{
				this.finishSegment(segmentData);
				this.parseDirective(segmentData);
			}
			
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
		this.lineReader.match('>', "expected '>>'");
		this.lineReader.match('>', "expected '>>'");
	}
	else
		this.lineReader.match('|', "expected '|'");
	
	this.lineReader.skipWhitespace();
	
	// TODO: Parse other types of tracks.
	// Parse track data.
	var trackData = this.parseNoteTrack(segmentData, trackIndex);
	
	// Add track to segment.
	segmentData.noteTracks.push(trackData);
	
	// Verify measure terminator alignment within this segment,
	// or, if this is the first track in the segment,
	// set its measure terminators as the ones to be matched.
	// TODO: Verify measure terminator alignment.
	if (segmentData.measureTerminatorsToMatch == null)
		segmentData.measureTerminatorsToMatch = trackData.measureTerminators;
}


CompilerParser.prototype.parseNoteTrack = function(segmentData, trackIndex)
{
	var trackData =
	{
		measureTerminators: [],
		notes: [],
		currentMeasureStartTick: segmentData.firstMeasureStartTick.clone(),
		currentTick: segmentData.segmentStartTick.clone(),
		baseDuration: new Rational(0, 1, 4)
	};
	
	while (!this.lineReader.isOver())
	{
		// Parse as many notes as there are.
		while (true)
		{
			// Check if there is a duration specifier.
			if (this.lineReader.currentChar() == ':')
				this.parseDurationSpecifier(trackData);
			
			var note = this.parseNote(trackData.baseDuration);
			if (note == null)
				break;
			
			// Update tick for the next note.
			var startTick = trackData.currentTick.clone();
			trackData.currentTick.add(note.duration);
			
			// Register note, if it's not a rest.
			if (note.pitch != null)
				trackData.notes.push(new SongNote(startTick, trackData.currentTick.clone(), trackIndex, note.pitch));
		}
		
		// Parse a measure terminator.
		this.parseTrackMeasureTerminator(segmentData, trackData);
	}
	
	return trackData;
}


CompilerParser.prototype.parseTrackMeasureTerminator = function(segmentData, trackData)
{
	// Is this a continuable measure terminator (double arrow)?
	if (this.lineReader.nextCharBy(0) == '>' && this.lineReader.nextCharBy(1) == '>')
	{
		this.lineReader.advance();
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
	
	var durationMultiplier = this.parseDurationMultiplier();
	if (durationMultiplier == null)
		throw this.lineReader.makeError("expected note duration");
	
	return {
		pitch: pitch,
		duration: baseDuration.clone().multiply(durationMultiplier)
	};
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
		var track = segmentData.noteTracks[i];
		for (var j = 0; j < track.notes.length; j++)
			this.song.noteAdd(track.notes[j]);
	}
	
	// Add measure terminators to song.
	for (var i = 0; i < segmentData.measureTerminatorsToMatch.length; i++)
	{
		if (segmentData.measureTerminatorsToMatch[i].kind != this.MEASURE_TERMINATOR_CONTINUABLE)
			this.song.measureAdd(segmentData.measureTerminatorsToMatch[i].tick);
	}
	
	// Grab next segment/measure start tick from any of
	// the tracks, since they all should have the same record.
	var anyTrackData = null;
	if (segmentData.noteTracks.length > 0)
		anyTrackData = segmentData.noteTracks[0];
	else
		anyTrackData = segmentData.chordTrack;
	
	// Update variables for next segment.
	segmentData.segmentStartTick = anyTrackData.currentTick.clone();
	segmentData.firstMeasureStartTick = anyTrackData.currentMeasureStartTick.clone();
	
	segmentData.noteTracks = [];
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