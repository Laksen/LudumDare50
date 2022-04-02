program ld50;

{$mode objfpc}

uses
  JS, Classes, SysUtils, math, Web,
  libjquery, webaudio,
  audio, audiostuff,
  GameVerlets, GameMath, GameBase, Resources, tmp, guibase, guictrls;

type
  TRoundStatus = (
    rsLoading,
    rsLoaded,
    rsStarting,
    rsGoing,
    rsEnded
  );

  TRound = record
    State: TRoundStatus;

    Word,
    Buffer,
    InputSequence: string;

    StartTime,
    StopTime: double;

    Mistypes,
    Correct: integer;
  end;

  TLD50 = class(TGameBase)
  private  
    gameLayer,
    prepLayer,
    postLayer: TGamePlane;

    // Post-game
    statusLbl: TGUILabel;
    instructionLbl: array[0..2] of TGUILabel;

    // Prep            
    prepPnl: TGUIPanel;
    prepLbl2, prepLbl: TGUILabel;

    // Game
    charLbl,
    targetLbl,
    winsLbl: TGUILabel;
    infoPnl: TGUIPanel;
    roundProgress: TGUIProgressBar;

    rnd: TRound;

    lastTime: double;

    bass: TInstrument;

    procedure StartRound(const ATarget: string; ACurrentTime, APreRunTime, ARoundLength: double);
    procedure EndRound;
    procedure AddMatch;
    procedure AddMiss(const AKeyCode: string);

    procedure SubmitScore;
  protected
    procedure InitializeResources; override;
    procedure AfterLoad; override;

    procedure Update(ATimeMS: double); override;
    procedure Render; override;
    procedure AfterResize; override;

    procedure DoKeyPress(const AKeyCode: string); override;
  end;

procedure TLD50.StartRound(const ATarget: string; ACurrentTime, APreRunTime, ARoundLength: double);
begin
  rnd.Word:=ATarget;
  rnd.Buffer:='>';
  rnd.InputSequence:='';
  rnd.Mistypes:=0;
  rnd.Correct:=0;
  rnd.StartTime:=ACurrentTime+APreRunTime*1e3;
  rnd.StopTime:=ACurrentTime+(APreRunTime+ARoundLength)*1e3;
  rnd.State:=rsStarting;

  charLbl.Caption:=rnd.Buffer;
  targetLbl.Caption:=format('>%s<', [ATarget]);

  roundProgress.Min:=ACurrentTime+APreRunTime*1e3;
  roundProgress.Max:=ACurrentTime+(APreRunTime+ARoundLength)*1e3;
  roundProgress.Value:=0;
                           
  prepLayer.Visible:=true;
  gameLayer.Visible:=false;
  postLayer.Visible:=false;
  prepLbl2.Caption:=format('%4.3f', [(APreRunTime*1e3)/1000]);
end;

procedure TLD50.EndRound;
begin
  statusLbl.Caption:=Format('Correct: %d', [rnd.Correct]);
end;

procedure TLD50.AddMatch;
begin
  inc(rnd.Correct);
  winsLbl.Caption:=Format('Correct: %d', [rnd.Correct]);

  MusicPlayer.AddNote(TNote.Create(440+20*rnd.Correct, MusicPlayer.Time+0.05, MusicPlayer.Time+0.30, bass));
end;

procedure TLD50.AddMiss(const AKeyCode: string);
begin
  inc(rnd.Mistypes);
end;

procedure TLD50.SubmitScore;
var
  form: TJSHTMLFormElement;
begin
  TJSHTMLInputElement(document.getElementsByName('run_score')[0]).value:=inttostr(rnd.Correct);
  TJSHTMLInputElement(document.getElementsByName('run_sequence')[0]).value:=rnd.InputSequence;
  TJSHTMLFormElement(document.getElementById('submit_form')).submit;
end;

procedure TLD50.InitializeResources;
begin
  TResources.AddResource('/ld50/samples/bass.raw', rtArrayBuffer);
end;

procedure TLD50.AfterLoad;
const
  instructionCaptions: array[0..2] of string = ('Retry: F5', 'Submit score: Enter', 'Exit to menu: Escape');
var
  i: Integer;
