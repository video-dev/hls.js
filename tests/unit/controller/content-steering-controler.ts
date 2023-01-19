import ContentSteeringController from '../../../src/controller/content-steering-controller';

describe('ContentSteeringController', function () {
  describe('HLS.js integration', function () {
    it('resets on MANIFEST_LOADING', function () {});
    it('accepts contentSteering options on MANIFEST_LOADED', function () {});
    it('implements startLoad', function () {});
    it('implements stopLoad', function () {});
    it('implements destroy', function () {});
  });

  describe('Steering Manifest', function () {
    it('loads the steering manifest', function () {});
    it('schedules a refresh', function () {});
    it('updates the pathwayId', function () {});
    it('updates the timeToLoad', function () {});
    it('updates the updated', function () {});
    it('updates the uri', function () {});
    it('emits an error on failure', function () {});
  });

  describe('Pathway grouping', function () {
    it('groups by pathwayId', function () {});
  });
});
