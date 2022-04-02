unit guictrls;

{$mode objfpc}

interface

uses
  guibase, web;

type
  TGUIImage = class(TGUIElement)
  private
    fImage: TJSElement;
  protected
    procedure Render(AContext: TJSCanvasRenderingContext2D); override;
  public
    property Image: TJSElement read fImage write fImage;
  end;

  TGUIPanel = class(TGUIElement)
  private
    fBackGround: string;
  protected
    procedure Render(AContext: TJSCanvasRenderingContext2D); override;
  public
    constructor Create;

    property BackGround: string read fBackGround write fBackGround;
  end;

  TGUILabelVAlign = (vaTop, vaMiddle, vaBottom);
  TGUILabelHAlign = (haLeft, haMiddle, haRight);

  TGUILabel = class(TGUIElement)
  private
    fCaption: string;
    fFormat,
    fFont: string;
    fHAlign: TGUILabelHAlign;
    fSize: longint;
    fVAlign: TGUILabelVAlign;
    procedure SetFont(AValue: string);
    procedure SetSize(AValue: longint);
  protected
    procedure Render(AContext: TJSCanvasRenderingContext2D); override;
  public
    constructor Create;

    property Caption: string read fCaption write fCaption;
    property Font: string read fFont write SetFont;
    property Size: longint read fSize write SetSize;

    property VAlign: TGUILabelVAlign read fVAlign write fVAlign;
    property HAlign: TGUILabelHAlign read fHAlign write fHAlign;
  end;

  TGUIProgressBar = class(TGUIElement)
  private
    fBackground: string;
    fBorder: string;
    fBorderWidth: double;
    fForeground: string;
    fMax: double;
    fMin: double;
    fValue: double;
  protected
    procedure Render(AContext: TJSCanvasRenderingContext2D); override;
  public
    property Background: string read fBackground write fBackground;
    property Foreground: string read fForeground write fForeground;
    property BorderStyle: string read fBorder write fBorder;
    property BorderWidth: double read fBorderWidth write fBorderWidth;

    property Min: double read fMin write fMin;
    property Max: double read fMax write fMax;
    property Value: double read fValue write fValue;
  end;

implementation

uses
  sysutils;

procedure TGUIProgressBar.Render(AContext: TJSCanvasRenderingContext2D);
var
  bw2, w: Double;
begin
  AContext.save;

  if fBackground<>'' then
  begin
    AContext.fillStyle:=fBackground;
    AContext.fillRect(Position.X,Position.Y, Width,Height);
  end;

  if fMax>fMin then
  begin
    w:=(fValue-fMin)/(fMax-fMin);
    if w>1 then w:=1;

    if w>0 then
    begin
      AContext.fillStyle:=fForeground;
      AContext.fillRect(Position.X,Position.Y, w*Width,Height);
    end;
  end;

  if (fBorderWidth>0) and (fBorder<>'') then
  begin
    AContext.strokeStyle:=fBorder;
    AContext.lineWidth:=fBorderWidth;
    bw2:=fBorderWidth/2;
    AContext.strokeRect(Position.X+bw2, Position.Y+bw2,
                        Width-fBorderWidth, Height-fBorderWidth);
  end;

  AContext.restore;

  inherited Render(AContext);
end;

procedure TGUIPanel.Render(AContext: TJSCanvasRenderingContext2D);
begin
  if BackGround<>'' then
  begin
    AContext.save;
    AContext.fillStyle:=fBackGround;
    AContext.fillRect(Position.X,Position.Y, Width,Height);
    AContext.restore;
  end;

  inherited Render(AContext);
end;

constructor TGUIPanel.Create;
begin
  inherited Create;
  fBackGround:='rgb(0,0,0,0.0)';
end;

procedure TGUILabel.SetFont(AValue: string);
begin
  if fFont=AValue then Exit;
  fFont:=AValue;

  fFormat:=Format('%dpx %s', [fSize,fFont]);
end;

procedure TGUILabel.SetSize(AValue: longint);
begin
  if fSize=AValue then Exit;
  fSize:=AValue;
  fFormat:=Format('%dpx %s', [fSize,fFont]);
end;

procedure TGUILabel.Render(AContext: TJSCanvasRenderingContext2D);
var
  measurement: TJSTextMetrics;
  ly, lx: double;
begin
  AContext.save;

  case VAlign of
    vaTop:
      begin
        ly:=Position.Y;
        AContext.textBaseline:='top';
      end;
    vaMiddle:
      begin
        ly:=Position.Y+Height/2;
        AContext.textBaseline:='middle';
      end;
    vaBottom:
      begin
        ly:=Position.Y+Height;
        AContext.textBaseline:='bottom';
      end;
  end;
  AContext.font:=fFormat;
  measurement:=AContext.measureText(fCaption);

  case HAlign of
    haLeft:   lx:=Position.X;
    haMiddle: lx:=Position.X+(Width-measurement.width)/2;
    haRight:  lx:=Position.X+Width-measurement.width;
  end;

  AContext.fillText(fCaption, lX, lY);

  AContext.restore;
  inherited Render(AContext);
end;

constructor TGUILabel.Create;
begin
  inherited Create;
  fFont:='sans';
  fSize:=12;
  fVAlign:=vaMiddle;
  fHAlign:=haMiddle;
end;

procedure TGUIImage.Render(AContext: TJSCanvasRenderingContext2D);
begin
  AContext.drawImage(fImage, Position.X, Position.Y, Width, Height);
  inherited Render(AContext);
end;

end.

