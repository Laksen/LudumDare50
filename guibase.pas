unit guibase;

{$mode objfpc}
{$modeswitch advancedrecords}

interface

uses
  Web,
  gamebase,
  Classes, SysUtils;

type
  TGUIElement = class;

  TGUIPoint = record
    X,Y: double;
    class function Create(const AX,AY: double): TGUIPoint; static;
  end;

  TGUICallback = procedure(ATarget: TGUIElement; const APosition: TGUIPoint) of object;

  TGUIElement = class(TGameElement)
  private
    fHeight: longint;
    fHitTestVisible: boolean;
    fLeft: longint;
    fOnClick: TGUICallback;
    fOnMouseEnter: TGUICallback;
    fOnMouseLeave: TGUICallback;
    fParent: TGUIElement;
    fTop: longint;
    fVisible: boolean;
    fWidth: longint;

    fChildren: TList;
    function GetChild(AIndex: longint): TGUIElement;
    function GetChildCount: longint;
  protected
    procedure Render(AContext: TJSCanvasRenderingContext2D); override;

    procedure NotifyRemovedSubchild(AChild: TGUIElement); virtual;

    procedure DoMouseLeave(const ACoord: TGUIPoint); virtual;
    procedure DoMouseEnter(const ACoord: TGUIPoint); virtual;

    function HitTest(ACoord: TGUIPoint): boolean;
    function HitChild(ACoord: TGUIPoint): longint;
  public
    constructor Create;
    destructor Destroy; override;

    procedure DoClick(ACoord: TGUIPoint; var AHandled: boolean); virtual;
    procedure DoMove(ACoord: TGUIPoint; var AHit: boolean; var AControl: TGUIElement); virtual;

    function TranslateToLocal(const AGlobal: TGUIPoint): TGUIPoint;
    function TranslateToGlobal(const ALocal: TGUIPoint): TGUIPoint;

    procedure AddChild(AChild: TGUIElement);
    procedure RemoveChild(AChild: TGUIElement);

    property ChildCount: longint read GetChildCount;
    property Child[AIndex: longint]: TGUIElement read GetChild; default;

    property Visible: boolean read fVisible write fVisible;
    property HitTestVisible: boolean read fHitTestVisible write fHitTestVisible;

    property Width: longint read fWidth write fWidth;
    property Height: longint read fHeight write fHeight;

    property Parent: TGUIElement read fParent write fParent;

    property OnClick: TGUICallback read fOnClick write fOnClick;
    property OnMouseEnter: TGUICallback read fOnMouseEnter write fOnMouseEnter;
    property OnMouseLeave: TGUICallback read fOnMouseLeave write fOnMouseLeave;
  end;

  TGUI = class(TGUIElement)
  private
    fCurrentHover: TGUIElement;
  protected
    procedure NotifyRemovedSubchild(AChild: TGUIElement); override;
  public
    procedure Update(AGame: TGameBase; ATimeMS: double); virtual;

    procedure DoRender(AContext: TJSCanvasRenderingContext2D);
    procedure DoClick(ACoord: TGUIPoint; var AHandled: boolean); override;
    procedure DoMove(ACoord: TGUIPoint; var AHit: boolean; var AControl: TGUIElement); override;
  end;

implementation

procedure TGUI.NotifyRemovedSubchild(AChild: TGUIElement);
begin
  if AChild=fCurrentHover then
    fCurrentHover:=nil;
end;

procedure TGUI.Update(AGame: TGameBase; ATimeMS: double);
begin
end;

procedure TGUI.DoRender(AContext: TJSCanvasRenderingContext2D);
begin
  Render(AContext);
end;

procedure TGUI.DoClick(ACoord: TGUIPoint; var AHandled: boolean);
var
  Hit: LongInt;
begin
  AHandled:=false;

  Hit:=HitChild(ACoord);
  if (Hit>=0) then
    Child[hit].DoClick(TranslateToLocal(ACoord), AHandled);
end;

procedure TGUI.DoMove(ACoord: TGUIPoint; var AHit: boolean; var AControl: TGUIElement);
var
  leaving, entering: Boolean;
