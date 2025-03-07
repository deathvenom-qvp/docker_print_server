"strict";

var _each = _.each;
var _isArray = _.isArray;
var _isFunction = _.isFunction;
var _isString = _.isString;
var _extend = _.extend;

function noop () {}
var console = window.console || {log: noop, error: noop};

// return true if fn(obj) returns true for every element in obj
var _all = function (obj, fn) {
  for (var i=0, l=obj.length; i<l; i++) {
    if (!fn(obj[i])) {
      return false;
    }
  }
  return true;
};

var removeElementFromArray = function (arr, element) {
  // IE8+ supported only (but this doesn't matter because... WebSocket)
  if (-1 === arr.indexOf(element)) {
    return arr;
  }
  // don't use Array.slice here, element could appear multiple times
  // remove all occurances
  var output = [], i = 0, l = arr.length;
  for ( ; i<l; i++) {
    if (element !== arr[i]) {
      output.push(arr[i]);
    }
  }
  return output;
};

function PN_Error (code, message) {
  if (!PN_Error.CODES[code]) {
    throw "unknown error code '"+code+"'";
  }
  this.code = code;
  this.message = message || PN_Error.CODES[code];
}
PN_Error.prototype.toString = function () {
  return "PrintNode " + this.code + ' exception: ' + this.message;
};
PN_Error.CODES = {
  // quote keys to prevent the minifiers rewriting objects
  "NotSupported": "This feature isn't supported",
  "BadArguments": "Bad arguments passed",
  "Server": "Server error",
  "Socket": "Socket error",
  "RateLimit": "Rate limit error",
  "Internal": "Internal error",
  "RunTime": "RunTime"
};


// a micro hierarchical pubsub implementation
function publify (obj, errorCallback) {
  if (obj.publish || obj.subscribe) {
    throw "publify can't operate on this object there's a collision with existing obj properties";
  }
  // subscriber list
  var subscribers = {};
  // publish
  obj.publish = function publish (topic, payload, publishErrorCallback) {
    publishErrorCallback = publishErrorCallback || errorCallback;
    var hierarchy = publify.topicExplodeHierarchy(topic);
    var subscriptions = publify.getSubscribersFromTopicHierarchy(hierarchy, subscribers);
    // call each subscription
    _each(subscriptions, function(sub) {
      var detail = {
        "subscription": topic,
        "originalSubscription": sub[0],
        "payload": payload,
        "data": sub[1].data
      };

      try {
        sub[1].fn.call(sub[1].context, payload, detail);
      } catch (e) {
        // add in the detail of the error
        detail.exception = e;
        detail.fn = sub[1].fn;
        detail.context = sub[1].context;
        // trip error callback
        publishErrorCallback(
          new PN_Error("RunTime", "Exception thrown in subscription callback - "+e.toString()),
          detail
        );
      }
    });
  };
  // subscribe
  obj.subscribe = function subscribe (topic, fn, options) {
    // allowed to subscribe on a array of strings
    if (_isArray(topic)) {
      if (!_all(topic, _isString)) {
        throw "subscription topic is a array but not a array of strings";
      }
      // IE9+ only
      topic = topic.map(publify.escapeTopicFragment).join('.');
    // string check
    } else if (!_isString(topic)) {
      throw "subscription topic must either be a string or a array of strings";
    }

    if (!_isFunction(fn)) {
      throw "subscription call backs must be functions";
    }
    options = options || {};
    var sub = {
      fn: fn,
      data: options.data || null,
      context: options.context || obj
    };
    if (undefined === subscribers[topic]) {
      subscribers[topic] = [sub];
    } else {
      subscribers[topic].push(sub);
    }
    return this;
  };
  // unsubscribe
  obj.unsubscribe = function unsubscribe (fnOrTopic) {
    var ret = 0;
    if (_isString(fnOrTopic)) {
      if (undefined !== subscribers[fnOrTopic]) {
        ret = subscribers[fnOrTopic].length;
        delete subscribers[fnOrTopic];
      }
    } else if (_isFunction(fnOrTopic)) {
      // Iterate subscriptions and compare subscription funcs. This is
      // a bit of a mess as removing from arrays being iterated is fiddly.
      var topic, current, topicsToRemove = [], numRemoved;
      for (topic in subscribers) {
        current = removeElementFromArray(subscribers[topic]);
        numRemoved = subscribers[topic].length - current.length;
        ret += numRemoved;
        if (0 === current.length) {
          topicsToRemove.push(topic);
        } else if (numRemoved) {
          subscribers[topic] = current;
        }
      }
      // remove empty subscription
      _each(topicsToRemove, function (topic) {
        delete subscribers[topic];
      });
    } else {
      throw "you can only unsubscribe strings or functions";
    }
    return ret;
  };
  return obj.publish;
}
// expode a topic into all it's hierarchical components
publify.topicExplodeHierarchy = function (topic) {
  var output, topicComponents;
  if (_isArray(topic)) {
    if (!_all(topic, _isString)) {
      throw "subscription topic is a array but not a array of strings";
    }
    topicComponents = topic;

  } else if (_isString(topic)) {
    topicComponents = publify.topicExplodeFragments(topic);
  } else {
    throw "you can only publish string or array topics";
  }
  output = [
    publify.escapeTopicFragment(topicComponents[0])
  ];
  for (var i=1, l=topicComponents.length; i<l; i++) {
    output[i] = output[i-1]+'.'+publify.escapeTopicFragment(topicComponents[i]);
  }
  return output;
};
// get all subscribers from a topic list
publify.getSubscribersFromTopicHierarchy = function (hierarchy, subscribers) {
  var output = [];
  _each(hierarchy, function (topic) {
    var subscriptions = subscribers[topic];
    if (!subscriptions) {
      return;
    }
    for (var i=0, l=subscriptions.length; i<l; i++) {
      output.push([topic, subscriptions[i]]);
    }
  });
  return output;
};
// escape a topic fragment
publify.escapeTopicFragment = function (input) {
  return input.replace(/\\/g, '\\\\').replace(/\./g, '\\.');
};
// split a topic into fragments (escaping aware)
publify.topicExplodeFragments = function (input) {
  var output = [''], outputIndex = 0, i=0, l = input.length, escaped = false, current;
  // iterate string and parse
  for (; i<l; i++) {
    current = input.charAt(i);
    // previous char was escaped
    if (escaped) {
      output[outputIndex] += current;
      escaped = false;
    // hit escaped char
    } else if ('\\' === current) {
      escaped = true;
    // separator
    } else if ('.' === current) {
      output[++outputIndex] = '';
    // vanilla char
    } else {
      output[outputIndex] += current;
    }
  }
  // drop trailing escape chars
  return output;
};

