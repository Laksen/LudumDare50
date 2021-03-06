var pas = {};

var rtl = {

  version: 20101,

  quiet: false,
  debug_load_units: false,
  debug_rtti: false,

  $res : {},

  debug: function(){
    if (rtl.quiet || !console || !console.log) return;
    console.log(arguments);
  },

  error: function(s){
    rtl.debug('Error: ',s);
    throw s;
  },

  warn: function(s){
    rtl.debug('Warn: ',s);
  },

  checkVersion: function(v){
    if (rtl.version != v) throw "expected rtl version "+v+", but found "+rtl.version;
  },

  hiInt: Math.pow(2,53),

  hasString: function(s){
    return rtl.isString(s) && (s.length>0);
  },

  isArray: function(a) {
    return Array.isArray(a);
  },

  isFunction: function(f){
    return typeof(f)==="function";
  },

  isModule: function(m){
    return rtl.isObject(m) && rtl.hasString(m.$name) && (pas[m.$name]===m);
  },

  isImplementation: function(m){
    return rtl.isObject(m) && rtl.isModule(m.$module) && (m.$module.$impl===m);
  },

  isNumber: function(n){
    return typeof(n)==="number";
  },

  isObject: function(o){
    var s=typeof(o);
    return (typeof(o)==="object") && (o!=null);
  },

  isString: function(s){
    return typeof(s)==="string";
  },

  getNumber: function(n){
    return typeof(n)==="number"?n:NaN;
  },

  getChar: function(c){
    return ((typeof(c)==="string") && (c.length===1)) ? c : "";
  },

  getObject: function(o){
    return ((typeof(o)==="object") || (typeof(o)==='function')) ? o : null;
  },

  isTRecord: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$new') && (typeof(type.$new)==='function'));
  },

  isPasClass: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$classname') && rtl.isObject(type.$module));
  },

  isPasClassInstance: function(type){
    return (rtl.isObject(type) && rtl.isPasClass(type.$class));
  },

  hexStr: function(n,digits){
    return ("000000000000000"+n.toString(16).toUpperCase()).slice(-digits);
  },

  m_loading: 0,
  m_loading_intf: 1,
  m_intf_loaded: 2,
  m_loading_impl: 3, // loading all used unit
  m_initializing: 4, // running initialization
  m_initialized: 5,

  module: function(module_name, intfuseslist, intfcode, impluseslist){
    if (rtl.debug_load_units) rtl.debug('rtl.module name="'+module_name+'" intfuses='+intfuseslist+' impluses='+impluseslist);
    if (!rtl.hasString(module_name)) rtl.error('invalid module name "'+module_name+'"');
    if (!rtl.isArray(intfuseslist)) rtl.error('invalid interface useslist of "'+module_name+'"');
    if (!rtl.isFunction(intfcode)) rtl.error('invalid interface code of "'+module_name+'"');
    if (!(impluseslist==undefined) && !rtl.isArray(impluseslist)) rtl.error('invalid implementation useslist of "'+module_name+'"');

    if (pas[module_name])
      rtl.error('module "'+module_name+'" is already registered');

    var r = Object.create(rtl.tSectionRTTI);
    var module = r.$module = pas[module_name] = {
      $name: module_name,
      $intfuseslist: intfuseslist,
      $impluseslist: impluseslist,
      $state: rtl.m_loading,
      $intfcode: intfcode,
      $implcode: null,
      $impl: null,
      $rtti: r
    };
    if (impluseslist) module.$impl = {
          $module: module,
          $rtti: r
        };
  },

  exitcode: 0,

  run: function(module_name){
    try {
      if (!rtl.hasString(module_name)) module_name='program';
      if (rtl.debug_load_units) rtl.debug('rtl.run module="'+module_name+'"');
      rtl.initRTTI();
      var module = pas[module_name];
      if (!module) rtl.error('rtl.run module "'+module_name+'" missing');
      rtl.loadintf(module);
      rtl.loadimpl(module);
      if (module_name=='program'){
        if (rtl.debug_load_units) rtl.debug('running $main');
        var r = pas.program.$main();
        if (rtl.isNumber(r)) rtl.exitcode = r;
      }
    } catch(re) {
      if (!rtl.showUncaughtExceptions) {
        throw re
      } else {  
        if (!rtl.handleUncaughtException(re)) {
          rtl.showException(re);
          rtl.exitcode = 216;
        }  
      }
    } 
    return rtl.exitcode;
  },
  
  showException : function (re) {
    var errMsg = rtl.hasString(re.$classname) ? re.$classname : '';
    errMsg +=  ((errMsg) ? ': ' : '') + (re.hasOwnProperty('fMessage') ? re.fMessage : re);
    alert('Uncaught Exception : '+errMsg);
  },

  handleUncaughtException: function (e) {
    if (rtl.onUncaughtException) {
      try {
        rtl.onUncaughtException(e);
        return true;
      } catch (ee) {
        return false; 
      }
    } else {
      return false;
    }
  },

  loadintf: function(module){
    if (module.$state>rtl.m_loading_intf) return; // already finished
    if (rtl.debug_load_units) rtl.debug('loadintf: "'+module.$name+'"');
    if (module.$state===rtl.m_loading_intf)
      rtl.error('unit cycle detected "'+module.$name+'"');
    module.$state=rtl.m_loading_intf;
    // load interfaces of interface useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadintf);
    // run interface
    if (rtl.debug_load_units) rtl.debug('loadintf: run intf of "'+module.$name+'"');
    module.$intfcode(module.$intfuseslist);
    // success
    module.$state=rtl.m_intf_loaded;
    // Note: units only used in implementations are not yet loaded (not even their interfaces)
  },

  loaduseslist: function(module,useslist,f){
    if (useslist==undefined) return;
    var len = useslist.length;
    for (var i = 0; i<len; i++) {
      var unitname=useslist[i];
      if (rtl.debug_load_units) rtl.debug('loaduseslist of "'+module.$name+'" uses="'+unitname+'"');
      if (pas[unitname]==undefined)
        rtl.error('module "'+module.$name+'" misses "'+unitname+'"');
      f(pas[unitname]);
    }
  },

  loadimpl: function(module){
    if (module.$state>=rtl.m_loading_impl) return; // already processing
    if (module.$state<rtl.m_intf_loaded) rtl.error('loadimpl: interface not loaded of "'+module.$name+'"');
    if (rtl.debug_load_units) rtl.debug('loadimpl: load uses of "'+module.$name+'"');
    module.$state=rtl.m_loading_impl;
    // load interfaces of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadintf);
    // load implementation of interfaces useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadimpl);
    // load implementation of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadimpl);
    // Note: At this point all interfaces used by this unit are loaded. If
    //   there are implementation uses cycles some used units might not yet be
    //   initialized. This is by design.
    // run implementation
    if (rtl.debug_load_units) rtl.debug('loadimpl: run impl of "'+module.$name+'"');
    if (rtl.isFunction(module.$implcode)) module.$implcode(module.$impluseslist);
    // run initialization
    if (rtl.debug_load_units) rtl.debug('loadimpl: run init of "'+module.$name+'"');
    module.$state=rtl.m_initializing;
    if (rtl.isFunction(module.$init)) module.$init();
    // unit initialized
    module.$state=rtl.m_initialized;
  },

  createCallback: function(scope, fn){
    var cb;
    if (typeof(fn)==='string'){
      cb = function(){
        return scope[fn].apply(scope,arguments);
      };
    } else {
      cb = function(){
        return fn.apply(scope,arguments);
      };
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  createSafeCallback: function(scope, fn){
    var cb = function(){
      try{
        if (typeof(fn)==='string'){
          return scope[fn].apply(scope,arguments);
        } else {
          return fn.apply(scope,arguments);
        };
      } catch (err) {
        if (!rtl.handleUncaughtException(err)) throw err;
      }
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  cloneCallback: function(cb){
    return rtl.createCallback(cb.scope,cb.fn);
  },

  eqCallback: function(a,b){
    // can be a function or a function wrapper
    if (a==b){
      return true;
    } else {
      return (a!=null) && (b!=null) && (a.fn) && (a.scope===b.scope) && (a.fn==b.fn);
    }
  },

  initStruct: function(c,parent,name){
    if ((parent.$module) && (parent.$module.$impl===parent)) parent=parent.$module;
    c.$parent = parent;
    if (rtl.isModule(parent)){
      c.$module = parent;
      c.$name = name;
    } else {
      c.$module = parent.$module;
      c.$name = parent.$name+'.'+name;
    };
    return parent;
  },

  initClass: function(c,parent,name,initfn,rttiname){
    parent[name] = c;
    c.$class = c; // Note: o.$class === Object.getPrototypeOf(o)
    c.$classname = rttiname?rttiname:name;
    parent = rtl.initStruct(c,parent,name);
    c.$fullname = parent.$name+'.'+name;
    // rtti
    if (rtl.debug_rtti) rtl.debug('initClass '+c.$fullname);
    var t = c.$module.$rtti.$Class(c.$classname,{ "class": c });
    c.$rtti = t;
    if (rtl.isObject(c.$ancestor)) t.ancestor = c.$ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  createClass: function(parent,name,ancestor,initfn,rttiname){
    // create a normal class,
    // ancestor must be null or a normal class,
    // the root ancestor can be an external class
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // Note:
      // if root is an "object" then c.$ancestor === Object.getPrototypeOf(c)
      // if root is a "function" then c.$ancestor === c.__proto__, Object.getPrototypeOf(c) returns the root
    } else {
      c = { $ancestor: null };
      c.$create = function(fn,args){
        if (args == undefined) args = [];
        var o = Object.create(this);
        o.$init();
        try{
          if (typeof(fn)==="string"){
            o[fn].apply(o,args);
          } else {
            fn.apply(o,args);
          };
          o.AfterConstruction();
        } catch($e){
          // do not call BeforeDestruction
          if (o.Destroy) o.Destroy();
          o.$final();
          throw $e;
        }
        return o;
      };
      c.$destroy = function(fnname){
        this.BeforeDestruction();
        if (this[fnname]) this[fnname]();
        this.$final();
      };
    };
    rtl.initClass(c,parent,name,initfn,rttiname);
  },

  createClassExt: function(parent,name,ancestor,newinstancefnname,initfn,rttiname){
    // Create a class using an external ancestor.
    // If newinstancefnname is given, use that function to create the new object.
    // If exist call BeforeDestruction and AfterConstruction.
    var isFunc = rtl.isFunction(ancestor);
    var c = null;
    if (isFunc){
      // create pascal class descendent from JS function
      c = Object.create(ancestor.prototype);
      c.$ancestorfunc = ancestor;
      c.$ancestor = null; // no pascal ancestor
    } else if (ancestor.$func){
      // create pascal class descendent from a pascal class descendent of a JS function
      isFunc = true;
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
    } else {
      c = Object.create(ancestor);
      c.$ancestor = null; // no pascal ancestor
    }
    c.$create = function(fn,args){
      if (args == undefined) args = [];
      var o = null;
      if (newinstancefnname.length>0){
        o = this[newinstancefnname](fn,args);
      } else if(isFunc) {
        o = new this.$func(args);
      } else {
        o = Object.create(c);
      }
      if (o.$init) o.$init();
      try{
        if (typeof(fn)==="string"){
          this[fn].apply(o,args);
        } else {
          fn.apply(o,args);
        };
        if (o.AfterConstruction) o.AfterConstruction();
      } catch($e){
        // do not call BeforeDestruction
        if (o.Destroy) o.Destroy();
        if (o.$final) o.$final();
        throw $e;
      }
      return o;
    };
    c.$destroy = function(fnname){
      if (this.BeforeDestruction) this.BeforeDestruction();
      if (this[fnname]) this[fnname]();
      if (this.$final) this.$final();
    };
    rtl.initClass(c,parent,name,initfn,rttiname);
    if (isFunc){
      function f(){}
      f.prototype = c;
      c.$func = f;
    }
  },

  createHelper: function(parent,name,ancestor,initfn,rttiname){
    // create a helper,
    // ancestor must be null or a helper,
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // c.$ancestor === Object.getPrototypeOf(c)
    } else {
      c = { $ancestor: null };
    };
    parent[name] = c;
    c.$class = c; // Note: o.$class === Object.getPrototypeOf(o)
    c.$classname = rttiname?rttiname:name;
    parent = rtl.initStruct(c,parent,name);
    c.$fullname = parent.$name+'.'+name;
    // rtti
    var t = c.$module.$rtti.$Helper(c.$classname,{ "helper": c });
    c.$rtti = t;
    if (rtl.isObject(ancestor)) t.ancestor = ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  tObjectDestroy: "Destroy",

  free: function(obj,name){
    if (obj[name]==null) return null;
    obj[name].$destroy(rtl.tObjectDestroy);
    obj[name]=null;
  },

  freeLoc: function(obj){
    if (obj==null) return null;
    obj.$destroy(rtl.tObjectDestroy);
    return null;
  },

  hideProp: function(o,p,v){
    Object.defineProperty(o,p, {
      enumerable: false,
      configurable: true,
      writable: true
    });
    if(arguments.length>2){ o[p]=v; }
  },

  recNewT: function(parent,name,initfn,full){
    // create new record type
    var t = {};
    if (parent) parent[name] = t;
    var h = rtl.hideProp;
    if (full){
      rtl.initStruct(t,parent,name);
      t.$record = t;
      h(t,'$record');
      h(t,'$name');
      h(t,'$parent');
      h(t,'$module');
      h(t,'$initSpec');
    }
    initfn.call(t);
    if (!t.$new){
      t.$new = function(){ return Object.create(t); };
    }
    t.$clone = function(r){ return t.$new().$assign(r); };
    h(t,'$new');
    h(t,'$clone');
    h(t,'$eq');
    h(t,'$assign');
    return t;
  },

  is: function(instance,type){
    return type.isPrototypeOf(instance) || (instance===type);
  },

  isExt: function(instance,type,mode){
    // mode===1 means instance must be a Pascal class instance
    // mode===2 means instance must be a Pascal class
    // Notes:
    // isPrototypeOf and instanceof return false on equal
    // isPrototypeOf does not work for Date.isPrototypeOf(new Date())
    //   so if isPrototypeOf is false test with instanceof
    // instanceof needs a function on right side
    if (instance == null) return false; // Note: ==null checks for undefined too
    if ((typeof(type) !== 'object') && (typeof(type) !== 'function')) return false;
    if (instance === type){
      if (mode===1) return false;
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if (type.isPrototypeOf && type.isPrototypeOf(instance)){
      if (mode===1) return rtl.isPasClassInstance(instance);
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if ((typeof type == 'function') && (instance instanceof type)) return true;
    return false;
  },

  Exception: null,
  EInvalidCast: null,
  EAbstractError: null,
  ERangeError: null,
  EIntOverflow: null,
  EPropWriteOnly: null,

  raiseE: function(typename){
    var t = rtl[typename];
    if (t==null){
      var mod = pas.SysUtils;
      if (!mod) mod = pas.sysutils;
      if (mod){
        t = mod[typename];
        if (!t) t = mod[typename.toLowerCase()];
        if (!t) t = mod['Exception'];
        if (!t) t = mod['exception'];
      }
    }
    if (t){
      if (t.Create){
        throw t.$create("Create");
      } else if (t.create){
        throw t.$create("create");
      }
    }
    if (typename === "EInvalidCast") throw "invalid type cast";
    if (typename === "EAbstractError") throw "Abstract method called";
    if (typename === "ERangeError") throw "range error";
    throw typename;
  },

  as: function(instance,type){
    if((instance === null) || rtl.is(instance,type)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  asExt: function(instance,type,mode){
    if((instance === null) || rtl.isExt(instance,type,mode)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  createInterface: function(module, name, guid, fnnames, ancestor, initfn){
    //console.log('createInterface name="'+name+'" guid="'+guid+'" names='+fnnames);
    var i = ancestor?Object.create(ancestor):{};
    module[name] = i;
    i.$module = module;
    i.$name = name;
    i.$fullname = module.$name+'.'+name;
    i.$guid = guid;
    i.$guidr = null;
    i.$names = fnnames?fnnames:[];
    if (rtl.isFunction(initfn)){
      // rtti
      if (rtl.debug_rtti) rtl.debug('createInterface '+i.$fullname);
      var t = i.$module.$rtti.$Interface(name,{ "interface": i, module: module });
      i.$rtti = t;
      if (ancestor) t.ancestor = ancestor.$rtti;
      if (!t.ancestor) t.ancestor = null;
      initfn.call(i);
    }
    return i;
  },

  strToGUIDR: function(s,g){
    var p = 0;
    function n(l){
      var h = s.substr(p,l);
      p+=l;
      return parseInt(h,16);
    }
    p+=1; // skip {
    g.D1 = n(8);
    p+=1; // skip -
    g.D2 = n(4);
    p+=1; // skip -
    g.D3 = n(4);
    p+=1; // skip -
    if (!g.D4) g.D4=[];
    g.D4[0] = n(2);
    g.D4[1] = n(2);
    p+=1; // skip -
    for(var i=2; i<8; i++) g.D4[i] = n(2);
    return g;
  },

  guidrToStr: function(g){
    if (g.$intf) return g.$intf.$guid;
    var h = rtl.hexStr;
    var s='{'+h(g.D1,8)+'-'+h(g.D2,4)+'-'+h(g.D3,4)+'-'+h(g.D4[0],2)+h(g.D4[1],2)+'-';
    for (var i=2; i<8; i++) s+=h(g.D4[i],2);
    s+='}';
    return s;
  },

  createTGUID: function(guid){
    var TGuid = (pas.System)?pas.System.TGuid:pas.system.tguid;
    var g = rtl.strToGUIDR(guid,TGuid.$new());
    return g;
  },

  getIntfGUIDR: function(intfTypeOrVar){
    if (!intfTypeOrVar) return null;
    if (!intfTypeOrVar.$guidr){
      var g = rtl.createTGUID(intfTypeOrVar.$guid);
      if (!intfTypeOrVar.hasOwnProperty('$guid')) intfTypeOrVar = Object.getPrototypeOf(intfTypeOrVar);
      g.$intf = intfTypeOrVar;
      intfTypeOrVar.$guidr = g;
    }
    return intfTypeOrVar.$guidr;
  },

  addIntf: function (aclass, intf, map){
    function jmp(fn){
      if (typeof(fn)==="function"){
        return function(){ return fn.apply(this.$o,arguments); };
      } else {
        return function(){ rtl.raiseE('EAbstractError'); };
      }
    }
    if(!map) map = {};
    var t = intf;
    var item = Object.create(t);
    if (!aclass.hasOwnProperty('$intfmaps')) aclass.$intfmaps = {};
    aclass.$intfmaps[intf.$guid] = item;
    do{
      var names = t.$names;
      if (!names) break;
      for (var i=0; i<names.length; i++){
        var intfname = names[i];
        var fnname = map[intfname];
        if (!fnname) fnname = intfname;
        //console.log('addIntf: intftype='+t.$name+' index='+i+' intfname="'+intfname+'" fnname="'+fnname+'" old='+typeof(item[intfname]));
        item[intfname] = jmp(aclass[fnname]);
      }
      t = Object.getPrototypeOf(t);
    }while(t!=null);
  },

  getIntfG: function (obj, guid, query){
    if (!obj) return null;
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query);
    // search
    var maps = obj.$intfmaps;
    if (!maps) return null;
    var item = maps[guid];
    if (!item) return null;
    // check delegation
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query+' item='+typeof(item));
    if (typeof item === 'function') return item.call(obj); // delegate. Note: COM contains _AddRef
    // check cache
    var intf = null;
    if (obj.$interfaces){
      intf = obj.$interfaces[guid];
      //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' cache='+typeof(intf));
    }
    if (!intf){ // intf can be undefined!
      intf = Object.create(item);
      intf.$o = obj;
      if (!obj.$interfaces) obj.$interfaces = {};
      obj.$interfaces[guid] = intf;
    }
    if (typeof(query)==='object'){
      // called by queryIntfT
      var o = null;
      if (intf.QueryInterface(rtl.getIntfGUIDR(query),
          {get:function(){ return o; }, set:function(v){ o=v; }}) === 0){
        return o;
      } else {
        return null;
      }
    } else if(query===2){
      // called by TObject.GetInterfaceByStr
      if (intf.$kind === 'com') intf._AddRef();
    }
    return intf;
  },

  getIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid);
  },

  queryIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid,intftype);
  },

  queryIntfIsT: function(obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (!i) return false;
    if (i.$kind === 'com') i._Release();
    return true;
  },

  asIntfT: function (obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (i!==null) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsIntfT: function(intf,intftype){
    return (intf!==null) && rtl.queryIntfIsT(intf.$o,intftype);
  },

  intfAsIntfT: function (intf,intftype){
    if (!intf) return null;
    var i = rtl.getIntfG(intf.$o,intftype.$guid);
    if (i) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsClass: function(intf,classtype){
    return (intf!=null) && (rtl.is(intf.$o,classtype));
  },

  intfAsClass: function(intf,classtype){
    if (intf==null) return null;
    return rtl.as(intf.$o,classtype);
  },

  intfToClass: function(intf,classtype){
    if ((intf!==null) && rtl.is(intf.$o,classtype)) return intf.$o;
    return null;
  },

  // interface reference counting
  intfRefs: { // base object for temporary interface variables
    ref: function(id,intf){
      // called for temporary interface references needing delayed release
      var old = this[id];
      //console.log('rtl.intfRefs.ref: id='+id+' old="'+(old?old.$name:'null')+'" intf="'+(intf?intf.$name:'null')+' $o='+(intf?intf.$o:'null'));
      if (old){
        // called again, e.g. in a loop
        delete this[id];
        old._Release(); // may fail
      }
      if(intf) {
        this[id]=intf;
      }
      return intf;
    },
    free: function(){
      //console.log('rtl.intfRefs.free...');
      for (var id in this){
        if (this.hasOwnProperty(id)){
          var intf = this[id];
          if (intf){
            //console.log('rtl.intfRefs.free: id='+id+' '+intf.$name+' $o='+intf.$o.$classname);
            intf._Release();
          }
        }
      }
    }
  },

  createIntfRefs: function(){
    //console.log('rtl.createIntfRefs');
    return Object.create(rtl.intfRefs);
  },

  setIntfP: function(path,name,value,skipAddRef){
    var old = path[name];
    //console.log('rtl.setIntfP path='+path+' name='+name+' old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old === value) return;
    if (old !== null){
      path[name]=null;
      old._Release();
    }
    if (value !== null){
      if (!skipAddRef) value._AddRef();
      path[name]=value;
    }
  },

  setIntfL: function(old,value,skipAddRef){
    //console.log('rtl.setIntfL old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old !== value){
      if (value!==null){
        if (!skipAddRef) value._AddRef();
      }
      if (old!==null){
        old._Release();  // Release after AddRef, to avoid double Release if Release creates an exception
      }
    } else if (skipAddRef){
      if (old!==null){
        old._Release();  // value has an AddRef
      }
    }
    return value;
  },

  _AddRef: function(intf){
    //if (intf) console.log('rtl._AddRef intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._AddRef();
    return intf;
  },

  _Release: function(intf){
    //if (intf) console.log('rtl._Release intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._Release();
    return intf;
  },

  trunc: function(a){
    return a<0 ? Math.ceil(a) : Math.floor(a);
  },

  checkMethodCall: function(obj,type){
    if (rtl.isObject(obj) && rtl.is(obj,type)) return;
    rtl.raiseE("EInvalidCast");
  },

  oc: function(i){
    // overflow check integer
    if ((Math.floor(i)===i) && (i>=-0x1fffffffffffff) && (i<=0x1fffffffffffff)) return i;
    rtl.raiseE('EIntOverflow');
  },

  rc: function(i,minval,maxval){
    // range check integer
    if ((Math.floor(i)===i) && (i>=minval) && (i<=maxval)) return i;
    rtl.raiseE('ERangeError');
  },

  rcc: function(c,minval,maxval){
    // range check char
    if ((typeof(c)==='string') && (c.length===1)){
      var i = c.charCodeAt(0);
      if ((i>=minval) && (i<=maxval)) return c;
    }
    rtl.raiseE('ERangeError');
  },

  rcSetCharAt: function(s,index,c){
    // range check setCharAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return rtl.setCharAt(s,index,c);
  },

  rcCharAt: function(s,index){
    // range check charAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return s.charAt(index);
  },

  rcArrR: function(arr,index){
    // range check read array
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      if (arguments.length>2){
        // arr,index1,index2,...
        arr=arr[index];
        for (var i=2; i<arguments.length; i++) arr=rtl.rcArrR(arr,arguments[i]);
        return arr;
      }
      return arr[index];
    }
    rtl.raiseE('ERangeError');
  },

  rcArrW: function(arr,index,value){
    // range check write array
    // arr,index1,index2,...,value
    for (var i=3; i<arguments.length; i++){
      arr=rtl.rcArrR(arr,index);
      index=arguments[i-1];
      value=arguments[i];
    }
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      return arr[index]=value;
    }
    rtl.raiseE('ERangeError');
  },

  length: function(arr){
    return (arr == null) ? 0 : arr.length;
  },

  arrayRef: function(a){
    if (a!=null) rtl.hideProp(a,'$pas2jsrefcnt',1);
    return a;
  },

  arraySetLength: function(arr,defaultvalue,newlength){
    var stack = [];
    var s = 9999;
    for (var i=2; i<arguments.length; i++){
      var j = arguments[i];
      if (j==='s'){ s = i-2; }
      else {
        stack.push({ dim:j+0, a:null, i:0, src:null });
      }
    }
    var dimmax = stack.length-1;
    var depth = 0;
    var lastlen = 0;
    var item = null;
    var a = null;
    var src = arr;
    var srclen = 0, oldlen = 0;
    do{
      if (depth>0){
        item=stack[depth-1];
        src = (item.src && item.src.length>item.i)?item.src[item.i]:null;
      }
      if (!src){
        a = [];
        srclen = 0;
        oldlen = 0;
      } else if (src.$pas2jsrefcnt>0 || depth>=s){
        a = [];
        srclen = src.length;
        oldlen = srclen;
      } else {
        a = src;
        srclen = 0;
        oldlen = a.length;
      }
      lastlen = stack[depth].dim;
      a.length = lastlen;
      if (depth>0){
        item.a[item.i]=a;
        item.i++;
        if ((lastlen===0) && (item.i<item.a.length)) continue;
      }
      if (lastlen>0){
        if (depth<dimmax){
          item = stack[depth];
          item.a = a;
          item.i = 0;
          item.src = src;
          depth++;
          continue;
        } else {
          if (srclen>lastlen) srclen=lastlen;
          if (rtl.isArray(defaultvalue)){
            // array of dyn array
            for (var i=0; i<srclen; i++) a[i]=src[i];
            for (var i=oldlen; i<lastlen; i++) a[i]=[];
          } else if (rtl.isObject(defaultvalue)) {
            if (rtl.isTRecord(defaultvalue)){
              // array of record
              for (var i=0; i<srclen; i++) a[i]=defaultvalue.$clone(src[i]);
              for (var i=oldlen; i<lastlen; i++) a[i]=defaultvalue.$new();
            } else {
              // array of set
              for (var i=0; i<srclen; i++) a[i]=rtl.refSet(src[i]);
              for (var i=oldlen; i<lastlen; i++) a[i]={};
            }
          } else {
            for (var i=0; i<srclen; i++) a[i]=src[i];
            for (var i=oldlen; i<lastlen; i++) a[i]=defaultvalue;
          }
        }
      }
      // backtrack
      while ((depth>0) && (stack[depth-1].i>=stack[depth-1].dim)){
        depth--;
      };
      if (depth===0){
        if (dimmax===0) return a;
        return stack[0].a;
      }
    }while (true);
  },

  arrayEq: function(a,b){
    if (a===null) return b===null;
    if (b===null) return false;
    if (a.length!==b.length) return false;
    for (var i=0; i<a.length; i++) if (a[i]!==b[i]) return false;
    return true;
  },

  arrayClone: function(type,src,srcpos,endpos,dst,dstpos){
    // type: 0 for references, "refset" for calling refSet(), a function for new type()
    // src must not be null
    // This function does not range check.
    if(type === 'refSet') {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = rtl.refSet(src[srcpos]); // ref set
    } else if (rtl.isTRecord(type)){
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = type.$clone(src[srcpos]); // clone record
    }  else {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = src[srcpos]; // reference
    };
  },

  arrayConcat: function(type){
    // type: see rtl.arrayClone
    var a = [];
    var l = 0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src !== null) l+=src.length;
    };
    a.length = l;
    l=0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      rtl.arrayClone(type,src,0,src.length,a,l);
      l+=src.length;
    };
    return a;
  },

  arrayConcatN: function(){
    var a = null;
    for (var i=0; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      if (a===null){
        a=rtl.arrayRef(src); // Note: concat(a) does not clone
      } else {
        a=a.concat(src);
      }
    };
    return a;
  },

  arrayCopy: function(type, srcarray, index, count){
    // type: see rtl.arrayClone
    // if count is missing, use srcarray.length
    if (srcarray === null) return [];
    if (index < 0) index = 0;
    if (count === undefined) count=srcarray.length;
    var end = index+count;
    if (end>srcarray.length) end = srcarray.length;
    if (index>=end) return [];
    if (type===0){
      return srcarray.slice(index,end);
    } else {
      var a = [];
      a.length = end-index;
      rtl.arrayClone(type,srcarray,index,end,a,0);
      return a;
    }
  },

  arrayInsert: function(item, arr, index){
    if (arr){
      arr.splice(index,0,item);
      return arr;
    } else {
      return [item];
    }
  },

  setCharAt: function(s,index,c){
    return s.substr(0,index)+c+s.substr(index+1);
  },

  getResStr: function(mod,name){
    var rs = mod.$resourcestrings[name];
    return rs.current?rs.current:rs.org;
  },

  createSet: function(){
    var s = {};
    for (var i=0; i<arguments.length; i++){
      if (arguments[i]!=null){
        s[arguments[i]]=true;
      } else {
        var first=arguments[i+=1];
        var last=arguments[i+=1];
        for(var j=first; j<=last; j++) s[j]=true;
      }
    }
    return s;
  },

  cloneSet: function(s){
    var r = {};
    for (var key in s) r[key]=true;
    return r;
  },

  refSet: function(s){
    rtl.hideProp(s,'$shared',true);
    return s;
  },

  includeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    s[enumvalue] = true;
    return s;
  },

  excludeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    delete s[enumvalue];
    return s;
  },

  diffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    return r;
  },

  unionSet: function(s,t){
    var r = {};
    for (var key in s) r[key]=true;
    for (var key in t) r[key]=true;
    return r;
  },

  intersectSet: function(s,t){
    var r = {};
    for (var key in s) if (t[key]) r[key]=true;
    return r;
  },

  symDiffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    for (var key in t) if (!s[key]) r[key]=true;
    return r;
  },

  eqSet: function(s,t){
    for (var key in s) if (!t[key]) return false;
    for (var key in t) if (!s[key]) return false;
    return true;
  },

  neSet: function(s,t){
    return !rtl.eqSet(s,t);
  },

  leSet: function(s,t){
    for (var key in s) if (!t[key]) return false;
    return true;
  },

  geSet: function(s,t){
    for (var key in t) if (!s[key]) return false;
    return true;
  },

  strSetLength: function(s,newlen){
    var oldlen = s.length;
    if (oldlen > newlen){
      return s.substring(0,newlen);
    } else if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return s+' '.repeat(newlen-oldlen);
    } else {
       while (oldlen<newlen){
         s+=' ';
         oldlen++;
       };
       return s;
    }
  },

  spaceLeft: function(s,width){
    var l=s.length;
    if (l>=width) return s;
    if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return ' '.repeat(width-l) + s;
    } else {
      while (l<width){
        s=' '+s;
        l++;
      };
      return s;
    };
  },

  floatToStr: function(d,w,p){
    // input 1-3 arguments: double, width, precision
    if (arguments.length>2){
      return rtl.spaceLeft(d.toFixed(p),w);
    } else {
	  // exponent width
	  var pad = "";
	  var ad = Math.abs(d);
	  if (ad<1.0e+10) {
		pad='00';
	  } else if (ad<1.0e+100) {
		pad='0';
      }  	
	  if (arguments.length<2) {
	    w=9;		
      } else if (w<9) {
		w=9;
      }		  
      var p = w-8;
      var s=(d>0 ? " " : "" ) + d.toExponential(p);
      s=s.replace(/e(.)/,'E$1'+pad);
      return rtl.spaceLeft(s,w);
    }
  },

  valEnum: function(s, enumType, setCodeFn){
    s = s.toLowerCase();
    for (var key in enumType){
      if((typeof(key)==='string') && (key.toLowerCase()===s)){
        setCodeFn(0);
        return enumType[key];
      }
    }
    setCodeFn(1);
    return 0;
  },

  lw: function(l){
    // fix longword bitwise operation
    return l<0?l+0x100000000:l;
  },

  and: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) & (b / hi);
    var l = (a & low) & (b & low);
    return h*hi + l;
  },

  or: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) | (b / hi);
    var l = (a & low) | (b & low);
    return h*hi + l;
  },

  xor: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) ^ (b / hi);
    var l = (a & low) ^ (b & low);
    return h*hi + l;
  },

  shr: function(a,b){
    if (a<0) a += rtl.hiInt;
    if (a<0x80000000) return a >> b;
    if (b<=0) return a;
    if (b>54) return 0;
    return Math.floor(a / Math.pow(2,b));
  },

  shl: function(a,b){
    if (a<0) a += rtl.hiInt;
    if (b<=0) return a;
    if (b>54) return 0;
    var r = a * Math.pow(2,b);
    if (r <= rtl.hiInt) return r;
    return r % rtl.hiInt;
  },

  initRTTI: function(){
    if (rtl.debug_rtti) rtl.debug('initRTTI');

    // base types
    rtl.tTypeInfo = { name: "tTypeInfo" };
    function newBaseTI(name,kind,ancestor){
      if (!ancestor) ancestor = rtl.tTypeInfo;
      if (rtl.debug_rtti) rtl.debug('initRTTI.newBaseTI "'+name+'" '+kind+' ("'+ancestor.name+'")');
      var t = Object.create(ancestor);
      t.name = name;
      t.kind = kind;
      rtl[name] = t;
      return t;
    };
    function newBaseInt(name,minvalue,maxvalue,ordtype){
      var t = newBaseTI(name,1 /* tkInteger */,rtl.tTypeInfoInteger);
      t.minvalue = minvalue;
      t.maxvalue = maxvalue;
      t.ordtype = ordtype;
      return t;
    };
    newBaseTI("tTypeInfoInteger",1 /* tkInteger */);
    newBaseInt("shortint",-0x80,0x7f,0);
    newBaseInt("byte",0,0xff,1);
    newBaseInt("smallint",-0x8000,0x7fff,2);
    newBaseInt("word",0,0xffff,3);
    newBaseInt("longint",-0x80000000,0x7fffffff,4);
    newBaseInt("longword",0,0xffffffff,5);
    newBaseInt("nativeint",-0x10000000000000,0xfffffffffffff,6);
    newBaseInt("nativeuint",0,0xfffffffffffff,7);
    newBaseTI("char",2 /* tkChar */);
    newBaseTI("string",3 /* tkString */);
    newBaseTI("tTypeInfoEnum",4 /* tkEnumeration */,rtl.tTypeInfoInteger);
    newBaseTI("tTypeInfoSet",5 /* tkSet */);
    newBaseTI("double",6 /* tkDouble */);
    newBaseTI("boolean",7 /* tkBool */);
    newBaseTI("tTypeInfoProcVar",8 /* tkProcVar */);
    newBaseTI("tTypeInfoMethodVar",9 /* tkMethod */,rtl.tTypeInfoProcVar);
    newBaseTI("tTypeInfoArray",10 /* tkArray */);
    newBaseTI("tTypeInfoDynArray",11 /* tkDynArray */);
    newBaseTI("tTypeInfoPointer",15 /* tkPointer */);
    var t = newBaseTI("pointer",15 /* tkPointer */,rtl.tTypeInfoPointer);
    t.reftype = null;
    newBaseTI("jsvalue",16 /* tkJSValue */);
    newBaseTI("tTypeInfoRefToProcVar",17 /* tkRefToProcVar */,rtl.tTypeInfoProcVar);

    // member kinds
    rtl.tTypeMember = {};
    function newMember(name,kind){
      var m = Object.create(rtl.tTypeMember);
      m.name = name;
      m.kind = kind;
      rtl[name] = m;
    };
    newMember("tTypeMemberField",1); // tmkField
    newMember("tTypeMemberMethod",2); // tmkMethod
    newMember("tTypeMemberProperty",3); // tmkProperty

    // base object for storing members: a simple object
    rtl.tTypeMembers = {};

    // tTypeInfoStruct - base object for tTypeInfoClass, tTypeInfoRecord, tTypeInfoInterface
    var tis = newBaseTI("tTypeInfoStruct",0);
    tis.$addMember = function(name,ancestor,options){
      if (rtl.debug_rtti){
        if (!rtl.hasString(name) || (name.charAt()==='$')) throw 'invalid member "'+name+'", this="'+this.name+'"';
        if (!rtl.is(ancestor,rtl.tTypeMember)) throw 'invalid ancestor "'+ancestor+':'+ancestor.name+'", "'+this.name+'.'+name+'"';
        if ((options!=undefined) && (typeof(options)!='object')) throw 'invalid options "'+options+'", "'+this.name+'.'+name+'"';
      };
      var t = Object.create(ancestor);
      t.name = name;
      this.members[name] = t;
      this.names.push(name);
      if (rtl.isObject(options)){
        for (var key in options) if (options.hasOwnProperty(key)) t[key] = options[key];
      };
      return t;
    };
    tis.addField = function(name,type,options){
      var t = this.$addMember(name,rtl.tTypeMemberField,options);
      if (rtl.debug_rtti){
        if (!rtl.is(type,rtl.tTypeInfo)) throw 'invalid type "'+type+'", "'+this.name+'.'+name+'"';
      };
      t.typeinfo = type;
      this.fields.push(name);
      return t;
    };
    tis.addFields = function(){
      var i=0;
      while(i<arguments.length){
        var name = arguments[i++];
        var type = arguments[i++];
        if ((i<arguments.length) && (typeof(arguments[i])==='object')){
          this.addField(name,type,arguments[i++]);
        } else {
          this.addField(name,type);
        };
      };
    };
    tis.addMethod = function(name,methodkind,params,result,options){
      var t = this.$addMember(name,rtl.tTypeMemberMethod,options);
      t.methodkind = methodkind;
      t.procsig = rtl.newTIProcSig(params);
      t.procsig.resulttype = result?result:null;
      this.methods.push(name);
      return t;
    };
    tis.addProperty = function(name,flags,result,getter,setter,options){
      var t = this.$addMember(name,rtl.tTypeMemberProperty,options);
      t.flags = flags;
      t.typeinfo = result;
      t.getter = getter;
      t.setter = setter;
      // Note: in options: params, stored, defaultvalue
      if (rtl.isArray(t.params)) t.params = rtl.newTIParams(t.params);
      this.properties.push(name);
      if (!rtl.isString(t.stored)) t.stored = "";
      return t;
    };
    tis.getField = function(index){
      return this.members[this.fields[index]];
    };
    tis.getMethod = function(index){
      return this.members[this.methods[index]];
    };
    tis.getProperty = function(index){
      return this.members[this.properties[index]];
    };

    newBaseTI("tTypeInfoRecord",12 /* tkRecord */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClass",13 /* tkClass */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClassRef",14 /* tkClassRef */);
    newBaseTI("tTypeInfoInterface",18 /* tkInterface */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoHelper",19 /* tkHelper */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoExtClass",20 /* tkExtClass */,rtl.tTypeInfoClass);
  },

  tSectionRTTI: {
    $module: null,
    $inherited: function(name,ancestor,o){
      if (rtl.debug_rtti){
        rtl.debug('tSectionRTTI.newTI "'+(this.$module?this.$module.$name:"(no module)")
          +'"."'+name+'" ('+ancestor.name+') '+(o?'init':'forward'));
      };
      var t = this[name];
      if (t){
        if (!t.$forward) throw 'duplicate type "'+name+'"';
        if (!ancestor.isPrototypeOf(t)) throw 'typeinfo ancestor mismatch "'+name+'" ancestor="'+ancestor.name+'" t.name="'+t.name+'"';
      } else {
        t = Object.create(ancestor);
        t.name = name;
        t.$module = this.$module;
        this[name] = t;
      }
      if (o){
        delete t.$forward;
        for (var key in o) if (o.hasOwnProperty(key)) t[key]=o[key];
      } else {
        t.$forward = true;
      }
      return t;
    },
    $Scope: function(name,ancestor,o){
      var t=this.$inherited(name,ancestor,o);
      t.members = {};
      t.names = [];
      t.fields = [];
      t.methods = [];
      t.properties = [];
      return t;
    },
    $TI: function(name,kind,o){ var t=this.$inherited(name,rtl.tTypeInfo,o); t.kind = kind; return t; },
    $Int: function(name,o){ return this.$inherited(name,rtl.tTypeInfoInteger,o); },
    $Enum: function(name,o){ return this.$inherited(name,rtl.tTypeInfoEnum,o); },
    $Set: function(name,o){ return this.$inherited(name,rtl.tTypeInfoSet,o); },
    $StaticArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoArray,o); },
    $DynArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoDynArray,o); },
    $ProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoProcVar,o); },
    $RefToProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoRefToProcVar,o); },
    $MethodVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoMethodVar,o); },
    $Record: function(name,o){ return this.$Scope(name,rtl.tTypeInfoRecord,o); },
    $Class: function(name,o){ return this.$Scope(name,rtl.tTypeInfoClass,o); },
    $ClassRef: function(name,o){ return this.$inherited(name,rtl.tTypeInfoClassRef,o); },
    $Pointer: function(name,o){ return this.$inherited(name,rtl.tTypeInfoPointer,o); },
    $Interface: function(name,o){ return this.$Scope(name,rtl.tTypeInfoInterface,o); },
    $Helper: function(name,o){ return this.$Scope(name,rtl.tTypeInfoHelper,o); },
    $ExtClass: function(name,o){ return this.$Scope(name,rtl.tTypeInfoExtClass,o); }
  },

  newTIParam: function(param){
    // param is an array, 0=name, 1=type, 2=optional flags
    var t = {
      name: param[0],
      typeinfo: param[1],
      flags: (rtl.isNumber(param[2]) ? param[2] : 0)
    };
    return t;
  },

  newTIParams: function(list){
    // list: optional array of [paramname,typeinfo,optional flags]
    var params = [];
    if (rtl.isArray(list)){
      for (var i=0; i<list.length; i++) params.push(rtl.newTIParam(list[i]));
    };
    return params;
  },

  newTIProcSig: function(params,result,flags){
    var s = {
      params: rtl.newTIParams(params),
      resulttype: result,
      flags: flags
    };
    return s;
  },

  addResource: function(aRes){
    rtl.$res[aRes.name]=aRes;
  },

  getResource: function(aName){
    var res = rtl.$res[aName];
    if (res !== undefined) {
      return res;
    } else {
      return null;
    }
  },

  getResourceList: function(){
    return Object.keys(rtl.$res);
  }
}

