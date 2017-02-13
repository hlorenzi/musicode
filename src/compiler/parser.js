function CompilerParser(src, msgReporter)
{
	this.song = new Song();
	this.reader = new CompilerReader(src);
	this.msgReporter = msgReporter;
	
	this.currentTick = new Rational(0);
	
	this.currentKey = new SongKey(this.currentTick.clone(), null, 0);
	this.song.keyAdd(this.currentKey);
	
	this.currentMeter = new SongMeter(this.currentTick.clone(), 4, 4);
	this.song.meterAdd(this.currentMeter);
	
	this.trackNum = 1;
	this.currentGroupEndTick = null;
}


CompilerParser.prototype.parse = function()
{
	var error = false;
	
	var startedCompass = false;
	
	while (!this.reader.isOver())
	{
		var lineReader = this.reader.makeLineReader();
		lineReader.skipWhitespace();
		
		if (lineReader.isOver())
		{
			if (startedCompass)
			{
				startedCompass = false;
				
				if (this.currentGroupEndTick != null)
				{
					this.currentTick = this.currentGroupEndTick;
					this.currentGroupEndTick = null;
				}
			}
			
			continue;
		}
		
		try
		{
			if (lineReader.currentChar() == '/' && lineReader.nextCharBy(1) == '/')
				continue;
			
			else if (lineReader.currentChar() == '@')
				this.parseDirective(lineReader);
			
			else if (lineReader.currentChar() == '=')
			{
				startedCompass = true;
				this.parseChordTrack(lineReader);
			}
			
			else
			{
				startedCompass = true;
				this.parseNoteTrack(lineReader);
			}
			
			lineReader.skipWhitespace();
			if (!lineReader.isOver())
				throw lineReader.makeError("expected line end");
		}
		catch (msg)
		{
			if (msg["description"] != undefined)
			{
				error = true;
				this.msgReporter.report(msg);
			}
			else
				throw msg;
		}
	}
	
	if (this.currentGroupEndTick != null)
	{
		this.currentTick = this.currentGroupEndTick;
		this.currentGroupEndTick = null;
	}
	
	this.song.setLength(this.currentTick.clone());
	
	return this.song;
}


CompilerParser.prototype.parseDirective = function(lineReader)
{
	lineReader.advance();
	lineReader.skipWhitespace();
	
	var directive = lineReader.readString();
	lineReader.skipWhitespace();
	
	if (directive == null)
		throw lineReader.makeError("expected directive");
	
	switch (directive)
	{
		case "key":
			this.parseDirectiveKey(lineReader);
			break;
			
		case "meter":
			this.parseDirectiveMeter(lineReader);
			break;
			
		default:
			throw lineReader.makeError("unknown directive '" + directive + "'");
	}
}


CompilerParser.prototype.parseDirectiveKey = function(lineReader)
{
	var tonicString = lineReader.readNoteName();
	lineReader.skipWhitespace();
	
	if (tonicString == null)
		throw lineReader.makeError("expected tonic pitch");
	
	var tonic = Theory.absoluteNoteNameToRelativePitchValue(tonicString);
	if (tonic == null)
		throw lineReader.makeError("invalid tonic pitch '" + tonicString + "'");
	
	this.currentKey = new SongKey(this.currentTick.clone(), null, tonic);
	this.song.keyAdd(this.currentKey);
}


CompilerParser.prototype.parseDirectiveMeter = function(lineReader)
{
	var numeratorString = lineReader.readInteger();
	lineReader.skipWhitespace();
	
	if (numeratorString == null)
		throw lineReader.makeError("expected meter numerator");
	
	var numerator = parseInt(numeratorString);
	if (isNaN(numerator) || numerator <= 0 || numerator > 256)
		throw lineReader.makeError("invalid meter numerator '" + numeratorString + "'");
	
	if (!lineReader.match('/'))
		throw lineReader.makeError("expected '/'");
	
	lineReader.skipWhitespace();
	
	var denominatorString = lineReader.readInteger();
	lineReader.skipWhitespace();
	
	if (denominatorString == null)
		throw lineReader.makeError("expected meter denominator");
	
	var denominator = parseInt(denominatorString);
	if (isNaN(denominator) ||
		(denominator != 1 && denominator != 2 && denominator != 4 &&
		denominator != 8 && denominator != 16 && denominator != 32 &&
		denominator != 64 && denominator != 128))
		throw lineReader.makeError("invalid meter denominator '" + denominatorString + "'");
		
	this.currentMeter = new SongMeter(this.currentTick.clone(), numerator, denominator);
	this.song.meterAdd(this.currentMeter);
}


