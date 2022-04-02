program ld50;

{$mode objfpc}

uses
  JS, fpjson, Classes, SysUtils, Web,
  libjquery,webaudio,
  audio, audiostuff;

procedure refill;
begin
  Player.Update;   
  window.setTimeout(@refill, 1);
end;

var
  tone, bass: TInstrument;
  x: JSValue;
  noteMap: TJSMap;

function ChordToNote(s: string): double;
begin
  case s of
    'c1': exit(261.63);
    'd1': exit(293.66);
    'e1': exit(329.63);
    'f1': exit(349.23);
    'g1': exit(392.00);
    'a1': exit(440.00);
    'h1': exit(493.88);

    'c2': exit(261.63*2);
    'd2': exit(293.66*2);
    'e2': exit(329.63*2);
    'f2': exit(349.23*2);
    'g2': exit(392.00*2);
    'a2': exit(440.00*2);
    'h2': exit(493.88*2);

    'c3': exit(261.63*4);
    'd3': exit(293.66*4);
    'e3': exit(329.63*4);
    'f3': exit(349.23*4);
    'g3': exit(392.00*4);
    'a3': exit(440.00*4);
    'h3': exit(493.88*4);
  else
    result:=0;
  end;
end;

function KeyToChord(s: string): string;
begin
  case s of
    'z': exit('c1');
    'x': exit('d1');
    'c': exit('e1');
    'v': exit('f1');
    'b': exit('g1');
    'n': exit('a1');
    'm': exit('h1');

    's': exit('c2');
    'd': exit('d2');
    'f': exit('e2');
    'g': exit('f2');
    'h': exit('g2');
    'j': exit('a2');
    'k': exit('h2');

    'e': exit('c3');
    'r': exit('d3');
    't': exit('e3');
    'y': exit('f3');
    'u': exit('g3');
    'i': exit('a3');
    'o': exit('h3');
  else
    result:=' ';
  end;
end;

procedure play(inst: TInstrument; prog: string; start, spacing: double);
var
  note: TNote;
  ch: Char;
  chord: String;
  skip: Boolean;
  i: Integer;
begin
  skip:=false;
  for i:=1 to length(prog) do
  begin
    if skip then
    begin
      skip:=false;
      continue;
    end;

    ch:=prog[i];

    if ch='.' then
    begin
      if note<>nil then
      begin
        note.StopTime:=start+(i-2)*spacing;
        note:=nil;
      end;
    end
    else if ch<>'-' then
    begin
      chord:=ch+prog[i+1];
      skip:=true;

      note:=player.AddNote(TNote.Create(ChordToNote(chord), start+(i-1)*spacing, start+(i+1)*spacing, inst));
    end;
  end;
end;

type
  TChord = record
    Name: char;
    Notes: array of string;
  end;

procedure playCh(inst: TInstrument; prog: string; start, spacing: double; const Chords: array of TChord);
var
  notes: TList;
  ch: Char;
  i, i2: integer;
  chord, n: String;
  note: JSValue;
begin
  notes:=tlist.Create;
  for i:=1 to length(prog) do
  begin
    ch:=prog[i];

    if ch='.' then
    begin
      if notes.Count>0 then
      begin
        for note in notes do
          TNote(note).StopTime:=start+(i-2)*spacing;
        notes.clear;
      end;
    end
    else if ch<>'-' then
    begin
      chord:=ch;

      for i2:=0 to high(chords) do
      begin
        if chords[i2].name=chord then
        begin
          for n in chords[i2].Notes do
            notes.add(player.AddNote(TNote.Create(ChordToNote(n), start+(i-1)*spacing, start+(i+1)*spacing, inst)));
          break;
        end;
      end;
    end;
  end;
  notes.Free;
end;

function Chord(name: char; const notes: array of string): TChord;
begin
  result.name:=name;
  result.Notes:=notes;
end;

function keyDown(aEvent: TJSKeyBoardEvent): boolean;
var
  note: TNote;
  x: double;
  sp, le, f: double;
  i: integer;
