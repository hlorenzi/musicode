var codeEditor = null;
var codeEditorLineWidgets = [];

var viewer = null;

var song = null;


function main()
{
	var elemSvgViewer = document.getElementById("svgViewer");
	viewer = new Viewer(elemSvgViewer);
	window.addEventListener("resize", function() { viewer.refresh(); });
	
	var elemDivCodeEditor = document.getElementById("divCode");
	codeEditor = CodeMirror(elemDivCodeEditor,
	{
		lineNumbers: true
	});
	
	codeEditor.setSize("100%", "100%");
	codeEditor.on("change", function() { compile(); });
	
	codeEditor.setValue(
		"@key c\n" +
		"@meter 4/4\n\n\n" +
		
		"// tuplets and anacrusis\n" +
		"0| :4:3 a3- a#3- b3- ||\n\n\n" +
		
		"// each group of lines defines a segment of music,\n" +
		"// usually one or more complete measures\n" +
		"0| c4- d4- e4- f4- |\n\n\n" +
		
		"// rests and different durations\n" +
		"0| g4-- _- a4. a#4, b4, |\n\n\n" +
		
		"// simultaneous notes\n" +
		"0| c5---- |\n" +
		"0| g4---- |\n" +
		"0| d4---- |\n\n\n" +
		
		"// note extensions from previous measure\n" +
		"// (works with simultaneous tracks)\n" +
		"0| ---- |\n" +
		"0| -- _-- |\n" +
		"0| e4---- |\n\n\n" +
		
		"// meter changes\n" +
		"@meter 11/8\n\n" +
		
		"0| c#5. c5. c#5. c5. c#5. c5. c#5. c5. c#5. c5. c#5. |\n\n\n" +
		
		"// key changes\n" +
		"@key e\n\n" +
		
		"0| e5- g#5- b4. g#4. b4. c5-- |\n\n\n" +
		
		"@meter 5/4\n\n" +
		
		"0| b4----- |\n\n" +
		
		"@key c\n\n" +
		
		"0| c5----- |");
		
	codeEditor.focus();
}


function compile()
{
	for (var i = 0; i < codeEditorLineWidgets.length; i++)
		codeEditorLineWidgets[i].clear();
	
	codeEditorLineWidgets = [];
	
	var msgReporter =
	{
		report: function(msg)
		{
			var msgDiv = document.createElement("div");
			var msgIcon = msgDiv.appendChild(document.createElement("span"));
			msgIcon.innerHTML = "×";
			msgIcon.className = "codeEditorErrorIcon";
			msgDiv.appendChild(document.createTextNode(msg.description));
			msgDiv.className = "codeEditorErrorText";
			
			codeEditorLineWidgets.push(
				codeEditor.addLineWidget(msg.lineStart, msgDiv, { coverGutter: false, noHScroll: true }));
		}
	};
	
	var parser = new CompilerParser(codeEditor.getValue(), msgReporter);
	song = parser.parse();
	
	viewer.setSong(song);
}