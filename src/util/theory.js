var Theory = {};


Theory.absoluteNoteNameToPitchValue = function(string)
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


Theory.absoluteNoteNameToRelativePitchValue = function(string)
{
	var note = Theory.absoluteNoteNameToPitchValue(string);
	if (note == null)
		return null;
	
	while (note >= 12)
		note -= 12;
		
	while (note < 0)
		note += 12;
	
	return note;
}