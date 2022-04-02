unit Resources;

{$mode ObjFPC}

interface

uses
  Classes, SysUtils,
  js, web;

type
  TResourceType = (
    rtText,
    rtArrayBuffer,
    rtBlob
  );

  TResources = class
  public
    class procedure AddResource(const APath: string; AType: TResourceType);

    class function GetText(const APath: string): string;
    class function GetArrayBuffer(const APath: string): TJSArrayBuffer;

    class function Completed: boolean;
    class function Total: longint;
    class function TotalLoaded: longint;
  end;

implementation

type
  TResource = class
  public
    ResType: TResourceType;
    Text: string;
    ArrayBuf: TJSArrayBuffer;
    Data: TJSBlob;
  end;

var
  fTotal, fTotalLoaded: integer;
  fResources: TStringList;

function DoFetch(const APath: string): TJSResponse; async;
begin
  result:=await(window.fetch(APath));

  if not result.ok then
    window.console.error('HTTP error! status: '+str(Result.status));
end;

class procedure TResources.AddResource(const APath: string; AType: TResourceType);
var
  res: TResource;
begin
  res:=TResource.Create;
  res.ResType:=AType;

  fResources.AddObject(APath, res);
  inc(fTotal);

  DoFetch(APath)._then(function(x: JSValue): JSValue begin
    writeln('Got ', APath);

    case AType of
      rtText:
        TJSResponse(x).text()._then(function(y: JSValue): JSValue begin
          res.text:=string(y);
          inc(fTotalLoaded);
        end);
      rtBlob:
        TJSResponse(x).blob()._then(function(y: JSValue): JSValue begin
          res.Data:=TJSBlob(y);
          inc(fTotalLoaded);
        end);
      rtArrayBuffer:
        TJSResponse(x).arrayBuffer()._then(function(y: JSValue): JSValue begin
          res.ArrayBuf:=TJSArrayBuffer(y);
          inc(fTotalLoaded);
        end);
    end;
  end);
end;

class function TResources.GetText(const APath: string): string;
var
  idx: Integer;
begin
  idx:=fResources.IndexOf(APath);
  result:=TResource(fResources.Objects[idx]).Text;
end;

class function TResources.GetArrayBuffer(const APath: string): TJSArrayBuffer;
var
  idx: Integer;
begin
  idx:=fResources.IndexOf(APath);
  result:=TResource(fResources.Objects[idx]).ArrayBuf;
end;

class function TResources.Completed: boolean;
begin
  result:=fTotal=fTotalLoaded;
end;

class function TResources.Total: longint;
begin
  result:=fTotal;
end;

class function TResources.TotalLoaded: longint;
begin
  result:=fTotalLoaded;
end;

initialization
  fResources:=TStringList.Create;
  fResources.CaseSensitive:=false;
  fResources.Sorted:=false;
  fResources.StrictDelimiter:=true;

end.

