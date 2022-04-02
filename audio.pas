unit audio;

{$mode ObjFPC}
{$WARN 4501 off : }
{$WARN 5023 off : }
{$WARN 5024 off : }
interface

uses
  Classes, contnrs, SysUtils,
  webaudio, js, web;

type        
  TNote = class;

  TASDR = record
    Attack,
    Decay,
    Sustain,
    Release: double;
  end;

  TInstrument = class
  protected
    function GetDefaultADSR: TASDR; virtual;
  public
    SampleRate: double;                                                                                                        
    DefaultADSR: TASDR;
    constructor Create;
    procedure Render(ANote: TNote; AStartTime, AStopTime: double; ABuffer: TJSFloat32Array; AOffset, ACount: integer); virtual; abstract;
  end;

  TNote = class
  private
    function GetFinalTime: double;
  public
    Key: double;
    StartTime, StopTime: double;
    Instrument: TInstrument;
    ADSR: TASDR;

    LastPhase: double;

    Done: boolean;

    function CalcEnvelope(ATime: double): double;

    constructor Create(AKey: double; AStartTime, AStopTime: double; AInstrument: TInstrument);
    property FinalTime: double read GetFinalTime;
  end;

  TSong = class
  private
  public
  end;

  TMusicPlayer = class
  private
    fInstruments,
    fNotes: TList;
  private
    fFreeBuffers,
    fPlaybackBuffers: TList;

    fSampleIndex: integer;
    procedure Refill;
    function GetTime: double;
  private                                               
    context: TJSAudioContext;
    spn: TJSScriptProcessorNode;
    evtHandler: JSValue;
    function processAudio(Event: TEventListenerEvent): boolean;
    procedure UserInteraction(Event: TJSEvent);
  public
    function AddInstrument(AInstr: TInstrument): TInstrument;
    function AddNote(ANote: TNote): TNote;

    procedure Update;

    constructor Create;
    destructor Destroy; override;

    property Time: double read GetTime;
  end;

var
  Player: TMusicPlayer;

implementation

function TNote.GetFinalTime: double;
begin
  result:=StopTime+ADSR.Release;
end;

function Lerp(T,a,b,y0,y1: double): double;
var
  factor: Double;
begin
  factor:=(t-a)/(b-a);
  result:=(y1-y0)*factor+y0;
end;

function TNote.CalcEnvelope(ATime: double): double;
var
  delta: Double;
begin
  if Done then exit(0);

  delta:=ATime-StartTime;
  if delta<0 then exit(0);
  if ATime>=FinalTime then
  begin
    Done:=true;
    exit(0);
  end;

  if delta<ADSR.Attack then Exit(Lerp(delta,0,ADSR.Attack,0,1));
  delta:=delta-ADSR.Attack;

  if delta<ADSR.Decay then Exit(Lerp(delta,0,adsr.Decay,1,adsr.Sustain));
  if ATime<StopTime then exit(ADSR.Sustain);

  exit(Lerp(ATime, StopTime, FinalTime, ADSR.Sustain, 0));
end;

constructor TNote.Create(AKey: double; AStartTime, AStopTime: double; AInstrument: TInstrument);
begin
  inherited Create;
  Key:=AKey;
  StartTime:=AStartTime;
  StopTime:=AStopTime;
  Instrument:=AInstrument;
  ADSR:=AInstrument.DefaultADSR;
end;

function TInstrument.GetDefaultADSR: TASDR;
begin
  result.Attack :=0.01;
  result.Decay  :=0.005;
  result.Sustain:=0.8;
  result.Release:=0.666;
end;

constructor TInstrument.Create;
begin
  inherited Create;
  DefaultADSR:=GetDefaultADSR;
end;

procedure TMusicPlayer.Refill;
var
  startTime, stopTime: Double;
  buf: TJSFloat32Array;
  noteObj: JSValue;
  note: TNote;
  remove: TList;
begin
  buf:=TJSFloat32Array(fFreeBuffers.First);
  fFreeBuffers.Delete(0);

  startTime:=fSampleIndex/context.sampleRate;
  stopTime:=(fSampleIndex+buf.length)/context.sampleRate;

  remove:=TList.Create;
  for noteObj in fNotes do
  begin
    note:=TNote(noteObj);
    if note.Done then
      remove.Add(note)
    else
      note.Instrument.Render(note, startTime, stopTime, buf, 0, buf.length);
  end;

  for noteObj in remove do
  begin
    fNotes.Remove(noteObj);
    TNote(noteObj).Destroy;
  end;

  remove.Free;

  fPlaybackBuffers.Add(buf);

  inc(fSampleIndex, buf.length);
end;

function TMusicPlayer.GetTime: double;
begin
  result:=fSampleIndex/context.sampleRate;
end;

function clamp(x: double): double;
begin
  if x>1 then result:=1
  else if x<-1 then result:=-1
  else
    result:=x;
end;

function TMusicPlayer.processAudio(Event: TEventListenerEvent): boolean;
var
  ob: TJSAudioBuffer;
  buf: TJSFloat32Array;
  i: Integer;
begin
  asm
    ob=Event.outputBuffer;
  end;

  if fPlaybackBuffers.Count>0 then
  begin
    buf:=TJSFloat32Array(fPlaybackBuffers.First);
    fPlaybackBuffers.Delete(0);

    for i:=0 to buf.length-1 do
      buf[i]:=clamp(buf[i]);

    ob.copyToChannel(buf, 0);

    buf.fill(0.0);
    fFreeBuffers.Add(buf);
  end;

  result:=true;
end;

procedure TMusicPlayer.UserInteraction(Event: TJSEvent);
var
  i, bufSize: Integer;
begin
  document.body.removeEventListener('click',   evtHandler);
  document.body.removeEventListener('scroll',  evtHandler);
  document.body.removeEventListener('keydown', evtHandler);

  bufSize:=1024;

  for i:=0 to 1 do
    fFreeBuffers.Add(TJSFloat32Array.new(bufSize));

  context.resume;

  spn:=context.createScriptProcessor(bufSize, 0, 1);
  spn.onaudioprocess:=@processAudio;
  spn.connect(context.destination);
end;

function TMusicPlayer.AddInstrument(AInstr: TInstrument): TInstrument;
begin
  AInstr.SampleRate:=context.sampleRate;
  fInstruments.Add(AInstr);
  result:=AInstr;
end;

function TMusicPlayer.AddNote(ANote: TNote): TNote;
begin
  fNotes.Add(ANote);
  result:=anote;
end;

procedure TMusicPlayer.Update;
begin
  while fFreeBuffers.Count>0 do
    Refill;
end;

constructor TMusicPlayer.Create;
begin
  inherited Create;             
  context:=TJSAudioContext.new;

  evtHandler:=@UserInteraction;
  document.body.addEventListener('click',   evtHandler);
  document.body.addEventListener('scroll',  evtHandler);
  document.body.addEventListener('keydown', evtHandler);

  fInstruments:=TObjectList.Create(true);
  fNotes:=TList.Create;
  fFreeBuffers:=TList.Create;
  fPlaybackBuffers:=TList.Create;
end;

destructor TMusicPlayer.Destroy;
begin
  fFreeBuffers.Free;
  fPlaybackBuffers.Free;
  fNotes.Free;
  fInstruments.Free;
  inherited Destroy;
end;

initialization
  Player:=TMusicPlayer.Create;

end.