CompilerParser.prototype.parseNoteTrack = function(lineReader)
{
	var trackString = lineReader.readInteger();
	lineReader.skipWhitespace();
	
	if (trackString == null)
		throw lineReader.makeError("expected track identifier");
	
	var trackIndex = parseInt(trackString);
	if (isNaN(trackIndex) || trackIndex < 0 || trackIndex >= this.trackNum)
		throw lineReader.makeError("invalid track '" + trackString + "'");
	
	if (!lineReader.match('|'))
		throw lineReader.makeError("expected '|'");
	
	lineReader.skipWhitespace();
	
	
	var trackData =
	{
		measureStartTick: this.currentTick.clone(),
		currentTick: this.currentTick.clone(),
		baseSizer: new Rational(0, 1, 4),
		sizer: new Rational(0, 1, 4)
	};
	
	var measureCorrectlyTerminated = false;
	
	while (!lineReader.isOver())
	{
		if (lineReader.currentChar() == '^')
			this.parseTrackSizer(lineReader, trackData);
		
		else if (lineReader.currentChar() == '|')
		{
			if (measureCorrectlyTerminated)
				throw lineReader.makeError("expected line end");
			
			lineReader.advance();
			
			var measureFullnessTest = this.testMeasureFullness(lineReader, trackData);
			
			if (lineReader.currentChar() == '|')
			{
				if (measureFullnessTest.compare == 0)
					this.msgReporter.report(lineReader.makeError("redundant forced measure terminator"));
				else if (measureFullnessTest.compare > 0)
					throw measureFullnessTest.err;
				
				lineReader.advance();
				lineReader.skipWhitespace();
				measureCorrectlyTerminated = true;
				this.song.forcedMeasureAdd(trackData.currentTick.clone());
				break;
			}
			
			lineReader.skipWhitespace();
			
			if (measureFullnessTest.compare != 0)
				throw measureFullnessTest.err;
			
			trackData.measureStartTick.add(
				new Rational(0, this.currentMeter.numerator, this.currentMeter.denominator));
				
			measureCorrectlyTerminated = true;
		}
		
		else
		{
			var note = this.parseTrackNote(lineReader, trackData);
			var startTick = trackData.currentTick.clone();
			trackData.currentTick.add(note.length);
			
			this.song.noteAdd(trackIndex, new SongNote(startTick, trackData.currentTick.clone(), note.pitch));
			
			measureCorrectlyTerminated = false;
		}
	}
	
	if (!measureCorrectlyTerminated)
		throw lineReader.makeError("expected measure terminator");
	
	if (this.currentGroupEndTick == null)
		this.currentGroupEndTick = trackData.currentTick.clone();
	else
	{
		var difference = trackData.currentTick.clone();
		difference.subtract(this.currentGroupEndTick);
		
		var negatedDifference = difference.clone();
		negatedDifference.negate();
		
		var comparison = difference.compare(new Rational(0));
		if (comparison > 0)
			throw lineReader.makeError("group length mismatch: overflowed by " + difference.toString());
		else if (comparison < 0)
			throw lineReader.makeError("group length mismatch: short by " + negatedDifference.toString());
	}
}


