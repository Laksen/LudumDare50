unit GameMath;

{$mode ObjFPC}
{$modeswitch AdvancedRecords}

interface

uses
  Classes, SysUtils, Math;

type
  TPVector = record
    X,Y: double;
    class function New(AX,AY: double): TPVector; static;

    function Length: double;
    function LengthSqr: double;

    function Dot(const A: TPVector): double;

    function Min(const A: TPVector): TPVector;
    function Max(const A: TPVector): TPVector;

    function Add(const A: TPVector): TPVector;
    function Sub(const A: TPVector): TPVector;
    function Scale(const A: double): TPVector;
  end;

  TPRect = record
  private
    function GetP01: TPVector;
    function GetP10: TPVector;
  public
    P0, P1: TPVector;

    property P01: TPVector read GetP01;
    property P10: TPVector read GetP10;
  end;

  TPMatrixArray = array[0..8] of double;

  TPMatrix = class
  private
    fIsIdentity,
    fIsTranslation: boolean;

    V: TPMatrixArray;

    function GetTranslation: TPVector;
  public
    constructor Identity;
    constructor CreateTranslation(AX,AY: double);
    constructor CreateRotation(ARotation: double);

    procedure Load(const AMatrix: TPMatrix);
    procedure Multiply(const AMatrix: TPMatrix);

    procedure TransformInplace(var AVectors: array of TPVector);
    function  Transform(const AVec: TPVector): TPVector;

    property Translation: TPVector read GetTranslation;

    property IsIdentity: boolean read fIsIdentity;
    property IsTranslation: boolean read fIsTranslation;
  end;

implementation

function TPRect.GetP01: TPVector;
begin
  result.X:=P0.X;
  result.Y:=P1.Y;
end;

function TPRect.GetP10: TPVector;
begin
  result.X:=P1.X;
  result.Y:=P0.Y;
end;

function TPMatrix.GetTranslation: TPVector;
begin
  result:=TPVector.New(V[2], V[5]);
end;

constructor TPMatrix.Identity;
var
  i: SizeInt;
begin
  for i:=0 to 8 do
    V[i]:=0;

  V[0]:=1;
  V[4]:=1;
  V[8]:=1;

  fIsIdentity:=true;
  fIsTranslation:=true;
end;

constructor TPMatrix.CreateTranslation(AX, AY: double);
begin
  Identity;

  V[2]:=AX;
  V[5]:=AY;

  fIsIdentity:=false;
  fIsTranslation:=true;
end;

constructor TPMatrix.CreateRotation(ARotation: double);
var
  cs, ss: Double;
begin
  Identity;

  if ARotation<>0 then
  begin
    cs:=cos(arotation);
    ss:=sin(arotation);

    V[0]:=cs;
    V[1]:=-ss;
    V[3]:=ss;
    V[4]:=cs;

    fIsIdentity:=false;
    fIsTranslation:=false;
  end
end;

procedure TPMatrix.Load(const AMatrix: TPMatrix);
begin
  v:=AMatrix.V;
end;

procedure TPMatrix.Multiply(const AMatrix: TPMatrix);
var
  n: TPMatrixArray;
begin
  n[0]:=v[0]*AMatrix.V[0]+v[1]*AMatrix.V[3]+v[2]*AMatrix.V[6];
  n[1]:=v[0]*AMatrix.V[1]+v[1]*AMatrix.V[4]+v[2]*AMatrix.V[7];
  n[2]:=v[0]*AMatrix.V[2]+v[1]*AMatrix.V[5]+v[2]*AMatrix.V[8];

  n[3]:=v[3]*AMatrix.V[0]+v[4]*AMatrix.V[3]+v[5]*AMatrix.V[6];
  n[4]:=v[3]*AMatrix.V[1]+v[4]*AMatrix.V[4]+v[5]*AMatrix.V[7];
  n[5]:=v[3]*AMatrix.V[2]+v[4]*AMatrix.V[5]+v[5]*AMatrix.V[8];

  n[6]:=v[6]*AMatrix.V[0]+v[7]*AMatrix.V[3]+v[8]*AMatrix.V[6];
  n[7]:=v[6]*AMatrix.V[1]+v[7]*AMatrix.V[4]+v[8]*AMatrix.V[7];
  n[8]:=v[6]*AMatrix.V[2]+v[7]*AMatrix.V[5]+v[8]*AMatrix.V[8];

  v:=n;

  fIsIdentity:=fIsIdentity and AMatrix.IsIdentity;
  fIsTranslation:=fIsTranslation and AMatrix.IsTranslation;
end;

procedure TPMatrix.TransformInplace(var AVectors: array of TPVector);
var
  i: SizeInt;
begin
  if fIsIdentity then
    exit;

  if fIsTranslation then
    for i:=low(AVectors) to high(AVectors) do
    begin
      AVectors[i].X:=AVectors[i].X+V[2];
      AVectors[i].Y:=AVectors[i].Y+V[5];
    end
  else
    for i:=low(AVectors) to high(AVectors) do
    begin
      AVectors[i].X:=AVectors[i].X*V[0]+AVectors[i].Y*V[1]+V[2];
      AVectors[i].Y:=AVectors[i].X*V[3]+AVectors[i].Y*V[4]+V[5];
    end;
end;

function TPMatrix.Transform(const AVec: TPVector): TPVector;
begin
  if fIsIdentity then
    exit(AVec);

  if fIsTranslation then
  begin
    Result.X:=AVec.X+V[2];
    Result.Y:=AVec.Y+V[5];
  end
  else
  begin
    Result.X:=AVec.X*V[0]+AVec.Y*V[1]+V[2];
    Result.Y:=AVec.X*V[3]+AVec.Y*V[4]+V[5];
  end;
end;


class function TPVector.New(AX, AY: double): TPVector;
begin
  result.X:=ax;
  result.Y:=AY;
end;

function TPVector.Length: double;
begin
  result:=sqr(X)+sqr(Y);
  if result>0 then
    result:=sqrt(result);
end;

function TPVector.LengthSqr: double;
begin
  result:=sqr(X)+sqr(Y);
end;

function TPVector.Dot(const A: TPVector): double;
begin
  result:=X*A.X+Y*A.Y;
end;

function TPVector.Min(const A: TPVector): TPVector;
begin
  result.X:=Math.Min(X, A.X);
  result.Y:=Math.Min(Y, A.Y);
end;

function TPVector.Max(const A: TPVector): TPVector;
begin
  result.X:=Math.Max(X, A.X);
  result.Y:=Math.Max(Y, A.Y);
end;

function TPVector.Add(const A: TPVector): TPVector;
begin
  result.X:=X+A.X;
  result.Y:=Y+A.Y;
end;

function TPVector.Sub(const A: TPVector): TPVector;
begin
  result.X:=X-A.X;
  result.Y:=Y-A.Y;
end;

function TPVector.Scale(const A: double): TPVector;
begin
  result.X:=X*A;
  result.Y:=Y*A;
end;

end.