begin
  inherited DoMove(ACoord, AHit, AControl);

  leaving:=(not AHit) or ((AControl<>fCurrentHover) and assigned(fCurrentHover));
  entering:=AHit and (AControl<>fCurrentHover);

  if leaving and assigned(fCurrentHover) then
  begin
    fCurrentHover.DoMouseLeave(ACoord);
    fCurrentHover:=nil;
  end;

  if entering then
  begin
    fCurrentHover:=AControl;
    fCurrentHover.DoMouseEnter(ACoord);
  end;
end;

class function TGUIPoint.Create(const AX, AY: double): TGUIPoint;
begin
  result.X:=AX;
  result.Y:=AY;
end;

function TGUIElement.GetChild(AIndex: longint): TGUIElement;
begin
  result:=TGUIElement(fChildren[AIndex]);
end;

function TGUIElement.GetChildCount: longint;
begin
  result:=fChildren.Count;
end;

procedure TGUIElement.Render(AContext: TJSCanvasRenderingContext2D);
var
  i: longint;
begin
  AContext.save;
  AContext.translate(Position.X,Position.Y);

  for i:=0 to fChildren.Count-1 do
    TGUIElement(fChildren[i]).Render(AContext);

  AContext.restore;
end;

procedure TGUIElement.NotifyRemovedSubchild(AChild: TGUIElement);
begin
  if assigned(fParent) then
    fParent.NotifyRemovedSubchild(AChild);
end;

procedure TGUIElement.DoMouseLeave(const ACoord: TGUIPoint);
begin
  if assigned(fOnMouseLeave) then
    fOnMouseLeave(self, ACoord);
end;

procedure TGUIElement.DoMouseEnter(const ACoord: TGUIPoint);
begin
  if assigned(fOnMouseEnter) then
    fOnMouseEnter(self, ACoord);
end;

procedure TGUIElement.DoClick(ACoord: TGUIPoint; var AHandled: boolean);
var
  Hit: LongInt;
begin
  AHandled:=true;

  Hit:=HitChild(ACoord);
  if (Hit>=0) then
  begin
    Child[hit].DoClick(TranslateToLocal(ACoord), AHandled);
    if AHandled then
      exit;
  end;

  if assigned(fOnClick) then
    fOnClick(self, ACoord);
end;

procedure TGUIElement.DoMove(ACoord: TGUIPoint; var AHit: boolean; var AControl: TGUIElement);
var
  Hit: LongInt;
begin
  AHit:=true;
  AControl:=self;

  Hit:=HitChild(ACoord);
  if (Hit>=0) then
    Child[hit].DoMove(TranslateToLocal(ACoord), AHit, AControl);
end;

function TGUIElement.HitTest(ACoord: TGUIPoint): boolean;
begin
  result:=fHitTestVisible and
          (ACoord.X>=Position.X) and
          (ACoord.Y>=Position.Y) and
          (ACoord.X<(Position.X+Width)) and
          (ACoord.Y<(Position.Y+Height));
end;

function TGUIElement.HitChild(ACoord: TGUIPoint): longint;
var
  local: TGUIPoint;
  i: longint;
begin
  result:=-1;
  if fChildren.Count>0 then
  begin
    local:=TranslateToLocal(ACoord);

    for i:=0 to ChildCount-1 do
      if Child[i].HitTest(local) then
        result:=i;
  end;
end;

constructor TGUIElement.Create;
begin
  inherited Create;
  fChildren:=TList.Create;
  fVisible:=true;
  fHitTestVisible:=true;
end;

destructor TGUIElement.Destroy;
var
  i: longint;
begin
  for i:=0 to fChildren.Count-1 do
    TGUIElement(fChildren[i]).Destroy;
  fChildren.Free;
  inherited Destroy;
end;

function TGUIElement.TranslateToLocal(const AGlobal: TGUIPoint): TGUIPoint;
begin
  result:=TGUIPoint.Create(AGlobal.X-Position.X, AGlobal.Y-Position.Y);
end;

function TGUIElement.TranslateToGlobal(const ALocal: TGUIPoint): TGUIPoint;
begin
  result:=TGUIPoint.Create(ALocal.X+Position.X, ALocal.Y+Position.Y);
end;

procedure TGUIElement.AddChild(AChild: TGUIElement);
begin
  AChild.Parent:=self;
  fChildren.Add(AChild);
end;

procedure TGUIElement.RemoveChild(AChild: TGUIElement);
begin
  AChild.Parent:=nil;
  fChildren.Remove(AChild);
end;

end.

