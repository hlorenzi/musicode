function CompilerReader(src)
{
	this.src = src;
	this.end = src.length;
	this.index = 0;
	this.line = 0;
	this.column = 0;
}


CompilerReader.prototype.makeLineReader = function()
{
	var start = this.index;
	var line = this.line;
	var column = this.column;
	var end = this.index;
	
	while (this.index < this.end)
	{
		this.advance();
		end += 1;
		
		if (this.src[this.index - 1] == '\n')
		{
			end -= 1;
			break;
		}
	}
	
	var lineReader = new CompilerReader(this.src);
	lineReader.end = end;
	lineReader.index = start;
	lineReader.line = line;
	lineReader.column = column;
	return lineReader;
}


CompilerReader.prototype.makeError = function(description)
{
	return {
		description: description,
		start: this.index,
		end: this.index,
		lineStart: this.line,
		lineEnd: this.line,
		columnStart: this.column,
		columnEnd: this.column
	};
}


CompilerReader.prototype.isOver = function()
{
	return this.index >= this.end;
}


CompilerReader.prototype.advance = function()
{
	if (this.index < this.end)
	{
		if (this.currentChar() == '\n')
		{
			this.line += 1;
			this.column = 0;
		}
		else
			this.column += 1;
		
		this.index += 1;
	}
}


CompilerReader.prototype.skipWhitespace = function()
{
	while (this.index < this.end)
	{
		// Skip comments.
		if (this.nextCharBy(0) == '/' && this.nextCharBy(1) == '/')
		{
			this.advance();
			this.advance();
			
			while (this.index < this.end)
			{
				if (this.currentChar() == '\n')
					break;
				
				this.advance();
			}
		}
		
		else if (!this.charIsWhitespace(this.currentChar()))
			break;
		
		else
			this.advance();
	}
}


CompilerReader.prototype.currentChar = function()
{
	if (this.index < this.end)
		return this.src[this.index];
	else
		return '\0';
}


CompilerReader.prototype.nextCharBy = function(amount)
{
	if (this.index + amount < this.end)
		return this.src[this.index + amount];
	else
		return '\0';
}


CompilerReader.prototype.match = function(c, errMsg = null)
{
	if (this.currentChar() == c)
	{
		this.advance();
		return true;
	}
	
	if (errMsg == null)
		return false;
	
	throw this.makeError(errMsg);
}


CompilerReader.prototype.readWhile = function(errMsg, fnStart, fnMiddle)
{
	if (fnStart(this.currentChar()))
	{
		var string = "";
		while (fnMiddle(this.currentChar()))
		{
			string += this.currentChar();
			this.advance();
		}
		
		return string;
	}
	
	if (errMsg == null)
		return null;
	
	throw this.makeError(errMsg);
}


CompilerReader.prototype.readString = function(errMsg = null)
{
	return this.readWhile(errMsg, this.charIsStringStart, this.charIsString);
}


CompilerReader.prototype.readText = function(errMsg = null)
{
	return this.readWhile(errMsg, this.charIsText, this.charIsText);
}


CompilerReader.prototype.readInteger = function(errMsg = null)
{
	return this.readWhile(errMsg, this.charIsNumber, this.charIsNumber);
}


CompilerReader.prototype.readAbsolutePitchName = function(errMsg = null)
{
	return this.readWhile(errMsg, this.charIsAbsolutePitchName, this.charIsAbsolutePitchName);
}


CompilerReader.prototype.readNoteName = function(errMsg = null)
{
	return this.readWhile(errMsg, this.charIsNoteName, this.charIsNoteName);
}


CompilerReader.prototype.readChordName = function(errMsg = null)
{
	return this.readWhile(errMsg, this.charIsChordName, this.charIsChordName);
}


CompilerReader.prototype.readChordKindName = function(errMsg = null)
{
	return this.readWhile(errMsg, this.charIsChordKindName, this.charIsChordKindName);
}


CompilerReader.prototype.charIsWhitespace = function(c)
{
	return (
		(c == ' ' || c == '\t' ||
		c == '\n' || c == '\r'));
}


CompilerReader.prototype.charIsStringStart = function(c)
{
	return (
		(c >= 'A' && c <= 'Z') ||
		(c >= 'a' && c <= 'z') ||
		c == '_');
}


CompilerReader.prototype.charIsString = function(c)
{
	return (
		(c >= 'A' && c <= 'Z') ||
		(c >= 'a' && c <= 'z') ||
		(c >= '0' && c <= '9') ||
		c == '_');
}


CompilerReader.prototype.charIsText = function(c)
{
	return (
		(c >= 'A' && c <= 'Z') ||
		(c >= 'a' && c <= 'z') ||
		c == '_');
}


CompilerReader.prototype.charIsNumber = function(c)
{
	return (c >= '0' && c <= '9');
}


CompilerReader.prototype.charIsAbsolutePitchName = function(c)
{
	return (
		(c >= 'A' && c <= 'G') ||
		(c >= 'a' && c <= 'g') ||
		c == '#');
}


CompilerReader.prototype.charIsNoteName = function(c)
{
	return (
		(c >= 'A' && c <= 'G') ||
		(c >= 'a' && c <= 'g') ||
		(c >= '1' && c <= '7') ||
		c == '#');
}


CompilerReader.prototype.charIsChordName = function(c)
{
	return (
		(c >= 'A' && c <= 'G') ||
		(c >= 'a' && c <= 'g') ||
		c == 'I' || c == 'i' ||
		c == 'V' || c == 'v' ||
		c == '#');
}


CompilerReader.prototype.charIsChordKindName = function(c)
{
	return (
		(c >= 'A' && c <= 'Z') ||
		(c >= 'a' && c <= 'z') ||
		(c >= '1' && c <= '9') ||
		c == '+' || c == '%');
}