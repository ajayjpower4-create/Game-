/**
 * Belseco DOT Mega Pack - cab console UI app.
 *
 * Polls the vehicle-side console controller for state and sends every button
 * press back through its single `action` / `preset` dispatch, so the app and the
 * keybinds can never disagree about what a control does.
 */
angular.module('beamng.apps')
  .directive('belsecoFleetConsole', ['$interval', function ($interval) {
    return {
      templateUrl: '/ui/modules/apps/belsecoFleetConsole/app.html',
      replace: true,
      restrict: 'EA',
      link: function (scope) {

        var POLL_MS = 120;
        // belsecoState / belsecoAction / belsecoPreset are published into the
        // vehicle Lua VM by the console controller when the upfit is fitted
        var READ = '(function() return belsecoState and belsecoState() or nil end)()';

        scope.connected = false;
        scope.state = null;
        scope.tab = 'lights';

        scope.lightbarLevels = [
          { v: 0, label: 'OFF' },
          { v: 1, label: 'L1' },
          { v: 2, label: 'L2' },
          { v: 3, label: 'L3' }
        ];

        scope.advisorModes = [
          { v: 0, label: 'OFF' },
          { v: 1, label: 'LEFT' },
          { v: 2, label: 'RIGHT' },
          { v: 3, label: 'SPLIT' },
          { v: 4, label: 'WIG' }
        ];

        scope.sirenTones = [
          { v: 0, label: 'OFF' },
          { v: 1, label: 'WAIL' },
          { v: 2, label: 'YELP' },
          { v: 3, label: 'PHASER' },
          { v: 4, label: 'HI-LO' }
        ];

        scope.boardModes = [
          { v: 0, label: 'OFF' },
          { v: 1, label: '4 CNR' },
          { v: 2, label: 'BAR' },
          { v: 3, label: 'LEFT' },
          { v: 4, label: 'RIGHT' },
          { v: 5, label: 'DOUBLE' },
          { v: 6, label: 'FLASH' }
        ];

        scope.presets = [
          { id: 'travel', label: 'TRAVEL' },
          { id: 'responding', label: 'RESPOND' },
          { id: 'onScene', label: 'ON SCENE' },
          { id: 'blockLeft', label: 'BLOCK L' },
          { id: 'blockRight', label: 'BLOCK R' },
          { id: 'shutdown', label: 'SHUTDOWN' }
        ];

        // the arrow board is drawn as a 5x3 lamp grid mirroring the real panel
        scope.lampRows = [
          [1, 2, 3, 4, 5],
          [6, 7, 8, 9, 10],
          [11, 12, 13, 14, 15]
        ];

        function send (lua) {
          bngApi.activeObjectLua(lua);
        }

        function quote (v) {
          if (typeof v === 'string') { return '"' + v + '"'; }
          if (typeof v === 'boolean') { return v ? 'true' : 'false'; }
          return String(v);
        }

        scope.act = function (name, value) {
          var args = quote(name);
          if (value !== undefined) { args += ', ' + quote(value); }
          send('if belsecoAction then belsecoAction(' + args + ') end');
        };

        scope.runPreset = function (id) {
          send('if belsecoPreset then belsecoPreset("' + id + '") end');
        };

        scope.lampOn = function (i) {
          if (!scope.state || !scope.state.arrowboard) { return false; }
          return scope.lamps[i] === 1;
        };

        scope.pct = function (v) {
          return Math.round((v || 0) * 100);
        };

        // arrow board lamps come straight off the vehicle electrics stream so
        // the preview panel blinks in step with the real board
        scope.lamps = {};

        function readLamps () {
          var lua = '(function() local t = {} for i = 1, 15 do' +
                    ' t[i] = electrics.values["belseco_ab_l" .. i] or 0 end return t end)()';
          bngApi.activeObjectLua(lua, function (data) {
            if (data) { scope.lamps = data; }
          });
        }

        function poll () {
          bngApi.activeObjectLua(READ, function (data) {
            scope.connected = !!data;
            scope.state = data || null;
            if (data && data.arrowboard && data.arrowboard.mode > 0) {
              readLamps();
            } else {
              scope.lamps = {};
            }
          });
        }

        var timer = $interval(poll, POLL_MS);
        poll();

        scope.$on('$destroy', function () {
          $interval.cancel(timer);
        });
      }
    };
  }]);
