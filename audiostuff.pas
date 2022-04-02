unit audiostuff;

{$mode ObjFPC}

interface

uses
  Classes, SysUtils,
  js, audio;

type
  TBassDrum = class(TInstrument)
  public
    procedure Render(ANote: TNote; AStartTime, AStopTime: double; ABuffer: TJSFloat32Array; AOffset, ACount: integer); override;
  end;

  TTone = class(TInstrument)
  public
    procedure Render(ANote: TNote; AStartTime, AStopTime: double; ABuffer: TJSFloat32Array; AOffset, ACount: integer); override;
  end;

  TSample = class(TInstrument)
  private
    fNaturalFreq, fSampleRate: Double;
    fLoop: Boolean;
    fSamples: TJSFloat32Array;
  protected
    function GetDefaultADSR: TASDR; override;
  public
    procedure Render(ANote: TNote; AStartTime, AStopTime: double; ABuffer: TJSFloat32Array; AOffset, ACount: integer); override;

    constructor Create(ANaturalFreq, ASampleRate: double; ASample: TJSFloat32Array; ALooping: boolean);
  end;

implementation

uses
  math;

const
  startFreq = 1e3;
  stopFreq = 10;

function TSample.GetDefaultADSR: TASDR;
begin
  result.Attack :=0;
  result.Decay  :=0;
  result.Sustain:=1;
  result.Release:=0;
end;

procedure TSample.Render(ANote: TNote; AStartTime, AStopTime: double; ABuffer: TJSFloat32Array; AOffset, ACount: integer);
var
  time, sampleStep, ph, delta, env: Double;
  i, Index, wrappedIndex: NativeInt;
begin
  ph:=ANote.LastPhase;
  sampleStep:=ANote.Key/fNaturalFreq*(SampleRate/fSampleRate);
  delta:=(AStopTime-AStartTime)/ACount;

  for i:=0 to ACount-1 do
  begin
    time:=AStartTime+delta*i;

    env:=ANote.CalcEnvelope(time);
    if env<=0 then continue;

    ph:=ph+sampleStep;

    Index:=Round(ph);
    if index>=fSamples.length then
    begin
      wrappedIndex:=Index mod fSamples.length;
      ph:=ph-(Index-wrappedIndex);
      index:=wrappedIndex;
    end;

    ABuffer[AOffset+i]:=ABuffer[AOffset+i]+env*fSamples[Index];
  end;

  ANote.LastPhase:=ph;
end;

constructor TSample.Create(ANaturalFreq, ASampleRate: double; ASample: TJSFloat32Array; ALooping: boolean);
begin
  inherited Create;
  fNaturalFreq:=ANaturalFreq;
  fSampleRate:=ASampleRate;
  fLoop:=ALooping;
  fSamples:=ASample;
end;

procedure TTone.Render(ANote: TNote; AStartTime, AStopTime: double; ABuffer: TJSFloat32Array; AOffset, ACount: integer);
var
  ff, delta, ph, time, env: Double;
  i: Integer;
begin
  ff:=1/SampleRate;
  delta:=(AStopTime-AStartTime)/ACount;

  ph:=ANote.LastPhase;

  for i:=0 to ACount-1 do
  begin
    time:=AStartTime+delta*i;

    env:=ANote.CalcEnvelope(time);
    if env<=0 then continue;

    ph:=ph+ANote.Key*ff;
    ABuffer[AOffset+i]:=ABuffer[AOffset+i]+0.2*math.Power((ph-math.floor(ph)-0.5*2), 3)*env;
  end;

  ANote.LastPhase:=ph;
end;

procedure TBassDrum.Render(ANote: TNote; AStartTime, AStopTime: double; ABuffer: TJSFloat32Array; AOffset, ACount: integer);
var
  time, delta, env, a, b, freq, ff, ph: double;
  i: Integer;
begin
  a:=ln(startFreq-stopFreq);
  b:=stopFreq;

  ff:=2*pi/SampleRate;
  delta:=(AStopTime-AStartTime)/ACount;

  ph:=ANote.LastPhase;

  for i:=0 to ACount-1 do
  begin
    time:=AStartTime+delta*i;

    env:=ANote.CalcEnvelope(time);
    if env<=0 then continue;

    freq:=Exp(-(time-a))+b;

    ph:=ph+freq*ff;
    ABuffer[AOffset+i]:=ABuffer[AOffset+i]+sin(ph)*env;
  end;

  ANote.LastPhase:=ph;
end;

end.