function PN_WebSocketMessage (msg) {
  this.cnt = msg['cnt'];
  this.version = msg['version'];
  this.message = msg['message'];
  this.payload = msg['payload'];
}

PN_WebSocketMessage.factory = function (msg) {
  var struct = JSON.parse(msg);
  return new PN_WebSocketMessage(struct);
};

function PN_WebsSocket (connection, client_state) {
  var scheme = connection.scheme || 'wss';
  var hostname = connection.hostname || 'locahost';
  var port = connection.port || 8888;
  var url = [scheme, '://', hostname, ':', port, '/ws/html_interface'].join('');

  var getDuration = (function () {
    var start = Date.now();
    return function () {
      return Date.now() - start;
    };
  })();
  var ws = new WebSocket(url);
  ws.onopen = function() {
    ws.send("Hi.");
    client_state.connected(true, "Connected ...");
  };
  ws.onmessage = function (evt) {
    var msg = PN_WebSocketMessage.factory(evt.data);
    client_state.new_ws_message(msg);
  };
  ws.onerror = function (evt) {
    console.error("Client WS error evt after %ss", evt, getDuration()/1000);
  };
  ws.onclose = function (evt) {
    var msg = (
      "Connection to client lost after "+
      Math.floor(getDuration()/10)/100 +
      "s. Attempting to reconnect."
    );
    client_state.connected(false, msg);
  };
}

function failHandler(err) {
  console.error("Publify error", err);
}

function ClientState () {
  this._setInitialState();
  publify(this, failHandler);
}
ClientState.prototype._setInitialState = function () {
  this.account = {};
  this.connection = {};
  this.gui_logs = [];
  this.printer_active_default = null;
  this.printer_multiprocess_printing = null;
  this.printers = [];
  this.process_info = {};
  this.proxy = null;
  this.retain_printjobs = null;
  this.system_info = {};
  this.http_config = {};
  this.power_availablity = {dflt: null, available: []};
  this.com_ports = [];
  this.scale_types = {};
  this.serial_scale_ui_state = {
    com_ports: [],
    types: [],
    scales: [],
    log_messages: [],
    scales_enabled: null
  }
};
ClientState.prototype.update_account = function (account) {
  this.account = account;
  this.publish('account', account);
};
ClientState.prototype.update_connection = function (connection) {
  this.connection = connection;
  this.publish('connection', connection);
};
ClientState.prototype.update_http_config = function (http_config) {
  this.http_config = http_config;
  this.publish('http_config', http_config);
};
ClientState.prototype.update_gui_logs = function (gui_logs) {
  this.gui_logs = gui_logs;
  this.publish('gui_logs', gui_logs);
};
ClientState.prototype.log_to_gui = function (gui_log) {
  this.gui_logs.unshift(gui_log);
  this.publish('log_to_gui', gui_log);
};
ClientState.prototype.update_printers = function (printers) {
  this.printers = printers;
  this.publish('printers', printers);
};
ClientState.prototype.update_power_availablity = function (power_availablity) {
  this.power_availablity = power_availablity;
  this.publish('power_availablity', power_availablity);
};
ClientState.prototype.update_proxy = function (proxy) {
  this.proxy = proxy;
  this.publish('proxy', proxy);
};
ClientState.prototype.proxy_checked = function (payload) {
  this.publish('proxy_checked', payload);
};
ClientState.prototype.update_printer_active_default = function (state) {
  this.printer_active_default = state;
  this.publish('printer_active_default', state);
};
ClientState.prototype.update_printer_multiprocess_printing = function (state) {
  this.printer_multiprocess_printing = state;
  this.publish('printer_multiprocess_printing', state);
};
ClientState.prototype.update_retain_printjobs = function (state) {
  this.retain_printjobs = state;
  this.publish('retain_printjobs', state);
};
ClientState.prototype.update_process_info = function (process_info) {
  this.process_info = process_info;
  this.publish('process_info', process_info);
};
ClientState.prototype.update_system_info = function (system_info) {
  this.system_info = system_info;
  this.publish('system_info', system_info);
};
ClientState.prototype.credentials_checked = function (success, request_id, msg) {
  this.publish('credentials_checked', [success, request_id, msg]);
};
ClientState.prototype.update_scales = function (scales) {
  this.publish('scales', scales);
};
ClientState.prototype.update_scales_enabled = function (state) {
  this.publish('scales_enabled', state);
};
ClientState.prototype.update_lock_scales_ui = function (state) {
  this.publish('lock_scales_ui', state);
};
ClientState.prototype.update_serial_scale_ui_state = function (state) {
  this.serial_scale_ui_state = state
  this.publish('serial_scale_ui_state', state);
};
ClientState.prototype.scale = function (action, payload) {
  this.publish(['scale', action], payload);
};
ClientState.prototype.connected = function (connected, errorText) {
  if (connected) {
    this._setInitialState();
  }
  this.publish('websocket', [connected, errorText]);
};
ClientState.prototype.client_exception = function (client_info, err, trace) {
  this.publish('client_exception', [client_info, err, trace]);
};