rtl.module("System",[],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"TObject",null,function () {
    this.$init = function () {
    };
    this.$final = function () {
    };
    this.Create = function () {
      return this;
    };
    this.Destroy = function () {
    };
    this.Free = function () {
      this.$destroy("Destroy");
    };
    this.AfterConstruction = function () {
    };
    this.BeforeDestruction = function () {
    };
  });
  this.Random = function (Range) {
    return Math.floor(Math.random()*Range);
  };
  this.Sqr = function (A) {
    return A*A;
  };
  this.Sqr$1 = function (A) {
    return A*A;
  };
  this.Trunc = function (A) {
    if (!Math.trunc) {
      Math.trunc = function(v) {
        v = +v;
        if (!isFinite(v)) return v;
        return (v - v % 1) || (v < 0 ? -0 : v === 0 ? v : 0);
      };
    }
    $mod.Trunc = Math.trunc;
    return Math.trunc(A);
  };
  this.Int = function (A) {
    var Result = 0.0;
    Result = $mod.Trunc(A);
    return Result;
  };
  this.Copy = function (S, Index, Size) {
    if (Index<1) Index = 1;
    return (Size>0) ? S.substring(Index-1,Index+Size-1) : "";
  };
  this.Copy$1 = function (S, Index) {
    if (Index<1) Index = 1;
    return S.substr(Index-1);
  };
  this.Delete = function (S, Index, Size) {
    var h = "";
    if ((Index < 1) || (Index > S.get().length) || (Size <= 0)) return;
    h = S.get();
    S.set($mod.Copy(h,1,Index - 1) + $mod.Copy$1(h,Index + Size));
  };
  this.Pos = function (Search, InString) {
    return InString.indexOf(Search)+1;
  };
  this.Insert = function (Insertion, Target, Index) {
    var t = "";
    if (Insertion === "") return;
    t = Target.get();
    if (Index < 1) {
      Target.set(Insertion + t)}
     else if (Index > t.length) {
      Target.set(t + Insertion)}
     else Target.set($mod.Copy(t,1,Index - 1) + Insertion + $mod.Copy(t,Index,t.length));
  };
  this.upcase = function (c) {
    return c.toUpperCase();
  };
  this.val = function (S, NI, Code) {
    NI.set($impl.valint(S,-9007199254740991,9007199254740991,Code));
  };
  this.StringOfChar = function (c, l) {
    var Result = "";
    var i = 0;
    if ((l>0) && c.repeat) return c.repeat(l);
    Result = "";
    for (var $l = 1, $end = l; $l <= $end; $l++) {
      i = $l;
      Result = Result + c;
    };
    return Result;
  };
  this.Writeln = function () {
    var i = 0;
    var l = 0;
    var s = "";
    l = arguments.length - 1;
    if ($impl.WriteCallBack != null) {
      for (var $l = 0, $end = l; $l <= $end; $l++) {
        i = $l;
        $impl.WriteCallBack(arguments[i],i === l);
      };
    } else {
      s = $impl.WriteBuf;
      for (var $l1 = 0, $end1 = l; $l1 <= $end1; $l1++) {
        i = $l1;
        s = s + ("" + arguments[i]);
      };
      console.log(s);
      $impl.WriteBuf = "";
    };
  };
  this.Assigned = function (V) {
    return (V!=undefined) && (V!=null) && (!rtl.isArray(V) || (V.length > 0));
  };
  $mod.$implcode = function () {
    $impl.WriteBuf = "";
    $impl.WriteCallBack = null;
    $impl.valint = function (S, MinVal, MaxVal, Code) {
      var Result = 0;
      var x = 0.0;
      x = Number(S);
      if (isNaN(x)) {
        var $tmp = $mod.Copy(S,1,1);
        if ($tmp === "$") {
          x = Number("0x" + $mod.Copy$1(S,2))}
         else if ($tmp === "&") {
          x = Number("0o" + $mod.Copy$1(S,2))}
         else if ($tmp === "%") {
          x = Number("0b" + $mod.Copy$1(S,2))}
         else {
          Code.set(1);
          return Result;
        };
      };
      if (isNaN(x) || (x !== $mod.Int(x))) {
        Code.set(1)}
       else if ((x < MinVal) || (x > MaxVal)) {
        Code.set(2)}
       else {
        Result = $mod.Trunc(x);
        Code.set(0);
      };
      return Result;
    };
  };
  $mod.$init = function () {
    rtl.exitcode = 0;
  };
},[]);
rtl.module("Types",["System"],function () {
  "use strict";
  var $mod = this;
  this.TDuplicates = {"0": "dupIgnore", dupIgnore: 0, "1": "dupAccept", dupAccept: 1, "2": "dupError", dupError: 2};
});
rtl.module("JS",["System","Types"],function () {
  "use strict";
  var $mod = this;
  this.isInteger = function (v) {
    return Math.floor(v)===v;
  };
  this.isNull = function (v) {
    return v === null;
  };
  this.TJSValueType = {"0": "jvtNull", jvtNull: 0, "1": "jvtBoolean", jvtBoolean: 1, "2": "jvtInteger", jvtInteger: 2, "3": "jvtFloat", jvtFloat: 3, "4": "jvtString", jvtString: 4, "5": "jvtObject", jvtObject: 5, "6": "jvtArray", jvtArray: 6};
  this.GetValueType = function (JS) {
    var Result = 0;
    var t = "";
    if ($mod.isNull(JS)) {
      Result = 0}
     else {
      t = typeof(JS);
      if (t === "string") {
        Result = 4}
       else if (t === "boolean") {
        Result = 1}
       else if (t === "object") {
        if (rtl.isArray(JS)) {
          Result = 6}
         else Result = 5;
      } else if (t === "number") if ($mod.isInteger(JS)) {
        Result = 2}
       else Result = 3;
    };
    return Result;
  };
});
rtl.module("RTLConsts",["System"],function () {
  "use strict";
  var $mod = this;
  $mod.$resourcestrings = {SArgumentMissing: {org: 'Missing argument in format "%s"'}, SInvalidFormat: {org: 'Invalid format specifier : "%s"'}, SInvalidArgIndex: {org: 'Invalid argument index in format: "%s"'}, SListCapacityError: {org: "List capacity (%s) exceeded."}, SListCountError: {org: "List count (%s) out of bounds."}, SListIndexError: {org: "List index (%s) out of bounds"}, SSortedListError: {org: "Operation not allowed on sorted list"}, SDuplicateString: {org: "String list does not allow duplicates"}, SErrFindNeedsSortedList: {org: "Cannot use find on unsorted list"}};
});
rtl.module("SysUtils",["System","RTLConsts","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.FreeAndNil = function (Obj) {
    var o = null;
    o = Obj.get();
    if (o === null) return;
    Obj.set(null);
    o.$destroy("Destroy");
  };
  rtl.recNewT(this,"TFormatSettings",function () {
    this.CurrencyDecimals = 0;
    this.CurrencyFormat = 0;
    this.CurrencyString = "";
    this.DateSeparator = "";
    this.DecimalSeparator = "";
    this.LongDateFormat = "";
    this.LongTimeFormat = "";
    this.NegCurrFormat = 0;
    this.ShortDateFormat = "";
    this.ShortTimeFormat = "";
    this.ThousandSeparator = "";
    this.TimeAMString = "";
    this.TimePMString = "";
    this.TimeSeparator = "";
    this.TwoDigitYearCenturyWindow = 0;
    this.InitLocaleHandler = null;
    this.$new = function () {
      var r = Object.create(this);
      r.DateTimeToStrFormat = rtl.arraySetLength(null,"",2);
      r.LongDayNames = rtl.arraySetLength(null,"",7);
      r.LongMonthNames = rtl.arraySetLength(null,"",12);
      r.ShortDayNames = rtl.arraySetLength(null,"",7);
      r.ShortMonthNames = rtl.arraySetLength(null,"",12);
      return r;
    };
    this.$eq = function (b) {
      return (this.CurrencyDecimals === b.CurrencyDecimals) && (this.CurrencyFormat === b.CurrencyFormat) && (this.CurrencyString === b.CurrencyString) && (this.DateSeparator === b.DateSeparator) && rtl.arrayEq(this.DateTimeToStrFormat,b.DateTimeToStrFormat) && (this.DecimalSeparator === b.DecimalSeparator) && (this.LongDateFormat === b.LongDateFormat) && rtl.arrayEq(this.LongDayNames,b.LongDayNames) && rtl.arrayEq(this.LongMonthNames,b.LongMonthNames) && (this.LongTimeFormat === b.LongTimeFormat) && (this.NegCurrFormat === b.NegCurrFormat) && (this.ShortDateFormat === b.ShortDateFormat) && rtl.arrayEq(this.ShortDayNames,b.ShortDayNames) && rtl.arrayEq(this.ShortMonthNames,b.ShortMonthNames) && (this.ShortTimeFormat === b.ShortTimeFormat) && (this.ThousandSeparator === b.ThousandSeparator) && (this.TimeAMString === b.TimeAMString) && (this.TimePMString === b.TimePMString) && (this.TimeSeparator === b.TimeSeparator) && (this.TwoDigitYearCenturyWindow === b.TwoDigitYearCenturyWindow);
    };
    this.$assign = function (s) {
      this.CurrencyDecimals = s.CurrencyDecimals;
      this.CurrencyFormat = s.CurrencyFormat;
      this.CurrencyString = s.CurrencyString;
      this.DateSeparator = s.DateSeparator;
      this.DateTimeToStrFormat = s.DateTimeToStrFormat.slice(0);
      this.DecimalSeparator = s.DecimalSeparator;
      this.LongDateFormat = s.LongDateFormat;
      this.LongDayNames = s.LongDayNames.slice(0);
      this.LongMonthNames = s.LongMonthNames.slice(0);
      this.LongTimeFormat = s.LongTimeFormat;
      this.NegCurrFormat = s.NegCurrFormat;
      this.ShortDateFormat = s.ShortDateFormat;
      this.ShortDayNames = s.ShortDayNames.slice(0);
      this.ShortMonthNames = s.ShortMonthNames.slice(0);
      this.ShortTimeFormat = s.ShortTimeFormat;
      this.ThousandSeparator = s.ThousandSeparator;
      this.TimeAMString = s.TimeAMString;
      this.TimePMString = s.TimePMString;
      this.TimeSeparator = s.TimeSeparator;
      this.TwoDigitYearCenturyWindow = s.TwoDigitYearCenturyWindow;
      return this;
    };
    this.GetJSLocale = function () {
      return Intl.DateTimeFormat().resolvedOptions().locale;
    };
    this.Create = function () {
      var Result = $mod.TFormatSettings.$new();
      Result.$assign($mod.TFormatSettings.Create$1($mod.TFormatSettings.GetJSLocale()));
      return Result;
    };
    this.Create$1 = function (ALocale) {
      var Result = $mod.TFormatSettings.$new();
      Result.LongDayNames = $impl.DefaultLongDayNames.slice(0);
      Result.ShortDayNames = $impl.DefaultShortDayNames.slice(0);
      Result.ShortMonthNames = $impl.DefaultShortMonthNames.slice(0);
      Result.LongMonthNames = $impl.DefaultLongMonthNames.slice(0);
      Result.DateTimeToStrFormat[0] = "c";
      Result.DateTimeToStrFormat[1] = "f";
      Result.DateSeparator = "-";
      Result.TimeSeparator = ":";
      Result.ShortDateFormat = "yyyy-mm-dd";
      Result.LongDateFormat = "ddd, yyyy-mm-dd";
      Result.ShortTimeFormat = "hh:nn";
      Result.LongTimeFormat = "hh:nn:ss";
      Result.DecimalSeparator = ".";
      Result.ThousandSeparator = ",";
      Result.TimeAMString = "AM";
      Result.TimePMString = "PM";
      Result.TwoDigitYearCenturyWindow = 50;
      Result.CurrencyFormat = 0;
      Result.NegCurrFormat = 0;
      Result.CurrencyDecimals = 2;
      Result.CurrencyString = "$";
      if ($mod.TFormatSettings.InitLocaleHandler != null) $mod.TFormatSettings.InitLocaleHandler($mod.UpperCase(ALocale),$mod.TFormatSettings.$clone(Result));
      return Result;
    };
  },true);
  rtl.createClass(this,"Exception",pas.System.TObject,function () {
    this.LogMessageOnCreate = false;
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fMessage = "";
    };
    this.Create$1 = function (Msg) {
      this.fMessage = Msg;
      if (this.LogMessageOnCreate) pas.System.Writeln("Created exception ",this.$classname," with message: ",Msg);
      return this;
    };
    this.CreateFmt = function (Msg, Args) {
      this.Create$1($mod.Format(Msg,Args));
      return this;
    };
  });
  rtl.createClass(this,"EConvertError",this.Exception,function () {
  });
  this.TrimLeft = function (S) {
    return S.replace(/^[\s\uFEFF\xA0\x00-\x1f]+/,'');
  };
  this.UpperCase = function (s) {
    return s.toUpperCase();
  };
  this.LowerCase = function (s) {
    return s.toLowerCase();
  };
  this.CompareStr = function (s1, s2) {
    var l1 = s1.length;
    var l2 = s2.length;
    if (l1<=l2){
      var s = s2.substr(0,l1);
      if (s1<s){ return -1;
      } else if (s1>s){ return 1;
      } else { return l1<l2 ? -1 : 0; };
    } else {
      var s = s1.substr(0,l2);
      if (s<s2){ return -1;
      } else { return 1; };
    };
  };
  this.CompareText = function (s1, s2) {
    var l1 = s1.toLowerCase();
    var l2 = s2.toLowerCase();
    if (l1>l2){ return 1;
    } else if (l1<l2){ return -1;
    } else { return 0; };
  };
  this.Format = function (Fmt, Args) {
    var Result = "";
    Result = $mod.Format$1(Fmt,Args,$mod.FormatSettings);
    return Result;
  };
  this.Format$1 = function (Fmt, Args, aSettings) {
    var Result = "";
    var ChPos = 0;
    var OldPos = 0;
    var ArgPos = 0;
    var DoArg = 0;
    var Len = 0;
    var Hs = "";
    var ToAdd = "";
    var Index = 0;
    var Width = 0;
    var Prec = 0;
    var Left = false;
    var Fchar = "";
    var vq = 0;
    function ReadFormat() {
      var Result = "";
      var Value = 0;
      function ReadInteger() {
        var Code = 0;
        var ArgN = 0;
        if (Value !== -1) return;
        OldPos = ChPos;
        while ((ChPos <= Len) && (Fmt.charAt(ChPos - 1) <= "9") && (Fmt.charAt(ChPos - 1) >= "0")) ChPos += 1;
        if (ChPos > Len) $impl.DoFormatError(1,Fmt);
        if (Fmt.charAt(ChPos - 1) === "*") {
          if (Index === 255) {
            ArgN = ArgPos}
           else {
            ArgN = Index;
            Index += 1;
          };
          if ((ChPos > OldPos) || (ArgN > (rtl.length(Args) - 1))) $impl.DoFormatError(1,Fmt);
          ArgPos = ArgN + 1;
          if (rtl.isNumber(Args[ArgN]) && pas.JS.isInteger(Args[ArgN])) {
            Value = rtl.trunc(Args[ArgN])}
           else $impl.DoFormatError(1,Fmt);
          ChPos += 1;
        } else {
          if (OldPos < ChPos) {
            pas.System.val(pas.System.Copy(Fmt,OldPos,ChPos - OldPos),{get: function () {
                return Value;
              }, set: function (v) {
                Value = v;
              }},{get: function () {
                return Code;
              }, set: function (v) {
                Code = v;
              }});
            if (Code > 0) $impl.DoFormatError(1,Fmt);
          } else Value = -1;
        };
      };
      function ReadIndex() {
        if (Fmt.charAt(ChPos - 1) !== ":") {
          ReadInteger()}
         else Value = 0;
        if (Fmt.charAt(ChPos - 1) === ":") {
          if (Value === -1) $impl.DoFormatError(2,Fmt);
          Index = Value;
          Value = -1;
          ChPos += 1;
        };
      };
      function ReadLeft() {
        if (Fmt.charAt(ChPos - 1) === "-") {
          Left = true;
          ChPos += 1;
        } else Left = false;
      };
      function ReadWidth() {
        ReadInteger();
        if (Value !== -1) {
          Width = Value;
          Value = -1;
        };
      };
      function ReadPrec() {
        if (Fmt.charAt(ChPos - 1) === ".") {
          ChPos += 1;
          ReadInteger();
          if (Value === -1) Value = 0;
          Prec = Value;
        };
      };
      Index = 255;
      Width = -1;
      Prec = -1;
      Value = -1;
      ChPos += 1;
      if (Fmt.charAt(ChPos - 1) === "%") {
        Result = "%";
        return Result;
      };
      ReadIndex();
      ReadLeft();
      ReadWidth();
      ReadPrec();
      Result = pas.System.upcase(Fmt.charAt(ChPos - 1));
      return Result;
    };
    function Checkarg(AT, err) {
      var Result = false;
      Result = false;
      if (Index === 255) {
        DoArg = ArgPos}
       else DoArg = Index;
      ArgPos = DoArg + 1;
      if ((DoArg > (rtl.length(Args) - 1)) || (pas.JS.GetValueType(Args[DoArg]) !== AT)) {
        if (err) $impl.DoFormatError(3,Fmt);
        ArgPos -= 1;
        return Result;
      };
      Result = true;
      return Result;
    };
    Result = "";
    Len = Fmt.length;
    ChPos = 1;
    OldPos = 1;
    ArgPos = 0;
    while (ChPos <= Len) {
      while ((ChPos <= Len) && (Fmt.charAt(ChPos - 1) !== "%")) ChPos += 1;
      if (ChPos > OldPos) Result = Result + pas.System.Copy(Fmt,OldPos,ChPos - OldPos);
      if (ChPos < Len) {
        Fchar = ReadFormat();
        var $tmp = Fchar;
        if ($tmp === "D") {
          Checkarg(2,true);
          ToAdd = $mod.IntToStr(rtl.trunc(Args[DoArg]));
          Width = Math.abs(Width);
          Index = Prec - ToAdd.length;
          if (ToAdd.charAt(0) !== "-") {
            ToAdd = pas.System.StringOfChar("0",Index) + ToAdd}
           else pas.System.Insert(pas.System.StringOfChar("0",Index + 1),{get: function () {
              return ToAdd;
            }, set: function (v) {
              ToAdd = v;
            }},2);
        } else if ($tmp === "U") {
          Checkarg(2,true);
          if (rtl.trunc(Args[DoArg]) < 0) $impl.DoFormatError(3,Fmt);
          ToAdd = $mod.IntToStr(rtl.trunc(Args[DoArg]));
          Width = Math.abs(Width);
          Index = Prec - ToAdd.length;
          ToAdd = pas.System.StringOfChar("0",Index) + ToAdd;
        } else if ($tmp === "E") {
          if (Checkarg(3,false) || Checkarg(2,true)) ToAdd = $mod.FloatToStrF$1(rtl.getNumber(Args[DoArg]),0,9999,Prec,aSettings);
        } else if ($tmp === "F") {
          if (Checkarg(3,false) || Checkarg(2,true)) ToAdd = $mod.FloatToStrF$1(rtl.getNumber(Args[DoArg]),0,9999,Prec,aSettings);
        } else if ($tmp === "G") {
          if (Checkarg(3,false) || Checkarg(2,true)) ToAdd = $mod.FloatToStrF$1(rtl.getNumber(Args[DoArg]),1,Prec,3,aSettings);
        } else if ($tmp === "N") {
          if (Checkarg(3,false) || Checkarg(2,true)) ToAdd = $mod.FloatToStrF$1(rtl.getNumber(Args[DoArg]),3,9999,Prec,aSettings);
        } else if ($tmp === "M") {
          if (Checkarg(3,false) || Checkarg(2,true)) ToAdd = $mod.FloatToStrF$1(rtl.getNumber(Args[DoArg]),4,9999,Prec,aSettings);
        } else if ($tmp === "S") {
          Checkarg(4,true);
          Hs = "" + Args[DoArg];
          Index = Hs.length;
          if ((Prec !== -1) && (Index > Prec)) Index = Prec;
          ToAdd = pas.System.Copy(Hs,1,Index);
        } else if ($tmp === "P") {
          Checkarg(2,true);
          ToAdd = $mod.IntToHex(rtl.trunc(Args[DoArg]),31);
        } else if ($tmp === "X") {
          Checkarg(2,true);
          vq = rtl.trunc(Args[DoArg]);
          Index = 31;
          if (Prec > Index) {
            ToAdd = $mod.IntToHex(vq,Index)}
           else {
            Index = 1;
            while ((rtl.shl(1,Index * 4) <= vq) && (Index < 16)) Index += 1;
            if (Index > Prec) Prec = Index;
            ToAdd = $mod.IntToHex(vq,Prec);
          };
        } else if ($tmp === "%") ToAdd = "%";
        if (Width !== -1) if (ToAdd.length < Width) if (!Left) {
          ToAdd = pas.System.StringOfChar(" ",Width - ToAdd.length) + ToAdd}
         else ToAdd = ToAdd + pas.System.StringOfChar(" ",Width - ToAdd.length);
        Result = Result + ToAdd;
      };
      ChPos += 1;
      OldPos = ChPos;
    };
    return Result;
  };
  this.IntToStr = function (Value) {
    var Result = "";
    Result = "" + Value;
    return Result;
  };
  this.IntToHex = function (Value, Digits) {
    var Result = "";
    Result = "";
    if (Value < 0) if (Value<0) Value = 0xFFFFFFFF + Value + 1;
    Result=Value.toString(16);
    Result = $mod.UpperCase(Result);
    while (Result.length < Digits) Result = "0" + Result;
    return Result;
  };
  this.TFloatFormat = {"0": "ffFixed", ffFixed: 0, "1": "ffGeneral", ffGeneral: 1, "2": "ffExponent", ffExponent: 2, "3": "ffNumber", ffNumber: 3, "4": "ffCurrency", ffCurrency: 4};
  this.FloatToStrF$1 = function (Value, format, Precision, Digits, aSettings) {
    var Result = "";
    var TS = "";
    var DS = "";
    DS = aSettings.DecimalSeparator;
    TS = aSettings.ThousandSeparator;
    var $tmp = format;
    if ($tmp === 1) {
      Result = $impl.FormatGeneralFloat(Value,Precision,DS)}
     else if ($tmp === 2) {
      Result = $impl.FormatExponentFloat(Value,Precision,Digits,DS)}
     else if ($tmp === 0) {
      Result = $impl.FormatFixedFloat(Value,Digits,DS)}
     else if ($tmp === 3) {
      Result = $impl.FormatNumberFloat(Value,Digits,DS,TS)}
     else if ($tmp === 4) Result = $impl.FormatNumberCurrency(Value * 10000,Digits,aSettings);
    if ((format !== 4) && (Result.length > 1) && (Result.charAt(0) === "-")) $impl.RemoveLeadingNegativeSign({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},DS,TS);
    return Result;
  };
  this.TimeSeparator = "";
  this.DateSeparator = "";
  this.ShortDateFormat = "";
  this.LongDateFormat = "";
  this.ShortTimeFormat = "";
  this.LongTimeFormat = "";
  this.DecimalSeparator = "";
  this.ThousandSeparator = "";
  this.TimeAMString = "";
  this.TimePMString = "";
  this.ShortMonthNames = rtl.arraySetLength(null,"",12);
  this.LongMonthNames = rtl.arraySetLength(null,"",12);
  this.ShortDayNames = rtl.arraySetLength(null,"",7);
  this.LongDayNames = rtl.arraySetLength(null,"",7);
  this.FormatSettings = this.TFormatSettings.$new();
  this.CurrencyFormat = 0;
  this.NegCurrFormat = 0;
  this.CurrencyDecimals = 0;
  this.CurrencyString = "";
  $mod.$implcode = function () {
    $impl.DefaultShortMonthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    $impl.DefaultLongMonthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    $impl.DefaultShortDayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    $impl.DefaultLongDayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    $impl.feInvalidFormat = 1;
    $impl.feMissingArgument = 2;
    $impl.feInvalidArgIndex = 3;
    $impl.DoFormatError = function (ErrCode, fmt) {
      var $tmp = ErrCode;
      if ($tmp === 1) {
        throw $mod.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SInvalidFormat"),[fmt]])}
       else if ($tmp === 2) {
        throw $mod.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SArgumentMissing"),[fmt]])}
       else if ($tmp === 3) throw $mod.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SInvalidArgIndex"),[fmt]]);
    };
    $impl.maxdigits = 15;
    $impl.ReplaceDecimalSep = function (S, DS) {
      var Result = "";
      var P = 0;
      P = pas.System.Pos(".",S);
      if (P > 0) {
        Result = pas.System.Copy(S,1,P - 1) + DS + pas.System.Copy(S,P + 1,S.length - P)}
       else Result = S;
      return Result;
    };
    $impl.FormatGeneralFloat = function (Value, Precision, DS) {
      var Result = "";
      var P = 0;
      var PE = 0;
      var Q = 0;
      var Exponent = 0;
      if ((Precision === -1) || (Precision > 15)) Precision = 15;
      Result = rtl.floatToStr(Value,Precision + 7);
      Result = $mod.TrimLeft(Result);
      P = pas.System.Pos(".",Result);
      if (P === 0) return Result;
      PE = pas.System.Pos("E",Result);
      if (PE === 0) {
        Result = $impl.ReplaceDecimalSep(Result,DS);
        return Result;
      };
      Q = PE + 2;
      Exponent = 0;
      while (Q <= Result.length) {
        Exponent = ((Exponent * 10) + Result.charCodeAt(Q - 1)) - 48;
        Q += 1;
      };
      if (Result.charAt((PE + 1) - 1) === "-") Exponent = -Exponent;
      if (((P + Exponent) < PE) && (Exponent > -6)) {
        Result = rtl.strSetLength(Result,PE - 1);
        if (Exponent >= 0) {
          for (var $l = 0, $end = Exponent - 1; $l <= $end; $l++) {
            Q = $l;
            Result = rtl.setCharAt(Result,P - 1,Result.charAt((P + 1) - 1));
            P += 1;
          };
          Result = rtl.setCharAt(Result,P - 1,".");
          P = 1;
          if (Result.charAt(P - 1) === "-") P += 1;
          while ((Result.charAt(P - 1) === "0") && (P < Result.length) && (pas.System.Copy(Result,P + 1,DS.length) !== DS)) pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P,1);
        } else {
          pas.System.Insert(pas.System.Copy("00000",1,-Exponent),{get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P - 1);
          Result = rtl.setCharAt(Result,P - Exponent - 1,Result.charAt(P - Exponent - 1 - 1));
          Result = rtl.setCharAt(Result,P - 1,".");
          if (Exponent !== -1) Result = rtl.setCharAt(Result,P - Exponent - 1 - 1,"0");
        };
        Q = Result.length;
        while ((Q > 0) && (Result.charAt(Q - 1) === "0")) Q -= 1;
        if (Result.charAt(Q - 1) === ".") Q -= 1;
        if ((Q === 0) || ((Q === 1) && (Result.charAt(0) === "-"))) {
          Result = "0"}
         else Result = rtl.strSetLength(Result,Q);
      } else {
        while (Result.charAt(PE - 1 - 1) === "0") {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},PE - 1,1);
          PE -= 1;
        };
        if (Result.charAt(PE - 1 - 1) === DS) {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},PE - 1,1);
          PE -= 1;
        };
        if (Result.charAt((PE + 1) - 1) === "+") {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},PE + 1,1)}
         else PE += 1;
        while (Result.charAt((PE + 1) - 1) === "0") pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},PE + 1,1);
      };
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    $impl.FormatExponentFloat = function (Value, Precision, Digits, DS) {
      var Result = "";
      var P = 0;
      DS = $mod.FormatSettings.DecimalSeparator;
      if ((Precision === -1) || (Precision > 15)) Precision = 15;
      Result = rtl.floatToStr(Value,Precision + 7);
      while (Result.charAt(0) === " ") pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      P = pas.System.Pos("E",Result);
      if (P === 0) {
        Result = $impl.ReplaceDecimalSep(Result,DS);
        return Result;
      };
      P += 2;
      if (Digits > 4) Digits = 4;
      Digits = (Result.length - P - Digits) + 1;
      if (Digits < 0) {
        pas.System.Insert(pas.System.Copy("0000",1,-Digits),{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P)}
       else while ((Digits > 0) && (Result.charAt(P - 1) === "0")) {
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P,1);
        if (P > Result.length) {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P - 2,2);
          break;
        };
        Digits -= 1;
      };
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    $impl.FormatFixedFloat = function (Value, Digits, DS) {
      var Result = "";
      if (Digits === -1) {
        Digits = 2}
       else if (Digits > 18) Digits = 18;
      Result = rtl.floatToStr(Value,0,Digits);
      if ((Result !== "") && (Result.charAt(0) === " ")) pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    $impl.FormatNumberFloat = function (Value, Digits, DS, TS) {
      var Result = "";
      var P = 0;
      if (Digits === -1) {
        Digits = 2}
       else if (Digits > 15) Digits = 15;
      Result = rtl.floatToStr(Value,0,Digits);
      if ((Result !== "") && (Result.charAt(0) === " ")) pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      P = pas.System.Pos(".",Result);
      if (P <= 0) P = Result.length + 1;
      Result = $impl.ReplaceDecimalSep(Result,DS);
      P -= 3;
      if ((TS !== "") && (TS !== "\x00")) while (P > 1) {
        if (Result.charAt(P - 1 - 1) !== "-") pas.System.Insert(TS,{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P);
        P -= 3;
      };
      return Result;
    };
    $impl.RemoveLeadingNegativeSign = function (AValue, DS, aThousandSeparator) {
      var Result = false;
      var i = 0;
      var TS = "";
      var StartPos = 0;
      Result = false;
      StartPos = 2;
      TS = aThousandSeparator;
      for (var $l = StartPos, $end = AValue.get().length; $l <= $end; $l++) {
        i = $l;
        Result = (AValue.get().charCodeAt(i - 1) in rtl.createSet(48,DS.charCodeAt(),69,43)) || (AValue.get().charAt(i - 1) === TS);
        if (!Result) break;
      };
      if (Result && (AValue.get().charAt(0) === "-")) pas.System.Delete(AValue,1,1);
      return Result;
    };
    $impl.FormatNumberCurrency = function (Value, Digits, aSettings) {
      var Result = "";
      var Negative = false;
      var P = 0;
      var CS = "";
      var DS = "";
      var TS = "";
      DS = aSettings.DecimalSeparator;
      TS = aSettings.ThousandSeparator;
      CS = aSettings.CurrencyString;
      if (Digits === -1) {
        Digits = aSettings.CurrencyDecimals}
       else if (Digits > 18) Digits = 18;
      Result = rtl.floatToStr(Value / 10000,0,Digits);
      Negative = Result.charAt(0) === "-";
      if (Negative) pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      P = pas.System.Pos(".",Result);
      if (TS !== "") {
        if (P !== 0) {
          Result = $impl.ReplaceDecimalSep(Result,DS)}
         else P = Result.length + 1;
        P -= 3;
        while (P > 1) {
          pas.System.Insert(DS,{get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P);
          P -= 3;
        };
      };
      if (Negative) $impl.RemoveLeadingNegativeSign({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},DS,TS);
      if (!Negative) {
        var $tmp = aSettings.CurrencyFormat;
        if ($tmp === 0) {
          Result = CS + Result}
         else if ($tmp === 1) {
          Result = Result + CS}
         else if ($tmp === 2) {
          Result = CS + " " + Result}
         else if ($tmp === 3) Result = Result + " " + CS;
      } else {
        var $tmp1 = aSettings.NegCurrFormat;
        if ($tmp1 === 0) {
          Result = "(" + CS + Result + ")"}
         else if ($tmp1 === 1) {
          Result = "-" + CS + Result}
         else if ($tmp1 === 2) {
          Result = CS + "-" + Result}
         else if ($tmp1 === 3) {
          Result = CS + Result + "-"}
         else if ($tmp1 === 4) {
          Result = "(" + Result + CS + ")"}
         else if ($tmp1 === 5) {
          Result = "-" + Result + CS}
         else if ($tmp1 === 6) {
          Result = Result + "-" + CS}
         else if ($tmp1 === 7) {
          Result = Result + CS + "-"}
         else if ($tmp1 === 8) {
          Result = "-" + Result + " " + CS}
         else if ($tmp1 === 9) {
          Result = "-" + CS + " " + Result}
         else if ($tmp1 === 10) {
          Result = Result + " " + CS + "-"}
         else if ($tmp1 === 11) {
          Result = CS + " " + Result + "-"}
         else if ($tmp1 === 12) {
          Result = CS + " " + "-" + Result}
         else if ($tmp1 === 13) {
          Result = Result + "-" + " " + CS}
         else if ($tmp1 === 14) {
          Result = "(" + CS + " " + Result + ")"}
         else if ($tmp1 === 15) Result = "(" + Result + " " + CS + ")";
      };
      return Result;
    };
  };
  $mod.$init = function () {
    $mod.ShortMonthNames = $impl.DefaultShortMonthNames.slice(0);
    $mod.LongMonthNames = $impl.DefaultLongMonthNames.slice(0);
    $mod.ShortDayNames = $impl.DefaultShortDayNames.slice(0);
    $mod.LongDayNames = $impl.DefaultLongDayNames.slice(0);
    $mod.FormatSettings.$assign($mod.TFormatSettings.Create());
    $mod.TimeSeparator = $mod.FormatSettings.TimeSeparator;
    $mod.DateSeparator = $mod.FormatSettings.DateSeparator;
    $mod.ShortDateFormat = $mod.FormatSettings.ShortDateFormat;
    $mod.LongDateFormat = $mod.FormatSettings.LongDateFormat;
    $mod.ShortTimeFormat = $mod.FormatSettings.ShortTimeFormat;
    $mod.LongTimeFormat = $mod.FormatSettings.LongTimeFormat;
    $mod.DecimalSeparator = $mod.FormatSettings.DecimalSeparator;
    $mod.ThousandSeparator = $mod.FormatSettings.ThousandSeparator;
    $mod.TimeAMString = $mod.FormatSettings.TimeAMString;
    $mod.TimePMString = $mod.FormatSettings.TimePMString;
    $mod.CurrencyFormat = $mod.FormatSettings.CurrencyFormat;
    $mod.NegCurrFormat = $mod.FormatSettings.NegCurrFormat;
    $mod.CurrencyDecimals = $mod.FormatSettings.CurrencyDecimals;
    $mod.CurrencyString = $mod.FormatSettings.CurrencyString;
  };
},[]);
rtl.module("Classes",["System","RTLConsts","Types","SysUtils","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"EListError",pas.SysUtils.Exception,function () {
  });
  rtl.createClass(this,"EStringListError",this.EListError,function () {
  });
  rtl.createClass(this,"TFPList",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = [];
      this.FCount = 0;
      this.FCapacity = 0;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Get = function (Index) {
      var Result = undefined;
      if ((Index < 0) || (Index >= this.FCount)) this.RaiseIndexError(Index);
      Result = this.FList[Index];
      return Result;
    };
    this.SetCapacity = function (NewCapacity) {
      if (NewCapacity < this.FCount) this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListCapacityError"),"" + NewCapacity);
      if (NewCapacity === this.FCapacity) return;
      this.FList = rtl.arraySetLength(this.FList,undefined,NewCapacity);
      this.FCapacity = NewCapacity;
    };
    this.SetCount = function (NewCount) {
      if (NewCount < 0) this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListCountError"),"" + NewCount);
      if (NewCount > this.FCount) {
        if (NewCount > this.FCapacity) this.SetCapacity(NewCount);
      };
      this.FCount = NewCount;
    };
    this.RaiseIndexError = function (Index) {
      this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListIndexError"),"" + Index);
    };
    this.Destroy = function () {
      this.Clear();
      pas.System.TObject.Destroy.call(this);
    };
    this.Add = function (Item) {
      var Result = 0;
      if (this.FCount === this.FCapacity) this.Expand();
      this.FList[this.FCount] = Item;
      Result = this.FCount;
      this.FCount += 1;
      return Result;
    };
    this.Clear = function () {
      if (rtl.length(this.FList) > 0) {
        this.SetCount(0);
        this.SetCapacity(0);
      };
    };
    this.Delete = function (Index) {
      if ((Index < 0) || (Index >= this.FCount)) this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListIndexError"),"" + Index);
      this.FCount = this.FCount - 1;
      this.FList.splice(Index,1);
      this.FCapacity -= 1;
    };
    this.Error = function (Msg, Data) {
      throw $mod.EListError.$create("CreateFmt",[Msg,[Data]]);
    };
    this.Expand = function () {
      var Result = null;
      var IncSize = 0;
      if (this.FCount < this.FCapacity) return this;
      IncSize = 4;
      if (this.FCapacity > 3) IncSize = IncSize + 4;
      if (this.FCapacity > 8) IncSize = IncSize + 8;
      if (this.FCapacity > 127) IncSize += this.FCapacity >>> 2;
      this.SetCapacity(this.FCapacity + IncSize);
      Result = this;
      return Result;
    };
    this.First = function () {
      var Result = undefined;
      if (this.FCount === 0) {
        Result = null}
       else Result = this.Get(0);
      return Result;
    };
    this.IndexOf = function (Item) {
      var Result = 0;
      var C = 0;
      Result = 0;
      C = this.FCount;
      while ((Result < C) && (this.FList[Result] != Item)) Result += 1;
      if (Result >= C) Result = -1;
      return Result;
    };
    this.Sort = function (Compare) {
      var $Self = this;
      if (!(rtl.length(this.FList) > 0) || (this.FCount < 2)) return;
      $impl.QuickSort(rtl.arrayRef(this.FList),0,this.FCount - 1,function (Item1, Item2) {
        var Result = 0;
        Result = Compare(Item1,Item2);
        return Result;
      });
    };
  });
  this.TListNotification = {"0": "lnAdded", lnAdded: 0, "1": "lnExtracted", lnExtracted: 1, "2": "lnDeleted", lnDeleted: 2};
  rtl.createClass(this,"TListEnumerator",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = null;
      this.FPosition = 0;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (AList) {
      pas.System.TObject.Create.call(this);
      this.FList = AList;
      this.FPosition = -1;
      return this;
    };
    this.GetCurrent = function () {
      var Result = undefined;
      Result = this.FList.Get(this.FPosition);
      return Result;
    };
    this.MoveNext = function () {
      var Result = false;
      this.FPosition += 1;
      Result = this.FPosition < this.FList.GetCount();
      return Result;
    };
  });
  rtl.createClass(this,"TList",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = null;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Get = function (Index) {
      var Result = undefined;
      Result = this.FList.Get(Index);
      return Result;
    };
    this.Notify = function (aValue, Action) {
      if (pas.System.Assigned(aValue)) ;
      if (Action === 1) ;
    };
    this.GetCount = function () {
      var Result = 0;
      Result = this.FList.FCount;
      return Result;
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.FList = $mod.TFPList.$create("Create");
      return this;
    };
    this.Destroy = function () {
      if (this.FList != null) this.Clear();
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FList;
        }, set: function (v) {
          this.p.FList = v;
        }});
    };
    this.Add = function (Item) {
      var Result = 0;
      Result = this.FList.Add(Item);
      if (pas.System.Assigned(Item)) this.Notify(Item,0);
      return Result;
    };
    this.Clear = function () {
      while (this.FList.FCount > 0) this.Delete(this.GetCount() - 1);
    };
    this.Delete = function (Index) {
      var V = undefined;
      V = this.FList.Get(Index);
      this.FList.Delete(Index);
      if (pas.System.Assigned(V)) this.Notify(V,2);
    };
    this.First = function () {
      var Result = undefined;
      Result = this.FList.First();
      return Result;
    };
    this.GetEnumerator = function () {
      var Result = null;
      Result = $mod.TListEnumerator.$create("Create$1",[this]);
      return Result;
    };
    this.IndexOf = function (Item) {
      var Result = 0;
      Result = this.FList.IndexOf(Item);
      return Result;
    };
    this.Remove = function (Item) {
      var Result = 0;
      Result = this.IndexOf(Item);
      if (Result !== -1) this.Delete(Result);
      return Result;
    };
    this.Sort = function (Compare) {
      this.FList.Sort(Compare);
    };
  });
  rtl.createClass(this,"TPersistent",pas.System.TObject,function () {
  });
  rtl.createClass(this,"TStrings",this.TPersistent,function () {
    this.$init = function () {
      $mod.TPersistent.$init.call(this);
      this.FAlwaysQuote = false;
      this.FUpdateCount = 0;
      this.FStrictDelimiter = false;
    };
    this.Error = function (Msg, Data) {
      throw $mod.EStringListError.$create("CreateFmt",[Msg,[pas.SysUtils.IntToStr(Data)]]);
    };
    this.GetCapacity = function () {
      var Result = 0;
      Result = this.GetCount();
      return Result;
    };
    this.GetObject = function (Index) {
      var Result = null;
      if (Index === 0) ;
      Result = null;
      return Result;
    };
    this.PutObject = function (Index, AObject) {
      if (Index === 0) return;
      if (AObject === null) return;
    };
    this.DoCompareText = function (s1, s2) {
      var Result = 0;
      Result = pas.SysUtils.CompareText(s1,s2);
      return Result;
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.FAlwaysQuote = false;
      return this;
    };
    this.Destroy = function () {
      pas.System.TObject.Destroy.call(this);
    };
    this.Add = function (S) {
      var Result = 0;
      Result = this.GetCount();
      this.Insert(this.GetCount(),S);
      return Result;
    };
    this.AddObject = function (S, AObject) {
      var Result = 0;
      Result = this.Add(S);
      this.PutObject(Result,AObject);
      return Result;
    };
    this.IndexOf = function (S) {
      var Result = 0;
      Result = 0;
      while ((Result < this.GetCount()) && (this.DoCompareText(this.Get(Result),S) !== 0)) Result = Result + 1;
      if (Result === this.GetCount()) Result = -1;
      return Result;
    };
  });
  rtl.recNewT(this,"TStringItem",function () {
    this.FString = "";
    this.FObject = null;
    this.$eq = function (b) {
      return (this.FString === b.FString) && (this.FObject === b.FObject);
    };
    this.$assign = function (s) {
      this.FString = s.FString;
      this.FObject = s.FObject;
      return this;
    };
  });
  this.TStringsSortStyle = {"0": "sslNone", sslNone: 0, "1": "sslUser", sslUser: 1, "2": "sslAuto", sslAuto: 2};
  rtl.createClass(this,"TStringList",this.TStrings,function () {
    this.$init = function () {
      $mod.TStrings.$init.call(this);
      this.FList = [];
      this.FCount = 0;
      this.FOnChange = null;
      this.FOnChanging = null;
      this.FDuplicates = 0;
      this.FCaseSensitive = false;
      this.FForceSort = false;
      this.FOwnsObjects = false;
      this.FSortStyle = 0;
    };
    this.$final = function () {
      this.FList = undefined;
      this.FOnChange = undefined;
      this.FOnChanging = undefined;
      $mod.TStrings.$final.call(this);
    };
    this.ExchangeItemsInt = function (Index1, Index2) {
      var S = "";
      var O = null;
      S = this.FList[Index1].FString;
      O = this.FList[Index1].FObject;
      this.FList[Index1].FString = this.FList[Index2].FString;
      this.FList[Index1].FObject = this.FList[Index2].FObject;
      this.FList[Index2].FString = S;
      this.FList[Index2].FObject = O;
    };
    this.GetSorted = function () {
      var Result = false;
      Result = this.FSortStyle in rtl.createSet(1,2);
      return Result;
    };
    this.Grow = function () {
      var NC = 0;
      NC = this.GetCapacity();
      if (NC >= 256) {
        NC = NC + rtl.trunc(NC / 4)}
       else if (NC === 0) {
        NC = 4}
       else NC = NC * 4;
      this.SetCapacity(NC);
    };
    this.InternalClear = function (FromIndex, ClearOnly) {
      var I = 0;
      if (FromIndex < this.FCount) {
        if (this.FOwnsObjects) {
          for (var $l = FromIndex, $end = this.FCount - 1; $l <= $end; $l++) {
            I = $l;
            this.FList[I].FString = "";
            pas.SysUtils.FreeAndNil({p: this.FList[I], get: function () {
                return this.p.FObject;
              }, set: function (v) {
                this.p.FObject = v;
              }});
          };
        } else {
          for (var $l1 = FromIndex, $end1 = this.FCount - 1; $l1 <= $end1; $l1++) {
            I = $l1;
            this.FList[I].FString = "";
          };
        };
        this.FCount = FromIndex;
      };
      if (!ClearOnly) this.SetCapacity(0);
    };
    this.QuickSort = function (L, R, CompareFn) {
      var Pivot = 0;
      var vL = 0;
      var vR = 0;
      if ((R - L) <= 1) {
        if (L < R) if (CompareFn(this,L,R) > 0) this.ExchangeItems(L,R);
        return;
      };
      vL = L;
      vR = R;
      Pivot = L + pas.System.Random(R - L);
      while (vL < vR) {
        while ((vL < Pivot) && (CompareFn(this,vL,Pivot) <= 0)) vL += 1;
        while ((vR > Pivot) && (CompareFn(this,vR,Pivot) > 0)) vR -= 1;
        this.ExchangeItems(vL,vR);
        if (Pivot === vL) {
          Pivot = vR}
         else if (Pivot === vR) Pivot = vL;
      };
      if ((Pivot - 1) >= L) this.QuickSort(L,Pivot - 1,CompareFn);
      if ((Pivot + 1) <= R) this.QuickSort(Pivot + 1,R,CompareFn);
    };
    this.SetSorted = function (Value) {
      if (Value) {
        this.SetSortStyle(2)}
       else this.SetSortStyle(0);
    };
    this.SetCaseSensitive = function (b) {
      if (b === this.FCaseSensitive) return;
      this.FCaseSensitive = b;
      if (this.FSortStyle === 2) {
        this.FForceSort = true;
        try {
          this.Sort();
        } finally {
          this.FForceSort = false;
        };
      };
    };
    this.SetSortStyle = function (AValue) {
      if (this.FSortStyle === AValue) return;
      if (AValue === 2) this.Sort();
      this.FSortStyle = AValue;
    };
    this.CheckIndex = function (AIndex) {
      if ((AIndex < 0) || (AIndex >= this.FCount)) this.Error(rtl.getResStr(pas.RTLConsts,"SListIndexError"),AIndex);
    };
    this.ExchangeItems = function (Index1, Index2) {
      this.ExchangeItemsInt(Index1,Index2);
    };
    this.Changed = function () {
      if (this.FUpdateCount === 0) {
        if (this.FOnChange != null) this.FOnChange(this);
      };
    };
    this.Changing = function () {
      if (this.FUpdateCount === 0) if (this.FOnChanging != null) this.FOnChanging(this);
    };
    this.Get = function (Index) {
      var Result = "";
      this.CheckIndex(Index);
      Result = this.FList[Index].FString;
      return Result;
    };
    this.GetCapacity = function () {
      var Result = 0;
      Result = rtl.length(this.FList);
      return Result;
    };
    this.GetCount = function () {
      var Result = 0;
      Result = this.FCount;
      return Result;
    };
    this.GetObject = function (Index) {
      var Result = null;
      this.CheckIndex(Index);
      Result = this.FList[Index].FObject;
      return Result;
    };
    this.PutObject = function (Index, AObject) {
      this.CheckIndex(Index);
      this.Changing();
      this.FList[Index].FObject = AObject;
      this.Changed();
    };
    this.SetCapacity = function (NewCapacity) {
      if (NewCapacity < 0) this.Error(rtl.getResStr(pas.RTLConsts,"SListCapacityError"),NewCapacity);
      if (NewCapacity !== this.GetCapacity()) this.FList = rtl.arraySetLength(this.FList,$mod.TStringItem,NewCapacity);
    };
    this.InsertItem = function (Index, S) {
      this.InsertItem$1(Index,S,null);
    };
    this.InsertItem$1 = function (Index, S, O) {
      var It = $mod.TStringItem.$new();
      this.Changing();
      if (this.FCount === this.GetCapacity()) this.Grow();
      It.FString = S;
      It.FObject = O;
      this.FList.splice(Index,0,It);
      this.FCount += 1;
      this.Changed();
    };
    this.DoCompareText = function (s1, s2) {
      var Result = 0;
      if (this.FCaseSensitive) {
        Result = pas.SysUtils.CompareStr(s1,s2)}
       else Result = pas.SysUtils.CompareText(s1,s2);
      return Result;
    };
    this.Destroy = function () {
      this.InternalClear(0,false);
      $mod.TStrings.Destroy.call(this);
    };
    this.Add = function (S) {
      var Result = 0;
      if (!(this.FSortStyle === 2)) {
        Result = this.FCount}
       else if (this.Find(S,{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }})) {
        var $tmp = this.FDuplicates;
        if ($tmp === 0) {
          return Result}
         else if ($tmp === 2) this.Error(rtl.getResStr(pas.RTLConsts,"SDuplicateString"),0);
      };
      this.InsertItem(Result,S);
      return Result;
    };
    this.Find = function (S, Index) {
      var Result = false;
      var L = 0;
      var R = 0;
      var I = 0;
      var CompareRes = 0;
      Result = false;
      Index.set(-1);
      if (!this.GetSorted()) throw $mod.EListError.$create("Create$1",[rtl.getResStr(pas.RTLConsts,"SErrFindNeedsSortedList")]);
      L = 0;
      R = this.GetCount() - 1;
      while (L <= R) {
        I = L + rtl.trunc((R - L) / 2);
        CompareRes = this.DoCompareText(S,this.FList[I].FString);
        if (CompareRes > 0) {
          L = I + 1}
         else {
          R = I - 1;
          if (CompareRes === 0) {
            Result = true;
            if (this.FDuplicates !== 1) L = I;
          };
        };
      };
      Index.set(L);
      return Result;
    };
    this.IndexOf = function (S) {
      var Result = 0;
      if (!this.GetSorted()) {
        Result = $mod.TStrings.IndexOf.call(this,S)}
       else if (!this.Find(S,{get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }})) Result = -1;
      return Result;
    };
    this.Insert = function (Index, S) {
      if (this.FSortStyle === 2) {
        this.Error(rtl.getResStr(pas.RTLConsts,"SSortedListError"),0)}
       else {
        if ((Index < 0) || (Index > this.FCount)) this.Error(rtl.getResStr(pas.RTLConsts,"SListIndexError"),Index);
        this.InsertItem(Index,S);
      };
    };
    this.Sort = function () {
      this.CustomSort($impl.StringListAnsiCompare);
    };
    this.CustomSort = function (CompareFn) {
      if ((this.FForceSort || !(this.FSortStyle === 2)) && (this.FCount > 1)) {
        this.Changing();
        this.QuickSort(0,this.FCount - 1,CompareFn);
        this.Changed();
      };
    };
  });
  $mod.$implcode = function () {
    $impl.QuickSort = function (aList, L, R, Compare) {
      var I = 0;
      var J = 0;
      var P = undefined;
      var Q = undefined;
      do {
        I = L;
        J = R;
        P = aList[rtl.trunc((L + R) / 2)];
        do {
          while (Compare(P,aList[I]) > 0) I = I + 1;
          while (Compare(P,aList[J]) < 0) J = J - 1;
          if (I <= J) {
            Q = aList[I];
            aList[I] = aList[J];
            aList[J] = Q;
            I = I + 1;
            J = J - 1;
          };
        } while (!(I > J));
        if ((J - L) < (R - I)) {
          if (L < J) $impl.QuickSort(rtl.arrayRef(aList),L,J,Compare);
          L = I;
        } else {
          if (I < R) $impl.QuickSort(rtl.arrayRef(aList),I,R,Compare);
          R = J;
        };
      } while (!(L >= R));
    };
    $impl.StringListAnsiCompare = function (List, Index1, Index) {
      var Result = 0;
      Result = List.DoCompareText(List.FList[Index1].FString,List.FList[Index].FString);
      return Result;
    };
    $impl.ClassList = null;
  };
  $mod.$init = function () {
    $impl.ClassList = new Object();
  };
},[]);
rtl.module("Math",["System"],function () {
  "use strict";
  var $mod = this;
  this.Ceil = function (A) {
    var Result = 0;
    Result = pas.System.Trunc(Math.ceil(A));
    return Result;
  };
});
rtl.module("Web",["System","Types","JS"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("webaudio",["System","SysUtils","JS","Web","Types"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("contnrs",["System","SysUtils","Classes"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TObjectList",pas.Classes.TList,function () {
    this.$init = function () {
      pas.Classes.TList.$init.call(this);
      this.FFreeObjects = false;
    };
    this.Notify = function (Ptr, Action) {
      var O = null;
      if (this.FFreeObjects) if (Action === 2) {
        O = rtl.getObject(Ptr);
        O = rtl.freeLoc(O);
      };
      pas.Classes.TList.Notify.call(this,Ptr,Action);
    };
    this.Create$3 = function (FreeObjects) {
      pas.Classes.TList.Create$1.call(this);
      this.FFreeObjects = FreeObjects;
      return this;
    };
  });
},["JS"]);
rtl.module("audio",["System","Classes","contnrs","SysUtils","webaudio","JS","Web"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.recNewT(this,"TASDR",function () {
    this.Attack = 0.0;
    this.Decay = 0.0;
    this.Sustain = 0.0;
    this.Release = 0.0;
    this.$eq = function (b) {
      return (this.Attack === b.Attack) && (this.Decay === b.Decay) && (this.Sustain === b.Sustain) && (this.Release === b.Release);
    };
    this.$assign = function (s) {
      this.Attack = s.Attack;
      this.Decay = s.Decay;
      this.Sustain = s.Sustain;
      this.Release = s.Release;
      return this;
    };
  });
  rtl.createClass(this,"TInstrument",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.SampleRate = 0.0;
      this.DefaultADSR = $mod.TASDR.$new();
    };
    this.$final = function () {
      this.DefaultADSR = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.GetDefaultADSR = function () {
      var Result = $mod.TASDR.$new();
      Result.Attack = 0.01;
      Result.Decay = 0.005;
      Result.Sustain = 0.8;
      Result.Release = 0.666;
      return Result;
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.DefaultADSR.$assign(this.GetDefaultADSR());
      return this;
    };
  });
  rtl.createClass(this,"TNote",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.Key = 0.0;
      this.StartTime = 0.0;
      this.StopTime = 0.0;
      this.Instrument = null;
      this.ADSR = $mod.TASDR.$new();
      this.LastPhase = 0.0;
      this.Done = false;
    };
    this.$final = function () {
      this.Instrument = undefined;
      this.ADSR = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.GetFinalTime = function () {
      var Result = 0.0;
      Result = this.StopTime + this.ADSR.Release;
      return Result;
    };
    this.CalcEnvelope = function (ATime) {
      var Result = 0.0;
      var delta = 0.0;
      if (this.Done) return 0;
      delta = ATime - this.StartTime;
      if (delta < 0) return 0;
      if (ATime >= this.GetFinalTime()) {
        this.Done = true;
        return 0;
      };
      if (delta < this.ADSR.Attack) return $impl.Lerp(delta,0,this.ADSR.Attack,0,1);
      delta = delta - this.ADSR.Attack;
      if (delta < this.ADSR.Decay) return $impl.Lerp(delta,0,this.ADSR.Decay,1,this.ADSR.Sustain);
      if (ATime < this.StopTime) return this.ADSR.Sustain;
      return $impl.Lerp(ATime,this.StopTime,this.GetFinalTime(),this.ADSR.Sustain,0);
      return Result;
    };
    this.Create$1 = function (AKey, AStartTime, AStopTime, AInstrument) {
      pas.System.TObject.Create.call(this);
      this.Key = AKey;
      this.StartTime = AStartTime;
      this.StopTime = AStopTime;
      this.Instrument = AInstrument;
      this.ADSR.$assign(AInstrument.DefaultADSR);
      return this;
    };
  });
  rtl.createClass(this,"TMusicPlayer",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fInstruments = null;
      this.fNotes = null;
      this.fFreeBuffers = null;
      this.fPlaybackBuffers = null;
      this.fSampleIndex = 0;
      this.context = null;
      this.spn = null;
      this.evtHandler = undefined;
    };
    this.$final = function () {
      this.fInstruments = undefined;
      this.fNotes = undefined;
      this.fFreeBuffers = undefined;
      this.fPlaybackBuffers = undefined;
      this.context = undefined;
      this.spn = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Refill = function () {
      var startTime = 0.0;
      var stopTime = 0.0;
      var buf = null;
      var noteObj = undefined;
      var note = null;
      var remove = null;
      buf = rtl.getObject(this.fFreeBuffers.First());
      this.fFreeBuffers.Delete(0);
      startTime = this.fSampleIndex / this.context.sampleRate;
      stopTime = (this.fSampleIndex + buf.length) / this.context.sampleRate;
      remove = pas.Classes.TList.$create("Create$1");
      var $in = this.fNotes.GetEnumerator();
      try {
        while ($in.MoveNext()) {
          noteObj = $in.GetCurrent();
          note = rtl.getObject(noteObj);
          if (note.Done) {
            remove.Add(note)}
           else note.Instrument.Render(note,startTime,stopTime,buf,0,buf.length);
        }
      } finally {
        $in = rtl.freeLoc($in)
      };
      var $in1 = remove.GetEnumerator();
      try {
        while ($in1.MoveNext()) {
          noteObj = $in1.GetCurrent();
          this.fNotes.Remove(noteObj);
          rtl.getObject(noteObj).$destroy("Destroy");
        }
      } finally {
        $in1 = rtl.freeLoc($in1)
      };
      remove = rtl.freeLoc(remove);
      this.fPlaybackBuffers.Add(buf);
      this.fSampleIndex += buf.length;
    };
    this.GetTime = function () {
      var Result = 0.0;
      Result = this.fSampleIndex / this.context.sampleRate;
      return Result;
    };
    this.processAudio = function (Event) {
      var Result = false;
      var ob = null;
      var buf = null;
      var i = 0;
      ob=Event.outputBuffer;
      if (this.fPlaybackBuffers.GetCount() > 0) {
        buf = rtl.getObject(this.fPlaybackBuffers.First());
        this.fPlaybackBuffers.Delete(0);
        for (var $l = 0, $end = buf.length - 1; $l <= $end; $l++) {
          i = $l;
          buf[i] = $impl.clamp(buf[i]);
        };
        ob.copyToChannel(buf,0);
        buf.fill(0.0);
        this.fFreeBuffers.Add(buf);
      };
      Result = true;
      return Result;
    };
    this.UserInteraction = function (Event) {
      var i = 0;
      var bufSize = 0;
      document.body.removeEventListener("click",this.evtHandler);
      document.body.removeEventListener("scroll",this.evtHandler);
      document.body.removeEventListener("keydown",this.evtHandler);
      bufSize = 1024;
      for (i = 0; i <= 1; i++) this.fFreeBuffers.Add(new Float32Array(bufSize));
      this.context.resume();
      this.spn = this.context.createScriptProcessor(bufSize,0,1);
      this.spn.onaudioprocess = rtl.createSafeCallback(this,"processAudio");
      this.spn.connect(this.context.destination);
    };
    this.AddInstrument = function (AInstr) {
      var Result = null;
      AInstr.SampleRate = this.context.sampleRate;
      this.fInstruments.Add(AInstr);
      Result = AInstr;
      return Result;
    };
    this.AddNote = function (ANote) {
      var Result = null;
      this.fNotes.Add(ANote);
      Result = ANote;
      return Result;
    };
    this.Update = function () {
      while (this.fFreeBuffers.GetCount() > 0) this.Refill();
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.context = new AudioContext();
      this.evtHandler = rtl.createCallback(this,"UserInteraction");
      document.body.addEventListener("click",this.evtHandler);
      document.body.addEventListener("scroll",this.evtHandler);
      document.body.addEventListener("keydown",this.evtHandler);
      this.fInstruments = pas.contnrs.TObjectList.$create("Create$3",[true]);
      this.fNotes = pas.Classes.TList.$create("Create$1");
      this.fFreeBuffers = pas.Classes.TList.$create("Create$1");
      this.fPlaybackBuffers = pas.Classes.TList.$create("Create$1");
      return this;
    };
    this.Destroy = function () {
      rtl.free(this,"fFreeBuffers");
      rtl.free(this,"fPlaybackBuffers");
      rtl.free(this,"fNotes");
      rtl.free(this,"fInstruments");
      pas.System.TObject.Destroy.call(this);
    };
  });
  this.MusicPlayer = null;
  $mod.$implcode = function () {
    $impl.Lerp = function (T, a, b, y0, y1) {
      var Result = 0.0;
      var factor = 0.0;
      factor = (T - a) / (b - a);
      Result = ((y1 - y0) * factor) + y0;
      return Result;
    };
    $impl.clamp = function (x) {
      var Result = 0.0;
      if (x > 1) {
        Result = 1}
       else if (x < -1) {
        Result = -1}
       else Result = x;
      return Result;
    };
  };
  $mod.$init = function () {
    $mod.MusicPlayer = $mod.TMusicPlayer.$create("Create$1");
  };
},[]);
rtl.module("audiostuff",["System","Classes","SysUtils","JS","Web","audio"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TSample",pas.audio.TInstrument,function () {
    this.$init = function () {
      pas.audio.TInstrument.$init.call(this);
      this.fNaturalFreq = 0.0;
      this.fSampleRate = 0.0;
      this.fLoop = false;
      this.fSamples = null;
    };
    this.$final = function () {
      this.fSamples = undefined;
      pas.audio.TInstrument.$final.call(this);
    };
    this.GetDefaultADSR = function () {
      var Result = pas.audio.TASDR.$new();
      Result.Attack = 0;
      Result.Decay = 0;
      Result.Sustain = 1;
      Result.Release = 0;
      return Result;
    };
    this.Render = function (ANote, AStartTime, AStopTime, ABuffer, AOffset, ACount) {
      var time = 0.0;
      var sampleStep = 0.0;
      var ph = 0.0;
      var delta = 0.0;
      var env = 0.0;
      var i = 0;
      var Index = 0;
      var wrappedIndex = 0;
      ph = ANote.LastPhase;
      sampleStep = (ANote.Key / this.fNaturalFreq) * (this.SampleRate / this.fSampleRate);
      delta = (AStopTime - AStartTime) / ACount;
      for (var $l = 0, $end = ACount - 1; $l <= $end; $l++) {
        i = $l;
        time = AStartTime + (delta * i);
        env = ANote.CalcEnvelope(time);
        if (env <= 0) continue;
        ph = ph + sampleStep;
        Index = Math.round(ph);
        if (Index >= this.fSamples.length) {
          if (!this.fLoop) {
            ANote.Done = true;
            break;
          };
          wrappedIndex = Index % this.fSamples.length;
          ph = ph - (Index - wrappedIndex);
          Index = wrappedIndex;
        };
        ABuffer[AOffset + i] = ABuffer[AOffset + i] + (env * this.fSamples[Index]);
      };
      ANote.LastPhase = ph;
    };
    this.Create$2 = function (ANaturalFreq, ASampleRate, ASample, ALooping) {
      pas.audio.TInstrument.Create$1.call(this);
      this.fNaturalFreq = ANaturalFreq;
      this.fSampleRate = ASampleRate;
      this.fLoop = ALooping;
      this.fSamples = ASample;
      return this;
    };
  });
},["Math"]);
rtl.module("GameMath",["System","Classes","SysUtils","Math"],function () {
  "use strict";
  var $mod = this;
  rtl.recNewT(this,"TPVector",function () {
    this.X = 0.0;
    this.Y = 0.0;
    this.$eq = function (b) {
      return (this.X === b.X) && (this.Y === b.Y);
    };
    this.$assign = function (s) {
      this.X = s.X;
      this.Y = s.Y;
      return this;
    };
    this.New = function (AX, AY) {
      var Result = $mod.TPVector.$new();
      Result.X = AX;
      Result.Y = AY;
      return Result;
    };
  });
});
rtl.module("guibase",["System","Web","GameBase","Classes","SysUtils"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TGUIElement",pas.GameBase.TGameElement,function () {
    this.$init = function () {
      pas.GameBase.TGameElement.$init.call(this);
      this.fHeight = 0;
      this.fHitTestVisible = false;
      this.fParent = null;
      this.fVisible = false;
      this.fWidth = 0;
      this.fChildren = null;
    };
    this.$final = function () {
      this.fParent = undefined;
      this.fChildren = undefined;
      pas.GameBase.TGameElement.$final.call(this);
    };
    this.Render = function (AContext) {
      var i = 0;
      AContext.save();
      AContext.translate(this.fPosition.X,this.fPosition.Y);
      for (var $l = 0, $end = this.fChildren.GetCount() - 1; $l <= $end; $l++) {
        i = $l;
        rtl.getObject(this.fChildren.Get(i)).Render(AContext);
      };
      AContext.restore();
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.fChildren = pas.Classes.TList.$create("Create$1");
      this.fVisible = true;
      this.fHitTestVisible = true;
      return this;
    };
    this.Destroy = function () {
      var i = 0;
      for (var $l = 0, $end = this.fChildren.GetCount() - 1; $l <= $end; $l++) {
        i = $l;
        rtl.getObject(this.fChildren.Get(i)).$destroy("Destroy");
      };
      rtl.free(this,"fChildren");
      pas.System.TObject.Destroy.call(this);
    };
    this.AddChild = function (AChild) {
      AChild.fParent = this;
      this.fChildren.Add(AChild);
    };
  });
});
rtl.module("guictrls",["System","guibase","Web"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TGUIPanel",pas.guibase.TGUIElement,function () {
    this.$init = function () {
      pas.guibase.TGUIElement.$init.call(this);
      this.fBackGround = "";
    };
    this.Render = function (AContext) {
      if (this.fBackGround !== "") {
        AContext.save();
        AContext.fillStyle = this.fBackGround;
        AContext.fillRect(this.fPosition.X,this.fPosition.Y,this.fWidth,this.fHeight);
        AContext.restore();
      };
      pas.guibase.TGUIElement.Render.call(this,AContext);
    };
    this.Create$2 = function () {
      pas.guibase.TGUIElement.Create$1.call(this);
      this.fBackGround = "rgb(0,0,0,0.0)";
      return this;
    };
  });
  this.TGUILabelVAlign = {"0": "vaTop", vaTop: 0, "1": "vaMiddle", vaMiddle: 1, "2": "vaBottom", vaBottom: 2};
  this.TGUILabelHAlign = {"0": "haLeft", haLeft: 0, "1": "haMiddle", haMiddle: 1, "2": "haRight", haRight: 2};
  rtl.createClass(this,"TGUILabel",pas.guibase.TGUIElement,function () {
    this.$init = function () {
      pas.guibase.TGUIElement.$init.call(this);
      this.fCaption = "";
      this.fFormat = "";
      this.fFont = "";
      this.fHAlign = 0;
      this.fSize = 0;
      this.fVAlign = 0;
    };
    this.SetSize = function (AValue) {
      if (this.fSize === AValue) return;
      this.fSize = AValue;
      this.fFormat = pas.SysUtils.Format("%dpx %s",[this.fSize,this.fFont]);
    };
    this.Render = function (AContext) {
      var measurement = null;
      var ly = 0.0;
      var lx = 0.0;
      AContext.save();
      var $tmp = this.fVAlign;
      if ($tmp === 0) {
        ly = this.fPosition.Y;
        AContext.textBaseline = "top";
      } else if ($tmp === 1) {
        ly = this.fPosition.Y + (this.fHeight / 2);
        AContext.textBaseline = "middle";
      } else if ($tmp === 2) {
        ly = this.fPosition.Y + this.fHeight;
        AContext.textBaseline = "bottom";
      };
      AContext.font = this.fFormat;
      measurement = AContext.measureText(this.fCaption);
      var $tmp1 = this.fHAlign;
      if ($tmp1 === 0) {
        lx = this.fPosition.X}
       else if ($tmp1 === 1) {
        lx = this.fPosition.X + ((this.fWidth - measurement.width) / 2)}
       else if ($tmp1 === 2) lx = (this.fPosition.X + this.fWidth) - measurement.width;
      AContext.fillText(this.fCaption,lx,ly);
      AContext.restore();
      pas.guibase.TGUIElement.Render.call(this,AContext);
    };
    this.Create$2 = function () {
      pas.guibase.TGUIElement.Create$1.call(this);
      this.fFont = "sans";
      this.fSize = 12;
      this.fVAlign = 1;
      this.fHAlign = 1;
      return this;
    };
  });
  rtl.createClass(this,"TGUIProgressBar",pas.guibase.TGUIElement,function () {
    this.$init = function () {
      pas.guibase.TGUIElement.$init.call(this);
      this.fBackground = "";
      this.fBorder = "";
      this.fBorderWidth = 0.0;
      this.fForeground = "";
      this.fMax = 0.0;
      this.fMin = 0.0;
      this.fValue = 0.0;
    };
    this.Render = function (AContext) {
      var bw2 = 0.0;
      var w = 0.0;
      AContext.save();
      if (this.fBackground !== "") {
        AContext.fillStyle = this.fBackground;
        AContext.fillRect(this.fPosition.X,this.fPosition.Y,this.fWidth,this.fHeight);
      };
      if (this.fMax > this.fMin) {
        w = (this.fValue - this.fMin) / (this.fMax - this.fMin);
        if (w > 1) w = 1;
        if (w > 0) {
          AContext.fillStyle = this.fForeground;
          AContext.fillRect(this.fPosition.X,this.fPosition.Y,w * this.fWidth,this.fHeight);
        };
      };
      if ((this.fBorderWidth > 0) && (this.fBorder !== "")) {
        AContext.strokeStyle = this.fBorder;
        AContext.lineWidth = this.fBorderWidth;
        bw2 = this.fBorderWidth / 2;
        AContext.strokeRect(this.fPosition.X + bw2,this.fPosition.Y + bw2,this.fWidth - this.fBorderWidth,this.fHeight - this.fBorderWidth);
      };
      AContext.restore();
      pas.guibase.TGUIElement.Render.call(this,AContext);
    };
  });
},["SysUtils"]);
rtl.module("Resources",["System","Classes","SysUtils","JS","Web"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.TResourceType = {"0": "rtText", rtText: 0, "1": "rtArrayBuffer", rtArrayBuffer: 1, "2": "rtBlob", rtBlob: 2};
  rtl.createClass(this,"TResources",pas.System.TObject,function () {
    this.AddResource = function (APath, AType) {
      var $Self = this;
      var res = null;
      res = $impl.TResource.$create("Create");
      res.ResType = AType;
      $impl.fResources.AddObject(APath,res);
      $impl.fTotal += 1;
      $impl.DoFetch(APath).then(function (x) {
        var Result = undefined;
        pas.System.Writeln("Got ",APath);
        var $tmp = AType;
        if ($tmp === 0) {
          rtl.getObject(x).text().then(function (y) {
            var Result = undefined;
            res.Text = "" + y;
            $impl.fTotalLoaded += 1;
            return Result;
          })}
         else if ($tmp === 2) {
          rtl.getObject(x).blob().then(function (y) {
            var Result = undefined;
            res.Data = rtl.getObject(y);
            $impl.fTotalLoaded += 1;
            return Result;
          })}
         else if ($tmp === 1) rtl.getObject(x).arrayBuffer().then(function (y) {
          var Result = undefined;
          res.ArrayBuf = rtl.getObject(y);
          $impl.fTotalLoaded += 1;
          return Result;
        });
        return Result;
      });
    };
    this.GetArrayBuffer = function (APath) {
      var Result = null;
      var idx = 0;
      idx = $impl.fResources.IndexOf(APath);
      Result = $impl.fResources.GetObject(idx).ArrayBuf;
      return Result;
    };
    this.Completed = function () {
      var Result = false;
      Result = $impl.fTotal === $impl.fTotalLoaded;
      return Result;
    };
    this.Total = function () {
      var Result = 0;
      Result = $impl.fTotal;
      return Result;
    };
    this.TotalLoaded = function () {
      var Result = 0;
      Result = $impl.fTotalLoaded;
      return Result;
    };
  });
  $mod.$implcode = function () {
    rtl.createClass($impl,"TResource",pas.System.TObject,function () {
      this.$init = function () {
        pas.System.TObject.$init.call(this);
        this.ResType = 0;
        this.Text = "";
        this.ArrayBuf = null;
        this.Data = null;
      };
      this.$final = function () {
        this.ArrayBuf = undefined;
        this.Data = undefined;
        pas.System.TObject.$final.call(this);
      };
    });
    $impl.fTotal = 0;
    $impl.fTotalLoaded = 0;
    $impl.fResources = null;
    $impl.DoFetch = async function (APath) {
      var Result = null;
      Result = await window.fetch(APath);
      if (!Result.ok) window.console.error("HTTP error! status: " + ("" + Result.status));
      return Result;
    };
  };
  $mod.$init = function () {
    $impl.fResources = pas.Classes.TStringList.$create("Create$1");
    $impl.fResources.SetCaseSensitive(false);
    $impl.fResources.SetSorted(false);
    $impl.fResources.FStrictDelimiter = true;
  };
},[]);
rtl.module("GameBase",["System","Web","audio","GameMath","SysUtils","Classes","contnrs"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"TGameElement",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fPosition = pas.GameMath.TPVector.$new();
      this.fTime = 0.0;
    };
    this.$final = function () {
      this.fPosition = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Update = function (AGame, ATimeMS) {
      this.fTime = ATimeMS;
    };
    this.Render = function (AContext) {
    };
  });
  rtl.createClass(this,"TGameTransform",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fScale = 0.0;
      this.fX = 0.0;
      this.fY = 0.0;
    };
    this.GetMatrix = function () {
      var Result = rtl.arraySetLength(null,0.0,6);
      Result[0] = this.fScale;
      Result[1] = 0;
      Result[2] = 0;
      Result[3] = this.fScale;
      Result[4] = this.fX;
      Result[5] = this.fY;
      return Result;
    };
  });
  rtl.createClass(this,"TGamePlane",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fTransform = null;
      this.Elements = null;
      this.ZIndex = 0;
      this.Visible = false;
    };
    this.$final = function () {
      this.fTransform = undefined;
      this.Elements = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.fTransform = null;
      this.Elements = pas.Classes.TList.$create("Create$1");
      return this;
    };
  });
  this.TGameBaseState = {"0": "bsStart", bsStart: 0, "1": "bsWaitResources", bsWaitResources: 1, "2": "bsWaitClick", bsWaitClick: 2, "3": "bsDone", bsDone: 3};
  this.TGameMouseState = {"0": "msUp", msUp: 0, "1": "msDragging", msDragging: 1, "2": "msDown", msDown: 2};
  rtl.createClass(this,"TGameBase",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fHeight = 0;
      this.fWidth = 0;
      this.fMouseStartY = 0.0;
      this.fMouseStartX = 0.0;
      this.fToFree = null;
      this.fPlanes = null;
      this.fState = 0;
      this.fMouseState = 0;
      this.fUserInteracted = false;
      this.fEvtHandler = undefined;
      this.Canvas = null;
      this.Ctx = null;
    };
    this.$final = function () {
      this.fToFree = undefined;
      this.fPlanes = undefined;
      this.Canvas = undefined;
      this.Ctx = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.OnCanvasKeyPress = function (aEvent) {
      var Result = false;
      if (this.fState === 3) this.DoKeyPress(aEvent.key);
      aEvent.stopPropagation();
      aEvent.preventDefault();
      Result = false;
      return Result;
    };
    this.OnCanvasKeyUp = function (aEvent) {
      var Result = false;
      aEvent.stopPropagation();
      aEvent.preventDefault();
      Result = false;
      return Result;
    };
    this.OnCanvasLeave = function (aEvent) {
      var Result = false;
      if (this.fMouseState === 1) {
        this.fMouseState = 0;
        this.DoStopDrag();
      };
      Result = true;
      return Result;
    };
    this.OnCanvasMouseDown = function (aEvent) {
      var Result = false;
      Result = true;
      if (this.fState === 3) {
        if (aEvent.button === 0) {
          this.fMouseStartX = aEvent.clientX;
          this.fMouseStartY = aEvent.clientY;
          this.fMouseState = 2;
        };
      };
      return Result;
    };
    this.OnCanvasMouseUp = function (aEvent) {
      var Result = false;
      if (this.fMouseState !== 0) {
        if (this.fMouseState === 1) {
          this.DoStopDrag()}
         else this.DoClick(aEvent.clientX,aEvent.clientY,aEvent.buttons);
        this.fMouseState = 0;
      };
      Result = true;
      return Result;
    };
    this.OnCanvasMove = function (aEvent) {
      var Result = false;
      if (this.fState === 3) {
        if ((this.fMouseState === 2) && (pas.System.Sqr(10) <= (pas.System.Sqr$1(aEvent.clientX - this.fMouseStartX) + pas.System.Sqr$1(aEvent.clientY - this.fMouseStartY)))) {
          this.fMouseState = 1;
          this.DoStartDrag(this.fMouseStartX,this.fMouseStartY);
        } else this.DoMove(aEvent.clientX,aEvent.clientY);
      };
      Result = true;
      return Result;
    };
    this.OnCanvasWheel = function (aEvent) {
      var Result = false;
      if (this.fState === 3) this.DoWheel(aEvent.deltaY);
      Result = true;
      return Result;
    };
    this.OnResize = function (Event) {
      var Result = false;
      this.fWidth = window.innerWidth;
      this.fHeight = window.innerHeight;
      this.Canvas.width = this.fWidth;
      this.Canvas.height = this.fHeight;
      pas.System.Writeln("Resize: ",this.fWidth,"x",this.fHeight);
      this.AfterResize();
      return Result;
    };
    this.OnRequestFrame = function (aTime) {
      var fWaitClickLbl = null;
      this.Ctx.clearRect(0,0,this.fWidth,this.fHeight);
      var $tmp = this.fState;
      if ($tmp === 1) {
        this.Ctx.textBaseline = "middle";
        this.Ctx.fillText(pas.SysUtils.Format("Loading resources: %d out of %d done",[pas.Resources.TResources.TotalLoaded(),pas.Resources.TResources.Total()]),0,0);
        if (pas.Resources.TResources.Completed()) {
          this.AfterLoad();
          this.fState = 2;
        };
      } else if ($tmp === 2) {
        if (this.fUserInteracted) {
          this.fState = 3;
        } else {
          fWaitClickLbl = $impl.THackerLabel.$create("Create$2");
          fWaitClickLbl.fPosition.$assign(pas.GameMath.TPVector.New(0,0));
          fWaitClickLbl.SetSize(50);
          fWaitClickLbl.fWidth = this.Canvas.width;
          fWaitClickLbl.fHeight = this.Canvas.height;
          fWaitClickLbl.fVAlign = 1;
          fWaitClickLbl.fHAlign = 1;
          fWaitClickLbl.fCaption = "Click to start game";
          fWaitClickLbl.DoRender(this.Ctx);
          fWaitClickLbl = rtl.freeLoc(fWaitClickLbl);
        };
      } else if ($tmp === 3) {
        this.Update(aTime);
        this.Render();
      };
      window.requestAnimationFrame(rtl.createCallback(this,"OnRequestFrame"));
    };
    this.UserInteraction = function () {
      document.body.removeEventListener("click",this.fEvtHandler);
      document.body.removeEventListener("scroll",this.fEvtHandler);
      document.body.removeEventListener("keydown",this.fEvtHandler);
      this.fUserInteracted = true;
    };
    this.InitializeResources = function () {
    };
    this.AfterLoad = function () {
    };
    this.AfterResize = function () {
    };
    this.DoMove = function (AX, AY) {
    };
    this.DoWheel = function (AX) {
    };
    this.DoStopDrag = function () {
    };
    this.DoStartDrag = function (AX, AY) {
    };
    this.DoClick = function (AX, AY, AButtons) {
    };
    this.DoKeyPress = function (AKeyCode) {
    };
    this.Update = function (ATimeMS) {
      var plane = null;
      var i = 0;
      var el = undefined;
      this.fPlanes.Sort($impl.SortPlanes);
      pas.audio.MusicPlayer.Update();
      for (var $l = 0, $end = this.fPlanes.GetCount() - 1; $l <= $end; $l++) {
        i = $l;
        plane = rtl.getObject(this.fPlanes.Get(i));
        var $in = plane.Elements.GetEnumerator();
        try {
          while ($in.MoveNext()) {
            el = $in.GetCurrent();
            rtl.getObject(el).Update(this,ATimeMS);
          }
        } finally {
          $in = rtl.freeLoc($in)
        };
      };
      for (var $l1 = 0, $end1 = this.fToFree.GetCount() - 1; $l1 <= $end1; $l1++) {
        i = $l1;
        rtl.getObject(this.fToFree.Get(i)).$destroy("Destroy");
      };
      this.fToFree.Clear();
    };
    this.Render = function () {
      var plane = null;
      var i = 0;
      var el = undefined;
      var mtx = rtl.arraySetLength(null,0.0,6);
      var doRestore = false;
      for (var $l = 0, $end = this.fPlanes.GetCount() - 1; $l <= $end; $l++) {
        i = $l;
        plane = rtl.getObject(this.fPlanes.Get(i));
        if (!plane.Visible) continue;
        if (plane.fTransform !== null) {
          this.Ctx.save();
          mtx = plane.fTransform.GetMatrix();
          this.Ctx.setTransform(mtx[0],mtx[1],mtx[2],mtx[3],mtx[4],mtx[5]);
          doRestore = true;
        } else doRestore = false;
        var $in = plane.Elements.GetEnumerator();
        try {
          while ($in.MoveNext()) {
            el = $in.GetCurrent();
            rtl.getObject(el).Render(this.Ctx);
          }
        } finally {
          $in = rtl.freeLoc($in)
        };
        if (doRestore) this.Ctx.restore();
      };
    };
    this.AddPlane = function (AZIndex, AVisible) {
      var Result = null;
      Result = $mod.TGamePlane.$create("Create$1");
      Result.Visible = AVisible;
      Result.ZIndex = AZIndex;
      this.fPlanes.Add(Result);
      return Result;
    };
    this.AddElement = function (AElement, ALayer) {
      ALayer.Elements.Add(AElement);
    };
    this.Create$1 = function () {
      var $Self = this;
      pas.System.TObject.Create.call(this);
      this.fToFree = pas.Classes.TList.$create("Create$1");
      this.fState = 0;
      this.fPlanes = pas.contnrs.TObjectList.$create("Create$3",[true]);
      this.Canvas = rtl.asExt(document.getElementById("c"),HTMLCanvasElement);
      this.Ctx = rtl.asExt(this.Canvas.getContext("2d"),CanvasRenderingContext2D);
      this.fEvtHandler = rtl.createCallback($Self,"UserInteraction");
      document.body.addEventListener("click",this.fEvtHandler);
      document.body.addEventListener("scroll",this.fEvtHandler);
      document.body.addEventListener("keydown",this.fEvtHandler);
      this.Canvas.onmousedown = rtl.createSafeCallback($Self,"OnCanvasMouseDown");
      this.Canvas.onmouseup = rtl.createSafeCallback($Self,"OnCanvasMouseUp");
      this.Canvas.onmousemove = rtl.createSafeCallback($Self,"OnCanvasMove");
      this.Canvas.onwheel = rtl.createSafeCallback($Self,"OnCanvasWheel");
      this.Canvas.onmouseleave = rtl.createSafeCallback($Self,"OnCanvasLeave");
      window.onkeydown = rtl.createSafeCallback($Self,"OnCanvasKeyPress");
      window.onkeyup = rtl.createSafeCallback($Self,"OnCanvasKeyUp");
      window.onresize = function (aEvent) {
        var Result = false;
        $Self.OnResize(null);
        return Result;
      };
      this.OnResize(null);
      this.InitializeResources();
      this.fState = 1;
      return this;
    };
    this.Run = function () {
      window.requestAnimationFrame(rtl.createCallback(this,"OnRequestFrame"));
    };
  });
  $mod.$implcode = function () {
    $impl.DragStart = 10;
    rtl.createClass($impl,"THackerLabel",pas.guictrls.TGUILabel,function () {
      this.DoRender = function (AContext) {
        this.Render(AContext);
      };
    });
    $impl.SortPlanes = function (Item1, Item2) {
      var Result = 0;
      Result = rtl.getObject(Item1).ZIndex - rtl.getObject(Item2).ZIndex;
      return Result;
    };
  };
},["guictrls","Resources"]);
rtl.module("program",["System","JS","Classes","SysUtils","Math","Web","webaudio","audio","audiostuff","GameMath","GameBase","Resources","guibase","guictrls"],function () {
  "use strict";
  var $mod = this;
  this.TRoundStatus = {"0": "rsLoading", rsLoading: 0, "1": "rsLoaded", rsLoaded: 1, "2": "rsStarting", rsStarting: 2, "3": "rsGoing", rsGoing: 3, "4": "rsEnded", rsEnded: 4};
  rtl.recNewT(this,"TRound",function () {
    this.State = 0;
    this.Word = "";
    this.Buffer = "";
    this.InputSequence = "";
    this.StartTime = 0.0;
    this.StopTime = 0.0;
    this.Mistypes = 0;
    this.Correct = 0;
    this.$eq = function (b) {
      return (this.State === b.State) && (this.Word === b.Word) && (this.Buffer === b.Buffer) && (this.InputSequence === b.InputSequence) && (this.StartTime === b.StartTime) && (this.StopTime === b.StopTime) && (this.Mistypes === b.Mistypes) && (this.Correct === b.Correct);
    };
    this.$assign = function (s) {
      this.State = s.State;
      this.Word = s.Word;
      this.Buffer = s.Buffer;
      this.InputSequence = s.InputSequence;
      this.StartTime = s.StartTime;
      this.StopTime = s.StopTime;
      this.Mistypes = s.Mistypes;
      this.Correct = s.Correct;
      return this;
    };
  });
  rtl.createClass(this,"TLD50",pas.GameBase.TGameBase,function () {
    this.$init = function () {
      pas.GameBase.TGameBase.$init.call(this);
      this.gameLayer = null;
      this.prepLayer = null;
      this.postLayer = null;
      this.statusLbl = null;
      this.instructionLbl = rtl.arraySetLength(null,null,3);
      this.prepPnl = null;
      this.prepLbl2 = null;
      this.prepLbl = null;
      this.charLbl = null;
      this.targetLbl = null;
      this.winsLbl = null;
      this.infoPnl = null;
      this.roundProgress = null;
      this.rnd = $mod.TRound.$new();
      this.lastTime = 0.0;
      this.bass = null;
    };
    this.$final = function () {
      this.gameLayer = undefined;
      this.prepLayer = undefined;
      this.postLayer = undefined;
      this.statusLbl = undefined;
      this.instructionLbl = undefined;
      this.prepPnl = undefined;
      this.prepLbl2 = undefined;
      this.prepLbl = undefined;
      this.charLbl = undefined;
      this.targetLbl = undefined;
      this.winsLbl = undefined;
      this.infoPnl = undefined;
      this.roundProgress = undefined;
      this.rnd = undefined;
      this.bass = undefined;
      pas.GameBase.TGameBase.$final.call(this);
    };
    this.StartRound = function (ATarget, ACurrentTime, APreRunTime, ARoundLength) {
      this.rnd.Word = ATarget;
      this.rnd.Buffer = ">";
      this.rnd.InputSequence = "";
      this.rnd.Mistypes = 0;
      this.rnd.Correct = 0;
      this.rnd.StartTime = ACurrentTime + (APreRunTime * 1e3);
      this.rnd.StopTime = ACurrentTime + ((APreRunTime + ARoundLength) * 1e3);
      this.rnd.State = 2;
      this.charLbl.fCaption = this.rnd.Buffer;
      this.targetLbl.fCaption = pas.SysUtils.Format(">%s<",[ATarget]);
      this.roundProgress.fMin = ACurrentTime + (APreRunTime * 1e3);
      this.roundProgress.fMax = ACurrentTime + ((APreRunTime + ARoundLength) * 1e3);
      this.roundProgress.fValue = 0;
      this.prepLayer.Visible = true;
      this.gameLayer.Visible = false;
      this.postLayer.Visible = false;
      this.prepLbl2.fCaption = pas.SysUtils.Format("%4.3f",[(APreRunTime * 1e3) / 1000]);
    };
    this.EndRound = function () {
      this.statusLbl.fCaption = pas.SysUtils.Format("Correct: %d",[this.rnd.Correct]);
    };
    this.AddMatch = function () {
      this.rnd.Correct += 1;
      this.winsLbl.fCaption = pas.SysUtils.Format("Correct: %d",[this.rnd.Correct]);
      pas.audio.MusicPlayer.AddNote(pas.audio.TNote.$create("Create$1",[440 + (20 * this.rnd.Correct),pas.audio.MusicPlayer.GetTime() + 0.05,pas.audio.MusicPlayer.GetTime() + 0.30,this.bass]));
    };
    this.AddMiss = function (AKeyCode) {
      this.rnd.Mistypes += 1;
    };
    this.SubmitScore = function () {
      document.getElementsByName("run_score").item(0).value = pas.SysUtils.IntToStr(this.rnd.Correct);
      document.getElementsByName("run_sequence").item(0).value = this.rnd.InputSequence;
      document.getElementById("submit_form").submit();
    };
    this.InitializeResources = function () {
      pas.Resources.TResources.AddResource("\/ld50\/samples\/bass.raw",1);
    };
    var instructionCaptions = ["Retry: F5","Submit score: Enter","Exit to menu: Escape"];
    this.AfterLoad = function () {
      var i = 0;
      this.bass = pas.audio.MusicPlayer.AddInstrument(pas.audiostuff.TSample.$create("Create$2",[2200,44100,new Float32Array(pas.Resources.TResources.GetArrayBuffer("\/ld50\/samples\/bass.raw")),false]));
      this.bass.DefaultADSR.Attack = 0.005;
      this.bass.DefaultADSR.Decay = 0.005;
      this.bass.DefaultADSR.Sustain = 0.2;
      this.bass.DefaultADSR.Release = 0.3;
      this.gameLayer = this.AddPlane(0,true);
      this.prepLayer = this.AddPlane(1,true);
      this.postLayer = this.AddPlane(1,false);
      this.charLbl = pas.guictrls.TGUILabel.$create("Create$2");
      this.charLbl.SetSize(72);
      this.charLbl.fWidth = this.Canvas.width;
      this.charLbl.fHeight = this.Canvas.height;
      this.charLbl.fHAlign = 2;
      this.charLbl.fVAlign = 1;
      this.charLbl.fCaption = "test";
      this.AddElement(this.charLbl,this.gameLayer);
      this.targetLbl = pas.guictrls.TGUILabel.$create("Create$2");
      this.targetLbl.SetSize(50);
      this.targetLbl.fPosition.Y = Math.round(this.Canvas.height / 10);
      this.targetLbl.fWidth = this.Canvas.width;
      this.targetLbl.fHeight = Math.round(this.Canvas.height / 5);
      this.targetLbl.fHAlign = 1;
      this.targetLbl.fVAlign = 1;
      this.targetLbl.fCaption = "><";
      this.AddElement(this.targetLbl,this.gameLayer);
      this.winsLbl = pas.guictrls.TGUILabel.$create("Create$2");
      this.winsLbl.SetSize(48);
      this.winsLbl.fWidth = Math.round(this.Canvas.width / 3);
      this.winsLbl.fHeight = Math.round(this.Canvas.height / 10);
      this.winsLbl.fHAlign = 0;
      this.winsLbl.fVAlign = 1;
      this.winsLbl.fCaption = "Correct: 0";
      this.infoPnl = pas.guictrls.TGUIPanel.$create("Create$2");
      this.infoPnl.fWidth = this.Canvas.width;
      this.infoPnl.fHeight = Math.round(this.Canvas.height / 10);
      this.infoPnl.fBackGround = "#7bca92";
      this.infoPnl.AddChild(this.winsLbl);
      this.AddElement(this.infoPnl,this.gameLayer);
      this.roundProgress = pas.guictrls.TGUIProgressBar.$create("Create$1");
      this.roundProgress.fPosition.Y = Math.round(this.Canvas.height - (this.Canvas.height / 10));
      this.roundProgress.fWidth = this.Canvas.width;
      this.roundProgress.fHeight = pas.Math.Ceil(this.Canvas.height / 10);
      this.roundProgress.fMin = 0;
      this.roundProgress.fMax = 100;
      this.roundProgress.fValue = 0;
      this.roundProgress.fForeground = "#7bca92";
      this.AddElement(this.roundProgress,this.gameLayer);
      this.prepLbl = pas.guictrls.TGUILabel.$create("Create$2");
      this.prepLbl.SetSize(72);
      this.prepLbl.fWidth = this.Canvas.width;
      this.prepLbl.fHeight = this.Canvas.height;
      this.prepLbl.fHAlign = 1;
      this.prepLbl.fVAlign = 1;
      this.prepLbl.fCaption = "Get ready";
      this.prepLbl2 = pas.guictrls.TGUILabel.$create("Create$2");
      this.prepLbl2.SetSize(72);
      this.prepLbl2.fPosition.Y = Math.round(this.Canvas.height - (this.Canvas.height / 10));
      this.prepLbl2.fWidth = this.Canvas.width;
      this.prepLbl2.fHeight = pas.Math.Ceil(this.Canvas.height / 10);
      this.prepLbl2.fHAlign = 1;
      this.prepLbl2.fVAlign = 1;
      this.prepLbl2.fCaption = "0.000";
      this.prepPnl = pas.guictrls.TGUIPanel.$create("Create$2");
      this.prepPnl.fWidth = this.Canvas.width;
      this.prepPnl.fHeight = this.Canvas.height;
      this.prepPnl.AddChild(this.prepLbl);
      this.prepPnl.AddChild(this.prepLbl2);
      this.AddElement(this.prepPnl,this.prepLayer);
      this.AddElement(this.prepLbl2,this.gameLayer);
      this.statusLbl = pas.guictrls.TGUILabel.$create("Create$2");
      this.statusLbl.SetSize(72);
      this.statusLbl.fWidth = this.Canvas.width;
      this.statusLbl.fHeight = this.Canvas.height;
      this.statusLbl.fHAlign = 1;
      this.statusLbl.fVAlign = 1;
      this.statusLbl.fCaption = "Words: 0";
      this.AddElement(this.statusLbl,this.postLayer);
      for (i = 0; i <= 2; i++) {
        this.instructionLbl[i] = pas.guictrls.TGUILabel.$create("Create$2");
        this.instructionLbl[i].SetSize(50);
        this.instructionLbl[i].fPosition.Y = (i + 7) * (this.Canvas.height / 10);
        this.instructionLbl[i].fWidth = this.Canvas.width;
        this.instructionLbl[i].fHeight = rtl.trunc(this.Canvas.height / 10);
        this.instructionLbl[i].fHAlign = 1;
        this.instructionLbl[i].fVAlign = 1;
        this.instructionLbl[i].fCaption = instructionCaptions[i];
        this.AddElement(this.instructionLbl[i],this.postLayer);
      };
      this.rnd.State = 1;
    };
    this.Update = function (ATimeMS) {
      var target = "";
      pas.GameBase.TGameBase.Update.call(this,ATimeMS);
      this.lastTime = ATimeMS;
      var $tmp = this.rnd.State;
      if ($tmp === 1) {
        target = document.getElementsByName("run_word").item(0).value;
        this.StartRound(target,ATimeMS,3,20);
      } else if ($tmp === 2) {
        this.prepLbl2.fCaption = pas.SysUtils.Format("%4.3f",[(this.rnd.StartTime - ATimeMS) / 1000]);
        if (ATimeMS >= this.rnd.StartTime) {
          this.rnd.State = 3;
          this.prepLayer.Visible = false;
          this.gameLayer.Visible = true;
          this.postLayer.Visible = false;
        };
      } else if ($tmp === 3) {
        this.roundProgress.fValue = ATimeMS;
        this.prepLbl2.fCaption = pas.SysUtils.Format("Remaining: %4.3f",[(this.rnd.StopTime - ATimeMS) / 1000]);
        if (ATimeMS >= this.rnd.StopTime) {
          this.EndRound();
          this.rnd.State = 4;
          this.prepLayer.Visible = false;
          this.gameLayer.Visible = false;
          this.postLayer.Visible = true;
        };
      };
    };
    this.Render = function () {
      pas.GameBase.TGameBase.Render.call(this);
    };
    this.AfterResize = function () {
      var i = 0;
      if (this.charLbl != null) {
        this.charLbl.fWidth = this.Canvas.width;
        this.charLbl.fHeight = this.Canvas.height;
        this.targetLbl.fPosition.Y = Math.round(this.Canvas.height / 10);
        this.targetLbl.fWidth = this.Canvas.width;
        this.targetLbl.fHeight = Math.round(this.Canvas.height / 5);
        this.winsLbl.fWidth = Math.round(this.Canvas.width / 3);
        this.winsLbl.fHeight = Math.round(this.Canvas.height / 10);
        this.infoPnl.fWidth = this.Canvas.width;
        this.infoPnl.fHeight = Math.round(this.Canvas.height / 10);
        this.roundProgress.fPosition.Y = this.Canvas.height - (this.Canvas.height / 10);
        this.roundProgress.fWidth = this.Canvas.width;
        this.roundProgress.fHeight = pas.Math.Ceil(this.Canvas.height / 10);
        this.prepLbl.fWidth = this.Canvas.width;
        this.prepLbl.fHeight = this.Canvas.height;
        this.prepLbl2.fPosition.Y = this.Canvas.height - (this.Canvas.height / 10);
        this.prepLbl2.fWidth = this.Canvas.width;
        this.prepLbl2.fHeight = pas.Math.Ceil(this.Canvas.height / 10);
        this.prepPnl.fWidth = this.Canvas.width;
        this.prepPnl.fHeight = this.Canvas.height;
        this.statusLbl.fWidth = this.Canvas.width;
        this.statusLbl.fHeight = this.Canvas.height;
        for (i = 0; i <= 2; i++) {
          this.instructionLbl[i].fPosition.Y = (i + 7) * (this.Canvas.height / 10);
          this.instructionLbl[i].fWidth = this.Canvas.width;
          this.instructionLbl[i].fHeight = rtl.trunc(this.Canvas.height / 10);
        };
      };
    };
    this.DoKeyPress = function (AKeyCode) {
      var s = "";
      var ch = "";
      var i = 0;
      if (this.rnd.State === 3) {
        if (AKeyCode.length !== 1) return;
        ch = pas.SysUtils.LowerCase(AKeyCode);
        s = this.rnd.Buffer + ch;
        this.rnd.InputSequence = this.rnd.InputSequence + ch;
        i = pas.System.Pos(this.rnd.Word,s);
        if (i > 0) {
          pas.System.Delete({get: function () {
              return s;
            }, set: function (v) {
              s = v;
            }},i,this.rnd.Word.length);
          this.AddMatch();
        } else this.AddMiss(ch);
        this.rnd.Buffer = s;
        if (s.length > 50) {
          this.charLbl.fCaption = pas.System.Copy$1(s,s.length - 50)}
         else this.charLbl.fCaption = s;
      } else if (this.rnd.State === 4) {
        var $tmp = AKeyCode;
        if ($tmp === "F5") {
          this.StartRound(this.rnd.Word,this.lastTime,3,20)}
         else if ($tmp === "Enter") {
          this.SubmitScore()}
         else if ($tmp === "Escape") window.location.replace("\/ld50\/index.php");
      };
    };
  });
  $mod.$main = function () {
    $mod.TLD50.$create("Create$1").Run();
  };
});
//# sourceMappingURL=ld50.js.map