begin
  bass:=MusicPlayer.AddInstrument(TSample.Create(2200, 44100, TJSFloat32Array.new(TResources.GetArrayBuffer('/ld50/samples/bass.raw')), false));
  bass.DefaultADSR.Attack:=0.005;
  bass.DefaultADSR.Decay:=0.005;
  bass.DefaultADSR.Sustain:=0.2;
  bass.DefaultADSR.Release:=0.3;

  gameLayer:=AddPlane(0);
  prepLayer:=AddPlane(1);
  postLayer:=AddPlane(1, false);

  // Game
  charLbl:=TGUILabel.Create;
  charLbl.Size:=72;
  charLbl.Width:=Canvas.width;
  charLbl.Height:=Canvas.height;
  charLbl.HAlign:=haRight;
  charLbl.VAlign:=vaMiddle;
  charLbl.Caption:='test';
  AddElement(charLbl, gameLayer);

  targetLbl:=TGUILabel.Create;
  targetLbl.Size:=50;                       
  targetLbl.Position.Y:=round(Canvas.height/10);
  targetLbl.Width:=Canvas.width;
  targetLbl.Height:=round(Canvas.height/5);
  targetLbl.HAlign:=haMiddle;
  targetLbl.VAlign:=vaMiddle;
  targetLbl.Caption:='><';
  AddElement(targetLbl, gameLayer);

  winsLbl:=TGUILabel.Create;
  winsLbl.Size:=48;
  winsLbl.Width:=round(Canvas.width/3);
  winsLbl.Height:=round(Canvas.height/10);
  winsLbl.HAlign:=haLeft;
  winsLbl.VAlign:=vaMiddle;
  winsLbl.Caption:='Correct: 0';

  infoPnl:=TGUIPanel.Create;
  infoPnl.Width:=Canvas.width;
  infoPnl.Height:=round(Canvas.height/10);
  infoPnl.BackGround:='#7bca92';
  infoPnl.AddChild(winsLbl);
  AddElement(infoPnl, gameLayer);

  roundProgress:=TGUIProgressBar.Create;        
  roundProgress.Position.Y:=round(Canvas.height-Canvas.height/10);
  roundProgress.Width:=Canvas.width;
  roundProgress.Height:=ceil(Canvas.height/10);
  roundProgress.Min:=0;
  roundProgress.Max:=100;
  roundProgress.Value:=0;
  roundProgress.Foreground:='#7bca92';
  AddElement(roundProgress, gameLayer);

  // Prep
  prepLbl:=TGUILabel.Create;
  prepLbl.Size:=72;
  prepLbl.Width:=Canvas.width;
  prepLbl.Height:=Canvas.height;
  prepLbl.HAlign:=haMiddle;
  prepLbl.VAlign:=vaMiddle;
  prepLbl.Caption:='Get ready';

  prepLbl2:=TGUILabel.Create;
  prepLbl2.Size:=72;          
  prepLbl2.Position.Y:=round(Canvas.height-Canvas.height/10);
  prepLbl2.Width:=Canvas.width;
  prepLbl2.Height:=ceil(Canvas.height/10);
  prepLbl2.HAlign:=haMiddle;
  prepLbl2.VAlign:=vaMiddle;
  prepLbl2.Caption:='0.000';

  prepPnl:=TGUIPanel.Create;
  prepPnl.Width:=Canvas.width;
  prepPnl.Height:=Canvas.height;
  prepPnl.AddChild(prepLbl);
  prepPnl.AddChild(prepLbl2);

  AddElement(prepPnl, prepLayer);
  AddElement(prepLbl2, gameLayer);

  // Post game
  statusLbl:=TGUILabel.Create;
  statusLbl.Size:=72;
  statusLbl.Width:=Canvas.width;
  statusLbl.Height:=Canvas.height;
  statusLbl.HAlign:=haMiddle;
  statusLbl.VAlign:=vaMiddle;
  statusLbl.Caption:='Words: 0';
  AddElement(statusLbl, postLayer);

  for i:=0 to 2 do
  begin
    instructionLbl[i]:=TGUILabel.Create;
    instructionLbl[i].Size:=50;
    instructionLbl[i].Position.y:=(i+7)*(Canvas.height/10);
    instructionLbl[i].Width:=Canvas.width;
    instructionLbl[i].Height:=Canvas.height div 10;
    instructionLbl[i].HAlign:=haMiddle;
    instructionLbl[i].VAlign:=vaMiddle;
    instructionLbl[i].Caption:=instructionCaptions[i];
    AddElement(instructionLbl[i], postLayer);
  end;

  rnd.State:=rsLoaded;