ClientState.prototype.new_ws_message = function (msg) {
  switch (msg.message) {
    case 'INSTANCE_ID':
      if (instanceId !== msg.payload) {
        window.location.reload();
      }
      break;
    case 'ACCOUNT':
    case 'CONNECTION':
    case 'GUI_LOGS':
    case 'HTTP_CONFIG':
    case 'PRINTER_ACTIVE_DEFAULT':
    case 'PRINTER_MULTIPROCESS_PRINTING':
    case 'PRINTERS':
    case 'PROCESS_INFO':
    case 'PROXY':
    case 'POWER_AVAILABLITY':
    case 'RETAIN_PRINTJOBS':
    case 'SERIAL_SCALE_UI_STATE':
    case 'SCALES':
    case 'LOCK_SCALES_UI':
    case 'SCALES_ENABLED':
    case 'SYSTEM_INFO':
      var method = "update_" + msg.message.toLowerCase();
      this[method](msg.payload);
      break;
    case 'LOG_TO_GUI':
      this.log_to_gui(msg.payload);
      break;
    case 'SCALE':
      this.scale(msg.payload.action, msg.payload.payload);
      break;
    case 'CREDENTIALS_CHECKED':
      this.credentials_checked(msg.payload[0], msg.payload[1], msg.payload[2]);
      break;
    case 'PROXY_CHECKED':
      this.proxy_checked(msg.payload);
      break;
    case 'CLIENT_EXCEPTION':
      this.client_exception(msg.payload[0], msg.payload[1], msg.payload[2]);
      break;
    default:
      console.error("unhandled new_ws_message", msg);
  }
};

function pad(n) {
  return n < 10 ? "0"+n.toString() : n.toString();
}

function format_duration (duration) {

  duration = Math.round(duration);
  var days = Math.floor(duration / 86400);
  duration = duration - days * 86400;
  var hours = Math.floor(duration /  3600);
  duration = duration - hours * 3600;
  var mins = Math.floor(duration / 60);
  var seconds = duration - mins * 60;

  if (days > 0) {
    return days.toString() + 'd ' + pad(hours) + 'h ' + pad(mins) + 'm ' + pad(seconds) + 's';
  } else if (hours > 0) {
    return pad(hours) + 'h ' + pad(mins) + 'm ' + pad(seconds) + 's';
  } else if (mins > 0) {
    return pad(mins) + 'm ' + pad(seconds) + 's';
  } else {
    return pad(seconds) + 's';
  }
}

function makeClockUpdater (elems) {
  var l = elems.length;
  function ago () {
    var now = moment.utc().unix();
    for (var i=0; i<l; i++) {
      if (elems[i].when) {
        elems[i].innerHTML = format_duration(now-elems[i].when);
      }
    }
  }
  return ago;
}

