unit tmp;

{$mode ObjFPC}

interface

uses
  Classes, SysUtils;

implementation

uses
  js, web,
  audio;

var
  tone, bass: TInstrument;
  noteMap: TJSMap;

function keyDown(aEvent: TJSKeyBoardEvent): boolean;
var
  note: TNote;
  x: double;
  sp, le, f: double;
  i: integer;
begin
  if aevent.key='q' then
  begin
    x:=MusicPlayer.time;

    sp:=0.33/4;
    le:=sp/2;

    play(bass,   'f1--....f2--....a2--....f1--....f2--....a2--....f1--....f2--....'+
                 'c1--....c2--....e2--....c1--....c2--....e2--....c1--....c2--....'+
                 'd1--....d2--....f2--....d1--....d2--....f2--....d1--....d2--....'+
                 'd1--....d2--....f2--....d1--....d2--....f2--....c1--....c2--....', x, sp/8);

    playCh(tone, 'f-----------------------------------------------------------....'+
                 'F-----------------------------------------------------------....'+
                 'D---------------------------------------------------------------'+
                 '----------------------------....c---------------------------....', x, sp/8,
                 [Chord('f', ['c3','f3','a3']), Chord('F', ['c3','e3','a3']), Chord('D',['d3','f3','a3']), Chord('c',['c3','e3','g3'])]);

    exit;
  end;
  {else if aevent.key='w' then
  begin
    x:=MusicPlayer.time;

    sp:=0.33/3.3;
    f:=0.08;
    le:=sp/2;


    for i in [0,2,4,6] do
    begin
      note:=MusicPlayer.AddNote(TNote.Create(ChordToNote('a1'), x+sp*(00+i)+0*f, x+sp*(0+i)+le, tone));
      note:=MusicPlayer.AddNote(TNote.Create(ChordToNote('a2'), x+sp*(00+i)+1*f, x+sp*(0+i)+le, tone));

      note:=MusicPlayer.AddNote(TNote.Create(ChordToNote('g1'), x+sp*(08+i)+0*f, x+sp*(08+i)+le, tone));
      note:=MusicPlayer.AddNote(TNote.Create(ChordToNote('g2'), x+sp*(08+i)+1*f, x+sp*(08+i)+le, tone));

      note:=MusicPlayer.AddNote(TNote.Create(ChordToNote('e1'), x+sp*(16+i)+0*f, x+sp*(16+i)+le, tone));
      note:=MusicPlayer.AddNote(TNote.Create(ChordToNote('e2'), x+sp*(16+i)+1*f, x+sp*(16+i)+le, tone));

      note:=MusicPlayer.AddNote(TNote.Create(ChordToNote('f1'), x+sp*(24+i)+0*f, x+sp*(24+i)+le, tone));
      note:=MusicPlayer.AddNote(TNote.Create(ChordToNote('f2'), x+sp*(24+i)+1*f, x+sp*(24+i)+le, tone));
    end;

    exit;
  end;}

  if noteMap.has(KeyToChord(aevent.key)) then exit;
  if aEvent._repeat then exit;

  note:=MusicPlayer.AddNote(TNote.Create(ChordToNote(KeyToChord(aevent.key)), MusicPlayer.Time, MusicPlayer.time+1000, tone));
  noteMap.&set(KeyToChord(aevent.key), note);
end;

function keyUp(aEvent: TJSKeyBoardEvent): boolean;
var
  note: TNote;
begin
  if not noteMap.has(KeyToChord(aevent.key)) then exit;

  note:=TNote(noteMap.get(KeyToChord(aevent.key)));
  note.StopTime:=MusicPlayer.Time;
  noteMap.delete(KeyToChord(aevent.key));

  writeln(note.StartTime,',',note.StopTime,',',KeyToChord(aevent.key));
end;


end.

