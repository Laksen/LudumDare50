unit GameBase;

{$mode objfpc}

interface

uses
  Web,
  audio, GameMath,
  sysutils, classes, contnrs;

type
  TGameBase = class;

  TGameElement = class
  private
    fPosition: TPVector;
    fX, fY: double;
    fTime: double;
  protected
    procedure Update(AGame: TGameBase; ATimeMS: double); virtual;
    procedure Render(AContext: TJSCanvasRenderingContext2D); virtual;
  public
    {procedure SetPosition(AX,AY: double);

    property X: double read fX write fX;
    property Y: double read fY write fY;}

    property Position: TPVector read fPosition write fPosition;
  end;

  TGameTransformMatrix = array[0..5] of double;
  TGamePoint = array[0..1] of double;

  TGameTransform = class
  private
    fScale: double;
    fX: double;
    fY: double;
    function GetMatrix: TGameTransformMatrix;
  public
    constructor Create;

    procedure Translate(AX,AY: double);

    function TransformTo(AX,AY: double): TGamePoint;

    property Matrix: TGameTransformMatrix read GetMatrix;

    property X: double read fX write fX;
    property Y: double read fY write fY;
    property Scale: double read fScale write fScale;
  end;

  TGameTexture = class
  protected
    constructor Create(AWidth, AHeight: longint);
  public
    destructor Destroy; override;
  end;

  TGamePlane = class
  private
    fTransform: TGameTransform;
  protected
    Elements: TList;
  public
    ZIndex: longint;
    Visible: boolean;

    procedure ClearItems;

    constructor Create;

    property Transform: TGameTransform read fTransform write fTransform;
  end;

  TGameBaseState = (bsStart, bsWaitResources, bsWaitClick, bsDone);

  TGameMouseState = (msUp, msDragging, msDown);

  TGameBase = class
  private
    fHeight, fWidth: longint;
    fMouseStartY: Double;
    fMouseStartX: Double;

    fToFree,
    fPlanes: TList;

    fState: TGameBaseState;

    fMouseState: TGameMouseState;

    fUserInteracted: boolean;
    fEvtHandler: JSValue;

    function OnCanvasKeyPress(aEvent: TJSKeyBoardEvent): boolean;
    function OnCanvasKeyUp(aEvent: TJSKeyBoardEvent): boolean;
    function OnCanvasLeave(aEvent: TJSMouseEvent): boolean;
    function OnCanvasMouseDown(aEvent: TJSMouseEvent): boolean;
    function OnCanvasMouseUp(aEvent: TJSMouseEvent): boolean;
    function OnCanvasMove(aEvent: TJSMouseEvent): boolean;
    function OnCanvasWheel(aEvent: TJSWheelEvent): boolean;

    function OnResize(Event: TEventListenerEvent): boolean;

    procedure OnRequestFrame(aTime: TJSDOMHighResTimeStamp);

    procedure UserInteraction;
  protected
    Canvas: TJSHTMLCanvasElement;
    Ctx: TJSCanvasRenderingContext2D;

    procedure InitializeResources; virtual;
    procedure AfterLoad; virtual;

    procedure AfterResize; virtual;

    procedure DoMove(AX,AY: double); virtual;
    procedure DoWheel(AX: double); virtual;
    procedure DoStopDrag(); virtual;
    procedure DoStartDrag(AX,AY: double); virtual;
    procedure DoClick(AX,AY: double; AButtons: longword); virtual;
    procedure DoKeyPress(const AKeyCode: string); virtual;

    procedure Update(ATimeMS: double); virtual;
    procedure Render; virtual;
  public
    function AddPlane(AZIndex: longint; AVisible: boolean=true): TGamePlane;

    procedure AddElement(AElement: TGameElement; ALayer: TGamePlane);
    procedure RemoveElement(AElement: TGameElement; AFreeLater: boolean=false);

    constructor Create;

    procedure Run;

    property Width: longint read fWidth;
    property Height: longint read fHeight;
  end;

implementation

uses
  guictrls,
  Resources;

const
  DragStart = 10;

type
  THackerLabel = class(TGUILabel)
  public
    procedure DoRender(AContext: TJSCanvasRenderingContext2D);
  end;

function SortPlanes(Item1, Item2: JSValue): Integer;
begin
  result:=TGamePlane(item1).ZIndex-TGamePlane(item2).ZIndex;
end;

procedure THackerLabel.DoRender(AContext: TJSCanvasRenderingContext2D);
begin
  Render(AContext);
end;

constructor TGameTexture.Create(AWidth, AHeight: longint);
begin

end;

destructor TGameTexture.Destroy;
begin
  inherited Destroy;
end;

function TGameTransform.GetMatrix: TGameTransformMatrix;
begin
  result[0]:=fScale;  result[1]:=0;
  result[2]:=0;       result[3]:=fScale;
  result[4]:=fX;      result[5]:=fY;