function runApp() {

  // check browser support
  if (!window.WebSocket) {
    alert(
      "Unfortunately this browser doesn't support Websockets which we need to make this interface work. "+
      "Please upgrade or use a supported browser.\n\n"+
      "The supported browsers are\n\n"+
      "   IE >= v10 and Edge\n"+
      "   Chrome >= v16 \n"+
      "   Firefox >= v11 \n"+
      "   Opera >= v12.1\n"+
      "   Safari >= v6\n"
    );
    return;
  }

  var clientState = new ClientState();

  // updating timers
  var runAgo = makeClockUpdater($('.ago').toArray());
  var runAgoInterval = setInterval(runAgo, 1000);

  // programatic tab management
  var activate = (function(scalesEnabled, clientState) {
    // cached store of [tab, content] jquery elements key'd by name
    var pairings = {};
    $('.navbar-nav > li[ref]').each(function activateNavbar() {
      var ref = this.getAttribute('ref');
      pairings[ref] = [
        $(this).on('click', function(e) {
          e.preventDefault();
          innerActivate(ref);
        }),
        $('#'+ref)
      ];
    });
    function innerActivate (what) {
      clientState.publish(["tab_changed", what], what);
      _.forEach(_.keys(pairings), function (key) {
        if (key === what) {
          pairings[key][0].addClass('active');
          pairings[key][1].show();
        } else {
          pairings[key][0].removeClass('active');
          pairings[key][1].hide();
        }
      });
    }
    if (!scalesEnabled) {
      // disable scales nav bar and don't show content
      pairings.scales[0].hide();
      pairings.scales[1].hide();
      delete pairings.scales;
    }
    return innerActivate;
  })(scalesEnabled, clientState);

  function connection_to_string (connection) {
    if ('handshaked' == connection.status) {
      return "Ready";
    } else if ('service_discovery' == connection.status) {
      return "Service discovery";
    } else {
      return connection.status;
    }
  }

  // connection update
  clientState.subscribe('connection', function (connection) {
    var when = moment.utc(connection.when).unix();
    $('.connection').text(connection_to_string(connection));
    $('.connection_uptime').each(function () {this.when = when;});
    runAgo();
  });
  // process, system info
  clientState.subscribe('process_info', function (process_info) {
    // null is a valid process_info response
    if (null === process_info) {
      return;
    }
    $('.pid').text(process_info.pid);
    $('.threads').text(process_info.num_threads);
    $('.memory_usage').text(process_info.rss[1]);
  });
  // system info
  clientState.subscribe('system_info', function (system_info) {
    var when = moment.utc(system_info.client_started).unix();
    $('.system').text(system_info.system);
    $('.hostname').text(system_info.hostname);
    $('.username').text(system_info.username);
    $('.platform').text(system_info.platform);
    $('.started').each(function() { this.when = when;});
    runAgo();
  });

  var local_tz = (function() {
    var date = new Date();
    var offset = date.getTimezoneOffset();
    var sign = offset < 0 ? '+' : '-';
    offset = Math.abs(offset);
    var hours = Math.floor(offset/60);
    var minutes = offset - hours * 60;
    if (minutes) {
      return 'UTC'+sign+pad(hours)+':'+pad(minutes);
    } else {
      return 'UTC'+sign+pad(hours);
    }
  })();
  $('.timezone').text(local_tz);

  function toLocalTime (date) {
    return [
      [date.getFullYear(), pad(date.getMonth()+1), pad(date.getDate())].join('-'),
      ' ',
      [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(':'),
      '.',
      date.getMilliseconds()
    ].join('');
  }

  // logs tab
  (function (clientState) {

    function makeLogsRow (log) {
      var dateWhen = moment.utc(log.when).toDate();
      var when = toLocalTime(dateWhen);

      return $("<tr>").append(
        $("<td class='col-md-3'>").text(when)
      ).append(
        $("<td class='col-md-9'>").text(log.msg)
      );
    }

    // logs update
    clientState.subscribe('gui_logs', function (logs) {
      var $tbody = $('tbody.logs');
      var $parent = $tbody.parent();
      $tbody.empty();
      for (var i=0, l=logs.length; i<l; i++){
        $tbody.append(makeLogsRow(logs[i]));
      }
      $tbody.appendTo($parent);
    });

    // log to gui
    clientState.subscribe('log_to_gui', function (log) {
      var $row = makeLogsRow(log);
      $row.prependTo('tbody.logs');
    });
    // is log submission enabled
    $('.send-to-support').toggle(logSubmissionEnabled);
    $('.send-to-support').on('click', function () {
      $.ajax({url: '/logs/send'});
    });

  })(clientState);

  // printers update
  (function (clientState) {

    $('.printer_media_size_settable').toggle(printerMediaSizeSettable);

    $( "tbody.printers" ).on("change", "input[type='checkbox']", function () {
      var checked = this.checked;
      var name = this.parentNode.parentNode.getAttribute('printer');
      $.ajax({
        url: '/printer/'+encodeURIComponent(name)+'/active',
        type: 'POST',
        data: JSON.stringify(checked),
        error: function (response) {
          console.error("Error updating printer", name, checked, response.responseText);
        }
      });
    });

    $( "tbody.printers" ).on("change", ".page_width, .page_height", function () {
      var row = this.parentNode;
      var printer = row.getAttribute('printer');
      var $width = $(row).find('.page_width input');
      var $height = $(row).find('.page_height input');
      var width = $width.val().trim(), height = $height.val().trim();

      var widthOk = false;
      var heightOk = false;

      var payload;
      // check with and height are valid floats
      // TODO: improve the UI
      if ((0 == width.length || 0 == width) && (0 == height.length || 0 == height)) {
        $width.removeClass('has-error');
        $height.removeClass('has-error');
        payload = {"paper": [null, null]}
      } else {
        var widthOk = !(isNaN(width) || 0 == width.length);
        $width.toggleClass('has-error', !widthOk);
        var heightOk = !(isNaN(height) || 0 == height.length);
        $height.toggleClass('has-error', !heightOk);
        if (!widthOk || !heightOk) {
          return;
        }
        payload = {"paper": [width, height]};
      }
      $.ajax({
        url: '/printer/'+encodeURIComponent(printer)+'/settings',
        type: 'POST',
        data: JSON.stringify(payload),
        error: function (response) {
          console.error("Error updating printer setting", printer, payload, response.responseText);
        }
      });
    });

    var $printerActiveDefault = $('#printers-active-default').on("change", function () {
      $.ajax({
        url: '/printers/active/default',
        type: 'POST',
        data: JSON.stringify(this.checked),
        error: function (response) {
          console.error("Error updating printer active default", response.responseText);
        }
      });
    });
    clientState.subscribe('printer_active_default', function (state) {
      $printerActiveDefault.prop('checked', state);
    });

    var $multiprocessPrinting = $('#multiprocess-printing').on("change", function () {
      $.ajax({
        url: '/printers/parallelprinting',
        type: 'POST',
        data: JSON.stringify(this.checked),
        error: function (response) {
          console.error("Error updating multiprocess printing", response.responseText);
        }
      });
    });
    clientState.subscribe('printer_multiprocess_printing', function (state) {
      $multiprocessPrinting.prop('checked', state);
    });

    var $printerPowerSelect = $('#printer-power-availability').on("change", function () {
      var selected = $(this).val()
      $.ajax({
        url: '/printer/power/availability',
        type: 'POST',
        data: JSON.stringify(selected),
        error: function (response) {
          console.error("Error updating printer power", response.responseText);
        }
      });
    })

    clientState.subscribe('power_availablity', function (power_availablity) {
      var dflt = power_availablity.dflt
      var available = power_availablity.available

      // remove existing options
      $('option', $printerPowerSelect).remove()
      // add new options
      for (var i = 0, item; i < available.length; i++) {
        var item = available[i]
        $printerPowerSelect.append($("<option>").val(item).text(item))
      }
      $printerPowerSelect.val(dflt);
    });

    function makePrinterDimInput (val) {
      return $("<input type='text'/>").val(val);
    }

    function makePrintersRow (printer) {
      var $cb = $("<input type='checkbox'/>").prop('checked', printer.active);
      var $printer = $("<tr>").attr("printer", printer.name).append(
        $("<td>").append($cb)
      ).append(
        $("<td>").text(printer.id)
      ).append(
        $("<td>").text(printer.name)
      ).append(
        $("<td>").text(printer.status)
      );
      // only set printer settings if they exist
      if (printerMediaSizeSettable) {
        var width, height;
        if (printer.settings && printer.settings.paper) {
          width = printer.settings.paper[0];
          height = printer.settings.paper[1];
        }
        $printer.append(
          $("<td class='page_width'>").append(makePrinterDimInput(width))
        ).append(
          $("<td class='page_height'>").append(makePrinterDimInput(height))
        );
      }
      if ('offline' == printer.status.toLowerCase()) {
        $printer.addClass('is_offline');
      }
      if (printer.default) {
        $printer.addClass('is_default');
      }
      return $printer;
    }

    // printers update
    clientState.subscribe('printers', function (printers) {
      var $tbody = $('tbody.printers');
      var $parent = $tbody.parent();
      $tbody.empty();
      for (var i=0, l=printers.length; i<l; i++){
        $tbody.append(makePrintersRow(printers[i]));
      }
      $tbody.appendTo($parent);
    });

  })(clientState);


  // login form
  (function(clientState) {

    // account update
    clientState.subscribe('account', function (account) {
      var $accountRow = $('.row.account');
      var $loginRows = $('.row.login');
      var $tabTitle = $('.navbar a[href="#login"]');
      var $delegatedSignin = $('.delegated-signin');
      var $emailPasswordSignin = $('.email-password-signin');

      var $hasComputerName = $('.has-computer-name')
      var $unknownComputerName = $('.unknown-computer-name')

      if (null === account.client_key) {
        $accountRow.hide();
        // pick which login component to show based on delegated_signin
        if (isDelegatedSignin) {
          $delegatedSignin.show();
        } else {
          $emailPasswordSignin.show();
        }
        $tabTitle.text('Login');
      } else {
        $accountRow.show();
        $loginRows.hide();
        $tabTitle.text('Account');
        // update the account message
        $accountRow.find('.email').text(account.email);
        var hasComputerName = (account.email !== '__UNKNOWN__')
        $unknownComputerName.toggle(!hasComputerName)
        $hasComputerName.toggle(hasComputerName)
      }

      $accountRow.find('.computer').text(account.computer_name);
      $loginRows.find('#login-email').val(account.email);
    });

    $('.logout-action').on('click', function () {
      $.ajax({
        url: '/logout',
        type: 'POST',
        data: JSON.stringify({
          reason: "logout requested via api"
        })
      });
    });

    $('.login-proxy-settings').on('click', function (e) {
      e.preventDefault();
      activate("settings");
    });

    // cached references to form elements
    var $loginForm = $('.login-form');
    var $email = $loginForm.find('#login-email');
    var $emailFormGroup = $email.closest('.form-group');
    var $password = $loginForm.find('#login-password');
    var $passwordFormGroup = $password.closest('.form-group');
    var $submit = $loginForm.find('.login-submit');
    var $loginError = $loginForm.find('.login-error');

    var inFlightRequest = false;

    var updateButtonState = function () {
      var emailOk = true;
      if (0 === $email.val().length) {
        emailOk = false;
      }
      $emailFormGroup.toggleClass('has-error', !emailOk);
      var passwordOk = true;
      if (0 === $password.val().length) {
        passwordOk = false;
      }
      $passwordFormGroup.toggleClass('has-error', !passwordOk);
      var allOk = emailOk && passwordOk && !inFlightRequest;
      $submit.toggleClass('disabled', !allOk);
      return allOk;
    };

    // fixes bug #477. Copy and paste is disabled because eventHandlers
    // don't propagate if false is returned
    var updateButtonStateEventHandler = function () {
      updateButtonState();
      return true;
    };

    var updateInFlightRequest = function (val) {
      inFlightRequest = val;
      updateButtonState();
      $loginError.text('');
    };

    $password.on('change keyup paste click', updateButtonStateEventHandler);
    $email.on('change keyup paste click', updateButtonStateEventHandler);

    $submit.on('click', function (evt) {
      // don't make request if disabled or inflight request
      if (!updateButtonState()) {
        return;
      }

      updateInFlightRequest(true);

      var data = {email: $email.val(), password: $password.val()};
      $.ajax({
        url: '/login',
        type: 'POST',
        data: JSON.stringify(data),
        success: function (loginRequestId) {
          updateInFlightRequest(loginRequestId);
        },
        error: function () {
          updateInFlightRequest(false);
        }
      });
    });

    function authErrorToString (err) {
      var code = err[1];
      if (undefined !== accountSettings[code]) {
        return accountSettings[code];
      } else {
        return code;
      }
    }

    // set initial state
    updateButtonState();
    // update account information
    clientState.subscribe('account', updateButtonState);
    clientState.subscribe(
      'credentials_checked',
      function (response) {
        if (inFlightRequest !== response[1]) {
          return;
        }
        updateInFlightRequest(false);
        if (!response[0]) {
          $loginError.text(authErrorToString(response[2]));
        }
      }
    );
    clientState.subscribe(
      'connection',
      function (response) {
        if (response.status = 'disconnected' && response.reason == 'no more connections allowed') {
          if (undefined !== accountSettings['no_more_connections_allowed']) {
            $loginError.html(accountSettings['no_more_connections_allowed']);
          } else {
            $loginError.html("No more connections allowed.");
          }

        }
      }
    );

  })(clientState);


  // scales
  (function(clientState) {
    var scales = [];

    var $scalesTbody = $('tbody.usb-scales');
    var $scalesTbodyParent = $scalesTbody.parent();

    function getScaleName (scaleEntry) {
      return [scaleEntry.deviceName, ' (vendor: ', scaleEntry.vendorName, ', stream: ', scaleEntry.deviceNum, ')'].join('');
    }

    function makeScalesRow (scaleEntry) {
      var $printer = $("<tr>").append(
        $("<td>").text(getScaleName(scaleEntry))
      ).append(
        $("<td>").text(scaleEntry.guiValue)
      );
      return $printer;
    }

    function render(newRows) {
      $scalesTbody.empty();
      for (var i=0, l=scales.length; i<l; i++){
        $scalesTbody.append(
          makeScalesRow(scales[i]).toggleClass(
            'newRow',
            -1 !== newRows.indexOf(i)
          )
        );
      }
      $scalesTbody.appendTo($scalesTbodyParent);
    }

    function lookupScaleKey(scaleEntry) {
      for (var i=0; i<scales.length; i++) {
        if (scales[i].connectionId === scaleEntry.connectionId) {
          return i;
        }
      }
      return undefined;
    }

    // initial state of scales
    clientState.subscribe('scales', function (new_state) {
      scales = new_state;
      render([]);
    });

    clientState.subscribe('scale.add', function (scale) {
      var key = lookupScaleKey(scale);
      if (undefined !== key) {
        console.error("Scale entry already exists for scale. Unabled to add scale ->", scale);
        return;
      }
      render([scales.push(scale)-1]);
    });
    clientState.subscribe('scale.measurement', function (scale) {
      var key = lookupScaleKey(scale);
      if (undefined === key) {
        console.error("No entry stored entry for scale. Unable to render measurement ->", scale);
        return;
      }
      scales[key] = scale;
      render([key]);
    });
    clientState.subscribe('scale.remove', function (scale) {
      var key = lookupScaleKey(scale);
      if (undefined === key) {
        console.error("No entry stored entry for scale. Unable to remove scale ->", scale);
        return;
      }
      scales.splice(key, 1);
      render([]);
    });
    clientState.subscribe('scale.renamed', function (renamed_scales) {
      var renamed = [];
      _each(renamed_scales, function (scale) {
        var key = lookupScaleKey(scale);
        if (undefined === key) {
          console.error("No entry stored entry for scale. Unable to rename scale ->", scale);
          return;
        }
        renamed.push(key);
        scales[key] = scale;
      });
      render(renamed);
    });

    clientState.subscribe('lock_scales_ui', function (locked) {
      $('.scales-refresh').attr('disabled', locked);
      $('#scales-enabled').attr('disabled', locked);
    });

    $('.scales-refresh').on('click', function () {
      $.ajax({
        url: '/scales/refresh'
      });
    });

    var $scalesEnabled = $('#scales-enabled').on("change", function () {
      $.ajax({
        url: '/scales/enabled',
        type: 'POST',
        data: JSON.stringify(this.checked),
        error: function (response) {
          console.error("Error updating scales active default", response);
        }
      });
    });

    clientState.subscribe('scales_enabled', function (state) {
      $scalesEnabled.prop('checked', state);
    });

  })(clientState);

  function formatScaleMeasurement (scale) {
    // A bit of application specific knowledge here. These aren't the only ways
    // to check the following but they are the simplest.
    //
    // If scale not reading e.g. not ready, crashed, not reported a weight yet
    //   "clientReportedTimestamp" === null
    // If scale reporting negative weight
    //    mass = [null, null]
    // Otherwise scale will have a meaningful measurement
    if (null === scale.clientReportedTimestamp) {
      return '...';
    } else if (null === scale.mass[0] && null === scale.mass[1]) {
      return '-';
    }
    var output = '', key, weight;
    for (key in scale.measurement) {
      weight = scale.measurement[key] / 1000000000;
      output += weight.toString() + key;
    }
    return output;
  }

  (function (clientState) {

    var $addScale = $('.serial-scale-add');
    var $addForm = $('.add-serial-scale');
    var $noComPorts = $('.no-com-ports');
    var $serialScalesLog = $('.serialscaleslog');

    $addScale.on('click', function () {
      var payload = {
        port: $('select.com-port').val(),
        type: $('select.scale-type').val()
      }
      $.ajax({
        url: '/serialscale',
        type: 'POST',
        data: JSON.stringify(payload),
        error: function (response) {
          console.error("%s", response.responseText);
        },
      });
    })

    // mini v-dom for scales table
    var scaleState = clientState.serial_scale_ui_state;
    var comPortsToDisplay = [];

    var h = maquette.h;
    var comPortsProjector = maquette.createProjector();
    var scaleTypesProjector = maquette.createProjector();
    var scaleTableProjector = maquette.createProjector();
    var scaleLogTableProjector = maquette.createProjector();

    function lookupTypeNameFromType (type) {
      var types = scaleState.types;
      for (var i = 0, l = types.length; i < l; i++) {
        if (types[i][2] === type) {
          return types[i][0]
        }
      }
      return type
    }

    function removeScale (port, typ) {
      var payload = {
        port: port,
        type: typ
      };
      $.ajax({
        url: '/serialscale',
        type: 'DELETE',
        data: JSON.stringify(payload),
        error: function (response) {
          console.error("%s", response.responseText);
        },
      });
    }

    function renderSerialScaleTable () {
      // this is going to generate a lot of closures and should ultimate be refactored out

      // build up table rows
      var rows = scaleState.scales.map(function (scale) {
        function _remove (evt) {
          evt.preventDefault()
          removeScale(scale.port, scale.type)
        }

        var measurementText = '...'
        if (scale.last_measurement) {
          measurementText = formatScaleMeasurement(scale.last_measurement)
        }
        return h('tr', {key: scale.port, }, [
          h('td', [scale.port]),
          h('td', [lookupTypeNameFromType(scale.type)]),
          h('td', [measurementText]),
          h('td', [
            h('a.delete',
              {href: '/#', key: scale.port, onclick: _remove},
              ['remove scale']
            )
          ]),
        ])
      })

      // build up table
      return h('table.table.table-condensed', {classes: {"hide": rows.length === 0}}, [
        h('thead', {}, [
          h('tr', [
            h('th', ['Port']),
            h('th', ['Type']),
            h('th.col-md-2', ['Mass']),
            h('th.delete', ['Actions']),
          ])
        ]),
        h('tbody', {}, rows)
      ])
    }

    function renderScaleLogTable () {
      // build up table rows
      var rows = scaleState.log_messages.map(function (log, idx) {
        var dateWhen = moment.utc(log[0]).toDate();
        var when = toLocalTime(dateWhen);
        return h('tr', {key: idx, }, [
          h('td', [when]),
          h('td', [log[1]]),
        ])
      })

      // build up table
      return h('table.table.table-condensed', [
        h('thead', {}, [
          h('tr', [
            h('th.col-md-3', ['Date and Time ' + local_tz]),
            h('th', ['Detail']),
          ])
        ]),
        h('tbody', {}, rows)
      ])
    }

    function renderComPortsDropDown () {
      var options = comPortsToDisplay.map(function (port) {
        return h('option', {value: port, key: port}, [port])
      })
      return h('select.form-control.com-port', options)
    }

    function renderScaleTypes () {
      var options = scaleState.types.map(function (typ) {
        return h('option', {value: typ[2], key: typ[2]}, [typ[0]])
      })
      return h('select.form-control.scale-type', options)
    }

    comPortsProjector.append(
      document.getElementById('comports-projector'),
      renderComPortsDropDown
    );
    scaleTypesProjector.append(
      document.getElementById('scaletype-projector'),
      renderScaleTypes
    );
    scaleTableProjector.append(
      document.getElementById('serialscales-projector'),
      renderSerialScaleTable
    );
    scaleLogTableProjector.append(
      document.getElementById('serialscaleslog-projector'),
      renderScaleLogTable
    );

    clientState.subscribe('serial_scale_ui_state', function (state) {
      // stuff for the vdom
      scaleState = state;  // using the outer variable

      // historical javascript shit
      comPortsToDisplay = _.difference(
        scaleState.com_ports,
        scaleState.scales.map(function (scale) {
          return scale.port
        })
      );

      // update the view
      comPortsProjector.scheduleRender();
      scaleTypesProjector.scheduleRender();
      scaleTableProjector.scheduleRender();
      scaleLogTableProjector.scheduleRender();

      $addForm.toggle(comPortsToDisplay.length > 0 && state.scales_enabled)
      $noComPorts.toggle(scaleState.com_ports.length === 0)
      $serialScalesLog.toggle(scaleState.log_messages.length > 0)
    })

  })(clientState);

  // Settings
  (function(clientState) {

    var currentProxy = null;
    var lastCheckedProxy = false;

    var $proxyType = $('#proxy-type');
    var $proxyHost = $('#proxy-host');
    var $proxyPort = $('#proxy-port');
    var $proxyRequiresAuth = $('#proxy-requires-auth');
    var $proxyUsername = $('#proxy-username');
    var $proxyPassword = $('#proxy-password');
    var $proxyCheck = $('#proxy-check');
    var $proxyCheckMsg = $('#proxy-check-message');
    var $proxyForm = $('.proxy-form').hide();

    function areProxiesSame (p1, p2) {
      return _.isEqual(p1, p2);
    }

    function showHideAuth (show) {
      $proxyPassword.toggleClass('show-auth', show);
      $proxyUsername.toggleClass('show-auth', show);
    }

    function showHideForm (show) {
      $proxyForm.toggle(show);
    }

    var inFlightRequest = false;

    var updateInFlightRequest = function (val) {
      inFlightRequest = val;
      updateButtonState();
      $proxyCheckMsg.text('');
    };

    function updateButtonText () {
      if (areProxiesSame(serialize(), currentProxy)) {
        $proxyCheck.text('Check proxy settings');
      } else {
        $proxyCheck.text('Check and save proxy settings');
      }
    }

    var updateButtonState = function () {
      var errorMsg = '';
      var hostOK = true;
      if (0 === $proxyHost.val().length) {
        hostOK = false;
      }
      $proxyHost.parent().toggleClass('has-error', !hostOK);
      var portOK = true;
      var port = $proxyPort.val();
      if (0 === port.length) {
        portOK = false;
      } else if (parseInt(port, 10).toString() !== port) {
        portOK = false;
        errorMsg = 'Proxy port is not a integer';
      }
      $proxyPort.parent().toggleClass('has-error', !portOK);
      var allOk = portOK && hostOK && !inFlightRequest;
      $proxyCheck.toggleClass('disabled', !allOk);
      updateProxyCheckMessage(errorMsg, !errorMsg);
      updateButtonText();
      return allOk;
    };

    $proxyHost.on('change keyup paste click', updateButtonState);
    $proxyPort.on('change keyup paste click', updateButtonState);

    $proxyType.on('change', function () {
      var val = $proxyType.val();
      showHideForm('null' !== val);
      updateButtonText();
      updateProxyCheckMessage("", true);
      if ('null' === val) {
        $.ajax({
          url: '/proxy',
          type: 'POST',
          data: JSON.stringify(null),
          success: function (proxyCheckId) {
          },
          error: function () {
          }
        });
      }
    });

    function serialize () {
      var proxyType = $proxyType.val(), auth = null;
      if ('null' === proxyType) {
        return null;
      }
      if ($proxyRequiresAuth.get(0).checked) {
        auth = [$proxyUsername.val(), $proxyPassword.val()];
      }
      return {
        type: proxyType,
        address: [$proxyHost.val(), parseInt($proxyPort.val(), 10)],
        auth: auth
      };
    }

    function updateProxyCheckMessage(message, ok, debug_uri) {
      $proxyCheckMsg.text(message);
      if (!ok && debug_uri !== undefined) {
        $proxyCheckMsg.append(
          $('<p class="proxy-more-info">More tech detail available </p>').append(
            $('<a target="_blank">here</a>').attr('href', '/proxy/debug/'+debug_uri)
          ).append('.')
        );
      }
      $proxyCheckMsg.toggleClass('ok', ok);
    }

    function updateProxy (proxy) {
      if (areProxiesSame(lastCheckedProxy, proxy) && !areProxiesSame(currentProxy, proxy)) {
        $proxyCheckMsg.get(0).innerHTML += ' Proxy settings saved.';
        currentProxy = proxy;
        lastCheckedProxy = false;
        updateButtonText();
        return;
      }
      currentProxy = proxy;
      // are we saveing a proxy
      // do nothing if this already matches our UI
      if (areProxiesSame(serialize(), proxy)) {
        return;
      }
      showHideForm(!!proxy);
      if (null === proxy) {
        $proxyType.val('null');
        $proxyHost.val('');
        $proxyPort.val('');
        $proxyRequiresAuth.prop('checked', false);
        $proxyUsername.val('');
        $proxyPassword.val('');
      } else {
        $proxyType.val(proxy.type);
        $proxyHost.val(proxy.address[0]);
        $proxyPort.val(proxy.address[1]);
        $proxyRequiresAuth.prop('checked', !!proxy.auth);
        showHideAuth(!!proxy.auth);
        $proxyUsername.val(proxy.auth ? proxy.auth[0] : "");
        $proxyPassword.val(proxy.auth ? proxy.auth[1] : "");
      }
      updateButtonState();
    }

    clientState.subscribe(['tab_changed', 'settings'], function (what) {
      updateProxy(currentProxy);
      $proxyCheckMsg.text("");
    });

    // account update
    clientState.subscribe('proxy', updateProxy);

    // proxy_checked
    clientState.subscribe(
      'proxy_checked',
      function (response) {
        if (inFlightRequest !== response.request_id) {
          return;
        }
        updateInFlightRequest(false);
        updateProxyCheckMessage(
          response.message,
          response.success,
          response.debug_uri
        );
      }
    );

    $proxyRequiresAuth.on('change', function () {
      showHideAuth(this.checked);
      updateButtonState();
    });

    $proxyCheck.on('click', function (evt) {
      // don't make request if disabled or inflight request
      if (!updateButtonState()) {
        return;
      }
      updateInFlightRequest(true);

      // so we can put the "Proxy saved" message in the UI
      lastCheckedProxy = serialize();

      $.ajax({
        url: '/proxy',
        type: 'POST',
        data: JSON.stringify(lastCheckedProxy),
        success: function (proxyCheckId) {
          updateInFlightRequest(proxyCheckId);
        },
        error: function () {
          updateInFlightRequest(false);
        }
      });
    });

    // set initial state
    updateButtonState();

  })(clientState);

  // back to login screen
  (function (clientState) {
    var $backToLogin = $('.back-to-login');

    clientState.subscribe('account', function (account) {
      $backToLogin.toggle(!account.client_key);
    });

    $backToLogin.find('a').on('click', function (e) {
      e.preventDefault();
      activate("login");
    });
  })(clientState);

  (function (clientState) {

    var $retainPrintJobs = $('input.retain-printjobs').on("change", function () {
      $.ajax({
        url: '/retain/printjobs',
        type: 'POST',
        data: JSON.stringify(this.checked),
        error: function (response) {
          console.error("Error updating printer retain printjobs", response);
        }
      });
    });

    clientState.subscribe('retain_printjobs', function (state) {
      $retainPrintJobs.prop('checked', state);
    });

  })(clientState);

  // ssl verification
  (function (clientState) {

    var $sslVerify = $('input.ssl-verify').on("change", function () {
      $.ajax({
        url: '/httpconfig',
        type: 'POST',
        data: JSON.stringify({ssl_verify:this.checked}),
        error: function (response) {
          console.error("Error updating ssl verification", response);
        }
      });
    });

    // account update
    clientState.subscribe('http_config', function (http_config) {
      $sslVerify.prop('checked', http_config.ssl_verify);
    });

  })(clientState);

  // http engine
  (function (clientState) {

    var $httpEngine = $('select.http-engine').on("change", function () {
      $.ajax({
        url: '/httpconfig',
        type: 'POST',
        data: JSON.stringify({engine: $(this).val()}),
        error: function (response) {
          console.error("Error updating http-engine", response);
        }
      });
    });

    // account update
    clientState.subscribe('http_config', function (http_config) {
      $httpEngine.val(http_config.engine);
    });

  })(clientState);


  // power icon
  (function () {
    if (!allowShutdown) {
      return;
    }
    // enable the power buttons in the client
    function shutdown (e) {
      e.preventDefault();
      var $appContent = $('.app-content');
      var $loadingInterface = $('.loading-interface');
      $.ajax({
        url: '/shutdown',
        type: 'GET',
        success: function (response) {
          $appContent.hide();
          $loadingInterface.text("Client shutting down.").show();
        },
        error: function (response) {
          console.error("%s", response.responseText);
        }
      });
    }
    $('.client-shutdown').on('click', shutdown).parent().show();
  }());

  // set login tab
  activate('login');
  // show navbar
  $('.navbar-left').show();

  (function (clientState) {

    function isAlive () {
      $.ajax({
        url: '/ping',
        success: connect,
        error: error
      });
    }

    var wsArgs = {
      scheme: 'http:' === window.location.protocol ? 'ws' : 'wss',
      hostname: window.location.hostname,
      port: window.location.port
    };

    // launch the websocket
    function connect () {
      var ws = new PN_WebsSocket(wsArgs, clientState);
    }
    connect();

    var timeout = 1000;
    function error (err) {
      setTimeout(isAlive, timeout);
      if (timeout < 5000) {
        timeout += 1000;
      }
    }

    var $appContent = $('.app-content');
    var $loadingInterface = $('.loading-interface');
    clientState.subscribe('websocket', function (payload) {
      var connected = payload[0], errorText = payload[1];
      if (connected) {
        timeout = 1000;
        $loadingInterface.hide();
        $appContent.show();
      } else {
        $appContent.hide();
        $loadingInterface.text(errorText).show();
        error();
      }
    });

    clientState.subscribe('client_exception', function (payload) {
      var client_info = payload[0], text = payload[1], trace = payload[2];
      console.error("%s\n%s", client_info.join("\n"), trace);
      var content = [
        "Client v",
        client_info[0],
        " error (",
        text,
        ")\n\n",
        trace,
        "\nAdditional logs available at",
        client_info[2],
        "\n\n",
        "Please contact support@printnode.com with the details above.",
      ].join("");
      $appContent.hide();
      $loadingInterface.addClass('exception').text(content).show();
    });

  })(clientState);

}

$(document).ready(runApp);
