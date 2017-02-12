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
};


CompilerReader.prototype.isOver = function()
{
	return this.index >= this.end;
};


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
};


CompilerReader.prototype.skipWhitespace = function()
{
	while (this.index < this.end && this.charIsWhitespace(this.src[this.index]))
	{
		this.advance();
	}
};


CompilerReader.prototype.currentChar = function()
{
	if (this.index < this.end)
		return this.src[this.index];
	else
		return '\0';
};


CompilerReader.prototype.nextCharBy = function(amount)
{
	if (this.index + amount < this.end)
		return this.src[this.index + amount];
	else
		return '\0';
};


CompilerReader.prototype.readWhile = function(fnStart, fnMiddle)
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
	
	return null;
};


CompilerReader.prototype.match = function(c)
{
	if (this.currentChar() == c)
	{
		this.advance();
		return true;
	}
	
	return false;
};


CompilerReader.prototype.readString = function()
{
	return this.readWhile(this.charIsStringStart, this.charIsString);
};


CompilerReader.prototype.readText = function()
{
	return this.readWhile(this.charIsText, this.charIsText);
};


CompilerReader.prototype.readInteger = function()
{
	return this.readWhile(this.charIsNumber, this.charIsNumber);
};


CompilerReader.prototype.readNoteName = function()
{
	return this.readWhile(this.charIsNoteName, this.charIsNoteName);
};


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


CompilerReader.prototype.charIsNoteName = function(c)
{
	return (
		(c >= 'A' && c <= 'G') ||
		(c >= 'a' && c <= 'g') ||
		c == '#');
}