end;

constructor TGameTransform.Create;
begin
  inherited Create;
  fX:=0;
  fY:=0;
  fScale:=1;
end;

procedure TGameTransform.Translate(AX, AY: double);
begin
  fX:=fX+AX;
  fY:=fY+AY;
end;

function TGameTransform.TransformTo(AX, AY: double): TGamePoint;
begin
  result[0]:=(AX-fX)/fScale;
  result[1]:=(AY-fY)/fScale;
end;

procedure TGameElement.Update(AGame: TGameBase; ATimeMS: double);
begin
  fTime:=ATimeMS;
end;

procedure TGameElement.Render(AContext: TJSCanvasRenderingContext2D);
begin
end;

{procedure TGameElement.SetPosition(AX, AY: double);
begin
  fX:=AX;
  fY:=AY;
end;}

procedure TGamePlane.ClearItems;
var
  el: JSValue;
begin
  for el in Elements do
    TObject(el).Destroy;
  Elements.Clear;
end;

constructor TGamePlane.Create;
begin
  inherited Create;
  fTransform:=nil;
  Elements:=TList.Create;
end;

function TGameBase.OnResize(Event: TEventListenerEvent): boolean;
begin
  fWidth :=window.innerwidth;
  fHeight:=window.innerHeight;

  canvas.width :=fWidth;
  canvas.height:=height;

  writeln('Resize: ', fWidth,'x',fHeight);

  AfterResize;
end;

function TGameBase.OnCanvasKeyPress(aEvent: TJSKeyBoardEvent): boolean;
begin
  if fState=bsDone then
    DoKeyPress(AEvent.Key);
  aevent.stopPropagation;
  aEvent.preventDefault;
  result:=false;
end;

function TGameBase.OnCanvasKeyUp(aEvent: TJSKeyBoardEvent): boolean;
begin                      
  aEvent.stopPropagation;
  aEvent.preventDefault;
  result:=false;
end;

function TGameBase.OnCanvasLeave(aEvent: TJSMouseEvent): boolean;
begin
  if fMouseState=msDragging then
  begin
    fMouseState:=msUp;
    DoStopDrag;
  end;
  result:=true;
end;

function TGameBase.OnCanvasMouseDown(aEvent: TJSMouseEvent): boolean;
begin
  result:=true;

  if fState=bsDone then
  begin
    if aEvent.button=0 then
    begin
      fMouseStartX:=aEvent.x;
      fMouseStartY:=aEvent.y;
      fMouseState:=msDown;
    end;
  end;
end;

function TGameBase.OnCanvasMouseUp(aEvent: TJSMouseEvent): boolean;
begin
  if fMouseState<>msUp then
  begin
    if fMouseState=msDragging then
      DoStopDrag
    else
      DoClick(aEvent.x, aEvent.y, aEvent.buttons);
    fMouseState:=msUp;
  end;
  result:=true;
end;

function TGameBase.OnCanvasMove(aEvent: TJSMouseEvent): boolean;
begin
  if fState=bsDone then
  begin
    if (fMouseState=msDown) and (sqr(DragStart)<=(sqr(aEvent.x-fMouseStartX)+sqr(aEvent.y-fMouseStartY))) then
    begin
      fMouseState:=msDragging;
      DoStartDrag(fMouseStartX, fMouseStartY);
    end
    else
      DoMove(AEvent.clientX, AEvent.clientY);
  end;
  result:=true;
end;

function TGameBase.OnCanvasWheel(aEvent: TJSWheelEvent): boolean;
begin
  if fState=bsDone then
    DoWheel(aEvent.deltaY);

  result:=true;
end;

procedure TGameBase.OnRequestFrame(aTime: TJSDOMHighResTimeStamp);
var
  fWaitClickLbl: THackerLabel;
begin
  Ctx.clearRect(0,0,width,height);

  case fState of
    bsWaitResources:
      begin
        ctx.textBaseline:='middle';
        Ctx.fillText(Format('Loading resources: %d out of %d done', [TResources.TotalLoaded, TResources.Total]), 0,0);

        if TResources.Completed then
        begin
          AfterLoad;
          fState:=bsWaitClick;
        end;
      end;
    bsWaitClick:
      begin
        if fUserInteracted then
        begin
          fState:=bsDone;
        end
        else
        begin
          fWaitClickLbl:=THackerLabel.Create;
          fWaitClickLbl.Position:=TPVector.New(0,0);
          fWaitClickLbl.Size:=50;
          fWaitClickLbl.Width:=Canvas.width;
          fWaitClickLbl.Height:=Canvas.height;

          fWaitClickLbl.VAlign:=vaMiddle;
          fWaitClickLbl.HAlign:=haMiddle;

          fWaitClickLbl.Caption:='Click to start game';

          fWaitClickLbl.DoRender(ctx);

          fWaitClickLbl.Free;
        end;
      end;
    bsDone:
      begin
        update(ATime);
        render;
      end;
  end;

  window.requestAnimationFrame(@OnRequestFrame);
