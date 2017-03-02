var Theory = {};


Theory.decodeAbsoluteNoteName = function(string)
{
	var note = 0;
	switch (string.charAt(0).toLowerCase())
	{
		case "c": note = 0; break;
		case "d": note = 2; break;
		case "e": note = 4; break;
		case "f": note = 5; break;
		case "g": note = 7; break;
		case "a": note = 9; break;
		case "b": note = 11; break;
		default: return null;
	}
	
	for (var i = 1; i < string.length; i++)
	{
		switch (string.charAt(i))
		{
			case "#": note += 1; break;
			case "b": note -= 1; break;
			default: return null;
		}
	}
	
	return note;
}


Theory.decodeDegreeName = function(string)
{
	var degree = 0;
	switch (string.charAt(0).toLowerCase())
	{
		case "1": degree = 0; break;
		case "2": degree = 2; break;
		case "3": degree = 4; break;
		case "4": degree = 5; break;
		case "5": degree = 7; break;
		case "6": degree = 9; break;
		case "7": degree = 11; break;
		default: return null;
	}
	
	for (var i = 1; i < string.length; i++)
	{
		switch (string.charAt(i))
		{
			case "#": degree += 1; break;
			case "b": degree -= 1; break;
			default: return null;
		}
	}
	
	return degree;
}


Theory.decodeRelativeNoteName = function(string)
{
	var note = Theory.decodeAbsoluteNoteName(string);
	if (note == null)
		return null;
	
	while (note >= 12)
		note -= 12;
		
	while (note < 0)
		note += 12;
	
	return note;
}


Theory.isValidMidiPitch = function(pitch)
{
	return pitch >= 0 && pitch < 12 * 9;
}


Theory.isValidOctave = function(octave)
{
	return octave >= 0 && octave < 9;
}


Theory.isValidBpm = function(bpm)
{
	return bpm >= 1 && bpm <= 999;
}


Theory.isValidMeterNumerator = function(numerator)
{
	return numerator >= 1 && numerator <= 256;
}


Theory.isValidMeterDenominator = function(denominator)
{
	return (
		denominator == 1 || denominator == 2 || denominator == 4 ||
		denominator == 8 || denominator == 16 || denominator == 32 ||
		denominator == 64 || denominator == 128);
}


Theory.getMeterLabel = function(numerator, denominator)
{
	return "" + numerator + " / " + denominator;
}


Theory.getKeyLabel = function(scale, tonicMidiPitch)
{
	// TODO: Use the representation set by the user (i.e., C# versus Db)
	var pitches = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
	return pitches[tonicMidiPitch % 12];
}