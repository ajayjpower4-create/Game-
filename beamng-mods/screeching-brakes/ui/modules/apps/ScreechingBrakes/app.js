angular.module('beamng.apps')
.directive('screechingBrakes', [function () {
  return {
    templateUrl: '/ui/modules/apps/ScreechingBrakes/app.html',
    replace: true,
    restrict: 'EA',
    scope: true,
    link: function (scope) {
      var LABELS = { car: 'Car screech', truck: 'Truck screech', auto: 'Auto (by weight)', off: 'Off' };

      scope.state = null;
      scope.ui = { volume: 80, sensitivity: 35, allVehicles: false };
      scope.vehicleChoices = [
        { id: 'default', label: 'Default' },
        { id: 'car', label: 'Car' },
        { id: 'truck', label: 'Truck' },
        { id: 'auto', label: 'Auto' },
        { id: 'off', label: 'Off' }
      ];
      scope.defaultChoices = scope.vehicleChoices.slice(1);

      function lua(call) {
        bngApi.engineLua('if screechingBrakes then screechingBrakes.' + call + ' end');
      }
      function str(value) {
        return JSON.stringify(String(value));
      }

      scope.label = function (id) { return LABELS[id] || id; };
      scope.toggle = function () { lua('toggleEnabled()'); };
      scope.setVehicleSound = function (id) { lua('setVehicleSound(' + str(id) + ')'); };
      scope.setDefaultSound = function (id) { lua('setDefaultSound(' + str(id) + ')'); };
      scope.volumeChanged = function () { lua('setVolume(' + (parseFloat(scope.ui.volume) / 100) + ')'); };
      scope.sensitivityChanged = function () { lua('setSensitivity(' + (parseFloat(scope.ui.sensitivity) / 100) + ')'); };
      scope.allChanged = function () { lua('setAllVehicles(' + (scope.ui.allVehicles ? 'true' : 'false') + ')'); };
      scope.test = function (id) { lua('testSound(' + str(id) + ')'); };

      scope.$on('ScreechingBrakesState', function (event, data) {
        scope.$evalAsync(function () {
          scope.state = data;
          scope.ui.volume = Math.round(data.volume * 100);
          scope.ui.sensitivity = Math.round(data.sensitivity * 100);
          scope.ui.allVehicles = !!data.allVehicles;
        });
      });
      scope.$on('VehicleFocusChanged', function () { lua('requestState()'); });
      scope.$on('VehicleChange', function () { lua('requestState()'); });

      lua('requestState()');
    }
  };
}]);