begin
  if aevent.key='q' then
  begin
    x:=Player.time;

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
    x:=Player.time;

    sp:=0.33/3.3;
    f:=0.08;
    le:=sp/2;


    for i in [0,2,4,6] do
    begin
      note:=player.AddNote(TNote.Create(ChordToNote('a1'), x+sp*(00+i)+0*f, x+sp*(0+i)+le, tone));
      note:=player.AddNote(TNote.Create(ChordToNote('a2'), x+sp*(00+i)+1*f, x+sp*(0+i)+le, tone));

      note:=player.AddNote(TNote.Create(ChordToNote('g1'), x+sp*(08+i)+0*f, x+sp*(08+i)+le, tone));
      note:=player.AddNote(TNote.Create(ChordToNote('g2'), x+sp*(08+i)+1*f, x+sp*(08+i)+le, tone));

      note:=player.AddNote(TNote.Create(ChordToNote('e1'), x+sp*(16+i)+0*f, x+sp*(16+i)+le, tone));
      note:=player.AddNote(TNote.Create(ChordToNote('e2'), x+sp*(16+i)+1*f, x+sp*(16+i)+le, tone));

      note:=player.AddNote(TNote.Create(ChordToNote('f1'), x+sp*(24+i)+0*f, x+sp*(24+i)+le, tone));
      note:=player.AddNote(TNote.Create(ChordToNote('f2'), x+sp*(24+i)+1*f, x+sp*(24+i)+le, tone));
    end;

    exit;
  end;}

  if noteMap.has(KeyToChord(aevent.key)) then exit;
  if aEvent._repeat then exit;

  note:=player.AddNote(TNote.Create(ChordToNote(KeyToChord(aevent.key)), player.Time, player.time+1000, tone));
  noteMap.&set(KeyToChord(aevent.key), note);
end;

function keyUp(aEvent: TJSKeyBoardEvent): boolean;
var
  note: TNote;
begin
  if not noteMap.has(KeyToChord(aevent.key)) then exit;

  note:=TNote(noteMap.get(KeyToChord(aevent.key)));
  note.StopTime:=player.Time;
  noteMap.delete(KeyToChord(aevent.key));         

  writeln(note.StartTime,',',note.StopTime,',',KeyToChord(aevent.key));
end;

function FetchSamples(APath: string): TJSFloat32Array; async;
var
  response: TJSResponse;
  arrayBuf: TJSArrayBuffer;
begin
  response:=await(window.fetch(APath));

  if not response.ok then
    raise Exception.Create('HTTP error! status: '+str(response.status))
  else begin
    asm
      arrayBuf=await(response.arrayBuffer());
    end;

    result:=TJSFloat32Array.new(arrayBuf);
  end;
end;



begin
  //tone:=Player.AddInstrument(TTone.Create);

  FetchSamples('/bass.raw')._then(function(x: JSValue): JSValue
  begin
    //writeln('test ', TJSFloat32Array(x).length);
    bass:=Player.AddInstrument(TSample.Create(2200, 44100, TJSFloat32Array(x), false));
    bass.DefaultADSR.Attack:=0.05;
    bass.DefaultADSR.Decay:=0.05;
    bass.DefaultADSR.Sustain:=0.9;
    bass.DefaultADSR.Release:=0.4;
  end);
  FetchSamples('/bass2.raw')._then(function(x: JSValue): JSValue
  begin
    tone:=Player.AddInstrument(TSample.Create(300*2, 16000, TJSFloat32Array(x), false));
    tone.DefaultADSR.Attack:=0.005;
    tone.DefaultADSR.Decay:=0.005;
    tone.DefaultADSR.Sustain:=0.2;
    tone.DefaultADSR.Release:=0.3;
  end);

  noteMap:=TJSMap.new;

  window.onkeydown:=@keyDown;
  window.onkeyup:=@keyUp;
  window.setTimeout(@refill, 1);
end.