end;

procedure TGameBase.InitializeResources;
begin
end;

procedure TGameBase.AfterLoad;
begin
end;

procedure TGameBase.AfterResize;
begin
end;

procedure TGameBase.DoMove(AX, AY: double);
begin
end;

procedure TGameBase.DoWheel(AX: double);
begin
end;

procedure TGameBase.DoStopDrag();
begin

end;

procedure TGameBase.DoStartDrag(AX, AY: double);
begin

end;

procedure TGameBase.DoClick(AX, AY: double; AButtons: longword);
begin
end;

procedure TGameBase.DoKeyPress(const AKeyCode: string);
begin
end;

procedure TGameBase.Update(ATimeMS: double);
var
  plane: TGamePlane;
  i: longint;
  el: JSValue;
begin
  fPlanes.Sort(@SortPlanes);

  MusicPlayer.Update;

  for i:=0 to fPlanes.Count-1 do
  begin
    plane:=TGamePlane(fPlanes[i]);

    for el in plane.Elements do
      TGameElement(el).Update(self, ATimeMS);
  end;

  for i:=0 to fToFree.Count-1 do
    TGameElement(fToFree[i]).Destroy;
  fToFree.Clear;
end;

procedure TGameBase.Render;
var
  plane: TGamePlane;
  i: longint;
  el: JSValue;
  mtx: TGameTransformMatrix;
  doRestore: Boolean;
begin
  for i:=0 to fPlanes.Count-1 do
  begin
    plane:=TGamePlane(fPlanes[i]);

    if not plane.Visible then
      continue;

    if plane.Transform<>nil then
    begin
      Ctx.save;
      mtx:=plane.Transform.Matrix;
      Ctx.setTransform(mtx[0], mtx[1], mtx[2], mtx[3], mtx[4], mtx[5]);
      doRestore:=true;
    end
    else
      doRestore:=false;

    for el in plane.Elements do
      TGameElement(el).Render(Ctx);

    if doRestore then
      ctx.restore;
  end;
end;

function TGameBase.AddPlane(AZIndex: longint; AVisible: boolean): TGamePlane;
begin
  result:=TGamePlane.Create;
  result.Visible:=AVisible;
  Result.ZIndex:=AZIndex;
  fPlanes.Add(result);
end;

procedure TGameBase.AddElement(AElement: TGameElement; ALayer: TGamePlane);
begin
  ALayer.Elements.Add(AElement);
end;

procedure TGameBase.RemoveElement(AElement: TGameElement; AFreeLater: boolean);
var
  plane: TGamePlane;
  i: longint;
begin
  for i:=0 to fPlanes.Count-1 do
  begin
    plane:=TGamePlane(fPlanes[i]);

    if plane.Elements.Remove(AElement)>=0 then
      exit;
  end;

  if AFreeLater then
    fToFree.Add(AElement);
end;

procedure TGameBase.UserInteraction;
begin
  document.body.removeEventListener('click',   fEvtHandler);
  document.body.removeEventListener('scroll',  fEvtHandler);
  document.body.removeEventListener('keydown', fEvtHandler);

  fUserInteracted:=true;
end;

constructor TGameBase.Create;
begin
  inherited Create;
  fToFree:=TList.Create;
  fState:=bsStart;

  fPlanes:=TObjectList.Create(true);

  canvas:=document.getElementById('c') as TJSHTMLCanvasElement;
  ctx:=canvas.getContext('2d') as TJSCanvasRenderingContext2D;
  
  fEvtHandler:=@UserInteraction;
  document.body.addEventListener('click',   fEvtHandler);
  document.body.addEventListener('scroll',  fEvtHandler);
  document.body.addEventListener('keydown', fEvtHandler);

  canvas.onmousedown:=@OnCanvasMouseDown;
  canvas.onmouseup:=@OnCanvasMouseUp;
  Canvas.onmousemove:=@OnCanvasMove;
  Canvas.onwheel:=@OnCanvasWheel;
  Canvas.onmouseleave:=@OnCanvasLeave;

  //document.addEventListener('keydown', @OnCanvasKeyPress);
  //document.addEventListener('keyup', @OnCanvasKeyUp);
  window.onkeydown:=@OnCanvasKeyPress;
  window.onkeyup:=@OnCanvasKeyUp;
  window.onresize:=function(aEvent : TJSUIEvent) : Boolean begin OnResize(nil); end;
  OnResize(nil);

  InitializeResources;
  fState:=bsWaitResources;
end;

procedure TGameBase.Run;
begin
  window.requestAnimationFrame(@OnRequestFrame);
end;

end.

