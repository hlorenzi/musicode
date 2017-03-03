var codeEditor = null;
var codeEditorLineWidgets = [];

var viewer = null;
var song = null;
var synth = null;

var songPlaying = false;


function main()
{
	var elemSvgViewer = document.getElementById("svgViewer");
	viewer = new Viewer(elemSvgViewer);
	window.onresize = function() { viewer.refresh(); };
	window.onkeydown = function(ev) { onKeyDown(ev); };
	
	synth = new Synth();
	
	var elemDivCodeEditor = document.getElementById("divCode");
	codeEditor = CodeMirror(elemDivCodeEditor,
	{
		lineNumbers: true
	});
	
	codeEditor.setSize("100%", "100%");
	codeEditor.on("change", function() { compile(); });
	
	codeEditor.setValue(
		"@key c4\n" +
		"@meter 4/4\n" +
		"@tempo 120\n\n\n" +
		
		"// tuplets and anacrusis\n" +
		"0| :4:3 < a a# b ||\n\n\n" +
		
		"// each group of lines defines a segment of music,\n" +
		"// usually one or more complete measures\n" +
		"0| c d e f |\n" +
		"h| I-- vim-- |\n\n\n" +
		
		"// rests and different durations\n" +
		"0| g-- _- a. a#, b, |\n" +
		"h| V7---- |\n\n\n" +
		
		"// simultaneous notes\n" +
		"0| :1 > c     |\n" +
		"0| :1   g     |\n" +
		"0| :1   d     |\n" +
		"h| :1   Isus2 |\n\n\n" +
		
		"// note extensions from previous measure\n" +
		"// (works with simultaneous tracks)\n" +
		"0| ---- |\n" +
		"0| -- _-- |\n" +
		"0| e---- |\n" +
		"h| I---- |\n\n\n" +
		
		"// meter changes\n" +
		"@meter 11/8\n\n" +
		
		"0| > c# c c# c c# c c# c c# c c# |\n" +
		"h|   io7----------- |\n\n\n" +
		
		"// key changes\n" +
		"@key e5\n\n" +
		
		"0| e-- g#-- < b g# b c---- |\n" +
		"h| I------- bVI---- |\n\n\n" +
		
		"@key c5\n" +
		"@meter 5/4\n\n" +
		
		"0| < b ----- |\n" +
		"h|   V7----- |\n\n" +
		
		"0| c----- |\n" +
		"h| I----- |");
		
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
	
	if (!songPlaying)
		viewer.setSong(song);
}


function togglePlay()
{
	songPlaying = !songPlaying;
	
	if (songPlaying)
	{
		synth.clear();
		
		if (song != null)
			song.feedSynth(synth, viewer.cursorTick);
		
		viewer.setCursorPlayback(viewer.cursorTick);
		var startTick = viewer.cursorTick.clone();
		
		synth.play(function(time)
		{
			// TODO: This doesn't belong here.
			
			// NOTE: Watch out for fixed song tempo,
			// if that changes in the future.
			
			// Convert time in seconds to ticks.
			var percentageOfWholeNote = time / (1000 / song.bpm / 4);
			var tick = Rational.fromFloat(percentageOfWholeNote, new Rational(0, 1, 64));
			tick.add(startTick);
			
			viewer.setCursorPlayback(tick);
			
			if (tick.compare(song.length) >= 0)
				togglePlay();
		});
	}
	else
	{
		synth.clear();
		synth.stop();
		viewer.hideCursorPlayback();
		viewer.setSong(song);
	}
}


function onKeyDown(ev)
{
	if (ev.ctrlKey && ev.keyCode == 32)
	{
		ev.preventDefault();
		togglePlay();
	}
}