CompilerParser.prototype.testMeasureFullness = function(lineReader, trackData)
{
	var meterLength = this.currentMeter.getMeasureLength();
	
	var measureLength = trackData.currentTick.clone();
	measureLength.subtract(trackData.measureStartTick);
	
	var measureLengthRemaining = measureLength.clone();
	measureLengthRemaining.subtractFrom(meterLength);
	
	var measureLengthCompared = measureLengthRemaining.compare(new Rational(0));
	if (measureLengthCompared > 0)
		return { compare: -1, err: lineReader.makeError("measure short by " + measureLengthRemaining.toString()) };
	else if (measureLengthCompared < 0)
	{
		var measureLengthOverflow = measureLength.clone();
		measureLengthOverflow.subtract(meterLength);
		
		return { compare: 1, err: lineReader.makeError("measure overflowed by " + measureLengthOverflow.toString()) };
	}
	
	return { compare: 0 };
}


CompilerParser.prototype.parseTrackSizer = function(lineReader, trackData)
{
	lineReader.advance();
	lineReader.skipWhitespace();

	if (lineReader.charIsNumber(lineReader.currentChar()))
	{
		var denominatorString = lineReader.readInteger();
		lineReader.skipWhitespace();
		
		var denominator = parseInt(denominatorString);
		if (isNaN(denominator) ||
			(denominator != 1 && denominator != 2 && denominator != 4 &&
			denominator != 8 && denominator != 16 && denominator != 32 &&
			denominator != 64 && denominator != 128))
			throw lineReader.makeError("invalid length '" + denominatorString + "'");
	
		trackData.baseSizer = new Rational(0, 1, denominator);
	}
	
	trackData.sizer = trackData.baseSizer.clone();
	
	if (lineReader.match(':'))
	{
		lineReader.skipWhitespace();
		
		var tupleString = lineReader.readInteger();
		if (tupleString == null)
			throw lineReader.makeError("expected tuple size");
		
		lineReader.skipWhitespace();
		
		var tuple = parseInt(tupleString);
		if (isNaN(tuple) || tuple <= 0 || tuple >= 128)
			throw lineReader.makeError("invalid tuple size '" + tupleString + "'");
		
		trackData.sizer.multiply(new Rational(0, 2, tuple));
	}
}


CompilerParser.prototype.parseTrackNote = function(lineReader, trackData)
{
	var pitch = null;
	
	if (lineReader.currentChar() == '_')
	{
		lineReader.advance();
	}
	else
	{
		var pitchString = lineReader.readNoteName();
		if (pitchString == null)
			throw lineReader.makeError("expected note");
		
		pitch = Theory.absoluteNoteNameToPitchValue(pitchString);
		if (pitch == null)
			throw lineReader.makeError("invalid note pitch '" + pitchString + "'");
		
		lineReader.skipWhitespace();
		
		var octaveString = lineReader.readInteger();
		if (octaveString == null)
			throw lineReader.makeError("expected note octave");
		
		var octave = parseInt(octaveString);
		if (isNaN(octave) || octave < 0 || octave >= 9)
			throw lineReader.makeError("invalid note octave '" + octaveString + "'");
		
		pitch += 12 * octave;
		if (pitch < 0 || pitch >= 12 * 9)
			throw lineReader.makeError("invalid note '" + pitchString + octaveString + "'");
	}
	
	lineReader.skipWhitespace();
	
	var lengthMultiplier = this.parseTrackLengthMultiplier(lineReader);
	if (lengthMultiplier == null)
		throw lineReader.makeError("expected note length");
	
	var length = trackData.sizer.clone();
	length.multiply(lengthMultiplier);
	
	return {
		pitch: pitch,
		length: length
	};
}


CompilerParser.prototype.parseTrackLengthMultiplier = function(lineReader)
{
	var multiplier = new Rational(0);
	
	while (true)
	{
		if (lineReader.match('-'))
			multiplier.add(new Rational(1));
		
		else if (lineReader.match('.'))
			multiplier.add(new Rational(0, 1, 2));
		
		else if (lineReader.match(','))
			multiplier.add(new Rational(0, 1, 4));
		
		else if (lineReader.match(';'))
			multiplier.add(new Rational(0, 1, 8));
		
		else
			break;
		
		lineReader.skipWhitespace();
	}
	
	if (multiplier.compare(new Rational(0)) == 0)
		return null;
	
	return multiplier;
}