end;

procedure TLD50.Update(ATimeMS: double);
var
  target: String;
begin
  inherited Update(ATimeMS);

  lastTime:=ATimeMS;

  case rnd.State of
    rsLoaded:
      begin
        target:=TJSHTMLInputElement(document.getElementsByName('run_word')[0]).value;
        StartRound(target, ATimeMS, 3, 20);
      end;
    rsStarting:
      begin
        prepLbl2.Caption:=format('%4.3f', [(rnd.StartTime-ATimeMS)/1000]);
        if ATimeMS>=rnd.StartTime then
        begin
          rnd.State:=rsGoing;
          prepLayer.Visible:=false;
          gameLayer.Visible:=true;
          postLayer.Visible:=false;
        end;
      end;
    rsGoing:
      begin                        
        roundProgress.Value:=ATimeMS;
        prepLbl2.Caption:=format('Remaining: %4.3f', [(rnd.StopTime-ATimeMS)/1000]);

        if ATimeMS>=rnd.StopTime then
        begin
          EndRound();

          rnd.State:=rsEnded;
          prepLayer.Visible:=false;
          gameLayer.Visible:=false;
          postLayer.Visible:=true;
        end;
      end;
  end;
end;

procedure TLD50.Render;
begin
  inherited Render;
end;

procedure TLD50.AfterResize;
var
  i: Integer;
begin
  if assigned(charLbl) then
  begin
    charLbl.Width:=Canvas.width;
    charLbl.Height:=Canvas.height;

    targetLbl.Position.Y:=round(Canvas.height/10);
    targetLbl.Width:=Canvas.width;
    targetLbl.Height:=round(Canvas.height/5);

    winsLbl.Width:=round(Canvas.width/3);
    winsLbl.Height:=round(Canvas.height/10);

    infoPnl.Width:=Canvas.width;
    infoPnl.Height:=round(Canvas.height/10);

    roundProgress.Position.y:=Canvas.height-Canvas.height/10;
    roundProgress.Width:=Canvas.width;
    roundProgress.Height:=ceil(Canvas.height/10);

    prepLbl.Width:=Canvas.width;
    prepLbl.Height:=Canvas.height;
    prepLbl2.Position.y:=Canvas.height-Canvas.height/10;
    prepLbl2.Width:=Canvas.width;
    prepLbl2.Height:=ceil(Canvas.height/10);
    prepPnl.Width:=Canvas.width;
    prepPnl.Height:=Canvas.height;

    statusLbl.Width:=Canvas.width;
    statusLbl.Height:=Canvas.height;

    for i:=0 to 2 do
    begin
      instructionLbl[i].Position.y:=(i+7)*(Canvas.height/10);
      instructionLbl[i].Width:=Canvas.width;
      instructionLbl[i].Height:=Canvas.height div 10;
    end;
  end;
end;

procedure TLD50.DoKeyPress(const AKeyCode: string);
var
  s, ch: String;
  i: Integer;
begin
  if rnd.State=rsGoing then
  begin   
    if length(AKeyCode)<>1 then exit;

    ch:=lowercase(AKeyCode);

    s:=rnd.Buffer+ch;
    rnd.InputSequence:=rnd.InputSequence+ch;

    i:=pos(rnd.Word, s);
    if i>0 then
    begin
      delete(s, i, length(rnd.Word));
      AddMatch();
    end
    else
      AddMiss(ch);

    rnd.Buffer:=s;

    if length(s)>50 then
      charLbl.Caption:=copy(s, length(s)-50)
    else
      charLbl.Caption:=s;
  end
  else if rnd.State=rsEnded then
  begin
    case AKeyCode of
      'F5':
        StartRound(rnd.Word, lastTime, 3, 20);
      'Enter':
        SubmitScore;
      'Escape':
        window.location.replace('/ld50/index.php');
    end;
  end;
end;

begin
  TLD50.Create.Run();
end.
